"""
HydroNetwork Engine API

FastAPI server for sanitation engineering calculations.
Deployed on Railway/Render, called by Lovable frontend.
Authenticates via Supabase JWT tokens.
"""

import os
import io
import json
import zipfile
import tempfile
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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
    layers: List[str] = []  # Empty = all layers


class GISFeature(BaseModel):
    id: str
    geometry_type: str = "Point"  # Point, LineString, Polygon
    coordinates: List[float] = []  # [x, y] for Point, [[x1,y1], [x2,y2]] for LineString
    properties: Dict[str, Any] = {}


class GISLayer(BaseModel):
    name: str
    geometry_type: str = "Point"
    features: List[GISFeature] = []
    crs: str = "EPSG:31983"


class ExportGISDataRequest(BaseModel):
    projeto_id: str
    layers: List[GISLayer]
    formato: str = "shapefile"
    crs: str = "EPSG:31983"


class MapViewRequest(BaseModel):
    pontos: List[PontoTopografico] = []
    trechos: List[TrechoInput] = []
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    zoom: int = 14


class CoordinateTransformRequest(BaseModel):
    coordinates: List[List[float]]  # [[x, y], [x, y], ...]
    source_crs: str = "EPSG:31983"
    target_crs: str = "EPSG:4326"


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


def generate_shapefile_zip(layers: List[dict], crs: str = "EPSG:31983") -> io.BytesIO:
    """
    Generate a ZIP file containing shapefiles for each layer.
    Uses in-memory generation for serverless compatibility.
    """
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for layer in layers:
            layer_name = layer.get("name", "layer")
            geom_type = layer.get("geometry_type", "Point")
            features = layer.get("features", [])

            # Generate simple CSV representation (GIS-compatible)
            csv_content = generate_csv_for_layer(layer_name, features, geom_type)
            zf.writestr(f"{layer_name}.csv", csv_content)

            # Generate GeoJSON (universal format)
            geojson_content = generate_geojson_for_layer(layer_name, features, geom_type, crs)
            zf.writestr(f"{layer_name}.geojson", geojson_content)

            # Generate PRJ file
            prj_content = get_prj_content(crs)
            zf.writestr(f"{layer_name}.prj", prj_content)

        # Add metadata
        metadata = {
            "generator": "HydroNetwork Engine API",
            "version": "2.0.0",
            "crs": crs,
            "layers": [l.get("name") for l in layers],
            "generated_at": datetime.utcnow().isoformat()
        }
        zf.writestr("metadata.json", json.dumps(metadata, indent=2))

    zip_buffer.seek(0)
    return zip_buffer


def generate_csv_for_layer(name: str, features: List[dict], geom_type: str) -> str:
    """Generate CSV content for a layer."""
    if not features:
        return "id,x,y,properties\n"

    lines = []
    # Header
    props_keys = set()
    for f in features:
        props_keys.update(f.get("properties", {}).keys())
    props_keys = sorted(props_keys)

    header = ["id", "x", "y"]
    if geom_type == "LineString":
        header = ["id", "x_start", "y_start", "x_end", "y_end", "wkt"]
    header.extend(props_keys)
    lines.append(";".join(header))

    # Data
    for f in features:
        coords = f.get("coordinates", [])
        props = f.get("properties", {})

        if geom_type == "Point":
            x = coords[0] if len(coords) > 0 else 0
            y = coords[1] if len(coords) > 1 else 0
            row = [str(f.get("id", "")), str(x), str(y)]
        elif geom_type == "LineString":
            if len(coords) >= 2:
                x1, y1 = coords[0] if isinstance(coords[0], list) else (coords[0], coords[1])
                x2, y2 = coords[-1] if isinstance(coords[-1], list) else (coords[-2], coords[-1])
            else:
                x1, y1, x2, y2 = 0, 0, 0, 0
            wkt = f"LINESTRING({' '.join([f'{c[0]} {c[1]}' for c in coords if isinstance(c, list)])})"
            row = [str(f.get("id", "")), str(x1), str(y1), str(x2), str(y2), wkt]
        else:
            row = [str(f.get("id", "")), "0", "0"]

        for key in props_keys:
            row.append(str(props.get(key, "")))

        lines.append(";".join(row))

    return "\n".join(lines)


def generate_geojson_for_layer(name: str, features: List[dict], geom_type: str, crs: str) -> str:
    """Generate GeoJSON content for a layer."""
    geojson_features = []

    for f in features:
        coords = f.get("coordinates", [])
        props = f.get("properties", {})
        props["id"] = f.get("id", "")

        if geom_type == "Point":
            geometry = {
                "type": "Point",
                "coordinates": coords if len(coords) == 2 else [0, 0]
            }
        elif geom_type == "LineString":
            geometry = {
                "type": "LineString",
                "coordinates": coords if coords else [[0, 0], [0, 0]]
            }
        elif geom_type == "Polygon":
            geometry = {
                "type": "Polygon",
                "coordinates": [coords] if coords else [[[0, 0], [0, 0], [0, 0], [0, 0]]]
            }
        else:
            geometry = {"type": "Point", "coordinates": [0, 0]}

        geojson_features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": props
        })

    geojson = {
        "type": "FeatureCollection",
        "name": name,
        "crs": {
            "type": "name",
            "properties": {"name": f"urn:ogc:def:crs:{crs.replace(':', '::')}" }
        },
        "features": geojson_features
    }

    return json.dumps(geojson, indent=2, ensure_ascii=False)


