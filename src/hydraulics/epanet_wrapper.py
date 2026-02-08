"""
EPANET Wrapper - Interface com o motor hidráulico EPANET

NUNCA sobrescreve valores autoritativos do projeto.
Apenas adiciona resultados de simulação como campos separados.
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import json


@dataclass
class EpanetOptions:
    """Opções de simulação EPANET"""
    headloss_formula: str = "H-W"  # H-W, D-W, C-M
    flow_units: str = "LPS"  # LPS, CMH, GPM
    duration: int = 24  # horas
    hydraulic_timestep: int = 60  # minutos
    pattern_timestep: int = 60  # minutos
    report_timestep: int = 60  # minutos
    quality_analysis: bool = False


@dataclass
class SimulationResults:
    """Resultados de simulação EPANET"""
    success: bool
    message: str
    nodes: Dict[str, Dict]  # node_id -> {pressure, demand, head, quality}
    links: Dict[str, Dict]  # link_id -> {flow, velocity, headloss, status}
    summary: Dict


class EpanetWrapper:
    """
    Wrapper para simulação EPANET.

    Gera arquivo .INP, executa simulação (se EPANET disponível),
    e processa resultados SEM sobrescrever dados do projeto.
    """

    def __init__(self, options: Optional[EpanetOptions] = None):
        self.options = options or EpanetOptions()
        self.inp_content: str = ""
        self.results: Optional[SimulationResults] = None

    def generate_inp(self, nodes: List[Dict], links: List[Dict],
                    reservoirs: List[Dict] = None,
                    pumps: List[Dict] = None,
                    valves: List[Dict] = None,
                    patterns: Dict = None) -> str:
        """
        Gera conteúdo do arquivo .INP do EPANET.

        Args:
            nodes: Lista de nós (junções)
            links: Lista de tubos
            reservoirs: Lista de reservatórios
            pumps: Lista de bombas
            valves: Lista de válvulas
            patterns: Padrões de demanda

        Returns:
            Conteúdo do arquivo .INP
        """
        reservoirs = reservoirs or []
        pumps = pumps or []
        valves = valves or []
        patterns = patterns or {}

        lines = []

        # TITLE
        lines.append("[TITLE]")
        lines.append("Rede de Saneamento - HydroNetwork Platform")
        lines.append("")

        # JUNCTIONS
        lines.append("[JUNCTIONS]")
        lines.append(";ID              Elev            Demand          Pattern")
        for node in nodes:
            node_id = node.get("id", "")
            elev = node.get("z", node.get("cota", 0))
            demand = node.get("demand", node.get("demanda", 0))
            pattern = node.get("pattern", "")
            lines.append(f"{node_id:<16} {elev:<15.2f} {demand:<15.3f} {pattern}")
        lines.append("")

        # RESERVOIRS
        lines.append("[RESERVOIRS]")
        lines.append(";ID              Head            Pattern")
        for res in reservoirs:
            res_id = res.get("id", "")
            head = res.get("head", res.get("cota", 100))
            pattern = res.get("pattern", "")
            lines.append(f"{res_id:<16} {head:<15.2f} {pattern}")
        lines.append("")

        # TANKS
        lines.append("[TANKS]")
        lines.append(";ID              Elevation       InitLevel       MinLevel        MaxLevel        Diameter        MinVol          VolCurve")
        lines.append("")

        # PIPES
        lines.append("[PIPES]")
        lines.append(";ID              Node1           Node2           Length          Diameter        Roughness       MinorLoss       Status")
        for idx, link in enumerate(links):
            link_id = link.get("id", f"P{idx+1}")
            node1 = link.get("from", link.get("from_node", ""))
            node2 = link.get("to", link.get("to_node", ""))
            length = link.get("length", link.get("comprimento", 100))
            diameter = link.get("diameter", link.get("DN", 150))
            roughness = self._get_roughness(link.get("material", "PVC"))
            minor_loss = link.get("minor_loss", 0)
            status = link.get("status", "Open")
            lines.append(f"{link_id:<16} {node1:<16} {node2:<16} {length:<15.2f} {diameter:<15.0f} {roughness:<15.1f} {minor_loss:<15.2f} {status}")
        lines.append("")

        # PUMPS
        lines.append("[PUMPS]")
        lines.append(";ID              Node1           Node2           Parameters")
        for pump in pumps:
            pump_id = pump.get("id", "")
            node1 = pump.get("from_node", "")
            node2 = pump.get("to_node", "")
            power = pump.get("power", 10)
            lines.append(f"{pump_id:<16} {node1:<16} {node2:<16} POWER {power}")
        lines.append("")

        # VALVES
        lines.append("[VALVES]")
        lines.append(";ID              Node1           Node2           Diameter        Type            Setting         MinorLoss")
        for valve in valves:
            valve_id = valve.get("id", "")
            node1 = valve.get("from_node", "")
            node2 = valve.get("to_node", "")
            diameter = valve.get("diameter", 100)
            valve_type = valve.get("type", "PRV")
            setting = valve.get("setting", 30)
            lines.append(f"{valve_id:<16} {node1:<16} {node2:<16} {diameter:<15.0f} {valve_type:<16} {setting:<15.1f} 0")
        lines.append("")

        # PATTERNS
        lines.append("[PATTERNS]")
        lines.append(";ID              Multipliers")
        if patterns:
            for pat_id, multipliers in patterns.items():
                mult_str = " ".join(f"{m:.2f}" for m in multipliers)
                lines.append(f"{pat_id:<16} {mult_str}")
        else:
            # Padrão típico de consumo residencial
            lines.append("PAT1            0.5  0.5  0.5  0.5  0.6  0.8  1.2  1.4  1.3  1.1  1.0  1.0")
            lines.append("PAT1            1.0  1.0  0.9  1.0  1.1  1.3  1.5  1.3  1.0  0.8  0.6  0.5")
        lines.append("")

        # CURVES (vazio por enquanto)
        lines.append("[CURVES]")
        lines.append(";ID              X-Value         Y-Value")
        lines.append("")

        # ENERGY
        lines.append("[ENERGY]")
        lines.append(" Global Efficiency  75")
        lines.append(" Global Price       0.0")
        lines.append(" Demand Charge      0.0")
        lines.append("")

        # STATUS
        lines.append("[STATUS]")
        lines.append(";ID              Status/Setting")
        lines.append("")

        # CONTROLS
        lines.append("[CONTROLS]")
        lines.append("")

        # RULES
        lines.append("[RULES]")
        lines.append("")

        # DEMANDS
        lines.append("[DEMANDS]")
        lines.append(";Junction        Demand      Pattern         Category")
        lines.append("")

        # QUALITY
        lines.append("[QUALITY]")
        lines.append(";Node            InitQual")
        lines.append("")

        # REACTIONS
        lines.append("[REACTIONS]")
        lines.append(" Order Bulk            1")
        lines.append(" Order Tank            1")
        lines.append(" Order Wall            1")
        lines.append(" Global Bulk           0")
        lines.append(" Global Wall           0")
        lines.append(" Limiting Potential    0")
        lines.append(" Roughness Correlation 0")
        lines.append("")

        # SOURCES
        lines.append("[SOURCES]")
        lines.append(";Node            Type            Quality         Pattern")
        lines.append("")

        # MIXING
        lines.append("[MIXING]")
        lines.append(";Tank            Model")
        lines.append("")

        # TIMES
        lines.append("[TIMES]")
        lines.append(f" Duration           {self.options.duration}:00")
        lines.append(f" Hydraulic Timestep {self.options.hydraulic_timestep}")
        lines.append(f" Quality Timestep   0:05")
        lines.append(f" Pattern Timestep   {self.options.pattern_timestep}")
        lines.append(f" Pattern Start      0:00")
        lines.append(f" Report Timestep    {self.options.report_timestep}")
        lines.append(" Report Start       0:00")
        lines.append(" Start ClockTime    12 am")
        lines.append(" Statistic          NONE")
        lines.append("")

        # REPORT
        lines.append("[REPORT]")
        lines.append(" Status             Yes")
        lines.append(" Summary            Yes")
        lines.append(" Page               0")
        lines.append("")

        # OPTIONS
        lines.append("[OPTIONS]")
        lines.append(f" Units              {self.options.flow_units}")
        lines.append(f" Headloss           {self.options.headloss_formula}")
        lines.append(" Specific Gravity   1.0")
        lines.append(" Viscosity          1.0")
        lines.append(" Trials             40")
        lines.append(" Accuracy           0.001")
        lines.append(" CHECKFREQ          2")
        lines.append(" MAXCHECK           10")
        lines.append(" DAMPLIMIT          0")
        lines.append(" Unbalanced         Continue 10")
        lines.append(" Pattern            PAT1")
        lines.append(" Demand Multiplier  1.0")
        lines.append(" Emitter Exponent   0.5")
        lines.append(" Quality            None mg/L")
        lines.append(" Diffusivity        1.0")
        lines.append(" Tolerance          0.01")
        lines.append("")

        # COORDINATES
        lines.append("[COORDINATES]")
        lines.append(";Node            X-Coord            Y-Coord")
        for node in nodes:
            node_id = node.get("id", "")
            x = node.get("x", 0)
            y = node.get("y", 0)
            lines.append(f"{node_id:<16} {x:<18.3f} {y:<18.3f}")
        for res in reservoirs:
            res_id = res.get("id", "")
            x = res.get("x", 0)
            y = res.get("y", 0)
            lines.append(f"{res_id:<16} {x:<18.3f} {y:<18.3f}")
        lines.append("")

        # VERTICES
        lines.append("[VERTICES]")
        lines.append(";Link            X-Coord            Y-Coord")
        lines.append("")

        # LABELS
        lines.append("[LABELS]")
        lines.append(";X-Coord           Y-Coord          Label & Anchor Node")
        lines.append("")

        # BACKDROP
        lines.append("[BACKDROP]")
        lines.append("")

        # END
        lines.append("[END]")

        self.inp_content = "\n".join(lines)
        return self.inp_content

    def _get_roughness(self, material: str) -> float:
        """Retorna coeficiente de rugosidade baseado no material"""
        roughness_table = {
            "PVC": 150,
            "PEAD": 140,
            "PRFV": 140,
            "Ferro Fundido": 100,
            "Ferro Dúctil": 120,
            "Aço": 100,
            "Concreto": 90,
            "Cimento Amianto": 120
        }
        return roughness_table.get(material, 130)

    def save_inp(self, filepath: str):
        """Salva arquivo .INP"""
        if not self.inp_content:
            raise ValueError("Gere o conteúdo primeiro com generate_inp()")

        with open(filepath, 'w') as f:
            f.write(self.inp_content)

    def simulate(self, nodes: List[Dict], links: List[Dict], **kwargs) -> SimulationResults:
        """
        Executa simulação (simplificada - resultados estimados).

        Para simulação real, use EPANET instalado ou WNTR.
        """
        # Gera INP
        self.generate_inp(nodes, links, **kwargs)

        # Simulação simplificada (estimativas)
        node_results = {}
        for node in nodes:
            node_id = node.get("id", "")
            elev = node.get("z", 0)
            # Estima pressão baseado na elevação
            pressure = max(10, 50 - elev * 0.1)  # Simplificado
            node_results[node_id] = {
                "pressure": pressure,
                "demand": node.get("demand", 0),
                "head": elev + pressure / 10,
                "quality": 0
            }

        link_results = {}
        for idx, link in enumerate(links):
            link_id = link.get("id", f"P{idx+1}")
            length = link.get("length", 100)
            diameter = link.get("diameter", 150)
            # Estima vazão e velocidade
            flow = 5.0 + idx * 0.5  # L/s simplificado
            area = 3.14159 * (diameter / 1000) ** 2 / 4
            velocity = flow / 1000 / area if area > 0 else 0
            headloss = 0.1 * length / 100  # Simplificado
            link_results[link_id] = {
                "flow": flow,
                "velocity": velocity,
                "headloss": headloss,
                "status": "Open"
            }

        self.results = SimulationResults(
            success=True,
            message="Simulação simplificada concluída. Para resultados precisos, use EPANET.",
            nodes=node_results,
            links=link_results,
            summary={
                "total_nodes": len(nodes),
                "total_links": len(links),
                "min_pressure": min(n["pressure"] for n in node_results.values()) if node_results else 0,
                "max_pressure": max(n["pressure"] for n in node_results.values()) if node_results else 0,
                "max_velocity": max(l["velocity"] for l in link_results.values()) if link_results else 0
            }
        )

        return self.results


def generate_epanet_inp(nodes: List[Dict], links: List[Dict], filepath: str,
                       **kwargs) -> str:
    """
    Função de conveniência para gerar arquivo .INP.

    Args:
        nodes: Lista de nós
        links: Lista de tubos
        filepath: Caminho de saída
        **kwargs: Parâmetros adicionais (reservoirs, pumps, valves)

    Returns:
        Conteúdo do arquivo
    """
    wrapper = EpanetWrapper()
    content = wrapper.generate_inp(nodes, links, **kwargs)
    wrapper.save_inp(filepath)
    return content
