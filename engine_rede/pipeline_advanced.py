"""
Advanced pipeline with construction parameters and GIS export.

This module provides an extended processing pipeline that includes:
- Soil and excavation conditions
- Shoring and bedding requirements
- Crew composition calculations
- Material-specific installation requirements
- Pavement restoration
- GIS export (Shapefile, GeoJSON, GeoPackage)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

from .budget import (
    CostBase,
    apply_budget,
    create_budget_summary,
    export_budget_excel,
    read_cost_base,
)
from .construction import (
    ParametrosExecucao,
    TipoEscavacao,
    TipoMaterial,
    TipoPavimento,
    TipoSolo,
    criar_parametros_execucao,
)
from .domain import (
    DEFAULT_DIAMETRO_MM,
    DEFAULT_MATERIAL,
    Trecho,
    create_trechos_from_topography,
    summarize_network,
)
from .reader import (
    read_topography,
    validate_topography_sequence,
)

# Optional GIS imports
try:
    from .gis_export import (
        create_network_geodataframe,
        export_to_shapefile,
        export_to_geojson,
        export_to_geopackage,
        HAS_GEOPANDAS,
    )
except ImportError:
    HAS_GEOPANDAS = False


class AdvancedPipelineError(Exception):
    """Raised when advanced pipeline processing fails."""
    pass


@dataclass
class ConfiguracaoObra:
    """Construction configuration parameters."""

    tipo_solo: str = "normal"           # normal, saturado, rochoso
    tipo_escavacao: str = "mecanizada"  # manual, mecanizada, mista
    tipo_pavimento: str = "asfalto"     # terra, paralelepipedo, asfalto, concreto, bloquete
    profundidade_media: float = 1.5     # meters
    crs: str = "EPSG:31983"             # Coordinate Reference System

    def validate(self) -> None:
        """Validate configuration parameters."""
        valid_solo = ["normal", "saturado", "rochoso"]
        valid_escavacao = ["manual", "mecanizada", "mista"]
        valid_pavimento = ["terra", "paralelepipedo", "asfalto", "concreto", "bloquete"]

        if self.tipo_solo.lower() not in valid_solo:
            raise ValueError(f"tipo_solo must be one of {valid_solo}")
        if self.tipo_escavacao.lower() not in valid_escavacao:
            raise ValueError(f"tipo_escavacao must be one of {valid_escavacao}")
        if self.tipo_pavimento.lower() not in valid_pavimento:
            raise ValueError(f"tipo_pavimento must be one of {valid_pavimento}")
        if self.profundidade_media <= 0:
            raise ValueError("profundidade_media must be positive")


@dataclass
class ResultadoAvancado:
    """Extended result container with construction and GIS data."""

    # Basic results
    trechos: List[Trecho]
    budget_df: pd.DataFrame
    network_summary: Dict[str, Any]
    budget_summary: Dict[str, Any]

    # Construction results
    parametros_execucao: Dict[str, ParametrosExecucao]
    resumo_construcao: Dict[str, Any]

    # Export paths
    excel_path: Optional[Path] = None
    shapefile_path: Optional[Path] = None
    geojson_path: Optional[Path] = None
    geopackage_path: Optional[Path] = None

    @property
    def total_cost(self) -> float:
        return self.budget_summary.get("total_cost", 0.0)

    @property
    def total_length(self) -> float:
        return self.network_summary.get("comprimento_total", 0.0)

    @property
    def segment_count(self) -> int:
        return len(self.trechos)

    @property
    def requires_shoring(self) -> int:
        """Count of segments requiring shoring."""
        return self.resumo_construcao.get("trechos_com_escoramento", 0)

    @property
    def total_crew(self) -> int:
        """Total crew size needed."""
        return self.resumo_construcao.get("equipe_total_max", 0)


def calcular_parametros_por_trecho(
    trechos: List[Trecho],
    config: ConfiguracaoObra,
) -> Dict[str, ParametrosExecucao]:
    """
    Calculate construction parameters for each segment.

    Args:
        trechos: List of network segments.
        config: Construction configuration.

    Returns:
        Dictionary mapping trecho IDs to execution parameters.
    """
    parametros = {}

    for trecho in trechos:
        key = f"{trecho.id_inicio}_{trecho.id_fim}"

        params = criar_parametros_execucao(
            tipo_solo=config.tipo_solo,
            tipo_escavacao=config.tipo_escavacao,
            tipo_pavimento=config.tipo_pavimento,
            tipo_material=trecho.material,
            profundidade=config.profundidade_media,
        )

        parametros[key] = params

    return parametros


def resumir_construcao(
    parametros: Dict[str, ParametrosExecucao],
) -> Dict[str, Any]:
    """
    Create summary of construction requirements.

    Args:
        parametros: Dictionary of execution parameters per segment.

    Returns:
        Summary statistics dictionary.
    """
    if not parametros:
        return {
            "total_trechos": 0,
            "trechos_com_escoramento": 0,
            "trechos_com_embasamento": 0,
            "trechos_com_termofusao": 0,
            "equipe_total_max": 0,
            "equipe_media": 0,
        }

    params_list = list(parametros.values())

    escoramento = sum(1 for p in params_list if p.escoramento.necessario)
    embasamento = sum(1 for p in params_list if p.embasamento.necessario)
    termofusao = sum(1 for p in params_list if p.assentamento.termofusao)
    equipes = [p.equipe.total for p in params_list]

    return {
        "total_trechos": len(params_list),
        "trechos_com_escoramento": escoramento,
        "trechos_com_embasamento": embasamento,
        "trechos_com_termofusao": termofusao,
        "trechos_equipamento_pesado": sum(1 for p in params_list if p.assentamento.equipamento_pesado),
        "equipe_total_max": max(equipes) if equipes else 0,
        "equipe_media": round(sum(equipes) / len(equipes), 1) if equipes else 0,
        "recomposicao_asfalto": sum(1 for p in params_list if p.tipo_pavimento == TipoPavimento.ASFALTO),
    }


def criar_dataframe_completo(
    trechos: List[Trecho],
    cost_base: CostBase,
    parametros: Dict[str, ParametrosExecucao],
) -> pd.DataFrame:
    """
    Create complete DataFrame with all segment data, costs, and construction info.

    Args:
        trechos: List of network segments.
        cost_base: Cost database.
        parametros: Execution parameters per segment.

    Returns:
        Complete DataFrame with all columns.
    """
    records = []

    for trecho in trechos:
        key = f"{trecho.id_inicio}_{trecho.id_fim}"
        params = parametros.get(key)

        unit_cost = cost_base.get_unit_cost(trecho.tipo_rede, trecho.diametro_mm)
        total_cost = trecho.comprimento * unit_cost if unit_cost else 0

        record = {
            # Identification
            "id_inicio": trecho.id_inicio,
            "id_fim": trecho.id_fim,

            # Geometry
            "comprimento_m": round(trecho.comprimento, 2),
            "declividade": round(trecho.declividade, 6),
            "declividade_pct": round(trecho.declividade * 100, 2),
            "desnivel_m": round(trecho.cota_inicio - trecho.cota_fim, 3),

            # Network
            "tipo_rede": trecho.tipo_rede,
            "diametro_mm": trecho.diametro_mm,
            "material": trecho.material,

            # Coordinates
            "x_inicio": round(trecho.x_inicio, 3),
            "y_inicio": round(trecho.y_inicio, 3),
            "cota_inicio": round(trecho.cota_inicio, 3),
            "x_fim": round(trecho.x_fim, 3),
            "y_fim": round(trecho.y_fim, 3),
            "cota_fim": round(trecho.cota_fim, 3),

            # Cost
            "custo_unitario": unit_cost or 0,
            "custo_total": round(total_cost, 2),
        }

        # Construction parameters
        if params:
            record.update({
                "tipo_solo": params.tipo_solo.value,
                "tipo_escavacao": params.tipo_escavacao.value,
                "tipo_pavimento": params.tipo_pavimento.value,
                "profundidade_m": params.profundidade,

                # Shoring
                "escoramento_necessario": params.escoramento.necessario,
                "escoramento_tipo": params.escoramento.tipo if params.escoramento.necessario else "",

                # Bedding
                "embasamento_necessario": params.embasamento.necessario,
                "lastro_areia": params.embasamento.lastro_areia,
                "lastro_brita": params.embasamento.lastro_brita,
                "dreno": params.embasamento.dreno,

                # Installation
                "termofusao": params.assentamento.termofusao,
                "equipamento_pesado": params.assentamento.equipamento_pesado,

                # Pavement
                "recomposicao_subbase": params.recomposicao.subbase,
                "recomposicao_base": params.recomposicao.base,
                "recomposicao_bgs": params.recomposicao.bgs,
                "recomposicao_cbuq": params.recomposicao.cbuq,

                # Crew
                "equipe_total": params.equipe.total,
                "equipe_profissionais": params.equipe.total_profissionais,
                "equipe_ajudantes": params.equipe.total_ajudantes,
            })

        records.append(record)

    return pd.DataFrame(records)


def export_excel_avancado(
    df: pd.DataFrame,
    output_path: Union[str, Path],
    network_summary: Dict[str, Any],
    budget_summary: Dict[str, Any],
    construction_summary: Dict[str, Any],
) -> Path:
    """
    Export complete data to Excel with multiple sheets.

    Args:
        df: Complete DataFrame.
        output_path: Output file path.
        network_summary: Network statistics.
        budget_summary: Budget statistics.
        construction_summary: Construction statistics.

    Returns:
        Path to created Excel file.
    """
    output_path = Path(output_path)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        # Main data sheet
        df.to_excel(writer, sheet_name="Trechos", index=False)

        # Network summary
        network_df = pd.DataFrame([
            {"Métrica": "Total de Trechos", "Valor": network_summary["total_trechos"]},
            {"Métrica": "Comprimento Total (m)", "Valor": network_summary["comprimento_total"]},
            {"Métrica": "Trechos por Gravidade", "Valor": network_summary["trechos_gravidade"]},
            {"Métrica": "Trechos com Elevatória", "Valor": network_summary["trechos_elevatoria"]},
            {"Métrica": "Declividade Média", "Valor": network_summary["declividade_media"]},
        ])
        network_df.to_excel(writer, sheet_name="Resumo Rede", index=False)

        # Budget summary
        budget_df = pd.DataFrame([
            {"Métrica": "Custo Total (R$)", "Valor": budget_summary["total_cost"]},
            {"Métrica": "Custo Médio (R$/m)", "Valor": budget_summary["average_cost_per_meter"]},
        ])
        budget_df.to_excel(writer, sheet_name="Resumo Orçamento", index=False)

        # Construction summary
        construction_df = pd.DataFrame([
            {"Métrica": "Trechos com Escoramento", "Valor": construction_summary["trechos_com_escoramento"]},
            {"Métrica": "Trechos com Embasamento Especial", "Valor": construction_summary["trechos_com_embasamento"]},
            {"Métrica": "Trechos com Termofusão", "Valor": construction_summary["trechos_com_termofusao"]},
            {"Métrica": "Equipe Máxima Necessária", "Valor": construction_summary["equipe_total_max"]},
            {"Métrica": "Equipe Média", "Valor": construction_summary["equipe_media"]},
        ])
        construction_df.to_excel(writer, sheet_name="Resumo Construção", index=False)

    return output_path


def process_topography_advanced(
    topography_file: Union[str, Path],
    cost_file: Union[str, Path],
    output_excel: Union[str, Path],
    config: Optional[ConfiguracaoObra] = None,
    output_shapefile: Optional[Union[str, Path]] = None,
    output_geojson: Optional[Union[str, Path]] = None,
    output_geopackage: Optional[Union[str, Path]] = None,
    diametro_mm: int = DEFAULT_DIAMETRO_MM,
    material: str = DEFAULT_MATERIAL,
) -> ResultadoAvancado:
    """
    Process topography with full construction parameters and GIS export.

    This is the main entry point for advanced processing that includes:
    - Network segment creation
    - Construction parameter calculation (shoring, bedding, crew)
    - Budget calculation
    - GIS export (shapefile, GeoJSON, GeoPackage)

    Args:
        topography_file: Path to topography file (.csv, .txt, .xlsx).
        cost_file: Path to cost base file.
        output_excel: Path for output Excel file.
        config: Construction configuration (soil, excavation, pavement, depth).
        output_shapefile: Optional path for shapefile export.
        output_geojson: Optional path for GeoJSON export.
        output_geopackage: Optional path for GeoPackage export.
        diametro_mm: Default pipe diameter.
        material: Default pipe material.

    Returns:
        ResultadoAvancado with all outputs.

    Example:
        >>> config = ConfiguracaoObra(
        ...     tipo_solo="saturado",
        ...     tipo_escavacao="mecanizada",
        ...     tipo_pavimento="asfalto",
        ...     profundidade_media=1.8,
        ... )
        >>> result = process_topography_advanced(
        ...     topography_file="topografia.txt",
        ...     cost_file="custos.xlsx",
        ...     output_excel="resultado.xlsx",
        ...     config=config,
        ...     output_shapefile="rede.shp",
        ... )
    """
    # Use default config if not provided
    if config is None:
        config = ConfiguracaoObra()

    config.validate()

    # Read and validate topography
    pontos = read_topography(topography_file)
    validate_topography_sequence(pontos)

    # Create network segments
    trechos = create_trechos_from_topography(
        pontos,
        diametro_mm=diametro_mm,
        material=material,
    )

    # Read cost base
    cost_base = read_cost_base(cost_file)

    # Calculate construction parameters
    parametros = calcular_parametros_por_trecho(trechos, config)

    # Create complete DataFrame
    df_completo = criar_dataframe_completo(trechos, cost_base, parametros)

    # Generate summaries
    network_summary = summarize_network(trechos)
    budget_summary = create_budget_summary(
        df_completo[["id_inicio", "id_fim", "comprimento_m", "custo_unitario", "custo_total"]].rename(
            columns={"comprimento_m": "comprimento"}
        )
    )
    construction_summary = resumir_construcao(parametros)

    # Export Excel
    excel_path = export_excel_avancado(
        df_completo,
        output_excel,
        network_summary,
        budget_summary,
        construction_summary,
    )

    # GIS exports (if geopandas available)
    shp_path = None
    geojson_path = None
    gpkg_path = None

    if HAS_GEOPANDAS:
        # Convert parameters to dict format for GIS
        params_dict = {k: v.to_dict() for k, v in parametros.items()}

        gdf = create_network_geodataframe(trechos, params_dict, crs=config.crs)

        if output_shapefile:
            shp_path = export_to_shapefile(gdf, output_shapefile)

        if output_geojson:
            geojson_path = export_to_geojson(gdf, output_geojson)

        if output_geopackage:
            gpkg_path = export_to_geopackage(gdf, output_geopackage)

    return ResultadoAvancado(
        trechos=trechos,
        budget_df=df_completo,
        network_summary=network_summary,
        budget_summary=budget_summary,
        parametros_execucao=parametros,
        resumo_construcao=construction_summary,
        excel_path=excel_path,
        shapefile_path=shp_path,
        geojson_path=geojson_path,
        geopackage_path=gpkg_path,
    )