def get_prj_content(crs: str) -> str:
    """Get WKT projection definition."""
    prj_definitions = {
        "EPSG:31983": 'PROJCS["SIRGAS 2000 / UTM zone 23S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-45],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]',
        "EPSG:31982": 'PROJCS["SIRGAS 2000 / UTM zone 22S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-51],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]',
        "EPSG:4326": 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]',
        "EPSG:4674": 'GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
    }
    return prj_definitions.get(crs, prj_definitions["EPSG:31983"])


def utm_to_latlon(x: float, y: float, zone: int = 23, south: bool = True) -> tuple:
    """Convert UTM coordinates to lat/lon (approximate)."""
    # Simplified conversion for display purposes
    # For production, use pyproj
    k0 = 0.9996
    a = 6378137.0  # WGS84 semi-major axis
    e = 0.081819191  # WGS84 eccentricity

    x = x - 500000  # Remove false easting
    if south:
        y = y - 10000000  # Remove false northing for southern hemisphere

    # Approximate conversion
    lon0 = (zone - 1) * 6 - 180 + 3  # Central meridian
    lat = y / 111320  # Approximate degrees
    lon = lon0 + x / (111320 * abs(lat / 90 - 1 + 0.0001))

    return (lat, lon)


def latlon_to_utm(lat: float, lon: float, zone: int = 23) -> tuple:
    """Convert lat/lon to UTM coordinates (approximate)."""
    # Simplified conversion
    x = 500000 + (lon - ((zone - 1) * 6 - 180 + 3)) * 111320 * abs(lat / 90 - 1 + 0.0001)
    y = 10000000 + lat * 111320 if lat < 0 else lat * 111320
    return (x, y)


@app.post("/api/gis/export/shapefile")
async def export_shapefile(
    request: ExportGISDataRequest,
    user: dict = Depends(get_current_user),
):
    """
    Export project data to Shapefile format (as ZIP with GeoJSON + CSV).

    Generates files for each layer with:
    - GeoJSON (universal GIS format)
    - CSV (tabular data)
    - PRJ (projection definition)
    """
    if not request.layers:
        raise HTTPException(status_code=400, detail="Nenhuma camada fornecida")

    try:
        layers_data = []
        for layer in request.layers:
            layer_dict = {
                "name": layer.name,
                "geometry_type": layer.geometry_type,
                "features": [
                    {
                        "id": f.id,
                        "coordinates": f.coordinates,
                        "properties": f.properties
                    }
                    for f in layer.features
                ]
            }
            layers_data.append(layer_dict)

        zip_buffer = generate_shapefile_zip(layers_data, request.crs)

        filename = f"export_{request.projeto_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na exportacao: {str(e)}")


@app.post("/api/gis/export/geojson")
async def export_geojson(
    request: ExportGISDataRequest,
    user: dict = Depends(get_current_user),
):
    """
    Export project data to GeoJSON format.

    Returns a single GeoJSON FeatureCollection with all features.
    """
    if not request.layers:
        raise HTTPException(status_code=400, detail="Nenhuma camada fornecida")

    all_features = []

    for layer in request.layers:
        for f in layer.features:
            coords = f.coordinates

            if layer.geometry_type == "Point":
                geometry = {
                    "type": "Point",
                    "coordinates": coords if len(coords) == 2 else [0, 0]
                }
            elif layer.geometry_type == "LineString":
                geometry = {
                    "type": "LineString",
                    "coordinates": coords if coords else [[0, 0], [0, 0]]
                }
            else:
                geometry = {"type": "Point", "coordinates": [0, 0]}

            properties = {**f.properties, "id": f.id, "layer": layer.name}

            all_features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": properties
            })

    geojson = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": f"urn:ogc:def:crs:{request.crs.replace(':', '::')}" }
        },
        "features": all_features,
        "metadata": {
            "projeto_id": request.projeto_id,
            "generated_at": datetime.utcnow().isoformat(),
            "generator": "HydroNetwork Engine API"
        }
    }

    return geojson


@app.post("/api/gis/export/geopackage")
async def export_geopackage(
    request: ExportGISDataRequest,
    user: dict = Depends(get_current_user),
):
    """
    Export project data to GeoPackage format.

    Returns a ZIP containing GeoJSON files (GeoPackage requires sqlite3 binary).
    For full GPKG support, use the Python CLI exporter.
    """
    if not request.layers:
        raise HTTPException(status_code=400, detail="Nenhuma camada fornecida")

    try:
        layers_data = []
        for layer in request.layers:
            layer_dict = {
                "name": layer.name,
                "geometry_type": layer.geometry_type,
                "features": [
                    {
                        "id": f.id,
                        "coordinates": f.coordinates,
                        "properties": f.properties
                    }
                    for f in layer.features
                ]
            }
            layers_data.append(layer_dict)

        zip_buffer = generate_shapefile_zip(layers_data, request.crs)

        filename = f"geopackage_{request.projeto_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na exportacao: {str(e)}")


