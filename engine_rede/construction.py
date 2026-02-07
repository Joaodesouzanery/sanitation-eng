"""
Construction parameters and execution rules for sanitation networks.

This module defines soil types, excavation parameters, shoring requirements,
crew composition, and pavement restoration logic based on Brazilian
construction standards.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TipoSolo(Enum):
    """Soil type classification."""

    NORMAL = "normal"
    SATURADO = "saturado"  # Requires drainage and sand bedding
    ROCHOSO = "rochoso"    # Requires special excavation


class TipoEscavacao(Enum):
    """Excavation type classification."""

    MANUAL = "manual"
    MECANIZADA = "mecanizada"
    MISTA = "mista"


class TipoPavimento(Enum):
    """Pavement type for surface restoration."""

    TERRA = "terra"              # Unpaved
    PARALELEPIPEDO = "paralelepipedo"
    ASFALTO = "asfalto"          # Requires subbase + base + BGS + asphalt
    CONCRETO = "concreto"
    BLOQUETE = "bloquete"


class TipoMaterial(Enum):
    """Pipe material types with installation requirements."""

    PVC = "PVC"                  # Standard installation
    PEAD = "PEAD"                # Requires thermofusion
    CONCRETO = "Concreto"        # Heavy, requires crane/equipment
    FERRO_FUNDIDO = "Ferro Fundido"  # Heavy, special joints


# Engineering constants
PROFUNDIDADE_ESCORAMENTO = 1.25  # meters - depth requiring shoring


@dataclass
class RequisitoEscoramento:
    """Shoring requirements based on depth."""

    necessario: bool
    profundidade: float
    tipo: str = "Pontaleteamento"  # Default shoring type

    @property
    def descricao(self) -> str:
        if not self.necessario:
            return "Não necessário (prof. <= 1,25m)"
        return f"{self.tipo} (prof. {self.profundidade:.2f}m)"


@dataclass
class RequisitoEmbasamento:
    """Bedding requirements for saturated soils."""

    necessario: bool
    lastro_areia: bool = False      # Sand bedding around pipe
    lastro_brita: bool = False      # Crushed stone for drainage
    dreno: bool = False             # Sub-drain required

    @property
    def descricao(self) -> str:
        if not self.necessario:
            return "Padrão (solo normal)"
        items = []
        if self.lastro_areia:
            items.append("Lastro de areia")
        if self.lastro_brita:
            items.append("Lastro de brita")
        if self.dreno:
            items.append("Dreno sub-superficial")
        return ", ".join(items) if items else "Embasamento especial"


@dataclass
class RequisitoAssentamento:
    """Pipe installation requirements based on material."""

    material: TipoMaterial
    termofusao: bool = False        # PEAD requires thermofusion
    equipamento_pesado: bool = False  # Concrete/iron pipes
    junta_especial: bool = False    # Special joint requirements

    @property
    def descricao(self) -> str:
        items = []
        if self.termofusao:
            items.append("Termofusão")
        if self.equipamento_pesado:
            items.append("Equipamento de içamento")
        if self.junta_especial:
            items.append("Junta especial")
        return ", ".join(items) if items else "Assentamento padrão"


@dataclass
class RequisitoRecomposicao:
    """Pavement restoration requirements."""

    tipo_pavimento: TipoPavimento
    subbase: bool = False
    base: bool = False
    bgs: bool = False               # Brita Graduada Simples
    cbuq: bool = False              # Asphalt layer

    @property
    def camadas(self) -> List[str]:
        """List of required layers for restoration."""
        layers = []
        if self.subbase:
            layers.append("Sub-base")
        if self.base:
            layers.append("Base")
        if self.bgs:
            layers.append("BGS (Brita Graduada Simples)")
        if self.cbuq:
            layers.append("CBUQ (Asfalto)")
        return layers

    @property
    def descricao(self) -> str:
        if not self.camadas:
            return f"Recomposição simples ({self.tipo_pavimento.value})"
        return f"Recomposição: {' → '.join(self.camadas)}"


@dataclass
class ComposicaoEquipe:
    """Crew composition for construction activities."""

    encarregado: int = 1
    pedreiro: int = 0
    servente: int = 2
    operador_maquina: int = 0
    soldador_pead: int = 0          # PEAD thermofusion specialist

    # Additional crew for special conditions
    adicional_escoramento: int = 0   # +1 professional +1 helper
    adicional_embasamento: int = 0   # +1 professional +1 helper
    adicional_material: int = 0      # For special materials

    @property
    def total_profissionais(self) -> int:
        """Total professional workers."""
        return (
            self.encarregado +
            self.pedreiro +
            self.operador_maquina +
            self.soldador_pead +
            self.adicional_escoramento +
            self.adicional_embasamento +
            self.adicional_material
        )

    @property
    def total_ajudantes(self) -> int:
        """Total helpers/assistants."""
        base = self.servente
        if self.adicional_escoramento > 0:
            base += 1
        if self.adicional_embasamento > 0:
            base += 1
        if self.adicional_material > 0:
            base += 1
        return base

    @property
    def total(self) -> int:
        """Total crew size."""
        return self.total_profissionais + self.total_ajudantes

    def to_dict(self) -> Dict[str, int]:
        return {
            "encarregado": self.encarregado,
            "pedreiro": self.pedreiro,
            "servente": self.servente,
            "operador_maquina": self.operador_maquina,
            "soldador_pead": self.soldador_pead,
            "total_profissionais": self.total_profissionais,
            "total_ajudantes": self.total_ajudantes,
            "total_equipe": self.total,
        }


@dataclass
class ParametrosExecucao:
    """Complete execution parameters for a network segment."""

    # Input parameters
    tipo_solo: TipoSolo
    tipo_escavacao: TipoEscavacao
    tipo_pavimento: TipoPavimento
    tipo_material: TipoMaterial
    profundidade: float  # meters

    # Calculated requirements
    escoramento: RequisitoEscoramento = field(default_factory=lambda: RequisitoEscoramento(False, 0))
    embasamento: RequisitoEmbasamento = field(default_factory=lambda: RequisitoEmbasamento(False))
    assentamento: RequisitoAssentamento = field(default_factory=lambda: RequisitoAssentamento(TipoMaterial.PVC))
    recomposicao: RequisitoRecomposicao = field(default_factory=lambda: RequisitoRecomposicao(TipoPavimento.TERRA))
    equipe: ComposicaoEquipe = field(default_factory=ComposicaoEquipe)

    def __post_init__(self):
        """Calculate all requirements based on input parameters."""
        self._calcular_escoramento()
        self._calcular_embasamento()
        self._calcular_assentamento()
        self._calcular_recomposicao()
        self._calcular_equipe()

    def _calcular_escoramento(self) -> None:
        """Calculate shoring requirements based on depth."""
        necessario = self.profundidade > PROFUNDIDADE_ESCORAMENTO
        self.escoramento = RequisitoEscoramento(
            necessario=necessario,
            profundidade=self.profundidade,
            tipo="Pontaleteamento" if self.profundidade <= 3.0 else "Estacas-prancha"
        )

    def _calcular_embasamento(self) -> None:
        """Calculate bedding requirements based on soil type."""
        if self.tipo_solo == TipoSolo.SATURADO:
            self.embasamento = RequisitoEmbasamento(
                necessario=True,
                lastro_areia=True,
                lastro_brita=True,
                dreno=True,
            )
        elif self.tipo_solo == TipoSolo.ROCHOSO:
            self.embasamento = RequisitoEmbasamento(
                necessario=True,
                lastro_areia=True,  # Cushion for pipe
                lastro_brita=False,
                dreno=False,
            )
        else:
            self.embasamento = RequisitoEmbasamento(necessario=False)

    def _calcular_assentamento(self) -> None:
        """Calculate installation requirements based on material."""
        if self.tipo_material == TipoMaterial.PEAD:
            self.assentamento = RequisitoAssentamento(
                material=self.tipo_material,
                termofusao=True,
                equipamento_pesado=False,
                junta_especial=True,
            )
        elif self.tipo_material == TipoMaterial.CONCRETO:
            self.assentamento = RequisitoAssentamento(
                material=self.tipo_material,
                termofusao=False,
                equipamento_pesado=True,
                junta_especial=True,
            )
        elif self.tipo_material == TipoMaterial.FERRO_FUNDIDO:
            self.assentamento = RequisitoAssentamento(
                material=self.tipo_material,
                termofusao=False,
                equipamento_pesado=True,
                junta_especial=True,
            )
        else:  # PVC
            self.assentamento = RequisitoAssentamento(
                material=self.tipo_material,
                termofusao=False,
                equipamento_pesado=False,
                junta_especial=False,
            )

    def _calcular_recomposicao(self) -> None:
        """Calculate pavement restoration requirements."""
        if self.tipo_pavimento == TipoPavimento.ASFALTO:
            self.recomposicao = RequisitoRecomposicao(
                tipo_pavimento=self.tipo_pavimento,
                subbase=True,
                base=True,
                bgs=True,
                cbuq=True,
            )
        elif self.tipo_pavimento == TipoPavimento.CONCRETO:
            self.recomposicao = RequisitoRecomposicao(
                tipo_pavimento=self.tipo_pavimento,
                subbase=True,
                base=True,
                bgs=False,
                cbuq=False,
            )
        elif self.tipo_pavimento == TipoPavimento.PARALELEPIPEDO:
            self.recomposicao = RequisitoRecomposicao(
                tipo_pavimento=self.tipo_pavimento,
                subbase=False,
                base=True,
                bgs=False,
                cbuq=False,
            )
        elif self.tipo_pavimento == TipoPavimento.BLOQUETE:
            self.recomposicao = RequisitoRecomposicao(
                tipo_pavimento=self.tipo_pavimento,
                subbase=False,
                base=True,
                bgs=False,
                cbuq=False,
            )
        else:  # TERRA
            self.recomposicao = RequisitoRecomposicao(
                tipo_pavimento=self.tipo_pavimento,
                subbase=False,
                base=False,
                bgs=False,
                cbuq=False,
            )

    def _calcular_equipe(self) -> None:
        """Calculate crew composition based on all requirements."""
        equipe = ComposicaoEquipe(
            encarregado=1,
            servente=2,
        )

        # Mechanical excavation requires operator
        if self.tipo_escavacao in (TipoEscavacao.MECANIZADA, TipoEscavacao.MISTA):
            equipe.operador_maquina = 1

        # Shoring requires additional crew
        if self.escoramento.necessario:
            equipe.adicional_escoramento = 1  # +1 professional
            equipe.pedreiro += 1

        # Saturated soil requires additional crew
        if self.embasamento.necessario and self.tipo_solo == TipoSolo.SATURADO:
            equipe.adicional_embasamento = 1  # +1 professional

        # Special materials require additional crew
        if self.tipo_material == TipoMaterial.PEAD:
            equipe.soldador_pead = 1
            equipe.adicional_material = 1
        elif self.tipo_material in (TipoMaterial.CONCRETO, TipoMaterial.FERRO_FUNDIDO):
            equipe.adicional_material = 1

        self.equipe = equipe

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for DataFrame/export."""
        return {
            "tipo_solo": self.tipo_solo.value,
            "tipo_escavacao": self.tipo_escavacao.value,
            "tipo_pavimento": self.tipo_pavimento.value,
            "tipo_material": self.tipo_material.value,
            "profundidade_m": round(self.profundidade, 2),
            "escoramento_necessario": self.escoramento.necessario,
            "escoramento_tipo": self.escoramento.tipo if self.escoramento.necessario else None,
            "embasamento_necessario": self.embasamento.necessario,
            "lastro_areia": self.embasamento.lastro_areia,
            "lastro_brita": self.embasamento.lastro_brita,
            "dreno": self.embasamento.dreno,
            "termofusao": self.assentamento.termofusao,
            "equipamento_pesado": self.assentamento.equipamento_pesado,
            "recomposicao_camadas": len(self.recomposicao.camadas),
            "equipe_total": self.equipe.total,
            "equipe_profissionais": self.equipe.total_profissionais,
            "equipe_ajudantes": self.equipe.total_ajudantes,
        }


