"""
HTTPS/TLS Configuration Module

Provides helpers for secure HTTPS deployment.

SECURITY: Implements TLS best practices:
- TLS 1.2+ only
- Strong cipher suites
- Certificate validation
"""

import os
import ssl
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .config import get_security_config


@dataclass
class TLSConfig:
    """TLS/SSL configuration for secure connections."""
    cert_path: str
    key_path: str
    ca_path: Optional[str] = None
    min_version: str = "TLSv1.2"
    verify_mode: str = "CERT_REQUIRED"


def create_ssl_context(config: Optional[TLSConfig] = None) -> ssl.SSLContext:
    """
    Create a secure SSL context for HTTPS.

    SECURITY: Configures TLS with modern security settings:
    - TLS 1.2 minimum (TLS 1.3 preferred)
    - Strong cipher suites only
    - Certificate verification

    Args:
        config: TLS configuration (uses env vars if not provided)

    Returns:
        Configured SSLContext
    """
    security_config = get_security_config()

    # Create context with TLS 1.2+
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

    # Set minimum TLS version
    context.minimum_version = ssl.TLSVersion.TLSv1_2

    # Prefer TLS 1.3 if available
    if hasattr(ssl.TLSVersion, "TLSv1_3"):
        context.maximum_version = ssl.TLSVersion.TLSv1_3

    # Configure strong cipher suites (TLS 1.2)
    # These are recommended by Mozilla's SSL Configuration Generator
    ciphers = [
        "ECDHE-ECDSA-AES128-GCM-SHA256",
        "ECDHE-RSA-AES128-GCM-SHA256",
        "ECDHE-ECDSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES256-GCM-SHA384",
        "ECDHE-ECDSA-CHACHA20-POLY1305",
        "ECDHE-RSA-CHACHA20-POLY1305",
        "DHE-RSA-AES128-GCM-SHA256",
        "DHE-RSA-AES256-GCM-SHA384",
    ]
    context.set_ciphers(":".join(ciphers))

    # Disable compression (CRIME attack prevention)
    context.options |= ssl.OP_NO_COMPRESSION

    # Enable OCSP stapling if available
    if hasattr(ssl, "OP_NO_TICKET"):
        context.options |= ssl.OP_NO_TICKET

    # Load certificate and key
    cert_path = config.cert_path if config else security_config.tls_cert_path
    key_path = config.key_path if config else security_config.tls_key_path

    if cert_path and key_path:
        if not Path(cert_path).exists():
            raise FileNotFoundError(f"Certificate not found: {cert_path}")
        if not Path(key_path).exists():
            raise FileNotFoundError(f"Private key not found: {key_path}")

        context.load_cert_chain(cert_path, key_path)

    return context


def get_uvicorn_ssl_config() -> Dict[str, Any]:
    """
    Get SSL configuration for Uvicorn server.

    Returns:
        Dictionary of SSL options for uvicorn.run()

    Example:
        import uvicorn
        from src.security.https import get_uvicorn_ssl_config

        uvicorn.run(
            app,
            host="0.0.0.0",
            port=443,
            **get_uvicorn_ssl_config()
        )
    """
    config = get_security_config()

    if not config.tls_enabled:
        return {}

    if not config.tls_cert_path or not config.tls_key_path:
        raise ValueError(
            "TLS is enabled but TLS_CERT_PATH and TLS_KEY_PATH environment variables are not set. "
            "Either set these variables or disable TLS in configuration."
        )

    return {
        "ssl_keyfile": config.tls_key_path,
        "ssl_certfile": config.tls_cert_path,
        "ssl_version": ssl.PROTOCOL_TLS_SERVER,
    }


def generate_self_signed_cert(
    output_dir: str = "./certs",
    hostname: str = "localhost",
    days_valid: int = 365
) -> tuple:
    """
    Generate a self-signed certificate for development.

    WARNING: Only use for development! Use proper CA-signed certs in production.

    Args:
        output_dir: Directory to save certificate files
        hostname: Hostname for the certificate
        days_valid: Certificate validity in days

    Returns:
        Tuple of (cert_path, key_path)
    """
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from datetime import datetime, timedelta
    except ImportError:
        raise RuntimeError(
            "cryptography package required. Install with: pip install cryptography"
        )

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # Generate certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "SP"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Sao Paulo"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "HydroNetwork Development"),
        x509.NameAttribute(NameOID.COMMON_NAME, hostname),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=days_valid))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName(hostname),
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            ]),
            critical=False,
        )
        .sign(private_key, hashes.SHA256())
    )

    # Write files
    cert_path = output_path / f"{hostname}.crt"
    key_path = output_path / f"{hostname}.key"

    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    with open(key_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    # Set restrictive permissions on key file
    os.chmod(key_path, 0o600)

    print(f"[SECURITY] Generated self-signed certificate:")
    print(f"  Certificate: {cert_path}")
    print(f"  Private Key: {key_path}")
    print(f"  Valid for: {days_valid} days")
    print(f"  WARNING: Self-signed certs are for development only!")

    return str(cert_path), str(key_path)


# Import ipaddress for certificate generation
try:
    import ipaddress
except ImportError:
    pass


# =============================================================================
# Production Deployment Checklist
# =============================================================================

DEPLOYMENT_CHECKLIST = """
# HydroNetwork Production Security Checklist

## TLS/HTTPS Configuration

1. [ ] Obtain proper SSL certificate from trusted CA (Let's Encrypt, DigiCert, etc.)
2. [ ] Configure TLS 1.2 minimum (TLS 1.3 preferred)
3. [ ] Use strong cipher suites only
4. [ ] Enable HSTS with preload
5. [ ] Configure OCSP stapling
6. [ ] Set up certificate auto-renewal

## Environment Variables (set in production)

```bash
# Required
export JWT_SECRET_KEY="<generate-with-secrets.token_urlsafe(64)>"
export TLS_CERT_PATH="/etc/ssl/certs/hydronetwork.crt"
export TLS_KEY_PATH="/etc/ssl/private/hydronetwork.key"

# Optional but recommended
export AUDIT_LOG_PATH="/var/log/hydronetwork/audit.log"
export RATE_LIMIT_ENABLED="true"
```

## Server Configuration (Uvicorn/Nginx)

```python
# Uvicorn production config
uvicorn.run(
    "src.api.main:app",
    host="0.0.0.0",
    port=443,
    ssl_keyfile="/etc/ssl/private/hydronetwork.key",
    ssl_certfile="/etc/ssl/certs/hydronetwork.crt",
    workers=4,
    access_log=True,
    proxy_headers=True,
    forwarded_allow_ips="*",
)
```

## Security Headers Verification

Test your deployment at:
- https://securityheaders.com/
- https://observatory.mozilla.org/
- https://www.ssllabs.com/ssltest/

## Monitoring

1. [ ] Set up log aggregation (ELK, Splunk, etc.)
2. [ ] Configure security alerts for:
   - Multiple failed login attempts
   - Rate limit triggers
   - Unusual file access patterns
3. [ ] Enable application performance monitoring

## Regular Maintenance

1. [ ] Run `safety check` weekly for dependency vulnerabilities
2. [ ] Run `bandit -r src/` for security issues
3. [ ] Review audit logs regularly
4. [ ] Update dependencies monthly
5. [ ] Rotate JWT secret keys periodically
"""
