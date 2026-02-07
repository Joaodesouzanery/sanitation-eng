"""
Cálculo de rede de esgoto por gravidade.

Etapas:
1. Calcular contribuição por nó (população, vazão média, pico, infiltração)
2. Acumular vazões por ordem topológica
3. Definir cotas de fundo (invert) por cobertura mínima e declividade
4. Dimensionar diâmetro com Manning
5. Verificar y/D, velocidades mín/máx
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..core.constants import SewerDefaults, SHP_FIELD_NAMES, MANNING_N
from ..core.topology import NetworkTopology, accumulate_upstream, Link, Node
from ..core.hydraulics import (
    manning_flow_circular,
    manning_velocity,
    raio_hidraulico,
    y_d_ratio_from_flow,
    select_commercial_diameter,
    manning_diameter_required,
)


@dataclass
class SewerParams:
    """Parâmetros para cálculo de rede de esgoto."""

    # Contribuições
    qpc: float = SewerDefaults.QPC  # L/hab.dia
    hab_por_uh: float = SewerDefaults.HAB_POR_UH
    coef_retorno: float = SewerDefaults.COEF_RETORNO
    taxa_infiltracao: float = SewerDefaults.TAXA_INFILTRACAO  # L/s por metro

    # Hidráulica
    manning_n: float = SewerDefaults.MANNING_N
    S_min: float = SewerDefaults.S_MIN
    S_max: float = SewerDefaults.S_MAX
    V_min: float = SewerDefaults.V_MIN
    V_max: float = SewerDefaults.V_MAX
    yD_min: float = SewerDefaults.YD_MIN
    yD_max: float = SewerDefaults.YD_MAX

    # Cobertura
    cobertura_min: float = SewerDefaults.COBERTURA_MIN
    cobertura_max: float = SewerDefaults.COBERTURA_MAX

    # Diâmetros
    DN_min: int = SewerDefaults.DN_MIN
    DN_comerciais: List[int] = None

    def __post_init__(self):
        if self.DN_comerciais is None:
            self.DN_comerciais = SewerDefaults.DN_COMERCIAIS.copy()


@dataclass
class SewerNodeResult:
    """Resultados calculados para um nó de esgoto."""
    node_id: str
    population: float = 0.0
    Qm: float = 0.0  # Vazão média (L/s)
    Kp: float = 1.0  # Fator de pico
    Qp: float = 0.0  # Vazão de pico (L/s)
    ground_elev: float = 0.0  # Cota do terreno (m)
    invert_elev: float = 0.0  # Cota de fundo (m)


@dataclass
class SewerLinkResult:
    """Resultados calculados para um trecho de esgoto."""
    link_id: str

    # Vazões
    Q_local: float = 0.0  # Vazão local (L/s)
    Q_upstream: float = 0.0  # Vazão acumulada montante (L/s)
    Q_inf: float = 0.0  # Vazão de infiltração (L/s)
    Q_total: float = 0.0  # Vazão total (L/s)

    # Geometria
    length: float = 0.0  # Comprimento (m)
    DN: int = 0  # Diâmetro nominal (mm)
    slope: float = 0.0  # Declividade (m/m)
    invert_up: float = 0.0  # Cota fundo montante (m)
    invert_down: float = 0.0  # Cota fundo jusante (m)
    cover_up: float = 0.0  # Cobertura montante (m)
    cover_down: float = 0.0  # Cobertura jusante (m)

    # Hidráulica
    velocity: float = 0.0  # Velocidade (m/s)
    y_D: float = 0.0  # Relação lâmina/diâmetro

    # Validação
    status: str = 'OK'
    alerts: List[str] = None

    def __post_init__(self):
        if self.alerts is None:
            self.alerts = []


class SewerCalculator:
    """Calculadora de rede de esgoto por gravidade."""

    def __init__(self, params: SewerParams = None):
        self.params = params or SewerParams()
        self.node_results: Dict[str, SewerNodeResult] = {}
        self.link_results: Dict[str, SewerLinkResult] = {}

    def calculate_node_contribution(
        self,
        node: Node,
        uh: float = 0.0,
        pop: float = None,
    ) -> SewerNodeResult:
        """
        Calcula contribuição de esgoto em um nó.

        Args:
            node: Nó da rede
            uh: Número de unidades habitacionais
            pop: População (se fornecida, ignora UH)

        Returns:
            SewerNodeResult com vazões calculadas
        """
        p = self.params

        # População
        if pop is not None:
            population = pop
        else:
            population = uh * p.hab_por_uh

        # Vazão média: Qm = (qpc * POP * Cret) / 86400
        Qm = (p.qpc * population * p.coef_retorno) / 86400  # L/s

        # Fator de pico (Harmon)
        pop_milhares = population / 1000
        Kp = SewerDefaults.fator_pico_harmon(pop_milhares)

        # Vazão de pico
        Qp = Qm * Kp

        result = SewerNodeResult(
            node_id=node.id,
            population=population,
            Qm=Qm,
            Kp=Kp,
            Qp=Qp,
            ground_elev=node.z,
        )

        self.node_results[node.id] = result
        return result

    def calculate_link(
        self,
        link: Link,
        topology: NetworkTopology,
        Q_accumulated: float = None,
    ) -> SewerLinkResult:
        """
        Calcula hidráulica de um trecho de esgoto.

        Args:
            link: Trecho da rede
            topology: Topologia da rede
            Q_accumulated: Vazão acumulada de montante (se já calculada)

        Returns:
            SewerLinkResult com dimensionamento
        """
        p = self.params
        from_node = topology.nodes[link.from_node]
        to_node = topology.nodes[link.to_node]

        # Vazão local (contribuição do nó de montante)
        Q_local = 0.0
        if link.from_node in self.node_results:
            Q_local = self.node_results[link.from_node].Qp

        # Vazão acumulada de montante
        if Q_accumulated is None:
            Q_accumulated = self._accumulate_flow_upstream(topology, link.id)

        # Vazão de infiltração
        Q_inf = p.taxa_infiltracao * link.length

        # Vazão total
        Q_total = Q_local + Q_accumulated + Q_inf

        # Converter para m³/s para cálculos
        Q_m3s = Q_total / 1000

        # Declividade do terreno
        dz = from_node.z - to_node.z
        S_terreno = dz / link.length if link.length > 0 else 0

        # Usar declividade mínima se necessário
        slope = max(S_terreno, p.S_min)

        # Dimensionar diâmetro
        D_required = manning_diameter_required(Q_m3s, slope, p.manning_n, p.yD_max)
        DN = select_commercial_diameter(D_required, p.DN_comerciais)
        DN = max(DN, p.DN_min)

        D_m = DN / 1000  # Converter para metros

        # Calcular y/D real
        y_D = y_d_ratio_from_flow(Q_m3s, D_m, slope, p.manning_n)

        # Calcular velocidade
        y = y_D * D_m
        R = raio_hidraulico(D_m, y) if y > 0 else D_m / 4
        velocity = manning_velocity(R, slope, p.manning_n)

        # Cotas de fundo (invert)
        # Usar cobertura mínima a partir do terreno
        invert_up = from_node.z - p.cobertura_min - (DN / 1000)
        invert_down = invert_up - slope * link.length

        # Verificar cobertura no nó de jusante
        cover_up = from_node.z - invert_up
        cover_down = to_node.z - invert_down

        # Verificações
        alerts = []

        if velocity < p.V_min:
            alerts.append(f"V={velocity:.2f}m/s < Vmin={p.V_min}m/s")

        if velocity > p.V_max:
            alerts.append(f"V={velocity:.2f}m/s > Vmax={p.V_max}m/s")

        if y_D < p.yD_min:
            alerts.append(f"y/D={y_D:.2f} < min={p.yD_min}")

        if y_D > p.yD_max:
            alerts.append(f"y/D={y_D:.2f} > max={p.yD_max}")

        if cover_down < p.cobertura_min:
            alerts.append(f"Cobertura={cover_down:.2f}m < min={p.cobertura_min}m")

        if cover_down > p.cobertura_max:
            alerts.append(f"Cobertura={cover_down:.2f}m > max={p.cobertura_max}m")

        if slope < p.S_min:
            alerts.append(f"S={slope:.4f} < Smin={p.S_min}")

        # Status
        status = 'OK'
        if any('>' in a or '<' in a for a in alerts):
            status = 'WARN'
        if cover_down < 0:
            status = 'ERROR'
            alerts.append("Cota de fundo acima do terreno!")

        result = SewerLinkResult(
            link_id=link.id,
            Q_local=Q_local,
            Q_upstream=Q_accumulated,
            Q_inf=Q_inf,
            Q_total=Q_total,
            length=link.length,
            DN=DN,
            slope=slope,
            invert_up=invert_up,
            invert_down=invert_down,
            cover_up=cover_up,
            cover_down=cover_down,
            velocity=velocity,
            y_D=y_D,
            status=status,
            alerts=alerts,
        )

        self.link_results[link.id] = result
        return result

    def _accumulate_flow_upstream(self, topology: NetworkTopology, link_id: str) -> float:
        """Acumula vazões de montante."""
        def get_flow(link: Link) -> float:
            if link.id in self.link_results:
                return self.link_results[link.id].Q_total
            return 0.0

        return accumulate_upstream(topology, link_id, get_flow, include_self=False)

    def calculate_network(
        self,
        topology: NetworkTopology,
        node_data: Dict[str, Dict[str, Any]] = None,
    ) -> None:
        """
        Calcula toda a rede de esgoto.

        Args:
            topology: Topologia da rede
            node_data: Dados dos nós {node_id: {'uh': x, 'pop': y, ...}}
        """
        if node_data is None:
            node_data = {}

        # 1. Calcular contribuições em cada nó
        for node_id, node in topology.nodes.items():
            data = node_data.get(node_id, {})
            uh = data.get('uh', data.get('UH', 0))
            pop = data.get('pop', data.get('POP', None))
            self.calculate_node_contribution(node, uh=uh, pop=pop)

        # 2. Calcular links em ordem topológica
        for link_id in topology.topological_order:
            link = topology.links[link_id]
            self.calculate_link(link, topology)

    def get_results_for_export(self) -> Dict[str, Dict[str, Any]]:
        """Retorna resultados formatados para exportação."""
        results = {}

        for link_id, r in self.link_results.items():
            results[link_id] = {
                SHP_FIELD_NAMES['flow']: round(r.Q_total, 2),
                SHP_FIELD_NAMES['velocity']: round(r.velocity, 2),
                SHP_FIELD_NAMES['diameter']: r.DN,
                SHP_FIELD_NAMES['slope']: round(r.slope, 5),
                SHP_FIELD_NAMES['y_d_ratio']: round(r.y_D, 3),
                SHP_FIELD_NAMES['invert_up']: round(r.invert_up, 3),
                SHP_FIELD_NAMES['invert_down']: round(r.invert_down, 3),
                SHP_FIELD_NAMES['cover_up']: round(r.cover_up, 2),
                SHP_FIELD_NAMES['cover_down']: round(r.cover_down, 2),
                SHP_FIELD_NAMES['length']: round(r.length, 2),
                SHP_FIELD_NAMES['status']: r.status,
                SHP_FIELD_NAMES['alerts']: '; '.join(r.alerts) if r.alerts else '',
            }

        return results


def calculate_sewer_network(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]] = None,
    params: SewerParams = None,
) -> Dict[str, SewerLinkResult]:
    """
    Função de conveniência para calcular rede de esgoto.

    Args:
        topology: Topologia da rede
        node_data: Dados dos nós
        params: Parâmetros de cálculo

    Returns:
        Dicionário de resultados por link
    """
    calculator = SewerCalculator(params)
    calculator.calculate_network(topology, node_data)
    return calculator.link_results
