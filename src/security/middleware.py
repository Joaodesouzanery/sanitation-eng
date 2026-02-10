"""
Security Middleware Module

Provides middleware for:
- Security headers injection
- Rate limiting
- Request validation
- Audit logging

SECURITY: Implements defense-in-depth approach.
"""

import hashlib
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Set
from dataclasses import dataclass, field
import logging

from .config import get_security_config
from .headers import SecurityHeaders


# Configure audit logger
audit_logger = logging.getLogger("hydronetwork.security.audit")


@dataclass
class RateLimitEntry:
    """Tracks rate limit state for an IP/user."""
    requests: List[float] = field(default_factory=list)
    blocked_until: Optional[float] = None


class SecurityHeadersMiddleware:
    """
    Middleware that adds security headers to all responses.

    SECURITY: Implements comprehensive security headers:
    - Content-Security-Policy
    - Strict-Transport-Security (HSTS)
    - X-Content-Type-Options
    - X-Frame-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy
    """

    def __init__(self, app):
        self.app = app
        self.config = get_security_config()
        self.headers = SecurityHeaders()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))

                # Add security headers
                security_headers = self.headers.get_all_headers()
                for name, value in security_headers.items():
                    if value:  # Only add non-empty headers
                        headers[name.lower().encode()] = value.encode()

                # Add request ID for tracing
                if b"x-request-id" not in headers:
                    import secrets
                    headers[b"x-request-id"] = secrets.token_hex(16).encode()

                message["headers"] = list(headers.items())

            await send(message)

        await self.app(scope, receive, send_with_headers)


