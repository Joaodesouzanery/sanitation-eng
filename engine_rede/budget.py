"""
Budget calculation module for sanitation network costing.

This module provides functions to read cost databases, merge with
network segments, and calculate total project budgets.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

from .domain import Trecho, trechos_to_records


class BudgetError(Exception):
    """Raised when budget calculation encounters an error."""

    pass


class CostBase:
    """
    Represents a cost database for network component pricing.

    The cost base maps network types and diameters to unit costs,
    enabling automated budget calculation for network segments.
    """

    REQUIRED_COLUMNS = {"tipo_rede", "diametro_mm", "custo_unitario"}

    def __init__(self, data: pd.DataFrame) -> None:
        """
        Initialize CostBase from a DataFrame.

        Args:
            data: DataFrame with tipo_rede, diametro_mm, custo_unitario columns.

        Raises:
            BudgetError: If required columns are missing.
        """
        self._validate_columns(data)
        self._data = self._normalize_data(data)
        self._lookup = self._build_lookup()

    def _validate_columns(self, data: pd.DataFrame) -> None:
        """Validate that DataFrame contains required columns."""
        columns = set(data.columns.str.lower().str.strip())
        missing = self.REQUIRED_COLUMNS - columns
        if missing:
            raise BudgetError(
                f"Cost base missing required columns: {missing}. "
                f"Found: {list(data.columns)}"
            )

    def _normalize_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """Normalize column names and data types."""
        df = data.copy()
        df.columns = df.columns.str.lower().str.strip()
        df = df[["tipo_rede", "diametro_mm", "custo_unitario"]]
        df["tipo_rede"] = df["tipo_rede"].astype(str).str.strip()
        df["diametro_mm"] = pd.to_numeric(df["diametro_mm"], errors="coerce")
        df["custo_unitario"] = pd.to_numeric(df["custo_unitario"], errors="coerce")
        return df

    def _build_lookup(self) -> Dict[tuple, float]:
        """Build a lookup dictionary for fast cost retrieval."""
        lookup = {}
        for _, row in self._data.iterrows():
            key = (row["tipo_rede"], int(row["diametro_mm"]))
            lookup[key] = float(row["custo_unitario"])
        return lookup

    def get_unit_cost(
        self,
        tipo_rede: str,
        diametro_mm: int,
    ) -> Optional[float]:
        """
        Retrieve unit cost for a specific network type and diameter.

        Args:
            tipo_rede: Network type classification.
            diametro_mm: Pipe diameter in millimeters.

        Returns:
            Unit cost per meter, or None if not found.
        """
        key = (tipo_rede, diametro_mm)
        return self._lookup.get(key)

    def has_cost(self, tipo_rede: str, diametro_mm: int) -> bool:
        """Check if cost exists for given parameters."""
        return (tipo_rede, diametro_mm) in self._lookup

    @property
    def dataframe(self) -> pd.DataFrame:
        """Return the underlying cost data as DataFrame."""
        return self._data.copy()

    def __repr__(self) -> str:
        return f"CostBase({len(self._lookup)} entries)"


def read_cost_base(file_path: Union[str, Path]) -> CostBase:
    """
    Read cost base from an Excel file.

    The file must contain columns: tipo_rede, diametro_mm, custo_unitario
    (case-insensitive).

    Args:
        file_path: Path to the cost base Excel file.

    Returns:
        CostBase instance for cost lookups.

    Raises:
        BudgetError: If file cannot be read or is malformed.
        FileNotFoundError: If file does not exist.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Cost base file not found: {file_path}")

    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)
    except Exception as e:
        raise BudgetError(f"Failed to read cost base file: {e}") from e

    if df.empty:
        raise BudgetError(f"Cost base file is empty: {file_path}")

    return CostBase(df)


def calculate_segment_cost(
    trecho: Trecho,
    cost_base: CostBase,
    raise_on_missing: bool = True,
) -> Optional[float]:
    """
    Calculate total cost for a single network segment.

    Cost is calculated as: comprimento * custo_unitario

    Args:
        trecho: Network segment.
        cost_base: Cost database for unit price lookup.
        raise_on_missing: Whether to raise error if cost not found.

    Returns:
        Total segment cost, or None if cost not found and raise_on_missing=False.

    Raises:
        BudgetError: If cost not found and raise_on_missing=True.
    """
    unit_cost = cost_base.get_unit_cost(trecho.tipo_rede, trecho.diametro_mm)

    if unit_cost is None:
        if raise_on_missing:
            raise BudgetError(
                f"No cost found for tipo_rede='{trecho.tipo_rede}', "
                f"diametro_mm={trecho.diametro_mm}. "
                f"Segment: {trecho.id_inicio} → {trecho.id_fim}"
            )
        return None

    return trecho.comprimento * unit_cost


