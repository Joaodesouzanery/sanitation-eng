"""
GIS export functionality for sanitation network data.

This module provides functions to export network segments to
geospatial formats (Shapefile, GeoJSON) compatible with QGIS
and other GIS software.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

try:
    import geopandas as gpd
    from shapely.geometry import LineString, Point
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False


class GISExportError(Exception):
    """Raised when GIS export fails."""
    pass


def check_geopandas_available() -> None:
    """
    Check if geopandas is available.

    Raises:
        GISExportError: If geopandas is not installed.
    """
    if not HAS_GEOPANDAS:
        raise GISExportError(
            "geopandas is required for GIS export. "
            "Install with: pip install geopandas"
        )


def create_line_geometry(
    x1: float, y1: float,
    x2: float, y2: float,
) -> "LineString":
    """
    Create a LineString geometry from coordinates.

    Args:
        x1, y1: Start point coordinates.
        x2, y2: End point coordinates.

    Returns:
        Shapely LineString geometry.
    """
    check_geopandas_available()
    return LineString([(x1, y1), (x2, y2)])


def create_point_geometry(x: float, y: float) -> "Point":
    """
    Create a Point geometry from coordinates.

    Args:
        x, y: Point coordinates.

    Returns:
        Shapely Point geometry.
    """
    check_geopandas_available()
    return Point(x, y)


def trechos_to_geodataframe(
    trechos_data: List[Dict[str, Any]],
    crs: str = "EPSG:31983",  # SIRGAS 2000 / UTM zone 23S (common in Brazil)
) -> "gpd.GeoDataFrame":
    """
    Convert trecho data to a GeoDataFrame with line geometries.

    Args:
        trechos_data: List of dictionaries with trecho attributes.
            Must include: x_inicio, y_inicio, x_fim, y_fim
        crs: Coordinate Reference System (default: SIRGAS 2000 UTM 23S).

    Returns:
        GeoDataFrame with LineString geometries.

    Raises:
        GISExportError: If required coordinate columns are missing.
    """
    check_geopandas_available()

    if not trechos_data:
        raise GISExportError("No data provided for GeoDataFrame creation")

    required_coords = ["x_inicio", "y_inicio", "x_fim", "y_fim"]
    first_record = trechos_data[0]

    missing = [c for c in required_coords if c not in first_record]
    if missing:
        raise GISExportError(
            f"Missing coordinate columns: {missing}. "
            "Use include_coordinates=True when converting trechos."
        )

    geometries = []
    for record in trechos_data:
        geom = create_line_geometry(
            record["x_inicio"],
            record["y_inicio"],
            record["x_fim"],
            record["y_fim"],
        )
        geometries.append(geom)

    gdf = gpd.GeoDataFrame(trechos_data, geometry=geometries, crs=crs)

    return gdf


def pontos_to_geodataframe(
    pontos_data: List[Dict[str, Any]],
    crs: str = "EPSG:31983",
) -> "gpd.GeoDataFrame":
    """
    Convert point data to a GeoDataFrame with point geometries.

    Args:
        pontos_data: List of dictionaries with point attributes.
            Must include: x, y
        crs: Coordinate Reference System.

    Returns:
        GeoDataFrame with Point geometries.
    """
    check_geopandas_available()

    if not pontos_data:
        raise GISExportError("No data provided for GeoDataFrame creation")

    geometries = []
    for record in pontos_data:
        geom = create_point_geometry(record["x"], record["y"])
        geometries.append(geom)

    gdf = gpd.GeoDataFrame(pontos_data, geometry=geometries, crs=crs)

    return gdf


def export_to_shapefile(
    gdf: "gpd.GeoDataFrame",
    output_path: Union[str, Path],
    encoding: str = "utf-8",
) -> Path:
    """
    Export GeoDataFrame to ESRI Shapefile format.

    Creates a .shp file along with companion files (.dbf, .shx, .prj).

    Args:
        gdf: GeoDataFrame to export.
        output_path: Path for output shapefile (.shp).
        encoding: Character encoding for attribute table.

    Returns:
        Path to the created shapefile.

    Raises:
        GISExportError: If export fails.
    """
    check_geopandas_available()

    output_path = Path(output_path)
    if output_path.suffix.lower() != ".shp":
        output_path = output_path.with_suffix(".shp")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Truncate column names to 10 characters (shapefile limitation)
    gdf_export = gdf.copy()
    gdf_export.columns = [
        col[:10] if col != "geometry" else col
        for col in gdf_export.columns
    ]

    try:
        gdf_export.to_file(output_path, driver="ESRI Shapefile", encoding=encoding)
    except Exception as e:
        raise GISExportError(f"Failed to export shapefile: {e}") from e

    return output_path


def export_to_geojson(
    gdf: "gpd.GeoDataFrame",
    output_path: Union[str, Path],
) -> Path:
    """
    Export GeoDataFrame to GeoJSON format.

    Args:
        gdf: GeoDataFrame to export.
        output_path: Path for output file (.geojson).

    Returns:
        Path to the created GeoJSON file.
    """
    check_geopandas_available()

    output_path = Path(output_path)
    if output_path.suffix.lower() not in (".geojson", ".json"):
        output_path = output_path.with_suffix(".geojson")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        gdf.to_file(output_path, driver="GeoJSON")
    except Exception as e:
        raise GISExportError(f"Failed to export GeoJSON: {e}") from e

    return output_path


def export_to_geopackage(
    gdf: "gpd.GeoDataFrame",
    output_path: Union[str, Path],
    layer_name: str = "rede_saneamento",
) -> Path:
    """
    Export GeoDataFrame to GeoPackage format.

    GeoPackage is a modern, open format that supports long column names
    and multiple layers.

    Args:
        gdf: GeoDataFrame to export.
        output_path: Path for output file (.gpkg).
        layer_name: Name of the layer within the GeoPackage.

    Returns:
        Path to the created GeoPackage file.
    """
    check_geopandas_available()

    output_path = Path(output_path)
    if output_path.suffix.lower() != ".gpkg":
        output_path = output_path.with_suffix(".gpkg")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        gdf.to_file(output_path, driver="GPKG", layer=layer_name)
    except Exception as e:
        raise GISExportError(f"Failed to export GeoPackage: {e}") from e

    return output_path


def create_network_geodataframe(
    trechos: List[Any],  # List[Trecho]
    parametros_execucao: Optional[Dict[str, Any]] = None,
    crs: str = "EPSG:31983",
) -> "gpd.GeoDataFrame":
    """
    Create a complete GeoDataFrame for network segments with all attributes.

    This is the main function for creating GIS-ready data with full
    attribute table for QGIS visualization and analysis.

    Args:
        trechos: List of Trecho objects.
        parametros_execucao: Optional execution parameters to include.
        crs: Coordinate Reference System.

    Returns:
        GeoDataFrame with complete attribute table.
    """
    check_geopandas_available()

    records = []
    geometries = []

    for trecho in trechos:
        record = {
            "id_inicio": trecho.id_inicio,
            "id_fim": trecho.id_fim,
            "comprim_m": round(trecho.comprimento, 2),
            "decliv": round(trecho.declividade, 6),
            "decliv_pct": round(trecho.declividade * 100, 2),
            "tipo_rede": trecho.tipo_rede,
            "diam_mm": trecho.diametro_mm,
            "material": trecho.material,
            "x_inicio": round(trecho.x_inicio, 3),
            "y_inicio": round(trecho.y_inicio, 3),
            "cota_ini": round(trecho.cota_inicio, 3),
            "x_fim": round(trecho.x_fim, 3),
            "y_fim": round(trecho.y_fim, 3),
            "cota_fim": round(trecho.cota_fim, 3),
            "desnivel": round(trecho.cota_inicio - trecho.cota_fim, 3),
        }

        # Add execution parameters if provided
        if parametros_execucao:
            params = parametros_execucao.get(f"{trecho.id_inicio}_{trecho.id_fim}", {})
            record.update({
                "solo": params.get("tipo_solo", ""),
                "escavacao": params.get("tipo_escavacao", ""),
                "pavimento": params.get("tipo_pavimento", ""),
                "prof_m": params.get("profundidade_m", 0),
                "escoram": params.get("escoramento_necessario", False),
                "embas": params.get("embasamento_necessario", False),
                "termofus": params.get("termofusao", False),
                "equipe": params.get("equipe_total", 0),
            })

        records.append(record)

        geom = create_line_geometry(
            trecho.x_inicio, trecho.y_inicio,
            trecho.x_fim, trecho.y_fim,
        )
        geometries.append(geom)

    gdf = gpd.GeoDataFrame(records, geometry=geometries, crs=crs)

    return gdf


def export_network_shapefile(
    trechos: List[Any],
    output_path: Union[str, Path],
    parametros_execucao: Optional[Dict[str, Any]] = None,
    crs: str = "EPSG:31983",
) -> Path:
    """
    Export network segments directly to shapefile.

    Convenience function that combines GeoDataFrame creation and export.

    Args:
        trechos: List of Trecho objects.
        output_path: Path for output shapefile.
        parametros_execucao: Optional execution parameters.
        crs: Coordinate Reference System.

    Returns:
        Path to created shapefile.
    """
    gdf = create_network_geodataframe(trechos, parametros_execucao, crs)
    return export_to_shapefile(gdf, output_path)