class RateLimitMiddleware:
    """
    Rate limiting middleware using sliding window algorithm.

    SECURITY: Prevents brute force and DoS attacks.
    """

    def __init__(self, app):
        self.app = app
        self.config = get_security_config()
        self._rate_limits: Dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)
        self._cleanup_interval = 300  # Clean up every 5 minutes
        self._last_cleanup = time.time()

    def _get_client_ip(self, scope) -> str:
        """Extract client IP from request, handling proxies."""
        headers = dict(scope.get("headers", []))

        # Check X-Forwarded-For (from reverse proxy)
        forwarded = headers.get(b"x-forwarded-for", b"").decode()
        if forwarded:
            # Take the first (original client) IP
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP
        real_ip = headers.get(b"x-real-ip", b"").decode()
        if real_ip:
            return real_ip

        # Fall back to direct client
        client = scope.get("client")
        if client:
            return client[0]

        return "unknown"

    def _cleanup_old_entries(self):
        """Remove expired rate limit entries."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        window = 3600  # 1 hour window
        expired_keys = []

        for key, entry in self._rate_limits.items():
            # Remove old requests
            entry.requests = [t for t in entry.requests if now - t < window]
            # Remove entries with no recent requests
            if not entry.requests and (not entry.blocked_until or entry.blocked_until < now):
                expired_keys.append(key)

        for key in expired_keys:
            del self._rate_limits[key]

        self._last_cleanup = now

    def _is_rate_limited(self, client_id: str) -> tuple:
        """
        Check if client is rate limited.

        Returns:
            (is_limited, retry_after_seconds)
        """
        now = time.time()
        entry = self._rate_limits[client_id]

        # Check if currently blocked
        if entry.blocked_until and entry.blocked_until > now:
            return True, int(entry.blocked_until - now)

        # Clean old requests outside window
        minute_ago = now - 60
        hour_ago = now - 3600
        entry.requests = [t for t in entry.requests if t > hour_ago]

        # Count requests in windows
        requests_last_minute = sum(1 for t in entry.requests if t > minute_ago)
        requests_last_hour = len(entry.requests)

        # Check limits
        if requests_last_minute >= self.config.rate_limit_requests_per_minute:
            # Block for 1 minute
            entry.blocked_until = now + 60
            return True, 60

        if requests_last_hour >= self.config.rate_limit_requests_per_hour:
            # Block for 10 minutes
            entry.blocked_until = now + 600
            return True, 600

        # Record this request
        entry.requests.append(now)
        return False, 0

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if not self.config.rate_limit_enabled:
            await self.app(scope, receive, send)
            return

        # Periodic cleanup
        self._cleanup_old_entries()

        client_ip = self._get_client_ip(scope)
        is_limited, retry_after = self._is_rate_limited(client_ip)

        if is_limited:
            # Return 429 Too Many Requests
            response = {
                "error": "Too many requests",
                "message": "Rate limit exceeded. Please try again later.",
                "retry_after": retry_after,
            }

            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"retry-after", str(retry_after).encode()),
                    (b"x-ratelimit-limit", str(self.config.rate_limit_requests_per_minute).encode()),
                    (b"x-ratelimit-remaining", b"0"),
                    (b"x-ratelimit-reset", str(int(time.time() + retry_after)).encode()),
                ],
            })
            await send({
                "type": "http.response.body",
                "body": json.dumps(response).encode(),
            })
            return

        await self.app(scope, receive, send)


class RequestValidationMiddleware:
    """
    Validates incoming requests for security issues.

    SECURITY: Blocks malicious requests before they reach handlers.
    """

    def __init__(self, app):
        self.app = app
        self.config = get_security_config()

        # Suspicious patterns to block
        self._blocked_patterns = [
            b"<script",
            b"javascript:",
            b"data:text/html",
            b"onerror=",
            b"onload=",
            b"eval(",
            b"expression(",
            b"../",  # Path traversal
            b"..\\",
            b"cmd.exe",
            b"/etc/passwd",
            b"UNION SELECT",
            b"SELECT * FROM",
            b"DROP TABLE",
            b"INSERT INTO",
            b"DELETE FROM",
            b"; --",
            b"' OR '1'='1",
            b"\" OR \"1\"=\"1",
        ]

    def _contains_suspicious_pattern(self, data: bytes) -> bool:
        """Check if data contains suspicious patterns."""
        data_lower = data.lower()
        return any(pattern.lower() in data_lower for pattern in self._blocked_patterns)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Check path for suspicious patterns
        path = scope.get("path", "").encode()
        if self._contains_suspicious_pattern(path):
            await self._send_blocked_response(send, "Suspicious path detected")
            return

        # Check query string
        query = scope.get("query_string", b"")
        if self._contains_suspicious_pattern(query):
            await self._send_blocked_response(send, "Suspicious query parameters detected")
            return

        # Check headers
        headers = dict(scope.get("headers", []))
        for name, value in headers.items():
            if self._contains_suspicious_pattern(value):
                await self._send_blocked_response(send, "Suspicious header detected")
                return

        # Check content length
        content_length = headers.get(b"content-length", b"0")
        try:
            size = int(content_length)
            max_size = self.config.max_request_size_mb * 1024 * 1024
            if size > max_size:
                await self._send_blocked_response(
                    send,
                    f"Request body too large. Maximum: {self.config.max_request_size_mb}MB"
                )
                return
        except ValueError:
            pass

        await self.app(scope, receive, send)

    async def _send_blocked_response(self, send, message: str):
        """Send a 400 Bad Request response."""
        response = {
            "error": "Bad Request",
            "message": message,
        }

        await send({
            "type": "http.response.start",
            "status": 400,
            "headers": [(b"content-type", b"application/json")],
        })
        await send({
            "type": "http.response.body",
            "body": json.dumps(response).encode(),
        })


class AuditLogMiddleware:
    """
    Logs security-relevant events for audit trail.

    SECURITY: Provides forensic evidence for security incidents.
    """

    def __init__(self, app):
        self.app = app
        self.config = get_security_config()
        self._sensitive_fields = set(self.config.audit_log_sensitive_fields)

    def _get_client_info(self, scope) -> dict:
        """Extract client information from request."""
        headers = dict(scope.get("headers", []))
        client = scope.get("client", ("unknown", 0))

        # Get IP (handling proxies)
        forwarded = headers.get(b"x-forwarded-for", b"").decode()
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = client[0]

        return {
            "ip": ip,
            "port": client[1] if len(client) > 1 else 0,
            "user_agent": headers.get(b"user-agent", b"").decode(),
            "referer": headers.get(b"referer", b"").decode(),
        }

    def _sanitize_data(self, data: dict) -> dict:
        """Remove sensitive fields from data before logging."""
        sanitized = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in self._sensitive_fields):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            else:
                sanitized[key] = value
        return sanitized

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if not self.config.audit_log_enabled:
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        request_id = hashlib.sha256(
            f"{time.time()}{scope.get('client', '')}".encode()
        ).hexdigest()[:16]

        # Capture response status
        response_status = [0]

        async def send_with_audit(message):
            if message["type"] == "http.response.start":
                response_status[0] = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_with_audit)
        finally:
            # Log the request
            duration = time.time() - start_time
            client_info = self._get_client_info(scope)

            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": request_id,
                "method": scope.get("method", ""),
                "path": scope.get("path", ""),
                "query": scope.get("query_string", b"").decode(),
                "status": response_status[0],
                "duration_ms": round(duration * 1000, 2),
                "client": client_info,
            }

            # Log security-relevant events
            if response_status[0] >= 400:
                audit_logger.warning(f"Request failed: {json.dumps(log_entry)}")
            elif response_status[0] == 401 or response_status[0] == 403:
                audit_logger.warning(f"Auth failure: {json.dumps(log_entry)}")
            else:
                audit_logger.info(f"Request: {json.dumps(log_entry)}")


def apply_all_security_middleware(app):
    """
    Apply all security middleware in the correct order.

    Order matters:
    1. AuditLog - Log all requests (outermost)
    2. RateLimit - Block excessive requests
    3. RequestValidation - Block malicious requests
    4. SecurityHeaders - Add security headers to responses (innermost)
    """
    app = SecurityHeadersMiddleware(app)
    app = RequestValidationMiddleware(app)
    app = RateLimitMiddleware(app)
    app = AuditLogMiddleware(app)
    return app
