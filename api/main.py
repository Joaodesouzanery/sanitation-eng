"""
HydroNetwork Engine API

FastAPI server for sanitation engineering calculations.
Deployed on Railway/Render, called by Lovable frontend.
Authenticates via Supabase JWT tokens.
"""

import os
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.auth import get_current_user, get_optional_user

app = FastAPI(
    title="HydroNetwork Engine API",
    description="Motor de calculos para engenharia de saneamento",
    version="2.0.0",
)

# CORS - Allow Lovable frontend and local development
allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# =============================================================================
# Pydantic Models
# =============================================================================


class PontoTopografico(BaseModel):
    id: str
    x: float
    y: float
    cota: float
    descricao: Optional[str] = None


class TrechoInput(BaseModel):
    id: str
    ponto_inicial: PontoTopografico
    ponto_final: PontoTopografico
    comprimento: float
    declividade: float
    tipo: str = "gravidade"
    diametro_mm: int = 150
    material: str = "PVC"


class ProcessTopografiaRequest(BaseModel):
    pontos: List[PontoTopografico]
    auto_trechos: bool = True


class OrcamentoRequest(BaseModel):
    trechos: List[TrechoInput]
    base_custos_id: Optional[str] = None


class PlanejamentoRequest(BaseModel):
    trechos: List[TrechoInput]
    metros_por_dia: float = Field(default=50, gt=0)
    data_inicio: str
    equipes: List[dict] = []


class ExportGISRequest(BaseModel):
    projeto_id: str
    formato: str = "shapefile"
    crs: str = "EPSG:31983"


