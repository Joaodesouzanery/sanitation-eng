#!/usr/bin/env python3
"""
Demo do HydroNetwork - Demonstração sem dependências externas (geopandas)

Este script demonstra o funcionamento do motor de cálculo hidráulico
usando dados sintéticos criados programaticamente.
"""

import sys
from pathlib import Path

# Adicionar diretório PAI ao path para imports funcionarem
sys.path.insert(0, str(Path(__file__).parent.parent))

from hydro_network.core.topology import TopologyBuilder, NetworkTopology, Node, Link
from hydro_network.networks.sewer import SewerCalculator, SewerParams
from hydro_network.networks.water import WaterCalculator, WaterParams
from hydro_network.networks.drainage import DrainageCalculator, DrainageParams
from hydro_network.construction.quantities import QuantityCalculator, TipoPavimento
from hydro_network.validation.rule_check import RuleChecker


def print_section(title: str):
    """Imprime cabeçalho de seção."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def create_sample_network() -> NetworkTopology:
    """Cria uma rede de exemplo para demonstração."""
    builder = TopologyBuilder()

    # Criar nós (PVs - Poços de Visita)
    # Simula uma rede de esgoto em um loteamento
    nodes = [
        ("PV01", 100.0, 0.0, 102.50),    # x, y, z (cota terreno)
        ("PV02", 150.0, 0.0, 101.80),
        ("PV03", 200.0, 0.0, 101.00),
        ("PV04", 250.0, 0.0, 100.20),
        ("PV05", 100.0, 50.0, 102.30),
        ("PV06", 150.0, 50.0, 101.50),
        ("PV07", 200.0, 50.0, 100.80),
        ("PV08", 300.0, 0.0, 99.50),     # Ponto final (emissário)
    ]

    for node_id, x, y, z in nodes:
        builder.add_node(Node(id=node_id, x=x, y=y, z=z))

    # Criar trechos (tubulações)
    links = [
        ("T01", "PV01", "PV02", 50.0),   # id, nó_montante, nó_jusante, comprimento
        ("T02", "PV02", "PV03", 50.0),
        ("T03", "PV03", "PV04", 50.0),
        ("T04", "PV05", "PV06", 50.0),
        ("T05", "PV06", "PV07", 50.0),
        ("T06", "PV06", "PV03", 70.7),   # Ligação transversal
        ("T07", "PV04", "PV08", 50.0),
        ("T08", "PV07", "PV04", 70.7),   # Ligação transversal
    ]

    for link_id, up_node, dn_node, length in links:
        builder.add_link(Link(id=link_id, from_node=up_node, to_node=dn_node, length=length))

    return builder.build()


def demo_sewer():
    """Demonstração de cálculo de rede de esgoto."""
    print_section("REDE DE ESGOTO (Gravidade - Manning)")

    topology = create_sample_network()
    print(f"\nRede criada: {len(topology.nodes)} nós, {len(topology.links)} trechos")

    # Dados de contribuição por nó (população/vazão)
    node_data = {
        "PV01": {"population": 50, "flow_lps": 0.0},
        "PV02": {"population": 80, "flow_lps": 0.0},
        "PV03": {"population": 100, "flow_lps": 0.0},
        "PV04": {"population": 60, "flow_lps": 0.0},
        "PV05": {"population": 45, "flow_lps": 0.0},
        "PV06": {"population": 90, "flow_lps": 0.0},
        "PV07": {"population": 70, "flow_lps": 0.0},
        "PV08": {"population": 0, "flow_lps": 0.0},  # Ponto de descarga
    }

    # Parâmetros de cálculo (usando valores padrão)
    params = SewerParams(
        qpc=160,                  # L/hab.dia
        manning_n=0.013,          # Coef. Manning (PVC)
        V_min=0.6,                # m/s
        V_max=5.0,                # m/s
        yD_max=0.75,              # y/D máximo
        S_min=0.005,              # Declividade mínima
    )

    calculator = SewerCalculator(params)
    calculator.calculate_network(topology, node_data)

    # Mostrar resultados
    print("\n┌─────────┬────────┬────────┬────────┬─────────┬─────────┬────────┐")
    print("│ Trecho  │ DN(mm) │ i(m/m) │ Q(L/s) │ V(m/s)  │  y/D    │ Status │")
    print("├─────────┼────────┼────────┼────────┼─────────┼─────────┼────────┤")

    results = calculator.get_results_for_export()
    for link_id, data in sorted(results.items()):
        dn = data.get('DN_MM', 0)
        slope = data.get('SLOPE', 0)
        flow = data.get('Q_LPS', 0)
        vel = data.get('V_MS', 0)
        yd = data.get('Y_D', 0)
        status = "OK" if data.get('VALID', False) else "ERRO"

        print(f"│ {link_id:7} │ {dn:6.0f} │ {slope:6.4f} │ {flow:6.2f} │ {vel:7.3f} │ {yd:7.3f} │ {status:6} │")

    print("└─────────┴────────┴────────┴────────┴─────────┴─────────┴────────┘")

    return results, topology


def demo_water():
    """Demonstração de cálculo de rede de água."""
    print_section("REDE DE ÁGUA (Pressurizada - Hazen-Williams)")

    # Criar rede simples de água
    builder = TopologyBuilder()

    # Nós: Reservatório + pontos de consumo
    nodes = [
        ("R1", 0.0, 0.0, 120.0),      # Reservatório elevado
        ("N1", 100.0, 0.0, 100.0),
        ("N2", 200.0, 0.0, 99.0),
        ("N3", 100.0, 100.0, 98.0),
        ("N4", 200.0, 100.0, 97.0),
    ]

    for node_id, x, y, z in nodes:
        builder.add_node(Node(id=node_id, x=x, y=y, z=z))

    # Trechos
    links = [
        ("L1", "R1", "N1", 100.0),
        ("L2", "N1", "N2", 100.0),
        ("L3", "N1", "N3", 100.0),
        ("L4", "N2", "N4", 100.0),
        ("L5", "N3", "N4", 100.0),
    ]

    for link_id, up_node, dn_node, length in links:
        builder.add_link(Link(id=link_id, from_node=up_node, to_node=dn_node, length=length))

    topology = builder.build()
    print(f"\nRede criada: {len(topology.nodes)} nós, {len(topology.links)} trechos")

    # Demandas nodais
    node_data = {
        "R1": {"demand_lps": 0, "is_source": True, "head": 120.0},
        "N1": {"demand_lps": 2.5},
        "N2": {"demand_lps": 3.0},
        "N3": {"demand_lps": 2.0},
        "N4": {"demand_lps": 4.0},
    }

    params = WaterParams(
        hazen_williams_C=140,     # PVC
        P_min=10.0,               # mca
        V_max=3.5,                # m/s
    )

    calculator = WaterCalculator(params)
    calculator.calculate_network_simple(topology, node_data, source_node="R1")

    # Resultados dos trechos
    print("\n┌─────────┬────────┬────────┬─────────┬──────────┐")
    print("│ Trecho  │ DN(mm) │ Q(L/s) │ V(m/s)  │ hf(m)    │")
    print("├─────────┼────────┼────────┼─────────┼──────────┤")

    results = calculator.get_results_for_export()
    for link_id, data in sorted(results.items()):
        dn = data.get('DN_MM', 0)
        flow = data.get('Q_LPS', 0)
        vel = data.get('V_MS', 0)
        hf = data.get('HF_M', 0)

        print(f"│ {link_id:7} │ {dn:6.0f} │ {flow:6.2f} │ {vel:7.3f} │ {hf:8.4f} │")

    print("└─────────┴────────┴────────┴─────────┴──────────┘")

    # Resultados dos nós (pressões)
    print("\n┌─────────┬──────────┬──────────┬──────────┐")
    print("│   Nó    │ Cota(m)  │ Piezom.  │ Press(m) │")
    print("├─────────┼──────────┼──────────┼──────────┤")

    node_results = calculator.get_node_results_for_export()
    for node_id, data in sorted(node_results.items()):
        z = data.get('Z_M', 0)
        piezo = data.get('PIEZO_M', 0)
        press = data.get('PRESS_M', 0)

        print(f"│ {node_id:7} │ {z:8.2f} │ {piezo:8.2f} │ {press:8.2f} │")

    print("└─────────┴──────────┴──────────┴──────────┘")

    return results, topology


def demo_drainage():
    """Demonstração de cálculo de drenagem pluvial."""
    print_section("DRENAGEM PLUVIAL (Método Racional)")

    builder = TopologyBuilder()

    # Rede de drenagem (bocas de lobo -> galeria)
    nodes = [
        ("BL1", 0.0, 0.0, 105.0),
        ("BL2", 50.0, 0.0, 104.5),
        ("BL3", 100.0, 0.0, 104.0),
        ("CX1", 150.0, 0.0, 103.0),
        ("DESC", 200.0, 0.0, 101.0),  # Descarga
    ]

    for node_id, x, y, z in nodes:
        builder.add_node(Node(id=node_id, x=x, y=y, z=z))

    links = [
        ("G1", "BL1", "BL2", 50.0),
        ("G2", "BL2", "BL3", 50.0),
        ("G3", "BL3", "CX1", 50.0),
        ("G4", "CX1", "DESC", 50.0),
    ]

    for link_id, up_node, dn_node, length in links:
        builder.add_link(Link(id=link_id, from_node=up_node, to_node=dn_node, length=length))

    topology = builder.build()
    print(f"\nRede criada: {len(topology.nodes)} nós, {len(topology.links)} trechos")

    # Dados de área de contribuição
    node_data = {
        "BL1": {"area_ha": 0.5, "runoff_coef": 0.7},
        "BL2": {"area_ha": 0.8, "runoff_coef": 0.75},
        "BL3": {"area_ha": 0.6, "runoff_coef": 0.7},
        "CX1": {"area_ha": 0.3, "runoff_coef": 0.8},
        "DESC": {"area_ha": 0.0, "runoff_coef": 0.0},
    }

    params = DrainageParams(
        periodo_retorno=10,       # anos
        manning_n=0.015,          # Concreto
        V_min=0.8,
        V_max=5.0,
    )

    calculator = DrainageCalculator(params)
    calculator.calculate_network(topology, node_data)

    print("\n┌─────────┬────────┬────────┬─────────┬─────────┬────────┐")
    print("│ Trecho  │ DN(mm) │ i(m/m) │ Q(m³/s) │ V(m/s)  │  y/D   │")
    print("├─────────┼────────┼────────┼─────────┼─────────┼────────┤")

    results = calculator.get_results_for_export()
    for link_id, data in sorted(results.items()):
        dn = data.get('DN_MM', 0)
        slope = data.get('SLOPE', 0)
        flow = data.get('Q_M3S', 0)
        vel = data.get('V_MS', 0)
        yd = data.get('Y_D', 0)

        print(f"│ {link_id:7} │ {dn:6.0f} │ {slope:6.4f} │ {flow:7.4f} │ {vel:7.3f} │ {yd:6.3f} │")

    print("└─────────┴────────┴────────┴─────────┴─────────┴────────┘")

    return results, topology


def demo_quantities(link_results: dict, topology: NetworkTopology):
    """Demonstração de cálculo de quantitativos."""
    print_section("QUANTITATIVOS DE OBRA")

    calculator = QuantityCalculator()

    for link_id, data in link_results.items():
        dn = data.get('DN_MM', 200)
        length = topology.links[link_id].length if link_id in topology.links else 50.0
        cover_up = 1.2
        cover_down = 1.5

        calculator.calculate(link_id, dn, length, cover_up, cover_down, TipoPavimento.ASFALTO)

    print("\n┌─────────┬────────┬────────┬──────────┬──────────┬─────────┐")
    print("│ Trecho  │ Comp(m)│ Escav. │ Reaterro │ Tubos(m) │ Equipe  │")
    print("│         │        │  (m³)  │   (m³)   │          │ (dias)  │")
    print("├─────────┼────────┼────────┼──────────┼──────────┼─────────┤")

    for link_id, result in calculator.results.items():
        print(f"│ {link_id:7} │ {result.length:6.1f} │ {result.vol_escavacao:6.2f} │ {result.vol_reaterro:8.2f} │ {result.length:8.1f} │ {'N/A':>7} │")

    print("└─────────┴────────┴────────┴──────────┴──────────┴─────────┘")

    totals = calculator.calculate_totals()
    print(f"\n  TOTAIS:")
    print(f"  • Escavação total: {totals['vol_escavacao_total']:,.2f} m³")
    print(f"  • Reaterro total: {totals['vol_reaterro_total']:,.2f} m³")
    print(f"  • Extensão total: {totals['comprimento_total']:,.2f} m")
    print(f"  • Bota-fora total: {totals['vol_botafora_total']:,.2f} m³")


def demo_validation(link_results: dict):
    """Demonstração de validação normativa."""
    print_section("VALIDAÇÃO NORMATIVA")

    checker = RuleChecker()
    checker.check_network('sewer', link_results, {})

    summary = checker.get_summary()

    print(f"\n  Resultado da verificação:")
    print(f"  • Total de violações: {summary['total_violations']}")
    print(f"  • ERROS: {summary['by_severity']['ERROR']}")
    print(f"  • AVISOS: {summary['by_severity']['WARN']}")
    print(f"  • INFO: {summary['by_severity']['INFO']}")

    if checker.violations:
        print("\n  Detalhes das violações:")
        for v in checker.violations[:5]:  # Mostrar até 5
            print(f"  [{v.severity}] {v.element_id}: {v.message}")


def main():
    """Função principal da demonstração."""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                     HYDRO NETWORK - DEMONSTRAÇÃO                     ║
║              Motor de Cálculo Hidráulico para Saneamento             ║
╚══════════════════════════════════════════════════════════════════════╝
    """)

    # 1. Rede de esgoto
    sewer_results, sewer_topology = demo_sewer()

    # 2. Rede de água
    water_results, water_topology = demo_water()

    # 3. Drenagem pluvial
    drainage_results, drainage_topology = demo_drainage()

    # 4. Quantitativos (usando resultados do esgoto)
    demo_quantities(sewer_results, sewer_topology)

    # 5. Validação
    demo_validation(sewer_results)

    print_section("DEMONSTRAÇÃO CONCLUÍDA")
    print("""
  O HydroNetwork suporta:

  ✓ Cálculo de esgoto por gravidade (Manning)
  ✓ Cálculo de água pressurizada (Hazen-Williams)
  ✓ Cálculo de drenagem pluvial (Método Racional)
  ✓ Quantitativos de obra (escavação, reaterro, equipe)
  ✓ Validação normativa (NBR 9649, NBR 12218)
  ✓ Exportação GIS (Shapefile, GeoJSON, CSV)
  ✓ Webmap interativo (Leaflet)

  Para usar com arquivos reais:
    python main.py --input ./data --output ./out --network sewer

  Dependências opcionais:
    pip install geopandas shapely folium
""")


if __name__ == '__main__':
    main()
