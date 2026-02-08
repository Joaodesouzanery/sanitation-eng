"""
Hydraulics - Motor de Cálculo Hidráulico

Integração com EPANET (água) e SWMM (esgoto/drenagem)

IMPORTANTE:
- NUNCA sobrescreve valores autoritativos do projeto
- Apenas adiciona resultados de simulação como campos separados
- Gera arquivos .INP sem modificar dados originais
"""

from .epanet_wrapper import (
    EpanetWrapper,
    EpanetOptions,
    SimulationResults,
    generate_epanet_inp
)

__all__ = [
    "EpanetWrapper",
    "EpanetOptions",
    "SimulationResults",
    "generate_epanet_inp",
]
