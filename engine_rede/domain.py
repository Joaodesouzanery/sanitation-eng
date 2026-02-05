"""
Domain models for sanitation network engineering.

This module defines the core domain entities representing network
segments (trechos) with their engineering properties and calculations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .geometry import (
    TipoRede,
    calculate_distance,
    calculate_slope,
    classify_network_type,
    validate_coordinates,
)
from .reader import PontoTopografico


# Default engineering parameters
DEFAULT_DIAMETRO_MM: int = 200
DEFAULT_MATERIAL: str = "PVC"


@dataclass
class Trecho:
    """
    Represents a network segment (trecho) between two topographic points.

    A segment is the fundamental engineering unit in sanitation network
    design. It connects two consecutive survey points and carries all
    the engineering properties needed for design and budgeting.

    Attributes:
        id_inicio: Identifier of the starting point.
        id_fim: Identifier of the ending point.
        comprimento: Length of the segment in meters.
        declividade: Slope (dimensionless ratio).
        tipo_rede: Network type classification.
        diametro_mm: Pipe diameter in millimeters.
        material: Pipe material specification.
        x_inicio: X coordinate of starting point.
        y_inicio: Y coordinate of starting point.
        cota_inicio: Elevation of starting point.
        x_fim: X coordinate of ending point.
        y_fim: Y coordinate of ending point.
        cota_fim: Elevation of ending point.
    """

    id_inicio: str
    id_fim: str
    comprimento: float
    declividade: float
    tipo_rede: TipoRede
    diametro_mm: int = DEFAULT_DIAMETRO_MM
    material: str = DEFAULT_MATERIAL

    # Store original coordinates for reference
    x_inicio: float = field(default=0.0, repr=False)
    y_inicio: float = field(default=0.0, repr=False)
    cota_inicio: float = field(default=0.0, repr=False)
    x_fim: float = field(default=0.0, repr=False)
    y_fim: float = field(default=0.0, repr=False)
    cota_fim: float = field(default=0.0, repr=False)

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert segment to a dictionary representation.

        Returns:
            Dictionary with all segment properties suitable for
            DataFrame conversion or JSON serialization.
        """
        return {
            "id_inicio": self.id_inicio,
            "id_fim": self.id_fim,
            "comprimento": round(self.comprimento, 3),
            "declividade": round(self.declividade, 6),
            "tipo_rede": self.tipo_rede,
            "diametro_mm": self.diametro_mm,
            "material": self.material,
        }

    def to_dict_full(self) -> Dict[str, Any]:
        """
        Convert segment to a dictionary with all coordinate details.

        Returns:
            Dictionary with all properties including coordinates.
        """
        base = self.to_dict()
        base.update({
            "x_inicio": round(self.x_inicio, 3),
            "y_inicio": round(self.y_inicio, 3),
            "cota_inicio": round(self.cota_inicio, 3),
            "x_fim": round(self.x_fim, 3),
            "y_fim": round(self.y_fim, 3),
            "cota_fim": round(self.cota_fim, 3),
        })
        return base

    @property
    def desnivel(self) -> float:
        """Calculate elevation difference (desnível) in meters."""
        return self.cota_inicio - self.cota_fim

    @property
    def is_gravity_flow(self) -> bool:
        """Check if segment operates by gravity flow."""
        return self.tipo_rede == "Esgoto por Gravidade"


