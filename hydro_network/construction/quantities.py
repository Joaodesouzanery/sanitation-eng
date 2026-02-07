"""
Cálculo de quantitativos de obra para redes de saneamento.

Quantitativos calculados por trecho:
- Escavação (m³)
- Escoramento (m²)
- Berço/lastro (m³)
- Envoltória (m³)
- Reaterro comum (m³)
- Bota-fora (m³)
- Recomposição de pavimento: sub-base, base, asfalto (m³/m²)

LEGENDA DE CAMPOS SHP:
    EXC_M3   = Volume de escavação (m³)
    SHOR_M2  = Área de escoramento (m²)
    BED_M3   = Volume do berço (m³)
    ENV_M3   = Volume da envoltória (m³)
    BFILL_M3 = Volume de reaterro (m³)
    WASTE_M3 = Volume de bota-fora (m³)
    SUBB_M3  = Volume de sub-base (m³)
    BASE_M3  = Volume de base (m³)
    ASPH_M3  = Volume de asfalto (m³)
    PAV_M2   = Área de recomposição de pavimento (m²)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import math

from ..core.constants import ConstructionDefaults, SHP_FIELD_NAMES, PI


class TipoPavimento(Enum):
    """Tipos de pavimento para recomposição."""
    NAO_PAVIMENTADO = "nao_pavimentado"
    TERRA = "terra"
    PARALELEPIPEDO = "paralelepipedo"
    ASFALTO = "asfalto"
    CONCRETO = "concreto"
    BLOQUETE = "bloquete"


class TipoVala(Enum):
    """Tipos de geometria de vala."""
    VERTICAL = "vertical"  # Paredes verticais
    TALUDADA = "taludada"  # Com taludes


@dataclass
class ConstructionParams:
    """Parâmetros para cálculo de quantitativos."""

    # Geometria da vala
    largura_minima: float = ConstructionDefaults.LARGURA_MINIMA_VALA  # m
    folga_lateral: float = ConstructionDefaults.FOLGA_LATERAL  # m
    tipo_vala: TipoVala = TipoVala.VERTICAL
    talude: float = 0.0  # 0 = vertical, 0.5 = 1:2, 1 = 1:1

    # Escoramento
    prof_escoramento: float = ConstructionDefaults.PROF_ESCORAMENTO  # m

    # Camadas
    esp_berco: float = ConstructionDefaults.ESPESSURA_BERCO  # m
    esp_envoltoria: float = ConstructionDefaults.ESPESSURA_ENVOLTORIA  # m acima do tubo

    # Pavimento
    faixa_tecnica: float = ConstructionDefaults.FAIXA_TECNICA  # m cada lado
    esp_subbase: float = ConstructionDefaults.ESP_SUBBASE  # m
    esp_base: float = ConstructionDefaults.ESP_BASE  # m
    esp_asfalto: float = ConstructionDefaults.ESP_ASFALTO  # m

    # Fatores
    fator_empolamento: float = ConstructionDefaults.FATOR_EMPOLAMENTO


@dataclass
class QuantityResult:
    """Resultados de quantitativos para um trecho."""
    link_id: str

    # Geometria
    length: float = 0.0  # Comprimento (m)
    DN_mm: int = 0  # Diâmetro nominal (mm)
    prof_media: float = 0.0  # Profundidade média da vala (m)
    largura_vala: float = 0.0  # Largura da vala (m)

    # Escavação
    area_secao: float = 0.0  # Área da seção transversal (m²)
    vol_escavacao: float = 0.0  # Volume de escavação (m³)

    # Escoramento
    escoramento_necessario: bool = False
    area_escoramento: float = 0.0  # m²

    # Camadas
    vol_tubo: float = 0.0  # Volume do tubo (m³)
    vol_berco: float = 0.0  # Volume do berço (m³)
    vol_envoltoria: float = 0.0  # Volume da envoltória (m³)
    vol_reaterro: float = 0.0  # Volume de reaterro comum (m³)
    vol_botafora: float = 0.0  # Volume de bota-fora (m³)

    # Pavimento
    tipo_pavimento: TipoPavimento = TipoPavimento.NAO_PAVIMENTADO
    area_pavimento: float = 0.0  # Área de recomposição (m²)
    vol_subbase: float = 0.0  # m³
    vol_base: float = 0.0  # m³
    vol_asfalto: float = 0.0  # m³

    def to_dict(self) -> Dict[str, Any]:
        """Converte para dicionário com nomes de campos SHP."""
        return {
            SHP_FIELD_NAMES['excavation']: round(self.vol_escavacao, 2),
            SHP_FIELD_NAMES['shoring']: round(self.area_escoramento, 2),
            SHP_FIELD_NAMES['bedding']: round(self.vol_berco, 2),
            SHP_FIELD_NAMES['envelope']: round(self.vol_envoltoria, 2),
            SHP_FIELD_NAMES['backfill']: round(self.vol_reaterro, 2),
            SHP_FIELD_NAMES['waste']: round(self.vol_botafora, 2),
            SHP_FIELD_NAMES['subbase']: round(self.vol_subbase, 2),
            SHP_FIELD_NAMES['base']: round(self.vol_base, 2),
            SHP_FIELD_NAMES['asphalt']: round(self.vol_asfalto, 2),
            SHP_FIELD_NAMES['pavement_area']: round(self.area_pavimento, 2),
        }


class QuantityCalculator:
    """Calculadora de quantitativos de obra."""

    def __init__(self, params: ConstructionParams = None):
        self.params = params or ConstructionParams()
        self.results: Dict[str, QuantityResult] = {}

    def calculate_trench_width(self, DN_mm: int) -> float:
        """
        Calcula largura da vala baseado no diâmetro.

        B = DN + 2 * folga_lateral, mínimo = largura_minima
        """
        p = self.params
        D_m = DN_mm / 1000
        B = D_m + 2 * p.folga_lateral
        return max(B, p.largura_minima)

    def calculate_trench_section_area(
        self,
        B: float,
        H: float,
    ) -> float:
        """
        Calcula área da seção transversal da vala.

        Args:
            B: Largura da base (m)
            H: Profundidade (m)

        Returns:
            Área (m²)
        """
        p = self.params

        if p.tipo_vala == TipoVala.VERTICAL:
            return B * H
        else:
            # Vala taludada: A = (B + B_topo) / 2 * H
            # B_topo = B + 2 * talude * H
            B_topo = B + 2 * p.talude * H
            return (B + B_topo) / 2 * H

    def calculate_shoring_area(self, H: float, L: float) -> float:
        """
        Calcula área de escoramento.

        A_esc = 2 * H * L (duas faces da vala)
        """
        return 2 * H * L

    def calculate_pipe_volume(self, DN_mm: int, L: float) -> float:
        """
        Calcula volume ocupado pelo tubo.

        V_tubo = π * (DN_ext)² / 4 * L
        """
        # Considerar diâmetro externo aproximado
        DN_ext_m = (DN_mm * 1.1) / 1000  # 10% maior que nominal
        return PI * (DN_ext_m ** 2) / 4 * L

    def calculate_bedding_volume(self, B: float, L: float) -> float:
        """
        Calcula volume do berço.

        V_berco = B * esp_berco * L
        """
        return B * self.params.esp_berco * L

    def calculate_envelope_volume(
        self,
        B: float,
        DN_mm: int,
        L: float,
    ) -> float:
        """
        Calcula volume da envoltória (material ao redor do tubo).

        V_env = (B * h_env * L) - V_tubo
        Onde h_env = DN + esp_envoltoria
        """
        p = self.params
        DN_m = DN_mm / 1000
        DN_ext_m = DN_m * 1.1

        h_env = DN_ext_m + p.esp_envoltoria
        vol_total = B * h_env * L
        vol_tubo = self.calculate_pipe_volume(DN_mm, L)

        return max(vol_total - vol_tubo, 0)

    def calculate_backfill_volume(
        self,
        vol_escavacao: float,
        vol_tubo: float,
        vol_berco: float,
        vol_envoltoria: float,
    ) -> float:
        """
        Calcula volume de reaterro comum.

        V_reat = V_esc - V_tubo - V_berco - V_env
        """
        return max(vol_escavacao - vol_tubo - vol_berco - vol_envoltoria, 0)

    def calculate_waste_volume(
        self,
        vol_escavacao: float,
        vol_tubo: float,
    ) -> float:
        """
        Calcula volume de bota-fora.

        V_botafora = V_esc * fator_empolamento - (V_esc - V_tubo)
        Ou seja, volume que não cabe de volta na vala após empolamento.
        """
        p = self.params
        vol_empolado = vol_escavacao * p.fator_empolamento
        vol_retorno = vol_escavacao - vol_tubo
        return max(vol_empolado - vol_retorno, vol_tubo * p.fator_empolamento)

    def calculate_pavement_area(self, B: float, L: float) -> float:
        """
        Calcula área de recomposição de pavimento.

        A_pav = (B + 2 * faixa_tecnica) * L
        """
        p = self.params
        largura_recomp = B + 2 * p.faixa_tecnica
        return largura_recomp * L

    def calculate_pavement_volumes(
        self,
        area_pav: float,
        tipo_pavimento: TipoPavimento,
    ) -> tuple:
        """
        Calcula volumes de recomposição de pavimento.

        Returns:
            Tuple (vol_subbase, vol_base, vol_asfalto)
        """
        p = self.params

        if tipo_pavimento in (TipoPavimento.NAO_PAVIMENTADO, TipoPavimento.TERRA):
            return 0.0, 0.0, 0.0

        vol_base = area_pav * p.esp_base

        if tipo_pavimento == TipoPavimento.ASFALTO:
            vol_subbase = area_pav * p.esp_subbase
            vol_asfalto = area_pav * p.esp_asfalto
            return vol_subbase, vol_base, vol_asfalto

        elif tipo_pavimento == TipoPavimento.CONCRETO:
            vol_subbase = area_pav * p.esp_subbase
            return vol_subbase, vol_base, 0.0

        else:  # PARALELEPIPEDO, BLOQUETE
            return 0.0, vol_base, 0.0

    def calculate(
        self,
        link_id: str,
        DN_mm: int,
        length: float,
        prof_up: float,
        prof_down: float,
        tipo_pavimento: TipoPavimento = TipoPavimento.NAO_PAVIMENTADO,
    ) -> QuantityResult:
        """
        Calcula todos os quantitativos para um trecho.

        Args:
            link_id: ID do trecho
            DN_mm: Diâmetro nominal (mm)
            length: Comprimento (m)
            prof_up: Profundidade na montante (m)
            prof_down: Profundidade na jusante (m)
            tipo_pavimento: Tipo de pavimento

        Returns:
            QuantityResult
        """
        p = self.params

        # Profundidade média
        prof_media = (prof_up + prof_down) / 2

        # Largura da vala
        B = self.calculate_trench_width(DN_mm)

        # Área da seção e volume de escavação
        area_secao = self.calculate_trench_section_area(B, prof_media)
        vol_escavacao = area_secao * length

        # Escoramento
        escoramento_necessario = prof_media > p.prof_escoramento
        area_escoramento = 0.0
        if escoramento_necessario:
            area_escoramento = self.calculate_shoring_area(prof_media, length)

        # Volume do tubo
        vol_tubo = self.calculate_pipe_volume(DN_mm, length)

        # Berço
        vol_berco = self.calculate_bedding_volume(B, length)

        # Envoltória
        vol_envoltoria = self.calculate_envelope_volume(B, DN_mm, length)

        # Reaterro
        vol_reaterro = self.calculate_backfill_volume(
            vol_escavacao, vol_tubo, vol_berco, vol_envoltoria
        )

        # Bota-fora
        vol_botafora = self.calculate_waste_volume(vol_escavacao, vol_tubo)

        # Pavimento
        area_pavimento = self.calculate_pavement_area(B, length)
        vol_subbase, vol_base, vol_asfalto = self.calculate_pavement_volumes(
            area_pavimento, tipo_pavimento
        )

        result = QuantityResult(
            link_id=link_id,
            length=length,
            DN_mm=DN_mm,
            prof_media=prof_media,
            largura_vala=B,
            area_secao=area_secao,
            vol_escavacao=vol_escavacao,
            escoramento_necessario=escoramento_necessario,
            area_escoramento=area_escoramento,
            vol_tubo=vol_tubo,
            vol_berco=vol_berco,
            vol_envoltoria=vol_envoltoria,
            vol_reaterro=vol_reaterro,
            vol_botafora=vol_botafora,
            tipo_pavimento=tipo_pavimento,
            area_pavimento=area_pavimento,
            vol_subbase=vol_subbase,
            vol_base=vol_base,
            vol_asfalto=vol_asfalto,
        )

        self.results[link_id] = result
        return result

    def calculate_totals(self) -> Dict[str, float]:
        """Calcula totais de todos os trechos."""
        totals = {
            'comprimento_total': 0.0,
            'vol_escavacao_total': 0.0,
            'area_escoramento_total': 0.0,
            'vol_berco_total': 0.0,
            'vol_envoltoria_total': 0.0,
            'vol_reaterro_total': 0.0,
            'vol_botafora_total': 0.0,
            'area_pavimento_total': 0.0,
            'vol_subbase_total': 0.0,
            'vol_base_total': 0.0,
            'vol_asfalto_total': 0.0,
        }

        for r in self.results.values():
            totals['comprimento_total'] += r.length
            totals['vol_escavacao_total'] += r.vol_escavacao
            totals['area_escoramento_total'] += r.area_escoramento
            totals['vol_berco_total'] += r.vol_berco
            totals['vol_envoltoria_total'] += r.vol_envoltoria
            totals['vol_reaterro_total'] += r.vol_reaterro
            totals['vol_botafora_total'] += r.vol_botafora
            totals['area_pavimento_total'] += r.area_pavimento
            totals['vol_subbase_total'] += r.vol_subbase
            totals['vol_base_total'] += r.vol_base
            totals['vol_asfalto_total'] += r.vol_asfalto

        return totals


def calculate_quantities(
    link_data: Dict[str, Dict[str, Any]],
    params: ConstructionParams = None,
    default_pavement: TipoPavimento = TipoPavimento.ASFALTO,
) -> Dict[str, QuantityResult]:
    """
    Função de conveniência para calcular quantitativos.

    Args:
        link_data: Dados dos links {link_id: {'DN': mm, 'length': m, 'cover_up': m, 'cover_down': m, 'pavement': str}}
        params: Parâmetros de construção
        default_pavement: Tipo de pavimento padrão

    Returns:
        Dicionário de resultados por link
    """
    calculator = QuantityCalculator(params)

    for link_id, data in link_data.items():
        DN = data.get('DN', data.get('DN_MM', 200))
        length = data.get('length', data.get('LENGTH_M', 0))
        prof_up = data.get('cover_up', data.get('COV_UP_M', 1.5))
        prof_down = data.get('cover_down', data.get('COV_DN_M', 1.5))

        pav_str = data.get('pavement', data.get('PAVEMENT', ''))
        try:
            tipo_pav = TipoPavimento(pav_str.lower()) if pav_str else default_pavement
        except ValueError:
            tipo_pav = default_pavement

        calculator.calculate(link_id, DN, length, prof_up, prof_down, tipo_pav)

    return calculator.results
