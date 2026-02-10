"""
Authentication and Authorization Module

Provides:
- JWT token generation and validation
- Password hashing with bcrypt
- User authentication helpers
- Role-based access control

SECURITY: Uses industry-standard cryptographic practices.
"""

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from dataclasses import dataclass
from enum import Enum

# JWT handling
try:
    from jose import JWTError, jwt
    JOSE_AVAILABLE = True
except ImportError:
    JOSE_AVAILABLE = False
    jwt = None
    JWTError = Exception

# Password hashing
try:
    from passlib.context import CryptContext
    PASSLIB_AVAILABLE = True
except ImportError:
    PASSLIB_AVAILABLE = False
    CryptContext = None

from .config import get_security_config


class UserRole(str, Enum):
    """User roles for authorization."""
    ADMIN = "admin"
    ENGINEER = "engineer"
    VIEWER = "viewer"
    GUEST = "guest"


class Permission(str, Enum):
    """Fine-grained permissions."""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"
    EXPORT = "export"
    IMPORT = "import"


# Role to permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, set] = {
    UserRole.ADMIN: {Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN, Permission.EXPORT, Permission.IMPORT},
    UserRole.ENGINEER: {Permission.READ, Permission.WRITE, Permission.EXPORT, Permission.IMPORT},
    UserRole.VIEWER: {Permission.READ, Permission.EXPORT},
    UserRole.GUEST: {Permission.READ},
}


@dataclass
class TokenPayload:
    """JWT token payload structure."""
    sub: str  # Subject (user ID)
    exp: datetime  # Expiration
    iat: datetime  # Issued at
    jti: str  # JWT ID (for revocation)
    role: UserRole
    permissions: set


@dataclass
class User:
    """Authenticated user representation."""
    id: str
    username: str
    email: str
    role: UserRole
    permissions: set
    is_active: bool = True


class PasswordHasher:
    """
    Secure password hashing using bcrypt.

    SECURITY: Uses adaptive hashing with configurable cost factor.
    """

    def __init__(self):
        if not PASSLIB_AVAILABLE:
            raise RuntimeError(
                "passlib not installed. Run: pip install passlib[bcrypt]"
            )

        config = get_security_config()
        self._context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__rounds=config.password_hash_rounds,
        )
        self._config = config

    def hash(self, password: str) -> str:
        """Hash a password securely."""
        self._validate_password_strength(password)
        return self._context.hash(password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return self._context.verify(plain_password, hashed_password)

    def needs_rehash(self, hashed_password: str) -> bool:
        """Check if password hash needs to be upgraded."""
        return self._context.needs_update(hashed_password)

    def _validate_password_strength(self, password: str) -> None:
        """
        Validate password meets security requirements.

        SECURITY: Enforces strong password policy.
        """
        config = self._config
        errors = []

        if len(password) < config.password_min_length:
            errors.append(f"Password must be at least {config.password_min_length} characters")

        if config.password_require_uppercase and not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")

        if config.password_require_lowercase and not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")

        if config.password_require_digit and not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")

        if config.password_require_special and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character")

        # Check for common weak passwords
        weak_passwords = {
            "password", "123456", "qwerty", "admin", "letmein",
            "welcome", "monkey", "dragon", "master", "login"
        }
        if password.lower() in weak_passwords:
            errors.append("Password is too common")

        if errors:
            raise ValueError("; ".join(errors))


class JWTHandler:
    """
    JWT token generation and validation.

    SECURITY: Implements secure JWT practices:
    - Short-lived access tokens
    - Unique token IDs for revocation
    - Strict validation
    """

    def __init__(self):
        if not JOSE_AVAILABLE:
            raise RuntimeError(
                "python-jose not installed. Run: pip install python-jose[cryptography]"
            )

        self._config = get_security_config()
        self._revoked_tokens: set = set()  # In production, use Redis or database

    def create_access_token(
        self,
        subject: str,
        role: UserRole = UserRole.GUEST,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a new JWT access token.

        Args:
            subject: User identifier
            role: User role for authorization
            additional_claims: Extra claims to include

        Returns:
            Encoded JWT token
        """
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self._config.jwt_access_token_expire_minutes)

        payload = {
            "sub": subject,
            "exp": expire,
            "iat": now,
            "jti": secrets.token_urlsafe(32),  # Unique token ID
            "iss": self._config.jwt_issuer,
            "aud": self._config.jwt_audience,
            "role": role.value,
            "permissions": list(ROLE_PERMISSIONS.get(role, set())),
        }

        if additional_claims:
            # Prevent overwriting critical claims
            safe_claims = {
                k: v for k, v in additional_claims.items()
                if k not in ("sub", "exp", "iat", "jti", "iss", "aud")
            }
            payload.update(safe_claims)

        return jwt.encode(
            payload,
            self._config.jwt_secret_key,
            algorithm=self._config.jwt_algorithm
        )

    def create_refresh_token(self, subject: str) -> str:
        """Create a long-lived refresh token."""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=self._config.jwt_refresh_token_expire_days)

        payload = {
            "sub": subject,
            "exp": expire,
            "iat": now,
            "jti": secrets.token_urlsafe(32),
            "iss": self._config.jwt_issuer,
            "type": "refresh",
        }

        return jwt.encode(
            payload,
            self._config.jwt_secret_key,
            algorithm=self._config.jwt_algorithm
        )

    def verify_token(self, token: str) -> Optional[TokenPayload]:
        """
        Verify and decode a JWT token.

        SECURITY: Performs strict validation:
        - Signature verification
        - Expiration check
        - Issuer/audience validation
        - Revocation check

        Returns:
            TokenPayload if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                self._config.jwt_secret_key,
                algorithms=[self._config.jwt_algorithm],
                issuer=self._config.jwt_issuer,
                audience=self._config.jwt_audience,
            )

            # Check if token is revoked
            jti = payload.get("jti")
            if jti and jti in self._revoked_tokens:
                return None

            return TokenPayload(
                sub=payload["sub"],
                exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
                iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc),
                jti=payload.get("jti", ""),
                role=UserRole(payload.get("role", "guest")),
                permissions=set(payload.get("permissions", [])),
            )

        except JWTError:
            return None

    def revoke_token(self, jti: str) -> None:
        """
        Revoke a token by its ID.

        SECURITY: In production, store revoked tokens in Redis with TTL.
        """
        self._revoked_tokens.add(jti)

    def is_token_revoked(self, jti: str) -> bool:
        """Check if a token has been revoked."""
        return jti in self._revoked_tokens


