"""
Cálculo de rede de drenagem pluvial (método racional).

Etapas:
1. Calcular área contribuinte e coeficiente de runoff por nó
2. Calcular tempo de concentração
3. Calcular intensidade de chuva (IDF)
4. Calcular vazão pelo método racional: Q = 0.00278 * C * i * A
5. Acumular vazões a montante
6. Dimensionar condutos com Manning
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable

from ..core.constants import DrainageDefaults, SHP_FIELD_NAMES, MANNING_N, IDFSaoPaulo
from ..core.topology import NetworkTopology, accumulate_upstream, Link, Node
from ..core.hydraulics import (
    manning_flow_circular,
    manning_velocity,
    raio_hidraulico,
    y_d_ratio_from_flow,
    select_commercial_diameter,
    manning_diameter_required,
    rational_method_flow,
    time_of_concentration_kirpich,
    idf_intensity,
)


@dataclass
class DrainageParams:
    """Parâmetros para cálculo de drenagem pluvial."""

    # Chuva
    periodo_retorno: float = DrainageDefaults.PERIODO_RETORNO  # anos
    duracao_minima: float = 5.0  # minutos

    # IDF (coeficientes)
    idf_K: float = IDFSaoPaulo.K
    idf_a: float = IDFSaoPaulo.a
    idf_b: float = IDFSaoPaulo.b
    idf_c: float = IDFSaoPaulo.c

    # Hidráulica
    manning_n: float = DrainageDefaults.MANNING_N_CONCRETO
    S_min: float = DrainageDefaults.S_MIN
    V_min: float = DrainageDefaults.V_MIN
    V_max: float = DrainageDefaults.V_MAX
    yD_max: float = DrainageDefaults.YD_MAX

    # Diâmetros
    DN_min: int = DrainageDefaults.DN_MIN
    DN_comerciais: List[int] = None

    def __post_init__(self):
        if self.DN_comerciais is None:
            self.DN_comerciais = DrainageDefaults.DN_COMERCIAIS.copy()

    def get_intensity(self, tc: float) -> float:
        """Calcula intensidade de chuva para o tc dado."""
        return idf_intensity(
            self.periodo_retorno, tc,
            self.idf_K, self.idf_a, self.idf_b, self.idf_c
        )


@dataclass
class DrainageNodeResult:
    """Resultados calculados para um nó de drenagem."""
    node_id: str
    area_ha: float = 0.0  # Área contribuinte (ha)
    runoff_coef: float = 0.0  # Coeficiente de runoff
    tc: float = 5.0  # Tempo de concentração (min)
    intensity: float = 0.0  # Intensidade de chuva (mm/h)
    Q_local: float = 0.0  # Vazão local (m³/s)
    ground_elev: float = 0.0


@dataclass
class DrainageLinkResult:
    """Resultados calculados para um trecho de drenagem."""
    link_id: str

    # Vazões
    Q_local: float = 0.0  # Vazão local (m³/s)
    Q_upstream: float = 0.0  # Vazão acumulada montante (m³/s)
    Q_total: float = 0.0  # Vazão total (m³/s)

    # Tempo de concentração
    tc_upstream: float = 5.0  # tc acumulado de montante (min)
    tc_trecho: float = 0.0  # Tempo no trecho (min)
    tc_total: float = 5.0  # tc total (min)

    # Intensidade
    intensity: float = 0.0  # Intensidade de chuva (mm/h)

    # Área e runoff acumulados
    area_total: float = 0.0  # Área total (ha)
    runoff_medio: float = 0.0  # Coeficiente médio ponderado

    # Geometria
    length: float = 0.0  # Comprimento (m)
    DN: int = 0  # Diâmetro nominal (mm)
    slope: float = 0.0  # Declividade (m/m)

    # Hidráulica
    velocity: float = 0.0  # Velocidade (m/s)
    y_D: float = 0.0  # Relação lâmina/diâmetro

    # Validação
    status: str = 'OK'
    alerts: List[str] = field(default_factory=list)


class DrainageCalculator:
    """Calculadora de rede de drenagem pluvial."""

    def __init__(self, params: DrainageParams = None):
        self.params = params or DrainageParams()
        self.node_results: Dict[str, DrainageNodeResult] = {}
        self.link_results: Dict[str, DrainageLinkResult] = {}

    def calculate_node_contribution(
        self,
        node: Node,
        area_ha: float = 0.0,
        runoff_coef: float = 0.7,
        tc: float = None,
    ) -> DrainageNodeResult:
        """
        Calcula contribuição de drenagem em um nó.

        Args:
            node: Nó da rede
            area_ha: Área contribuinte (hectares)
            runoff_coef: Coeficiente de runoff (0-1)
            tc: Tempo de concentração (min), se já conhecido

        Returns:
            DrainageNodeResult
        """
        p = self.params

        if tc is None:
            tc = p.duracao_minima

        # Intensidade de chuva
        intensity = p.get_intensity(tc)

        # Vazão pelo método racional
        Q_local = rational_method_flow(runoff_coef, intensity, area_ha)

        result = DrainageNodeResult(
            node_id=node.id,
            area_ha=area_ha,
            runoff_coef=runoff_coef,
            tc=tc,
            intensity=intensity,
            Q_local=Q_local,
            ground_elev=node.z,
        )

        self.node_results[node.id] = result
        return result

    def calculate_link(
        self,
        link: Link,
        topology: NetworkTopology,
    ) -> DrainageLinkResult:
        """
        Calcula hidráulica de um trecho de drenagem.

        Args:
            link: Trecho da rede
            topology: Topologia da rede

        Returns:
            DrainageLinkResult
        """
        p = self.params
        from_node = topology.nodes[link.from_node]
        to_node = topology.nodes[link.to_node]

        # Acumular área, runoff e vazão de montante
        area_total, runoff_medio, Q_upstream, tc_upstream = self._accumulate_upstream(
            topology, link.id
        )

        # Contribuição local
        node_result = self.node_results.get(link.from_node)
        if node_result:
            area_total += node_result.area_ha
            # Ponderar runoff
            if area_total > 0:
                runoff_medio = (
                    (runoff_medio * (area_total - node_result.area_ha)) +
                    (node_result.runoff_coef * node_result.area_ha)
                ) / area_total

        # Declividade do terreno
        dz = from_node.z - to_node.z
        slope = dz / link.length if link.length > 0 else p.S_min
        slope = max(slope, p.S_min)

        # Estimar velocidade para calcular tempo no trecho
        V_estimada = 1.5  # m/s inicial
        tc_trecho = link.length / (V_estimada * 60)  # minutos

        # Tempo de concentração total
        tc_total = max(tc_upstream + tc_trecho, p.duracao_minima)

        # Intensidade para o tc total
        intensity = p.get_intensity(tc_total)

        # Vazão total pelo método racional
        Q_total = rational_method_flow(runoff_medio, intensity, area_total)

        # Vazão local do nó
        Q_local = 0.0
        if node_result:
            Q_local = node_result.Q_local

        # Dimensionar diâmetro
        D_required = manning_diameter_required(Q_total, slope, p.manning_n, p.yD_max)
        DN = select_commercial_diameter(D_required, p.DN_comerciais)
        DN = max(DN, p.DN_min)

        D_m = DN / 1000

        # Calcular y/D real
        y_D = y_d_ratio_from_flow(Q_total, D_m, slope, p.manning_n)

        # Calcular velocidade
        y = y_D * D_m
        R = raio_hidraulico(D_m, y) if y > 0 else D_m / 4
        velocity = manning_velocity(R, slope, p.manning_n)

        # Atualizar tc_trecho com velocidade real
        if velocity > 0:
            tc_trecho = link.length / (velocity * 60)

        # Verificações
        alerts = []

        if velocity < p.V_min and Q_total > 0:
            alerts.append(f"V={velocity:.2f}m/s < Vmin={p.V_min}m/s")

        if velocity > p.V_max:
            alerts.append(f"V={velocity:.2f}m/s > Vmax={p.V_max}m/s")

        if y_D > p.yD_max:
            alerts.append(f"y/D={y_D:.2f} > max={p.yD_max}")

        if slope < p.S_min:
            alerts.append(f"S={slope:.4f} < Smin={p.S_min}")

        status = 'OK' if not alerts else 'WARN'

        result = DrainageLinkResult(
            link_id=link.id,
            Q_local=Q_local,
            Q_upstream=Q_upstream,
            Q_total=Q_total,
            tc_upstream=tc_upstream,
            tc_trecho=tc_trecho,
            tc_total=tc_total,
            intensity=intensity,
            area_total=area_total,
            runoff_medio=runoff_medio,
            length=link.length,
            DN=DN,
            slope=slope,
            velocity=velocity,
            y_D=y_D,
            status=status,
            alerts=alerts,
        )

        self.link_results[link.id] = result
        return result

    def _accumulate_upstream(
        self,
        topology: NetworkTopology,
        link_id: str,
    ) -> tuple:
        """
        Acumula área, runoff médio, vazão e tc de montante.

        Returns:
            Tuple (area_total, runoff_medio, Q_total, tc_max)
        """
        link = topology.links[link_id]
        upstream_link_ids = topology.upstream.get(link.from_node, [])

        if not upstream_link_ids:
            return 0.0, 0.7, 0.0, self.params.duracao_minima

        area_total = 0.0
        weighted_runoff = 0.0
        Q_total = 0.0
        tc_max = self.params.duracao_minima

        for upstream_id in upstream_link_ids:
            if upstream_id in self.link_results:
                r = self.link_results[upstream_id]
                area_total += r.area_total
                weighted_runoff += r.runoff_medio * r.area_total
                Q_total = max(Q_total, r.Q_total)  # Usar máxima vazão convergente
                tc_max = max(tc_max, r.tc_total)

        runoff_medio = weighted_runoff / area_total if area_total > 0 else 0.7

        return area_total, runoff_medio, Q_total, tc_max

    def calculate_network(
        self,
        topology: NetworkTopology,
        node_data: Dict[str, Dict[str, Any]] = None,
    ) -> None:
        """
        Calcula toda a rede de drenagem.

        Args:
            topology: Topologia da rede
            node_data: Dados dos nós {node_id: {'area_ha': x, 'runoff_coef': y}}
        """
        if node_data is None:
            node_data = {}

        p = self.params

        # 1. Calcular contribuições em cada nó
        for node_id, node in topology.nodes.items():
            data = node_data.get(node_id, {})
            area_ha = data.get('area_ha', data.get('AREA_HA', 0))
            runoff_coef = data.get('runoff_coef', data.get('RUNOFF_C', 0.7))
            tc = data.get('tc', None)
            self.calculate_node_contribution(node, area_ha, runoff_coef, tc)

        # 2. Calcular links em ordem topológica
        for link_id in topology.topological_order:
            link = topology.links[link_id]
            self.calculate_link(link, topology)

    def get_results_for_export(self) -> Dict[str, Dict[str, Any]]:
        """Retorna resultados formatados para exportação."""
        results = {}

        for link_id, r in self.link_results.items():
            results[link_id] = {
                SHP_FIELD_NAMES['flow']: round(r.Q_total * 1000, 2),  # L/s
                SHP_FIELD_NAMES['velocity']: round(r.velocity, 2),
                SHP_FIELD_NAMES['diameter']: r.DN,
                SHP_FIELD_NAMES['slope']: round(r.slope, 5),
                SHP_FIELD_NAMES['y_d_ratio']: round(r.y_D, 3),
                SHP_FIELD_NAMES['area_contrib']: round(r.area_total, 3),
                SHP_FIELD_NAMES['runoff_coef']: round(r.runoff_medio, 2),
                SHP_FIELD_NAMES['intensity']: round(r.intensity, 1),
                SHP_FIELD_NAMES['length']: round(r.length, 2),
                SHP_FIELD_NAMES['status']: r.status,
                SHP_FIELD_NAMES['alerts']: '; '.join(r.alerts) if r.alerts else '',
            }

        return results


def calculate_drainage_network(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]] = None,
    params: DrainageParams = None,
) -> Dict[str, DrainageLinkResult]:
    """
    Função de conveniência para calcular rede de drenagem.

    Args:
        topology: Topologia da rede
        node_data: Dados dos nós
        params: Parâmetros de cálculo

    Returns:
        Dicionário de resultados por link
    """
    calculator = DrainageCalculator(params)
    calculator.calculate_network(topology, node_data)
    return calculator.link_results