# =============================================================================
# Health Check (public, no auth required)
# =============================================================================


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway/Render."""
    return {"status": "healthy", "version": "2.0.0"}


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "HydroNetwork Engine API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# =============================================================================
# Topografia Endpoints
# =============================================================================


@app.post("/api/topografia/process")
async def process_topografia(
    request: ProcessTopografiaRequest,
    user: dict = Depends(get_current_user),
):
    """
    Process topographic points and generate network sections.

    Receives a list of survey points, calculates distances,
    slopes, and automatically creates trechos (pipe sections).
    """
    pontos = request.pontos

    if len(pontos) < 2:
        raise HTTPException(
            status_code=400,
            detail="Minimo 2 pontos topograficos necessarios",
        )

    trechos = []
    if request.auto_trechos:
        for i in range(len(pontos) - 1):
            p1 = pontos[i]
            p2 = pontos[i + 1]

            dx = p2.x - p1.x
            dy = p2.y - p1.y
            comprimento = (dx**2 + dy**2) ** 0.5
            desnivel = p1.cota - p2.cota
            declividade = (desnivel / comprimento) * 100 if comprimento > 0 else 0

            trechos.append({
                "id": f"T{i+1}",
                "ponto_inicial": p1.model_dump(),
                "ponto_final": p2.model_dump(),
                "comprimento": round(comprimento, 4),
                "declividade": round(declividade, 6),
                "tipo": "gravidade" if declividade > 0 else "elevatoria",
                "diametro_mm": 150,
                "material": "PVC",
            })

    extensao_total = sum(t["comprimento"] for t in trechos)
    cotas = [p.cota for p in pontos]

    estatisticas = {
        "total_pontos": len(pontos),
        "total_trechos": len(trechos),
        "extensao_total_m": round(extensao_total, 2),
        "cota_max": max(cotas),
        "cota_min": min(cotas),
        "desnivel_total": round(max(cotas) - min(cotas), 4),
    }

    return {
        "pontos": [p.model_dump() for p in pontos],
        "trechos": trechos,
        "estatisticas": estatisticas,
    }


# =============================================================================
# Orcamento Endpoints
# =============================================================================


@app.post("/api/orcamento/calculate")
async def calculate_orcamento(
    request: OrcamentoRequest,
    user: dict = Depends(get_current_user),
):
    """
    Calculate budget based on network sections.

    Uses cost tables (SINAPI/SICRO) to estimate excavation,
    pipe installation, manholes, and backfill costs.
    """
    resultados = []
    custo_total = 0

    for trecho in request.trechos:
        comp = trecho.comprimento
        prof_media = 1.5  # Default average depth

        # Excavation cost
        volume_escavacao = comp * 0.8 * prof_media  # width 0.8m
        custo_escavacao = volume_escavacao * 45.0  # R$/m3

        # Pipe cost
        custo_tubo_m = 35.0 if trecho.diametro_mm == 150 else 55.0
        custo_tubulacao = comp * custo_tubo_m

        # Backfill cost
        custo_reaterro = volume_escavacao * 25.0  # R$/m3

        # Manhole cost (1 per section)
        custo_poco = 2500.0

        custo_trecho = custo_escavacao + custo_tubulacao + custo_reaterro + custo_poco
        custo_total += custo_trecho

        resultados.append({
            "trecho_id": trecho.id,
            "comprimento": comp,
            "itens": {
                "escavacao": {"volume_m3": round(volume_escavacao, 2), "custo": round(custo_escavacao, 2)},
                "tubulacao": {"metros": comp, "custo": round(custo_tubulacao, 2)},
                "reaterro": {"volume_m3": round(volume_escavacao, 2), "custo": round(custo_reaterro, 2)},
                "poco_visita": {"quantidade": 1, "custo": custo_poco},
            },
            "custo_total": round(custo_trecho, 2),
        })

    return {
        "trechos": resultados,
        "custo_total": round(custo_total, 2),
        "custo_por_metro": round(custo_total / sum(t.comprimento for t in request.trechos), 2) if request.trechos else 0,
        "resumo": {
            "extensao_total_m": round(sum(t.comprimento for t in request.trechos), 2),
            "total_trechos": len(request.trechos),
        },
    }


# =============================================================================
# Planejamento Endpoints
# =============================================================================


@app.post("/api/planejamento/generate")
async def generate_planejamento(
    request: PlanejamentoRequest,
    user: dict = Depends(get_current_user),
):
    """
    Generate construction schedule with Same-Day Completion Rule.

    Groups pipe sections into daily work packages, ensuring no
    open trench is left overnight (safety requirement).
    """
    if not request.trechos:
        raise HTTPException(status_code=400, detail="Nenhum trecho fornecido")

    metros_por_dia = request.metros_por_dia
    dias = []
    dia_atual = 1
    metros_acumulados = 0
    trechos_do_dia = []
    metros_do_dia = 0

    for trecho in request.trechos:
        comp = trecho.comprimento

        # Same-Day Rule: if adding this section exceeds daily capacity
        # but has already started, finish it today
        if metros_do_dia + comp <= metros_por_dia or len(trechos_do_dia) == 0:
            trechos_do_dia.append(trecho.id)
            metros_do_dia += comp
        else:
            # Close current day
            dias.append({
                "dia": dia_atual,
                "trechos": trechos_do_dia,
                "metros_planejados": round(metros_do_dia, 2),
                "metros_acumulados": round(metros_acumulados + metros_do_dia, 2),
            })
            metros_acumulados += metros_do_dia

            # Start new day
            dia_atual += 1
            trechos_do_dia = [trecho.id]
            metros_do_dia = comp

    # Close last day
    if trechos_do_dia:
        dias.append({
            "dia": dia_atual,
            "trechos": trechos_do_dia,
            "metros_planejados": round(metros_do_dia, 2),
            "metros_acumulados": round(metros_acumulados + metros_do_dia, 2),
        })
        metros_acumulados += metros_do_dia

    extensao_total = sum(t.comprimento for t in request.trechos)

    # Curva S data
    curva_s = []
    for dia in dias:
        percentual = (dia["metros_acumulados"] / extensao_total * 100) if extensao_total > 0 else 0
        curva_s.append({
            "dia": dia["dia"],
            "percentual_acumulado": round(percentual, 2),
        })

    return {
        "dias": dias,
        "total_dias": dia_atual,
        "extensao_total_m": round(extensao_total, 2),
        "metros_por_dia_real": round(extensao_total / dia_atual, 2) if dia_atual > 0 else 0,
        "curva_s": curva_s,
    }


# =============================================================================
# GIS Export Endpoints
# =============================================================================


@app.post("/api/gis/export/shapefile")
async def export_shapefile(
    request: ExportGISRequest,
    user: dict = Depends(get_current_user),
):
    """
    Export project to Shapefile format.

    Generates 11 standard layers for sanitation networks.
    Returns download URL from Supabase Storage.
    """
    # Placeholder - will integrate with src/gis/exporters/shp.py
    return {
        "status": "pending_implementation",
        "formato": "shapefile",
        "projeto_id": request.projeto_id,
        "crs": request.crs,
        "message": "Exportacao de Shapefile sera implementada com integracao GIS completa",
    }


@app.post("/api/gis/export/geopackage")
async def export_geopackage(
    request: ExportGISRequest,
    user: dict = Depends(get_current_user),
):
    """
    Export project to GeoPackage format.
    """
    return {
        "status": "pending_implementation",
        "formato": "geopackage",
        "projeto_id": request.projeto_id,
        "crs": request.crs,
        "message": "Exportacao de GeoPackage sera implementada com integracao GIS completa",
    }


# =============================================================================
# Peer Review Endpoint
# =============================================================================


@app.post("/api/peer-review/analyze")
async def analyze_project(
    projeto_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Analyze project against ABNT rules and generate findings.
    """
    return {
        "status": "pending_implementation",
        "projeto_id": projeto_id,
        "message": "Analise de peer review sera implementada com motor de regras ABNT",
    }