def calcular_profundidade_trecho(
    cota_terreno_inicio: float,
    cota_terreno_fim: float,
    cota_tubo_inicio: float,
    cota_tubo_fim: float,
) -> float:
    """
    Calculate average trench depth for a segment.

    Args:
        cota_terreno_inicio: Ground elevation at start.
        cota_terreno_fim: Ground elevation at end.
        cota_tubo_inicio: Pipe invert elevation at start.
        cota_tubo_fim: Pipe invert elevation at end.

    Returns:
        Average depth in meters.
    """
    prof_inicio = cota_terreno_inicio - cota_tubo_inicio
    prof_fim = cota_terreno_fim - cota_tubo_fim
    return (prof_inicio + prof_fim) / 2


def criar_parametros_execucao(
    tipo_solo: str,
    tipo_escavacao: str,
    tipo_pavimento: str,
    tipo_material: str,
    profundidade: float,
) -> ParametrosExecucao:
    """
    Factory function to create execution parameters from string inputs.

    Args:
        tipo_solo: "normal", "saturado", or "rochoso"
        tipo_escavacao: "manual", "mecanizada", or "mista"
        tipo_pavimento: "terra", "paralelepipedo", "asfalto", "concreto", "bloquete"
        tipo_material: "PVC", "PEAD", "Concreto", "Ferro Fundido"
        profundidade: Trench depth in meters

    Returns:
        Configured ParametrosExecucao instance.
    """
    solo_map = {
        "normal": TipoSolo.NORMAL,
        "saturado": TipoSolo.SATURADO,
        "rochoso": TipoSolo.ROCHOSO,
    }

    escavacao_map = {
        "manual": TipoEscavacao.MANUAL,
        "mecanizada": TipoEscavacao.MECANIZADA,
        "mista": TipoEscavacao.MISTA,
    }

    pavimento_map = {
        "terra": TipoPavimento.TERRA,
        "paralelepipedo": TipoPavimento.PARALELEPIPEDO,
        "asfalto": TipoPavimento.ASFALTO,
        "concreto": TipoPavimento.CONCRETO,
        "bloquete": TipoPavimento.BLOQUETE,
    }

    material_map = {
        "pvc": TipoMaterial.PVC,
        "pead": TipoMaterial.PEAD,
        "concreto": TipoMaterial.CONCRETO,
        "ferro fundido": TipoMaterial.FERRO_FUNDIDO,
    }

    return ParametrosExecucao(
        tipo_solo=solo_map.get(tipo_solo.lower(), TipoSolo.NORMAL),
        tipo_escavacao=escavacao_map.get(tipo_escavacao.lower(), TipoEscavacao.MANUAL),
        tipo_pavimento=pavimento_map.get(tipo_pavimento.lower(), TipoPavimento.TERRA),
        tipo_material=material_map.get(tipo_material.lower(), TipoMaterial.PVC),
        profundidade=profundidade,
    )