def apply_budget(
    trechos: List[Trecho],
    cost_base: CostBase,
    raise_on_missing: bool = True,
) -> pd.DataFrame:
    """
    Apply budget calculations to a list of network segments.

    Creates a DataFrame with all segment properties plus cost columns:
    - custo_unitario: Unit cost per meter
    - custo_total: Total segment cost (comprimento * custo_unitario)

    Args:
        trechos: List of network segments.
        cost_base: Cost database.
        raise_on_missing: Whether to raise error if any cost is missing.

    Returns:
        DataFrame with segment data and calculated costs.

    Raises:
        BudgetError: If any cost is missing and raise_on_missing=True.
    """
    if not trechos:
        return pd.DataFrame(columns=[
            "id_inicio", "id_fim", "comprimento", "declividade",
            "tipo_rede", "diametro_mm", "material",
            "custo_unitario", "custo_total"
        ])

    records = trechos_to_records(trechos, include_coordinates=False)
    df = pd.DataFrame(records)

    custo_unitario: List[Optional[float]] = []
    custo_total: List[Optional[float]] = []

    for trecho in trechos:
        unit_cost = cost_base.get_unit_cost(trecho.tipo_rede, trecho.diametro_mm)

        if unit_cost is None:
            if raise_on_missing:
                raise BudgetError(
                    f"No cost found for tipo_rede='{trecho.tipo_rede}', "
                    f"diametro_mm={trecho.diametro_mm}. "
                    f"Segment: {trecho.id_inicio} → {trecho.id_fim}"
                )
            custo_unitario.append(None)
            custo_total.append(None)
        else:
            custo_unitario.append(unit_cost)
            custo_total.append(round(trecho.comprimento * unit_cost, 2))

    df["custo_unitario"] = custo_unitario
    df["custo_total"] = custo_total

    return df


def create_budget_summary(budget_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Create a summary of the budget calculation.

    Args:
        budget_df: DataFrame from apply_budget function.

    Returns:
        Dictionary with budget summary statistics.
    """
    if budget_df.empty:
        return {
            "total_segments": 0,
            "total_length_m": 0.0,
            "total_cost": 0.0,
            "cost_by_network_type": {},
            "average_cost_per_meter": 0.0,
        }

    total_cost = budget_df["custo_total"].sum()
    total_length = budget_df["comprimento"].sum()

    cost_by_type = (
        budget_df.groupby("tipo_rede")["custo_total"]
        .sum()
        .round(2)
        .to_dict()
    )

    return {
        "total_segments": len(budget_df),
        "total_length_m": round(total_length, 3),
        "total_cost": round(total_cost, 2),
        "cost_by_network_type": cost_by_type,
        "average_cost_per_meter": round(total_cost / total_length, 2) if total_length > 0 else 0.0,
    }


def export_budget_excel(
    budget_df: pd.DataFrame,
    output_path: Union[str, Path],
    include_summary_sheet: bool = True,
) -> Path:
    """
    Export budget DataFrame to Excel file.

    Creates an Excel file with the budget data. Optionally includes
    a summary sheet with totals and statistics.

    Args:
        budget_df: DataFrame from apply_budget function.
        output_path: Path for the output Excel file.
        include_summary_sheet: Whether to add a summary sheet.

    Returns:
        Path to the created Excel file.

    Raises:
        BudgetError: If export fails.
    """
    output_path = Path(output_path)

    try:
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            budget_df.to_excel(writer, sheet_name="Orçamento", index=False)

            if include_summary_sheet:
                summary = create_budget_summary(budget_df)
                summary_data = {
                    "Métrica": [
                        "Total de Trechos",
                        "Comprimento Total (m)",
                        "Custo Total (R$)",
                        "Custo Médio por Metro (R$/m)",
                    ],
                    "Valor": [
                        summary["total_segments"],
                        summary["total_length_m"],
                        summary["total_cost"],
                        summary["average_cost_per_meter"],
                    ],
                }
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name="Resumo", index=False)

                if summary["cost_by_network_type"]:
                    type_data = {
                        "Tipo de Rede": list(summary["cost_by_network_type"].keys()),
                        "Custo Total (R$)": list(summary["cost_by_network_type"].values()),
                    }
                    type_df = pd.DataFrame(type_data)
                    type_df.to_excel(
                        writer,
                        sheet_name="Custo por Tipo",
                        index=False
                    )

    except Exception as e:
        raise BudgetError(f"Failed to export budget to Excel: {e}") from e

    return output_path
