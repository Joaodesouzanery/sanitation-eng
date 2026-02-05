"""
Engine Rede - Sanitation Network Pre-Design and Budget Estimation Engine.

A professional Python package for automatic pre-design and budget estimation
of sanitation networks (sewage/water) based on topographic survey data.

Main Features:
    - Automatic segment creation from topographic survey points
    - Engineering calculations (distance, slope, network classification)
    - Cost-based budget estimation
    - Excel export with summary sheets

Quick Start:
    >>> from engine_rede.pipeline import process_topography
    >>>
    >>> result = process_topography(
    ...     topography_file="topografia.xlsx",
    ...     cost_file="base_custos.xlsx",
    ...     output_file="orcamento_rede.xlsx"
    ... )
    >>> print(f"Total cost: R$ {result.total_cost:,.2f}")

Module Structure:
    - geometry: Core geometric calculations and engineering constants
    - reader: File I/O for topography data
    - domain: Domain models (Trecho, PontoTopografico)
    - budget: Cost base handling and budget calculations
    - pipeline: High-level orchestration functions

Engineering Rules:
    - Minimum slope (DECLIVIDADE_MIN): 0.5% (0.005)
    - Slope >= 0.5%: Gravity-fed sewage ("Esgoto por Gravidade")
    - Slope < 0.5%: Requires pumping ("Elevatória / Booster")
"""

__version__ = "1.0.0"
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

__all__ = [
    # Version info
    "__version__",
    # Pipeline (main entry points)
    "process_topography",
    "create_network_from_topography",
    "calculate_budget_for_trechos",
    "export_network_to_dataframe",
    "validate_cost_base_coverage",
    "ProcessingResult",
    "PipelineError",
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
]
