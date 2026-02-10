"""
HydroNetwork Security Module

This module provides comprehensive security features for the HydroNetwork platform:
- JWT-based authentication and authorization
- Rate limiting and request throttling
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Input validation and sanitization
- HTTPS/TLS configuration helpers
- Audit logging

SECURITY LEVEL: MAXIMUM
Last Updated: 2026-02-10
"""

from .config import SecurityConfig, get_security_config
from .auth import (
    AuthenticationManager,
    JWTHandler,
    PasswordHasher,
    create_access_token,
    verify_token,
    get_current_user,
)
from .middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    RequestValidationMiddleware,
    AuditLogMiddleware,
)
from .validators import (
    InputSanitizer,
    FileValidator,
    GeoDataValidator,
)
from .headers import SecurityHeaders

__all__ = [
    # Configuration
    "SecurityConfig",
    "get_security_config",
    # Authentication
    "AuthenticationManager",
    "JWTHandler",
    "PasswordHasher",
    "create_access_token",
    "verify_token",
    "get_current_user",
    # Middleware
    "SecurityHeadersMiddleware",
    "RateLimitMiddleware",
    "RequestValidationMiddleware",
    "AuditLogMiddleware",
    # Validators
    "InputSanitizer",
    "FileValidator",
    "GeoDataValidator",
    # Headers
    "SecurityHeaders",
]