class TrechoFactory:
    """
    Factory for creating Trecho objects from topographic data.

    This factory encapsulates the engineering logic for segment creation,
    ensuring consistent application of calculation rules and defaults.
    """

    def __init__(
        self,
        diametro_mm: int = DEFAULT_DIAMETRO_MM,
        material: str = DEFAULT_MATERIAL,
    ) -> None:
        """
        Initialize factory with default segment parameters.

        Args:
            diametro_mm: Default pipe diameter in millimeters.
            material: Default pipe material.
        """
        self.diametro_mm = diametro_mm
        self.material = material

    def create_from_points(
        self,
        ponto_inicio: PontoTopografico,
        ponto_fim: PontoTopografico,
        diametro_mm: Optional[int] = None,
        material: Optional[str] = None,
    ) -> Trecho:
        """
        Create a Trecho from two consecutive topographic points.

        Automatically calculates distance, slope, and network type
        based on the engineering rules.

        Args:
            ponto_inicio: Starting point of the segment.
            ponto_fim: Ending point of the segment.
            diametro_mm: Override default diameter (optional).
            material: Override default material (optional).

        Returns:
            Configured Trecho instance.

        Raises:
            ValueError: If points are invalid or identical.
        """
        validate_coordinates(ponto_inicio.x, ponto_inicio.y, ponto_inicio.cota)
        validate_coordinates(ponto_fim.x, ponto_fim.y, ponto_fim.cota)

        comprimento = calculate_distance(
            ponto_inicio.x,
            ponto_inicio.y,
            ponto_fim.x,
            ponto_fim.y,
        )

        declividade = calculate_slope(
            ponto_inicio.cota,
            ponto_fim.cota,
            comprimento,
        )

        tipo_rede = classify_network_type(declividade)

        return Trecho(
            id_inicio=ponto_inicio.id,
            id_fim=ponto_fim.id,
            comprimento=comprimento,
            declividade=declividade,
            tipo_rede=tipo_rede,
            diametro_mm=diametro_mm or self.diametro_mm,
            material=material or self.material,
            x_inicio=ponto_inicio.x,
            y_inicio=ponto_inicio.y,
            cota_inicio=ponto_inicio.cota,
            x_fim=ponto_fim.x,
            y_fim=ponto_fim.y,
            cota_fim=ponto_fim.cota,
        )


def create_trechos_from_topography(
    pontos: List[PontoTopografico],
    diametro_mm: int = DEFAULT_DIAMETRO_MM,
    material: str = DEFAULT_MATERIAL,
) -> List[Trecho]:
    """
    Create a list of Trecho objects from consecutive topographic points.

    This is the primary function for converting survey data into
    engineered network segments. Points are processed in sequence,
    creating segments between each consecutive pair.

    Args:
        pontos: List of topographic points in network order.
        diametro_mm: Pipe diameter for all segments (mm).
        material: Pipe material for all segments.

    Returns:
        List of Trecho objects representing the network.

    Raises:
        ValueError: If fewer than 2 points are provided.

    Example:
        >>> pontos = [
        ...     PontoTopografico("P1", 0, 0, 100),
        ...     PontoTopografico("P2", 100, 0, 99),
        ...     PontoTopografico("P3", 200, 0, 98),
        ... ]
        >>> trechos = create_trechos_from_topography(pontos)
        >>> len(trechos)
        2
    """
    if len(pontos) < 2:
        raise ValueError(
            f"At least 2 points are required to create segments. "
            f"Got: {len(pontos)}"
        )

    factory = TrechoFactory(diametro_mm=diametro_mm, material=material)
    trechos: List[Trecho] = []

    for i in range(len(pontos) - 1):
        trecho = factory.create_from_points(pontos[i], pontos[i + 1])
        trechos.append(trecho)

    return trechos


def trechos_to_records(trechos: List[Trecho], include_coordinates: bool = False) -> List[Dict[str, Any]]:
    """
    Convert a list of Trecho objects to list of dictionaries.

    Args:
        trechos: List of Trecho objects.
        include_coordinates: Whether to include coordinate details.

    Returns:
        List of dictionaries suitable for DataFrame creation.
    """
    if include_coordinates:
        return [t.to_dict_full() for t in trechos]
    return [t.to_dict() for t in trechos]


def summarize_network(trechos: List[Trecho]) -> Dict[str, Any]:
    """
    Generate summary statistics for a network of segments.

    Args:
        trechos: List of Trecho objects.

    Returns:
        Dictionary with network summary statistics.
    """
    if not trechos:
        return {
            "total_trechos": 0,
            "comprimento_total": 0.0,
            "trechos_gravidade": 0,
            "trechos_elevatoria": 0,
            "declividade_media": 0.0,
            "declividade_min": 0.0,
            "declividade_max": 0.0,
        }

    comprimentos = [t.comprimento for t in trechos]
    declividades = [t.declividade for t in trechos]
    gravidade = sum(1 for t in trechos if t.is_gravity_flow)

    return {
        "total_trechos": len(trechos),
        "comprimento_total": round(sum(comprimentos), 3),
        "trechos_gravidade": gravidade,
        "trechos_elevatoria": len(trechos) - gravidade,
        "declividade_media": round(sum(declividades) / len(declividades), 6),
        "declividade_min": round(min(declividades), 6),
        "declividade_max": round(max(declividades), 6),
    }
