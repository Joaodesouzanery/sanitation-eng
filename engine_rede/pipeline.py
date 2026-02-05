"""
High-level orchestration pipeline for sanitation network processing.

This module provides the main entry point for processing topography
data into budgeted network designs. It coordinates all other modules
to deliver end-to-end functionality.
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
from .domain import (
    DEFAULT_DIAMETRO_MM,
    DEFAULT_MATERIAL,
    Trecho,
    create_trechos_from_topography,
    summarize_network,
    trechos_to_records,
)
from .reader import (
    PontoTopografico,
    read_topography,
    validate_topography_sequence,
)


class PipelineError(Exception):
    """Raised when pipeline processing fails."""

    pass


@dataclass
class ProcessingResult:
    """
    Result container for pipeline processing.

    Contains all outputs and intermediate results from the
    topography processing pipeline.
    """

    pontos: List[PontoTopografico]
    trechos: List[Trecho]
    budget_df: pd.DataFrame
    output_path: Optional[Path]
    network_summary: Dict[str, Any]
    budget_summary: Dict[str, Any]

    @property
    def total_cost(self) -> float:
        """Get total project cost."""
        return self.budget_summary.get("total_cost", 0.0)

    @property
    def total_length(self) -> float:
        """Get total network length in meters."""
        return self.network_summary.get("comprimento_total", 0.0)

    @property
    def segment_count(self) -> int:
        """Get number of network segments."""
        return len(self.trechos)


def process_topography(
    topography_file: Union[str, Path],
    cost_file: Union[str, Path],
    output_file: Union[str, Path],
    diametro_mm: int = DEFAULT_DIAMETRO_MM,
    material: str = DEFAULT_MATERIAL,
    include_summary_sheet: bool = True,
    raise_on_missing_cost: bool = True,
) -> ProcessingResult:
    """
    Process topography data into a budgeted sanitation network design.

    This is the main entry point for the engine. It orchestrates the
    complete workflow from raw survey data to final budget output.

    Workflow:
        1. Read topography data from CSV/Excel
        2. Validate survey point sequence
        3. Create network segments (Trechos) with engineering calculations
        4. Load cost base
        5. Apply budget calculations
        6. Export results to Excel

    Args:
        topography_file: Path to topography file (.csv, .xlsx, .xls).
        cost_file: Path to cost base file (.xlsx, .xls, .csv).
        output_file: Path for output Excel budget file.
        diametro_mm: Default pipe diameter in millimeters.
        material: Default pipe material specification.
        include_summary_sheet: Include summary sheets in output Excel.
        raise_on_missing_cost: Raise error if any segment cost is missing.

    Returns:
        ProcessingResult containing all outputs and summaries.

    Raises:
        PipelineError: If processing fails at any stage.
        FileNotFoundError: If input files do not exist.

    Example:
        >>> result = process_topography(
        ...     topography_file="topografia.xlsx",
        ...     cost_file="base_custos.xlsx",
        ...     output_file="orcamento_rede.xlsx"
        ... )
        >>> print(f"Total cost: R$ {result.total_cost:,.2f}")
        >>> print(f"Total length: {result.total_length:,.1f} m")
    """
    try:
        pontos = read_topography(topography_file)
        validate_topography_sequence(pontos)
    except Exception as e:
        raise PipelineError(f"Failed to read topography: {e}") from e

    try:
        trechos = create_trechos_from_topography(
            pontos,
            diametro_mm=diametro_mm,
            material=material,
        )
    except Exception as e:
        raise PipelineError(f"Failed to create network segments: {e}") from e

    try:
        cost_base = read_cost_base(cost_file)
    except Exception as e:
        raise PipelineError(f"Failed to read cost base: {e}") from e

    try:
        budget_df = apply_budget(
            trechos,
            cost_base,
            raise_on_missing=raise_on_missing_cost,
        )
    except Exception as e:
        raise PipelineError(f"Failed to calculate budget: {e}") from e

    try:
        output_path = export_budget_excel(
            budget_df,
            output_file,
            include_summary_sheet=include_summary_sheet,
        )
    except Exception as e:
        raise PipelineError(f"Failed to export budget: {e}") from e

    network_summary = summarize_network(trechos)
    budget_summary = create_budget_summary(budget_df)

    return ProcessingResult(
        pontos=pontos,
        trechos=trechos,
        budget_df=budget_df,
        output_path=output_path,
        network_summary=network_summary,
        budget_summary=budget_summary,
    )


def create_network_from_topography(
    topography_file: Union[str, Path],
    diametro_mm: int = DEFAULT_DIAMETRO_MM,
    material: str = DEFAULT_MATERIAL,
) -> List[Trecho]:
    """
    Create network segments from topography file without budget calculation.

    Use this function when you only need the engineering design without
    cost calculations (e.g., for visualization or further processing).

    Args:
        topography_file: Path to topography file.
        diametro_mm: Default pipe diameter in millimeters.
        material: Default pipe material specification.

    Returns:
        List of Trecho objects representing the network.

    Raises:
        PipelineError: If processing fails.
    """
    try:
        pontos = read_topography(topography_file)
        validate_topography_sequence(pontos)
        return create_trechos_from_topography(
            pontos,
            diametro_mm=diametro_mm,
            material=material,
        )
    except Exception as e:
        raise PipelineError(f"Failed to create network: {e}") from e


def calculate_budget_for_trechos(
    trechos: List[Trecho],
    cost_file: Union[str, Path],
    output_file: Optional[Union[str, Path]] = None,
) -> pd.DataFrame:
    """
    Calculate budget for existing Trecho objects.

    Use this function when you have already created Trecho objects
    and want to apply budget calculations separately.

    Args:
        trechos: List of network segments.
        cost_file: Path to cost base file.
        output_file: Optional path to export Excel file.

    Returns:
        DataFrame with segment data and calculated costs.

    Raises:
        PipelineError: If budget calculation fails.
    """
    try:
        cost_base = read_cost_base(cost_file)
        budget_df = apply_budget(trechos, cost_base)

        if output_file:
            export_budget_excel(budget_df, output_file)

        return budget_df
    except Exception as e:
        raise PipelineError(f"Failed to calculate budget: {e}") from e


def export_network_to_dataframe(
    trechos: List[Trecho],
    include_coordinates: bool = False,
) -> pd.DataFrame:
    """
    Convert network segments to a pandas DataFrame.

    Args:
        trechos: List of network segments.
        include_coordinates: Whether to include coordinate columns.

    Returns:
        DataFrame with segment data.
    """
    records = trechos_to_records(trechos, include_coordinates=include_coordinates)
    return pd.DataFrame(records)


def validate_cost_base_coverage(
    trechos: List[Trecho],
    cost_base: CostBase,
) -> Dict[str, Any]:
    """
    Check if cost base covers all segment configurations in the network.

    Useful for validating cost base completeness before running
    the full pipeline.

    Args:
        trechos: List of network segments.
        cost_base: Cost database to validate.

    Returns:
        Dictionary with validation results:
        - is_complete: Whether all segments have costs
        - missing_configurations: List of (tipo_rede, diametro_mm) tuples without costs
        - coverage_percentage: Percentage of segments with valid costs
    """
    missing: List[tuple] = []
    covered = 0

    for trecho in trechos:
        if cost_base.has_cost(trecho.tipo_rede, trecho.diametro_mm):
            covered += 1
        else:
            config = (trecho.tipo_rede, trecho.diametro_mm)
            if config not in missing:
                missing.append(config)

    total = len(trechos)
    coverage = (covered / total * 100) if total > 0 else 100.0

    return {
        "is_complete": len(missing) == 0,
        "missing_configurations": missing,
        "coverage_percentage": round(coverage, 2),
        "segments_covered": covered,
        "segments_total": total,
    }
