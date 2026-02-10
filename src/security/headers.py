"""
Security Headers Module

Generates comprehensive security headers for HTTP responses.

SECURITY: Implements all recommended security headers from:
- OWASP Secure Headers Project
- Mozilla Web Security Guidelines
- Content Security Policy Level 3
"""

from typing import Dict
from .config import get_security_config


class SecurityHeaders:
    """
    Generates security headers for HTTP responses.

    Usage:
        headers = SecurityHeaders()
        response_headers = headers.get_all_headers()
    """

    def __init__(self):
        self.config = get_security_config()

    def get_csp(self) -> str:
        """
        Get Content-Security-Policy header value.

        SECURITY: CSP prevents XSS, clickjacking, and data injection attacks.
        """
        return self.config.get_csp_header()

    def get_hsts(self) -> str:
        """
        Get Strict-Transport-Security header value.

        SECURITY: HSTS enforces HTTPS-only connections.
        """
        return self.config.get_hsts_header()

    def get_x_content_type_options(self) -> str:
        """
        Get X-Content-Type-Options header value.

        SECURITY: Prevents MIME type sniffing attacks.
        """
        return self.config.x_content_type_options

    def get_x_frame_options(self) -> str:
        """
        Get X-Frame-Options header value.

        SECURITY: Prevents clickjacking by controlling framing.
        """
        return self.config.x_frame_options

    def get_x_xss_protection(self) -> str:
        """
        Get X-XSS-Protection header value.

        SECURITY: Legacy XSS protection for older browsers.
        Note: Modern browsers use CSP instead.
        """
        return self.config.x_xss_protection

    def get_referrer_policy(self) -> str:
        """
        Get Referrer-Policy header value.

        SECURITY: Controls referrer information leakage.
        """
        return self.config.referrer_policy

    def get_permissions_policy(self) -> str:
        """
        Get Permissions-Policy header value.

        SECURITY: Restricts browser features (camera, mic, geolocation, etc.)
        """
        return self.config.permissions_policy

    def get_cache_control(self) -> str:
        """
        Get Cache-Control header for sensitive responses.

        SECURITY: Prevents caching of sensitive data.
        """
        return "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"

    def get_pragma(self) -> str:
        """Legacy cache control for HTTP/1.0."""
        return "no-cache"

    def get_expires(self) -> str:
        """Legacy cache expiration."""
        return "0"

    def get_all_headers(self) -> Dict[str, str]:
        """
        Get all security headers as a dictionary.

        Returns:
            Dictionary of header name to header value
        """
        headers = {
            "Content-Security-Policy": self.get_csp(),
            "X-Content-Type-Options": self.get_x_content_type_options(),
            "X-Frame-Options": self.get_x_frame_options(),
            "X-XSS-Protection": self.get_x_xss_protection(),
            "Referrer-Policy": self.get_referrer_policy(),
            "Permissions-Policy": self.get_permissions_policy(),
            "Cache-Control": self.get_cache_control(),
            "Pragma": self.get_pragma(),
            "Expires": self.get_expires(),
            # Additional security headers
            "X-Permitted-Cross-Domain-Policies": "none",
            "X-Download-Options": "noopen",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
        }

        # Add HSTS if enabled
        hsts = self.get_hsts()
        if hsts:
            headers["Strict-Transport-Security"] = hsts

        return headers

    def get_html_meta_tags(self) -> str:
        """
        Get security headers as HTML meta tags for static files.

        SECURITY: Provides security headers even without server control.

        Returns:
            HTML string with meta tags
        """
        return f'''
    <!-- Security Headers -->
    <meta http-equiv="Content-Security-Policy" content="{self.get_csp()}">
    <meta http-equiv="X-Content-Type-Options" content="{self.get_x_content_type_options()}">
    <meta http-equiv="X-Frame-Options" content="{self.get_x_frame_options()}">
    <meta http-equiv="X-XSS-Protection" content="{self.get_x_xss_protection()}">
    <meta name="referrer" content="{self.get_referrer_policy()}">
'''


def get_secure_cookie_options() -> Dict[str, any]:
    """
    Get secure cookie options for session management.

    SECURITY: Implements secure cookie attributes.

    Returns:
        Dictionary of cookie options
    """
    config = get_security_config()

    return {
        "httponly": config.session_cookie_httponly,
        "secure": config.session_cookie_secure,
        "samesite": config.session_cookie_samesite,
        "max_age": config.session_max_age_seconds,
        "path": "/",
        "domain": None,  # Use request domain
    }


# =============================================================================
# HTML Security Header Snippet for Static Files
# =============================================================================

SECURITY_META_TAGS = '''
<!-- HydroNetwork Security Headers -->
<!-- SECURITY: Add these to <head> for static file security -->
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Security Meta Tags -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' https:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
<meta name="referrer" content="strict-origin-when-cross-origin">

<!-- Prevent search engine indexing of sensitive pages -->
<meta name="robots" content="noindex, nofollow">
'''
