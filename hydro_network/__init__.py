"""
HydroNetwork - Sistema de Cálculo Hidráulico para Redes de Saneamento

Este pacote fornece ferramentas para:
- Cálculo de redes de esgoto por gravidade (Manning)
- Cálculo de redes de água pressurizada (Hazen-Williams)
- Cálculo de redes de drenagem pluvial (Método Racional)
- Quantitativos de obra
- Validação normativa
- Exportação GIS e webmap
"""

__version__ = "1.0.0"
__author__ = "HydroNetwork Team"

from .core.topology import TopologyBuilder, NetworkTopology
from .core.constants import SHP_FIELD_NAMES
from .networks.sewer import SewerCalculator, SewerParams
from .networks.water import WaterCalculator, WaterParams
from .networks.drainage import DrainageCalculator, DrainageParams
from .construction.quantities import QuantityCalculator, ConstructionParams, TipoPavimento
from .validation.rule_check import RuleChecker

__all__ = [
    'TopologyBuilder',
    'NetworkTopology',
    'SHP_FIELD_NAMES',
    'SewerCalculator',
    'SewerParams',
    'WaterCalculator',
    'WaterParams',
    'DrainageCalculator',
    'DrainageParams',
    'QuantityCalculator',
    'ConstructionParams',
    'TipoPavimento',
    'RuleChecker',
]
