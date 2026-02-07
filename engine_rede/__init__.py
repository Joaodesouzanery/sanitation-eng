"""
Engine Rede - Sanitation Network Pre-Design and Budget Estimation Engine.

A professional Python package for automatic pre-design and budget estimation
of sanitation networks (sewage/water) based on topographic survey data.

Main Features:
    - Automatic segment creation from topographic survey points
    - Engineering calculations (distance, slope, network classification)
    - Construction parameters (shoring, bedding, crew composition)
    - Material-specific installation requirements
    - Cost-based budget estimation
    - Excel export with summary sheets
    - GIS export (Shapefile, GeoJSON, GeoPackage) for QGIS

Quick Start (Basic):
    >>> from engine_rede.pipeline import process_topography
    >>> result = process_topography(
    ...     topography_file="topografia.xlsx",
    ...     cost_file="base_custos.xlsx",
    ...     output_file="orcamento_rede.xlsx"
    ... )

Quick Start (Advanced with GIS):
    >>> from engine_rede.pipeline_advanced import (
    ...     process_topography_advanced,
    ...     ConfiguracaoObra,
    ... )
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

Module Structure:
    - geometry: Core geometric calculations and engineering constants
    - reader: File I/O for topography data (.csv, .txt, .xlsx)
    - domain: Domain models (Trecho, PontoTopografico)
    - budget: Cost base handling and budget calculations
    - construction: Soil, excavation, shoring, crew parameters
    - gis_export: Shapefile/GeoJSON/GeoPackage export for QGIS
    - pipeline: Basic orchestration
    - pipeline_advanced: Full orchestration with construction and GIS

Engineering Rules:
    - Minimum slope (DECLIVIDADE_MIN): 0.5% (0.005)
    - Slope >= 0.5%: Gravity-fed sewage ("Esgoto por Gravidade")
    - Slope < 0.5%: Requires pumping ("Elevatória / Booster")
    - Depth > 1.25m: Requires shoring
    - Saturated soil: Requires sand bedding + drainage
    - PEAD material: Requires thermofusion welding
"""

__version__ = "2.0.0"
__author__ = "Sanitation Engineering Team"

from .domain import (
    DEFAULT_DIAMETRO_MM,
    DEFAULT_MATERIAL,
    Trecho,
    TrechoFactory,
    create_trechos_from_topography,
    summarize_network,
    trechos_to_records,
)
from .geometry import (
    DECLIVIDADE_MIN,
    TipoRede,
    calculate_distance,
    calculate_slope,
    classify_network_type,
)
from .pipeline import (
    PipelineError,
    ProcessingResult,
    calculate_budget_for_trechos,
    create_network_from_topography,
    export_network_to_dataframe,
    process_topography,
    validate_cost_base_coverage,
)
from .reader import (
    PontoTopografico,
    TopographyReaderError,
    read_topography,
    read_topography_dataframe,
    validate_topography_sequence,
)
from .budget import (
    BudgetError,
    CostBase,
    apply_budget,
    create_budget_summary,
    export_budget_excel,
    read_cost_base,
)
from .construction import (
    ComposicaoEquipe,
    ParametrosExecucao,
    RequisitoAssentamento,
    RequisitoEmbasamento,
    RequisitoEscoramento,
    RequisitoRecomposicao,
    TipoEscavacao,
    TipoMaterial,
    TipoPavimento,
    TipoSolo,
    criar_parametros_execucao,
    PROFUNDIDADE_ESCORAMENTO,
)
from .pipeline_advanced import (
    AdvancedPipelineError,
    ConfiguracaoObra,
    ResultadoAvancado,
    process_topography_advanced,
)

# Optional GIS exports (require geopandas)
try:
    from .gis_export import (
        GISExportError,
        create_network_geodataframe,
        export_to_shapefile,
        export_to_geojson,
        export_to_geopackage,
        export_network_shapefile,
    )
    HAS_GIS = True
except ImportError:
    HAS_GIS = False

__all__ = [
    # Version info
    "__version__",
    # Pipeline Basic (main entry points)
    "process_topography",
    "create_network_from_topography",
    "calculate_budget_for_trechos",
    "export_network_to_dataframe",
    "validate_cost_base_coverage",
    "ProcessingResult",
    "PipelineError",
    # Pipeline Advanced (with construction and GIS)
    "process_topography_advanced",
    "ConfiguracaoObra",
    "ResultadoAvancado",
    "AdvancedPipelineError",
    # Domain models
    "Trecho",
    "TrechoFactory",
    "PontoTopografico",
    "create_trechos_from_topography",
    "summarize_network",
    "trechos_to_records",
    "DEFAULT_DIAMETRO_MM",
    "DEFAULT_MATERIAL",
    # Geometry
    "calculate_distance",
    "calculate_slope",
    "classify_network_type",
    "DECLIVIDADE_MIN",
    "TipoRede",
    # Reader
    "read_topography",
    "read_topography_dataframe",
    "validate_topography_sequence",
    "TopographyReaderError",
    # Budget
    "CostBase",
    "read_cost_base",
    "apply_budget",
    "create_budget_summary",
    "export_budget_excel",
    "BudgetError",
    # Construction
    "TipoSolo",
    "TipoEscavacao",
    "TipoPavimento",
    "TipoMaterial",
    "ParametrosExecucao",
    "ComposicaoEquipe",
    "RequisitoEscoramento",
    "RequisitoEmbasamento",
    "RequisitoAssentamento",
    "RequisitoRecomposicao",
    "criar_parametros_execucao",
    "PROFUNDIDADE_ESCORAMENTO",
    # GIS Export (optional - requires geopandas)
    "HAS_GIS",
]

# Add GIS exports if available
if HAS_GIS:
    __all__.extend([
        "GISExportError",
        "create_network_geodataframe",
        "export_to_shapefile",
        "export_to_geojson",
        "export_to_geopackage",
        "export_network_shapefile",
    ])
