"""
File readers for topography and survey data.

This module provides functions to read topographic survey data from
various file formats (CSV, Excel) into structured Python objects.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Union

import pandas as pd


@dataclass(frozen=True)
class PontoTopografico:
    """
    Represents a single surveyed topographic point.

    Attributes:
        id: Unique identifier for the point.
        x: X coordinate (easting) in meters.
        y: Y coordinate (northing) in meters.
        cota: Elevation above reference datum in meters.
    """

    id: str
    x: float
    y: float
    cota: float

    def __post_init__(self) -> None:
        """Validate point data after initialization."""
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError(f"Point ID must be a non-empty string. Got: {self.id!r}")


class TopographyReaderError(Exception):
    """Raised when topography file reading fails."""

    pass


def _detect_file_format(file_path: Union[str, Path]) -> str:
    """
    Detect file format from extension.

    Args:
        file_path: Path to the input file.

    Returns:
        File format identifier ('csv', 'txt', or 'excel').

    Raises:
        TopographyReaderError: If file format is not supported.
    """
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix == ".csv":
        return "csv"
    elif suffix == ".txt":
        return "txt"
    elif suffix in (".xlsx", ".xls"):
        return "excel"
    else:
        raise TopographyReaderError(
            f"Unsupported file format: {suffix}. "
            "Supported formats: .csv, .txt, .xlsx, .xls"
        )


def _detect_delimiter(file_path: Union[str, Path]) -> str:
    """
    Auto-detect delimiter in a text file.

    Args:
        file_path: Path to the text file.

    Returns:
        Detected delimiter character.
    """
    path = Path(file_path)

    with open(path, "r", encoding="utf-8") as f:
        first_lines = f.read(2048)

    # Count occurrences of common delimiters
    delimiters = {
        "\t": first_lines.count("\t"),
        ";": first_lines.count(";"),
        ",": first_lines.count(","),
        " ": first_lines.count(" "),
    }

    # Return the most common delimiter (excluding space if others exist)
    for delim in ["\t", ";", ","]:
        if delimiters[delim] > 0:
            return delim

    # Default to whitespace (space)
    return r"\s+"


def _validate_required_columns(df: pd.DataFrame, file_path: Union[str, Path]) -> None:
    """
    Validate that DataFrame contains all required columns.

    Args:
        df: DataFrame to validate.
        file_path: Path to source file (for error messages).

    Raises:
        TopographyReaderError: If required columns are missing.
    """
    required_columns = {"id", "x", "y", "cota"}
    actual_columns = set(df.columns.str.lower())

    missing = required_columns - actual_columns
    if missing:
        raise TopographyReaderError(
            f"Missing required columns in {file_path}: {missing}. "
            f"Found columns: {list(df.columns)}"
        )


def _normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column names to lowercase.

    Args:
        df: Input DataFrame.

    Returns:
        DataFrame with lowercase column names.
    """
    df = df.copy()
    df.columns = df.columns.str.lower().str.strip()
    return df


def read_topography_dataframe(file_path: Union[str, Path]) -> pd.DataFrame:
    """
    Read topography file into a pandas DataFrame.

    Supports CSV, TXT, and Excel formats. The file must contain columns:
    id, x, y, cota (case-insensitive).

    For TXT files, the delimiter is auto-detected (tab, semicolon, comma, or space).

    Args:
        file_path: Path to the topography file (.csv, .txt, .xlsx, or .xls).

    Returns:
        DataFrame with columns: id, x, y, cota.

    Raises:
        TopographyReaderError: If file cannot be read or is malformed.
        FileNotFoundError: If file does not exist.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Topography file not found: {file_path}")

    file_format = _detect_file_format(path)

    try:
        if file_format == "csv":
            df = pd.read_csv(path)
        elif file_format == "txt":
            delimiter = _detect_delimiter(path)
            if delimiter == r"\s+":
                df = pd.read_csv(path, sep=r"\s+", engine="python")
            else:
                df = pd.read_csv(path, sep=delimiter)
        else:
            df = pd.read_excel(path)
    except Exception as e:
        raise TopographyReaderError(
            f"Failed to read file {file_path}: {e}"
        ) from e

    df = _normalize_column_names(df)
    _validate_required_columns(df, file_path)

    if df.empty:
        raise TopographyReaderError(f"Topography file is empty: {file_path}")

    return df[["id", "x", "y", "cota"]]


def read_topography(file_path: Union[str, Path]) -> List[PontoTopografico]:
    """
    Read topography file into a list of PontoTopografico objects.

    This function provides a structured, object-oriented representation
    of the survey data, suitable for domain logic processing.

    Args:
        file_path: Path to the topography file (.csv, .xlsx, or .xls).

    Returns:
        List of PontoTopografico objects in file order.

    Raises:
        TopographyReaderError: If file cannot be read or is malformed.
        FileNotFoundError: If file does not exist.
        ValueError: If point data is invalid.
    """
    df = read_topography_dataframe(file_path)

    pontos: List[PontoTopografico] = []

    for idx, row in df.iterrows():
        try:
            ponto = PontoTopografico(
                id=str(row["id"]).strip(),
                x=float(row["x"]),
                y=float(row["y"]),
                cota=float(row["cota"]),
            )
            pontos.append(ponto)
        except (ValueError, TypeError) as e:
            raise TopographyReaderError(
                f"Invalid data at row {idx + 1}: {e}"
            ) from e

    return pontos


def validate_topography_sequence(pontos: List[PontoTopografico]) -> None:
    """
    Validate that a topography sequence is suitable for network design.

    Args:
        pontos: List of topographic points.

    Raises:
        TopographyReaderError: If sequence is invalid for network design.
    """
    if len(pontos) < 2:
        raise TopographyReaderError(
            f"At least 2 points are required to define a network. "
            f"Got: {len(pontos)} point(s)"
        )

    ids = [p.id for p in pontos]
    duplicates = [id_ for id_ in ids if ids.count(id_) > 1]
    if duplicates:
        raise TopographyReaderError(
            f"Duplicate point IDs found: {set(duplicates)}"
        )