class AuthenticationManager:
    """
    High-level authentication manager.

    Combines password hashing, JWT handling, and user management.
    """

    def __init__(self):
        self.password_hasher = PasswordHasher()
        self.jwt_handler = JWTHandler()
        self._users: Dict[str, Dict] = {}  # In production, use database

    def register_user(
        self,
        username: str,
        email: str,
        password: str,
        role: UserRole = UserRole.VIEWER
    ) -> User:
        """
        Register a new user.

        SECURITY: Validates email format and password strength.
        """
        # Validate email format
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, email):
            raise ValueError("Invalid email format")

        # Validate username
        if not re.match(r"^[a-zA-Z0-9_]{3,32}$", username):
            raise ValueError("Username must be 3-32 alphanumeric characters or underscores")

        # Check if user exists
        if username in self._users:
            raise ValueError("Username already exists")

        # Hash password (validates strength internally)
        password_hash = self.password_hasher.hash(password)

        user_id = secrets.token_urlsafe(16)
        user_data = {
            "id": user_id,
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "role": role,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._users[username] = user_data

        return User(
            id=user_id,
            username=username,
            email=email,
            role=role,
            permissions=ROLE_PERMISSIONS.get(role, set()),
            is_active=True,
        )

    def authenticate(self, username: str, password: str) -> Optional[str]:
        """
        Authenticate user and return access token.

        Returns:
            JWT access token if authentication succeeds, None otherwise
        """
        user_data = self._users.get(username)
        if not user_data:
            # Constant-time comparison to prevent timing attacks
            self.password_hasher.verify(password, "$2b$12$dummy.hash.for.timing.attack.prevention")
            return None

        if not user_data.get("is_active"):
            return None

        if not self.password_hasher.verify(password, user_data["password_hash"]):
            return None

        # Check if password needs rehash
        if self.password_hasher.needs_rehash(user_data["password_hash"]):
            user_data["password_hash"] = self.password_hasher.hash(password)

        return self.jwt_handler.create_access_token(
            subject=user_data["id"],
            role=user_data["role"],
        )

    def logout(self, token: str) -> None:
        """Logout by revoking the token."""
        payload = self.jwt_handler.verify_token(token)
        if payload:
            self.jwt_handler.revoke_token(payload.jti)


# =============================================================================
# Convenience functions for FastAPI integration
# =============================================================================

_auth_manager: Optional[AuthenticationManager] = None


def get_auth_manager() -> AuthenticationManager:
    """Get singleton authentication manager."""
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = AuthenticationManager()
    return _auth_manager


def create_access_token(subject: str, role: UserRole = UserRole.GUEST) -> str:
    """Create an access token for a user."""
    return get_auth_manager().jwt_handler.create_access_token(subject, role)


def verify_token(token: str) -> Optional[TokenPayload]:
    """Verify a JWT token."""
    return get_auth_manager().jwt_handler.verify_token(token)


def get_current_user(token: str) -> Optional[User]:
    """
    Get the current user from a token.

    For use in FastAPI dependency injection.
    """
    payload = verify_token(token)
    if not payload:
        return None

    return User(
        id=payload.sub,
        username="",  # Would be fetched from database
        email="",
        role=payload.role,
        permissions=payload.permissions,
        is_active=True,
    )
