"""
Security Configuration Module

Centralized security configuration with environment-based settings.
All sensitive values should be loaded from environment variables.

SECURITY: Never hardcode secrets in this file.
"""

import os
import secrets
from dataclasses import dataclass, field
from typing import List, Optional, Set
from functools import lru_cache


@dataclass(frozen=True)
class SecurityConfig:
    """
    Immutable security configuration.

    All values are loaded from environment variables with secure defaults.
    """

    # ==========================================================================
    # JWT Configuration
    # ==========================================================================
    jwt_secret_key: str = field(default_factory=lambda: os.environ.get(
        "JWT_SECRET_KEY",
        secrets.token_urlsafe(64)  # Generate secure random key if not provided
    ))
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    jwt_issuer: str = "hydronetwork"
    jwt_audience: str = "hydronetwork-api"

    # ==========================================================================
    # Password Policy
    # ==========================================================================
    password_min_length: int = 12
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_digit: bool = True
    password_require_special: bool = True
    password_hash_rounds: int = 12  # bcrypt cost factor

    # ==========================================================================
    # Rate Limiting
    # ==========================================================================
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 60
    rate_limit_requests_per_hour: int = 1000
    rate_limit_burst_size: int = 10
    rate_limit_by_ip: bool = True

    # ==========================================================================
    # CORS Configuration
    # ==========================================================================
    cors_enabled: bool = True
    cors_allow_origins: tuple = ("https://localhost", "https://127.0.0.1")
    cors_allow_methods: tuple = ("GET", "POST", "PUT", "DELETE", "OPTIONS")
    cors_allow_headers: tuple = ("Authorization", "Content-Type", "X-Request-ID")
    cors_allow_credentials: bool = True
    cors_max_age: int = 86400  # 24 hours

    # ==========================================================================
    # Content Security Policy (CSP)
    # ==========================================================================
    csp_default_src: str = "'self'"
    csp_script_src: str = "'self' 'wasm-unsafe-eval'"
    csp_style_src: str = "'self' 'unsafe-inline'"  # Required for some UI frameworks
    csp_img_src: str = "'self' data: blob:"
    csp_font_src: str = "'self'"
    csp_connect_src: str = "'self'"
    csp_frame_ancestors: str = "'none'"
    csp_form_action: str = "'self'"
    csp_base_uri: str = "'self'"
    csp_object_src: str = "'none'"
    csp_upgrade_insecure_requests: bool = True

    # ==========================================================================
    # Security Headers
    # ==========================================================================
    hsts_enabled: bool = True
    hsts_max_age: int = 31536000  # 1 year
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True

    x_content_type_options: str = "nosniff"
    x_frame_options: str = "DENY"
    x_xss_protection: str = "1; mode=block"
    referrer_policy: str = "strict-origin-when-cross-origin"
    permissions_policy: str = (
        "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), "
        "camera=(), cross-origin-isolated=(), display-capture=(), "
        "document-domain=(), encrypted-media=(), execution-while-not-rendered=(), "
        "execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), "
        "gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), "
        "navigation-override=(), payment=(), picture-in-picture=(), "
        "publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), "
        "usb=(), web-share=(), xr-spatial-tracking=()"
    )

    # ==========================================================================
    # File Upload Security
    # ==========================================================================
    max_upload_size_mb: int = 50
    allowed_file_extensions: tuple = (
        ".dxf", ".dwg", ".geojson", ".json", ".shp", ".gpkg",
        ".xlsx", ".xls", ".csv", ".txt"
    )
    allowed_mime_types: tuple = (
        "application/dxf", "application/acad", "application/x-dxf",
        "application/geo+json", "application/json",
        "application/x-shapefile", "application/geopackage+sqlite3",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel", "text/csv", "text/plain"
    )
    scan_uploads_for_malware: bool = True

    # ==========================================================================
    # Session Configuration
    # ==========================================================================
    session_cookie_name: str = "hydronetwork_session"
    session_cookie_secure: bool = True  # HTTPS only
    session_cookie_httponly: bool = True  # No JavaScript access
    session_cookie_samesite: str = "Strict"
    session_max_age_seconds: int = 3600  # 1 hour
    session_regenerate_on_login: bool = True

    # ==========================================================================
    # HTTPS/TLS Configuration
    # ==========================================================================
    tls_enabled: bool = True
    tls_min_version: str = "TLSv1.2"
    tls_cert_path: Optional[str] = field(default_factory=lambda: os.environ.get("TLS_CERT_PATH"))
    tls_key_path: Optional[str] = field(default_factory=lambda: os.environ.get("TLS_KEY_PATH"))

    # ==========================================================================
    # Audit Logging
    # ==========================================================================
    audit_log_enabled: bool = True
    audit_log_path: str = "/var/log/hydronetwork/audit.log"
    audit_log_sensitive_fields: tuple = (
        "password", "token", "secret", "key", "credential", "auth"
    )

    # ==========================================================================
    # IP Security
    # ==========================================================================
    ip_whitelist_enabled: bool = False
    ip_whitelist: tuple = ()
    ip_blacklist_enabled: bool = True
    ip_blacklist: tuple = ()
    block_private_ips: bool = False  # For internal networks

    # ==========================================================================
    # Request Validation
    # ==========================================================================
    max_request_size_mb: int = 10
    max_json_depth: int = 10
    max_query_params: int = 50
    max_header_size_kb: int = 8
    request_timeout_seconds: int = 30

    def get_csp_header(self) -> str:
        """Generate complete Content-Security-Policy header value."""
        directives = [
            f"default-src {self.csp_default_src}",
            f"script-src {self.csp_script_src}",
            f"style-src {self.csp_style_src}",
            f"img-src {self.csp_img_src}",
            f"font-src {self.csp_font_src}",
            f"connect-src {self.csp_connect_src}",
            f"frame-ancestors {self.csp_frame_ancestors}",
            f"form-action {self.csp_form_action}",
            f"base-uri {self.csp_base_uri}",
            f"object-src {self.csp_object_src}",
        ]

        if self.csp_upgrade_insecure_requests:
            directives.append("upgrade-insecure-requests")

        return "; ".join(directives)

    def get_hsts_header(self) -> str:
        """Generate Strict-Transport-Security header value."""
        if not self.hsts_enabled:
            return ""

        value = f"max-age={self.hsts_max_age}"
        if self.hsts_include_subdomains:
            value += "; includeSubDomains"
        if self.hsts_preload:
            value += "; preload"

        return value


@lru_cache(maxsize=1)
def get_security_config() -> SecurityConfig:
    """
    Get the singleton security configuration.

    Uses environment variables for sensitive values.
    Cached for performance.
    """
    return SecurityConfig()


# =============================================================================
# Environment Variable Template
# =============================================================================
ENV_TEMPLATE = """
# HydroNetwork Security Configuration
# Copy this to .env and customize for your environment
# NEVER commit .env to version control!

# JWT Configuration (REQUIRED - Generate secure random values)
JWT_SECRET_KEY=your-super-secret-jwt-key-min-64-chars-use-secrets-token-urlsafe

# TLS Configuration (REQUIRED for production)
TLS_CERT_PATH=/etc/ssl/certs/hydronetwork.crt
TLS_KEY_PATH=/etc/ssl/private/hydronetwork.key

# Database (if using external database)
DATABASE_URL=postgresql://user:password@localhost:5432/hydronetwork

# Rate Limiting (optional)
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Audit Logging
AUDIT_LOG_PATH=/var/log/hydronetwork/audit.log
"""
