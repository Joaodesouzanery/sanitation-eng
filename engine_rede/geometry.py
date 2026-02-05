"""
Geometric calculations for sanitation network engineering.

This module provides core geometric functions for calculating distances,
slopes, and classifying network segments based on engineering criteria.
"""

from __future__ import annotations

import math
from typing import Literal

# Engineering constants
DECLIVIDADE_MIN: float = 0.005  # Minimum slope (0.5%) for gravity flow

# Network type literals for type safety
TipoRede = Literal["Esgoto por Gravidade", "Elevatória / Booster"]


def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Calculate the Euclidean distance between two points in a 2D plane.

    Args:
        x1: X coordinate of the first point.
        y1: Y coordinate of the first point.
        x2: X coordinate of the second point.
        y2: Y coordinate of the second point.

    Returns:
        The Euclidean distance between the two points.

    Raises:
        ValueError: If distance calculation results in a non-positive value
            due to identical points.
    """
    dx = x2 - x1
    dy = y2 - y1
    distance = math.sqrt(dx * dx + dy * dy)

    if distance <= 0:
        raise ValueError(
            f"Distance between points ({x1}, {y1}) and ({x2}, {y2}) "
            "must be greater than zero. Points cannot be identical."
        )

    return distance


def calculate_slope(cota_inicio: float, cota_fim: float, distance: float) -> float:
    """
    Calculate the slope (declividade) between two elevation points.

    The slope is defined as the elevation difference divided by the
    horizontal distance. A positive slope indicates downward flow
    from start to end point.

    Args:
        cota_inicio: Elevation at the starting point (meters).
        cota_fim: Elevation at the ending point (meters).
        distance: Horizontal distance between points (meters).

    Returns:
        The slope as a dimensionless ratio (e.g., 0.005 = 0.5%).

    Raises:
        ValueError: If distance is zero or negative.
    """
    if distance <= 0:
        raise ValueError(
            f"Distance must be positive for slope calculation. Got: {distance}"
        )

    return (cota_inicio - cota_fim) / distance


def classify_network_type(slope: float) -> TipoRede:
    """
    Classify the network segment type based on slope criteria.

    According to sanitation engineering standards, segments with
    sufficient slope can operate by gravity. Segments with insufficient
    slope require pumping stations (elevatória) or booster systems.

    Args:
        slope: The calculated slope (dimensionless ratio).

    Returns:
        Network type classification:
        - "Esgoto por Gravidade": Gravity-fed sewage (slope >= 0.5%)
        - "Elevatória / Booster": Requires pumping (slope < 0.5%)
    """
    if slope >= DECLIVIDADE_MIN:
        return "Esgoto por Gravidade"
    return "Elevatória / Booster"


def validate_coordinates(x: float, y: float, cota: float) -> None:
    """
    Validate that coordinates are finite numbers.

    Args:
        x: X coordinate.
        y: Y coordinate.
        cota: Elevation value.

    Raises:
        ValueError: If any coordinate is not a finite number.
    """
    if not all(math.isfinite(v) for v in (x, y, cota)):
        raise ValueError(
            f"All coordinates must be finite numbers. "
            f"Got: x={x}, y={y}, cota={cota}"
        )
