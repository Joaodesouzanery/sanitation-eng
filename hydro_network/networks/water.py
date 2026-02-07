"""
Cálculo de rede de água pressurizada.

Etapas:
1. Calcular demandas por nó (Qm, Qmd, Qmh)
2. Calcular perdas de carga por Hazen-Williams
3. Resolver pressões nos nós (método iterativo simplificado)
4. Dimensionar diâmetros para atender pressão min/max
5. Calcular boosters se necessário
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import math

from ..core.constants import WaterDefaults, SHP_FIELD_NAMES, HAZEN_WILLIAMS_C, GRAVITY
from ..core.topology import NetworkTopology, Link, Node
from ..core.hydraulics import (
    hazen_williams_headloss,
    hazen_williams_velocity,
    hazen_williams_diameter_required,
    select_commercial_diameter,
    pump_power,
    pump_power_cv,
)


@dataclass
class WaterParams:
    """Parâmetros para cálculo de rede de água."""

    # Demandas
    qpc: float = WaterDefaults.QPC  # L/hab.dia
    hab_por_uh: float = WaterDefaults.HAB_POR_UH
    K1: float = WaterDefaults.K1
    K2: float = WaterDefaults.K2

    # Pressões
    P_min: float = WaterDefaults.P_MIN  # mca
    P_max: float = WaterDefaults.P_MAX  # mca
    P_estatica_max: float = WaterDefaults.P_ESTATICA_MAX

    # Hidráulica
    hazen_williams_C: float = WaterDefaults.HAZEN_WILLIAMS_C
    V_min: float = WaterDefaults.V_MIN
    V_max: float = WaterDefaults.V_MAX

    # Bombeamento
    rendimento_bomba: float = WaterDefaults.RENDIMENTO_BOMBA

    # Diâmetros
    DN_min: int = WaterDefaults.DN_MIN
    DN_comerciais: List[int] = None

    # Reservatório (cota piezométrica de referência)
    cota_reservatorio: float = 0.0

    def __post_init__(self):
        if self.DN_comerciais is None:
            self.DN_comerciais = WaterDefaults.DN_COMERCIAIS.copy()


@dataclass
class WaterNodeResult:
    """Resultados calculados para um nó de água."""
    node_id: str
    population: float = 0.0
    Qm: float = 0.0  # Vazão média (L/s)
    Qmd: float = 0.0  # Vazão máxima diária (L/s)
    Qmh: float = 0.0  # Vazão máxima horária (L/s)
    ground_elev: float = 0.0  # Cota do terreno (m)
    head: float = 0.0  # Carga hidráulica (m)
    pressure: float = 0.0  # Pressão (mca)
    status: str = 'OK'
    alerts: List[str] = field(default_factory=list)


@dataclass
class WaterLinkResult:
    """Resultados calculados para um trecho de água."""
    link_id: str

    # Vazões
    Q: float = 0.0  # Vazão no trecho (L/s)

    # Geometria
    length: float = 0.0  # Comprimento (m)
    DN: int = 0  # Diâmetro nominal (mm)

    # Hidráulica
    velocity: float = 0.0  # Velocidade (m/s)
    headloss: float = 0.0  # Perda de carga (m)
    headloss_unit: float = 0.0  # Perda de carga unitária (m/m)

    # Validação
    status: str = 'OK'
    alerts: List[str] = field(default_factory=list)


@dataclass
class BoosterResult:
    """Resultados de cálculo de booster/bomba."""
    node_id: str
    Q: float = 0.0  # Vazão (L/s)
    head_in: float = 0.0  # Carga entrada (m)
    head_out: float = 0.0  # Carga saída (m)
    delta_H: float = 0.0  # Altura manométrica (m)
    power_kw: float = 0.0  # Potência (kW)
    power_cv: float = 0.0  # Potência (CV)


class WaterCalculator:
    """Calculadora de rede de água pressurizada."""

    def __init__(self, params: WaterParams = None):
        self.params = params or WaterParams()
        self.node_results: Dict[str, WaterNodeResult] = {}
        self.link_results: Dict[str, WaterLinkResult] = {}
        self.boosters: List[BoosterResult] = []

    def calculate_node_demand(
        self,
        node: Node,
        uh: float = 0.0,
        pop: float = None,
        demand: float = None,
    ) -> WaterNodeResult:
        """
        Calcula demanda de água em um nó.

        Args:
            node: Nó da rede
            uh: Número de unidades habitacionais
            pop: População (se fornecida, ignora UH)
            demand: Demanda direta em L/s (se fornecida, ignora cálculo)

        Returns:
            WaterNodeResult com demandas calculadas
        """
        p = self.params

        if demand is not None:
            # Demanda fornecida diretamente
            Qm = demand
            population = 0
        else:
            # Calcular por população
            if pop is not None:
                population = pop
            else:
                population = uh * p.hab_por_uh

            # Vazão média: Qm = (qpc * POP) / 86400
            Qm = (p.qpc * population) / 86400  # L/s

        # Vazões de projeto
        Qmd = Qm * p.K1  # Máxima diária
        Qmh = Qmd * p.K2  # Máxima horária

        result = WaterNodeResult(
            node_id=node.id,
            population=population,
            Qm=Qm,
            Qmd=Qmd,
            Qmh=Qmh,
            ground_elev=node.z,
        )

        self.node_results[node.id] = result
        return result

    def calculate_link(
        self,
        link: Link,
        topology: NetworkTopology,
        Q: float,
        head_upstream: float,
    ) -> Tuple[WaterLinkResult, float]:
        """
        Calcula hidráulica de um trecho de água.

        Args:
            link: Trecho da rede
            topology: Topologia da rede
            Q: Vazão no trecho (L/s)
            head_upstream: Carga no nó de montante (m)

        Returns:
            Tuple (resultado, carga no nó de jusante)
        """
        p = self.params

        Q_m3s = Q / 1000  # Converter para m³/s

        # Verificar se há vazão
        if Q_m3s <= 0:
            # Trecho sem vazão, manter diâmetro mínimo
            result = WaterLinkResult(
                link_id=link.id,
                Q=Q,
                length=link.length,
                DN=p.DN_min,
                velocity=0,
                headloss=0,
                headloss_unit=0,
                status='OK',
            )
            self.link_results[link.id] = result
            return result, head_upstream

        # Dimensionar diâmetro
        # Critério: limitar perda de carga e velocidade
        hf_target = link.length * 0.005  # 5 m/km inicial

        D_required = hazen_williams_diameter_required(
            Q_m3s, link.length, max(hf_target, 0.1), p.hazen_williams_C
        )

        DN = select_commercial_diameter(D_required, p.DN_comerciais)
        DN = max(DN, p.DN_min)

        D_m = DN / 1000

        # Calcular velocidade
        velocity = hazen_williams_velocity(Q_m3s, D_m)

        # Verificar velocidade e redimensionar se necessário
        if velocity > p.V_max:
            # Aumentar diâmetro
            for dn in p.DN_comerciais:
                if dn > DN:
                    v_test = hazen_williams_velocity(Q_m3s, dn / 1000)
                    if v_test <= p.V_max:
                        DN = dn
                        D_m = DN / 1000
                        velocity = v_test
                        break

        # Calcular perda de carga
        headloss = hazen_williams_headloss(Q_m3s, D_m, link.length, p.hazen_williams_C)
        headloss_unit = headloss / link.length if link.length > 0 else 0

        # Carga no nó de jusante
        head_downstream = head_upstream - headloss

        # Verificações
        alerts = []

        if velocity < p.V_min and Q > 0:
            alerts.append(f"V={velocity:.2f}m/s < Vmin={p.V_min}m/s")

        if velocity > p.V_max:
            alerts.append(f"V={velocity:.2f}m/s > Vmax={p.V_max}m/s")

        if headloss_unit > 0.015:  # 15 m/km
            alerts.append(f"J={headloss_unit*1000:.1f}m/km > 15m/km")

        status = 'OK' if not alerts else 'WARN'

        result = WaterLinkResult(
            link_id=link.id,
            Q=Q,
            length=link.length,
            DN=DN,
            velocity=velocity,
            headloss=headloss,
            headloss_unit=headloss_unit,
            status=status,
            alerts=alerts,
        )

        self.link_results[link.id] = result
        return result, head_downstream

    def calculate_node_pressure(self, node_id: str, head: float) -> None:
        """Calcula pressão em um nó dada a carga."""
        if node_id in self.node_results:
            result = self.node_results[node_id]
            result.head = head
            result.pressure = head - result.ground_elev

            p = self.params

            if result.pressure < p.P_min:
                result.alerts.append(f"P={result.pressure:.1f}mca < Pmin={p.P_min}mca")
                result.status = 'WARN'

            if result.pressure > p.P_max:
                result.alerts.append(f"P={result.pressure:.1f}mca > Pmax={p.P_max}mca")
                result.status = 'WARN'

    def calculate_booster(
        self,
        node_id: str,
        Q: float,
        head_in: float,
        head_required: float,
    ) -> BoosterResult:
        """
        Calcula booster necessário.

        Args:
            node_id: ID do nó
            Q: Vazão (L/s)
            head_in: Carga de entrada (m)
            head_required: Carga requerida na saída (m)

        Returns:
            BoosterResult
        """
        p = self.params

        delta_H = head_required - head_in
        Q_m3s = Q / 1000

        power_kw = pump_power(Q_m3s, delta_H, p.rendimento_bomba)
        power_cv = pump_power_cv(Q_m3s, delta_H, p.rendimento_bomba)

        booster = BoosterResult(
            node_id=node_id,
            Q=Q,
            head_in=head_in,
            head_out=head_required,
            delta_H=delta_H,
            power_kw=power_kw,
            power_cv=power_cv,
        )

        self.boosters.append(booster)
        return booster

    def calculate_network_simple(
        self,
        topology: NetworkTopology,
        node_data: Dict[str, Dict[str, Any]] = None,
        source_node: str = None,
    ) -> None:
        """
        Calcula rede de água (método simplificado para redes ramificadas).

        Para redes malhadas, use EPANET ou método de Hardy-Cross.

        Args:
            topology: Topologia da rede
            node_data: Dados dos nós {node_id: {'uh': x, 'pop': y, 'demand': z}}
            source_node: Nó de origem (reservatório)
        """
        if node_data is None:
            node_data = {}

        p = self.params

        # 1. Calcular demandas em cada nó
        for node_id, node in topology.nodes.items():
            data = node_data.get(node_id, {})
            uh = data.get('uh', data.get('UH', 0))
            pop = data.get('pop', data.get('POP', None))
            demand = data.get('demand', data.get('DEM_LS', None))
            self.calculate_node_demand(node, uh=uh, pop=pop, demand=demand)

        # 2. Identificar nó fonte
        if source_node is None:
            # Usar primeiro nó sem links de entrada
            sources = set(topology.nodes.keys()) - set(
                link.to_node for link in topology.links.values()
            )
            if sources:
                source_node = list(sources)[0]
            else:
                source_node = list(topology.nodes.keys())[0]

        # 3. Calcular vazões em cada trecho (acumulando demandas a jusante)
        link_flows = self._calculate_link_flows(topology, source_node)

        # 4. Calcular hidráulica e pressões
        head_source = p.cota_reservatorio if p.cota_reservatorio > 0 else (
            topology.nodes[source_node].z + 30  # 30m acima do terreno
        )

        self._calculate_pressures(topology, source_node, head_source, link_flows)

    def _calculate_link_flows(
        self,
        topology: NetworkTopology,
        source_node: str,
    ) -> Dict[str, float]:
        """Calcula vazões em cada trecho por acumulação de demandas."""
        link_flows: Dict[str, float] = {}

        # Calcular vazão a jusante de cada link recursivamente
        def get_downstream_demand(node_id: str, visited: set) -> float:
            if node_id in visited:
                return 0.0
            visited.add(node_id)

            # Demanda do próprio nó
            total = self.node_results.get(node_id, WaterNodeResult(node_id)).Qmh

            # Demandas a jusante
            for link_id in topology.downstream.get(node_id, []):
                link = topology.links[link_id]
                total += get_downstream_demand(link.to_node, visited)

            return total

        # Calcular para cada link
        for link_id, link in topology.links.items():
            downstream_demand = get_downstream_demand(link.to_node, set())
            link_flows[link_id] = downstream_demand

        return link_flows

    def _calculate_pressures(
        self,
        topology: NetworkTopology,
        source_node: str,
        head_source: float,
        link_flows: Dict[str, float],
    ) -> None:
        """Propaga cálculo de pressões pela rede."""
        self.calculate_node_pressure(source_node, head_source)

        visited = set([source_node])
        queue = [source_node]

        while queue:
            node_id = queue.pop(0)
            current_head = self.node_results[node_id].head

            for link_id in topology.downstream.get(node_id, []):
                link = topology.links[link_id]
                Q = link_flows.get(link_id, 0)

                _, head_downstream = self.calculate_link(
                    link, topology, Q, current_head
                )

                if link.to_node not in visited:
                    visited.add(link.to_node)
                    self.calculate_node_pressure(link.to_node, head_downstream)
                    queue.append(link.to_node)

    def get_results_for_export(self) -> Dict[str, Dict[str, Any]]:
        """Retorna resultados formatados para exportação."""
        results = {}

        for link_id, r in self.link_results.items():
            results[link_id] = {
                SHP_FIELD_NAMES['flow']: round(r.Q, 2),
                SHP_FIELD_NAMES['velocity']: round(r.velocity, 2),
                SHP_FIELD_NAMES['diameter']: r.DN,
                SHP_FIELD_NAMES['headloss']: round(r.headloss, 3),
                SHP_FIELD_NAMES['length']: round(r.length, 2),
                SHP_FIELD_NAMES['status']: r.status,
                SHP_FIELD_NAMES['alerts']: '; '.join(r.alerts) if r.alerts else '',
            }

        return results

    def get_node_results_for_export(self) -> Dict[str, Dict[str, Any]]:
        """Retorna resultados de nós para exportação."""
        results = {}

        for node_id, r in self.node_results.items():
            results[node_id] = {
                SHP_FIELD_NAMES['pressure']: round(r.pressure, 2),
                SHP_FIELD_NAMES['head']: round(r.head, 2),
                SHP_FIELD_NAMES['demand']: round(r.Qmh, 2),
                SHP_FIELD_NAMES['population']: int(r.population),
                SHP_FIELD_NAMES['elevation']: round(r.ground_elev, 2),
                SHP_FIELD_NAMES['status']: r.status,
                SHP_FIELD_NAMES['alerts']: '; '.join(r.alerts) if r.alerts else '',
            }

        return results


def calculate_water_network(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]] = None,
    params: WaterParams = None,
    source_node: str = None,
) -> Tuple[Dict[str, WaterLinkResult], Dict[str, WaterNodeResult]]:
    """
    Função de conveniência para calcular rede de água.

    Args:
        topology: Topologia da rede
        node_data: Dados dos nós
        params: Parâmetros de cálculo
        source_node: Nó de origem (reservatório)

    Returns:
        Tuple (resultados links, resultados nós)
    """
    calculator = WaterCalculator(params)
    calculator.calculate_network_simple(topology, node_data, source_node)
    return calculator.link_results, calculator.node_results