@app.post("/api/gis/transform")
async def transform_coordinates(
    request: CoordinateTransformRequest,
    user: dict = Depends(get_optional_user),
):
    """
    Transform coordinates between CRS.

    Supports common Brazilian CRS:
    - EPSG:4326 (WGS84 - Lat/Lon)
    - EPSG:4674 (SIRGAS 2000 - Lat/Lon)
    - EPSG:31982 (UTM Zone 22S)
    - EPSG:31983 (UTM Zone 23S)
    """
    results = []

    for coord in request.coordinates:
        if len(coord) < 2:
            results.append({"error": "Invalid coordinate"})
            continue

        x, y = coord[0], coord[1]

        # UTM to LatLon conversions
        if request.source_crs == "EPSG:31983" and request.target_crs == "EPSG:4326":
            lat, lon = utm_to_latlon(x, y, zone=23, south=True)
            results.append({"lat": round(lat, 8), "lon": round(lon, 8)})

        elif request.source_crs == "EPSG:31982" and request.target_crs == "EPSG:4326":
            lat, lon = utm_to_latlon(x, y, zone=22, south=True)
            results.append({"lat": round(lat, 8), "lon": round(lon, 8)})

        # LatLon to UTM conversions
        elif request.source_crs == "EPSG:4326" and request.target_crs == "EPSG:31983":
            utm_x, utm_y = latlon_to_utm(y, x, zone=23)  # Note: lat=y, lon=x for WGS84
            results.append({"x": round(utm_x, 3), "y": round(utm_y, 3)})

        elif request.source_crs == "EPSG:4326" and request.target_crs == "EPSG:31982":
            utm_x, utm_y = latlon_to_utm(y, x, zone=22)
            results.append({"x": round(utm_x, 3), "y": round(utm_y, 3)})

        # Same CRS - no transformation needed
        elif request.source_crs == request.target_crs:
            results.append({"x": x, "y": y})

        else:
            results.append({"error": f"Transformation not supported: {request.source_crs} -> {request.target_crs}"})

    return {
        "source_crs": request.source_crs,
        "target_crs": request.target_crs,
        "results": results
    }


@app.post("/api/gis/map/generate")
async def generate_map_view(
    request: MapViewRequest,
    user: dict = Depends(get_optional_user),
):
    """
    Generate interactive map configuration for frontend.

    Returns map center, bounds, and layer configurations.
    """
    points_coords = []
    for p in request.pontos:
        # Convert UTM to approximate lat/lon for map display
        lat, lon = utm_to_latlon(p.x, p.y, zone=23, south=True)
        points_coords.append({
            "id": p.id,
            "lat": lat,
            "lon": lon,
            "cota": p.cota,
            "descricao": p.descricao or ""
        })

    segments = []
    for t in request.trechos:
        lat1, lon1 = utm_to_latlon(t.ponto_inicial.x, t.ponto_inicial.y, zone=23, south=True)
        lat2, lon2 = utm_to_latlon(t.ponto_final.x, t.ponto_final.y, zone=23, south=True)
        segments.append({
            "id": t.id,
            "start": {"lat": lat1, "lon": lon1},
            "end": {"lat": lat2, "lon": lon2},
            "comprimento": t.comprimento,
            "declividade": t.declividade,
            "tipo": t.tipo,
            "diametro_mm": t.diametro_mm,
            "material": t.material
        })

    # Calculate bounds
    if points_coords:
        lats = [p["lat"] for p in points_coords]
        lons = [p["lon"] for p in points_coords]
        bounds = {
            "north": max(lats),
            "south": min(lats),
            "east": max(lons),
            "west": min(lons)
        }
        center = {
            "lat": sum(lats) / len(lats),
            "lon": sum(lons) / len(lons)
        }
    else:
        # Default to Sao Paulo
        bounds = {"north": -23.4, "south": -23.7, "east": -46.4, "west": -46.8}
        center = {"lat": -23.5505, "lon": -46.6333}

    # Override center if provided
    if request.center_lat is not None:
        center["lat"] = request.center_lat
    if request.center_lng is not None:
        center["lon"] = request.center_lng

    return {
        "center": center,
        "zoom": request.zoom,
        "bounds": bounds,
        "markers": points_coords,
        "polylines": segments,
        "layers": {
            "points": {
                "name": "Pontos Topograficos",
                "type": "markers",
                "visible": True,
                "style": {
                    "radius": 8,
                    "fillColor": "#3b82f6",
                    "fillOpacity": 0.9,
                    "color": "#ffffff",
                    "weight": 2
                }
            },
            "segments": {
                "name": "Trechos",
                "type": "polylines",
                "visible": True,
                "style": {
                    "color": "#22c55e",
                    "weight": 4,
                    "opacity": 0.8
                }
            }
        },
        "baseLayers": [
            {"name": "OpenStreetMap", "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"},
            {"name": "Satellite", "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"}
        ]
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
