"""
Supabase Authentication for Railway/Render API.

Validates JWT tokens issued by Supabase Auth.
This replaces the standalone JWT handler in src/security/auth.py
when running behind Supabase.

Supports three access modes:
    1. Authenticated (PRO or DEMO) - Bearer token from Supabase
    2. Demo token - special "demo" token for unauthenticated trial access
    3. Optional auth - returns None for anonymous users

Usage in endpoints:
    @app.get("/api/protected")
    async def protected_route(user: dict = Depends(get_current_user)):
        return {"user_id": user["id"]}

    @app.get("/api/demo-ok")
    async def demo_route(user: dict = Depends(get_current_user_or_demo)):
        plan = get_user_plan(user)  # returns DEMO for demo users
"""

import os
import uuid
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

DEMO_TOKEN = "demo"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate a Supabase JWT token and return user info.

    The token comes from the Lovable frontend via:
        Authorization: Bearer <supabase-access-token>

    We validate it by calling the Supabase Auth API with the
    service role key, which verifies the signature and expiration.

    Returns:
        dict with user info: {id, email, role, ...}

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )

    token = credentials.credentials

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = response.json()

    if not user_data.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_data


async def get_current_user_or_demo(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> dict:
    """
    Accept either a real Supabase token or the special 'demo' token.

    Demo users get a synthetic user dict with plan=demo in metadata.
    This allows endpoints to serve limited responses to trial users
    without requiring Supabase registration.

    Frontend usage:
        // For demo access (no signup required):
        fetch("/api/topografia/process", {
            headers: { "Authorization": "Bearer demo" }
        })
    """
    if credentials is None or credentials.credentials == DEMO_TOKEN:
        return _make_demo_user()

    return await get_current_user(credentials)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[dict]:
    """
    Optional auth - returns user if token is present and valid, None otherwise.

    Use for endpoints that work for both authenticated and anonymous users.
    """
    if credentials is None:
        return None

    if credentials.credentials == DEMO_TOKEN:
        return _make_demo_user()

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def _make_demo_user() -> dict:
    """Create a synthetic demo user dict matching Supabase user structure."""
    return {
        "id": f"demo-{uuid.uuid4().hex[:8]}",
        "email": "demo@hydronetwork.app",
        "role": "authenticated",
        "user_metadata": {
            "plan": "demo",
        },
    }
