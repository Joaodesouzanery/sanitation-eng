"""
Demo / Trial Plan Management.

Controls feature access and usage limits based on user plan (demo vs pro).
Demo users can test core functionality with restricted limits,
encouraging upgrade to the full (pro) plan.

Usage in endpoints:
    from api.demo import get_user_plan, enforce_limit, PlanTier

    @app.post("/api/topografia/process")
    async def process_topografia(request, user=Depends(get_current_user)):
        plan = get_user_plan(user)
        enforce_limit(plan, "topografia_max_pontos", len(request.pontos))
        ...
"""

from enum import Enum
from typing import Any, Optional

from fastapi import HTTPException, status


class PlanTier(str, Enum):
    """User subscription tiers."""
    DEMO = "demo"
    PRO = "pro"


# =============================================================================
# Plan Limits Configuration
# =============================================================================

PLAN_LIMITS: dict[str, dict[str, Any]] = {
    PlanTier.DEMO: {
        # Topografia
        "topografia_max_pontos": 10,

        # Orcamento
        "orcamento_max_trechos": 5,
        "orcamento_mostra_custo_total": False,  # Only per-section cost

        # Planejamento
        "planejamento_max_trechos": 5,
        "planejamento_curva_s": False,

        # GIS Export
        "gis_export_shapefile": False,
        "gis_export_geopackage": False,
        "gis_export_geojson": True,  # GeoJSON preview only
        "gis_export_max_features": 10,

        # Maps & Coordinates (available - good for demos)
        "gis_transform": True,
        "gis_map": True,

        # Peer Review
        "peer_review": False,

        # General
        "watermark": True,  # Add "DEMO" watermark to responses
    },
    PlanTier.PRO: {
        "topografia_max_pontos": None,  # Unlimited
        "orcamento_max_trechos": None,
        "orcamento_mostra_custo_total": True,
        "planejamento_max_trechos": None,
        "planejamento_curva_s": True,
        "gis_export_shapefile": True,
        "gis_export_geopackage": True,
        "gis_export_geojson": True,
        "gis_export_max_features": None,
        "gis_transform": True,
        "gis_map": True,
        "peer_review": True,
        "watermark": False,
    },
}

# Human-readable limit descriptions for the /api/demo/limits endpoint
LIMIT_DESCRIPTIONS: dict[str, str] = {
    "topografia_max_pontos": "Pontos topograficos por processamento",
    "orcamento_max_trechos": "Trechos por calculo de orcamento",
    "orcamento_mostra_custo_total": "Exibir custo total consolidado",
    "planejamento_max_trechos": "Trechos por planejamento",
    "planejamento_curva_s": "Curva S (Earned Value)",
    "gis_export_shapefile": "Exportar Shapefile",
    "gis_export_geopackage": "Exportar GeoPackage",
    "gis_export_geojson": "Exportar GeoJSON",
    "gis_export_max_features": "Features por exportacao GIS",
    "gis_transform": "Transformacao de coordenadas",
    "gis_map": "Mapa interativo",
    "peer_review": "Revisao por pares (Peer Review)",
    "watermark": "Marca d'agua DEMO nas respostas",
}


def get_user_plan(user: Optional[dict]) -> PlanTier:
    """
    Determine the user's plan tier from their Supabase user data.

    The plan is stored in user_metadata.plan. Defaults to DEMO
    if not set, so new users automatically start with the trial.

    To upgrade a user, set their metadata in Supabase:
        supabase.auth.admin.update_user(uid, {"user_metadata": {"plan": "pro"}})
    """
    if user is None:
        return PlanTier.DEMO

    metadata = user.get("user_metadata", {}) or {}
    plan_value = metadata.get("plan", PlanTier.DEMO)

    try:
        return PlanTier(plan_value)
    except ValueError:
        return PlanTier.DEMO


def get_limit(plan: PlanTier, key: str) -> Any:
    """Get a specific limit value for the given plan."""
    return PLAN_LIMITS[plan].get(key)


def enforce_limit(plan: PlanTier, key: str, current_value: int) -> None:
    """
    Enforce a numeric limit. Raises HTTP 403 if the limit is exceeded.

    Args:
        plan: The user's current plan tier.
        key: The limit key from PLAN_LIMITS.
        current_value: The current count to check against the limit.

    Raises:
        HTTPException 403 with upgrade message if limit exceeded.
    """
    limit = get_limit(plan, key)

    if limit is None:
        return  # Unlimited

    if current_value > limit:
        description = LIMIT_DESCRIPTIONS.get(key, key)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "demo_limit_exceeded",
                "message": (
                    f"Limite do plano DEMO atingido: {description}. "
                    f"Maximo permitido: {limit}, recebido: {current_value}. "
                    f"Faca upgrade para o plano PRO para uso ilimitado."
                ),
                "limit_key": key,
                "limit_value": limit,
                "current_value": current_value,
                "upgrade_required": True,
            },
        )


def enforce_feature(plan: PlanTier, key: str) -> None:
    """
    Enforce a boolean feature gate. Raises HTTP 403 if feature is disabled.

    Args:
        plan: The user's current plan tier.
        key: The feature key from PLAN_LIMITS.

    Raises:
        HTTPException 403 with upgrade message if feature is disabled.
    """
    allowed = get_limit(plan, key)

    if allowed is False:
        description = LIMIT_DESCRIPTIONS.get(key, key)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "demo_feature_blocked",
                "message": (
                    f"Funcionalidade nao disponivel no plano DEMO: {description}. "
                    f"Faca upgrade para o plano PRO para desbloquear."
                ),
                "feature_key": key,
                "upgrade_required": True,
            },
        )


def add_demo_watermark(response: dict, plan: PlanTier) -> dict:
    """
    Add a demo watermark to API responses if the user is on the demo plan.

    This adds a top-level `_demo` field to JSON responses so the frontend
    can display a visible indicator.
    """
    if get_limit(plan, "watermark"):
        response["_demo"] = {
            "is_demo": True,
            "message": "Voce esta usando o plano DEMO com funcionalidades limitadas.",
            "upgrade_url": "/upgrade",
        }
    return response


def get_plan_comparison() -> dict:
    """
    Return a comparison of DEMO vs PRO limits for display.

    Useful for the frontend upgrade/pricing page.
    """
    comparison = []
    for key, description in LIMIT_DESCRIPTIONS.items():
        demo_val = PLAN_LIMITS[PlanTier.DEMO].get(key)
        pro_val = PLAN_LIMITS[PlanTier.PRO].get(key)

        # Format for display
        def format_val(v: Any) -> str:
            if v is None:
                return "Ilimitado"
            if isinstance(v, bool):
                return "Sim" if v else "Nao"
            return str(v)

        comparison.append({
            "feature": description,
            "key": key,
            "demo": format_val(demo_val),
            "pro": format_val(pro_val),
        })

    return {
        "plans": {
            "demo": {"name": "DEMO", "price": "Gratis"},
            "pro": {"name": "PRO", "price": "Consulte"},
        },
        "comparison": comparison,
    }
