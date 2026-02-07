#!/usr/bin/env python3
"""
HydroNetwork - Sistema de Cálculo Hidráulico para Redes de Saneamento

CLI principal para processamento de redes de:
- Esgoto por gravidade
- Água pressurizada
- Drenagem pluvial

Uso:
    python main.py --input ./data --output ./out
    python main.py --help
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Imports do pacote
from core.topology import TopologyBuilder, NetworkTopology
from core.constants import SHP_FIELD_NAMES
from networks.sewer import SewerCalculator, SewerParams
from networks.water import WaterCalculator, WaterParams
from networks.drainage import DrainageCalculator, DrainageParams
from construction.quantities import QuantityCalculator, ConstructionParams, TipoPavimento
from validation.rule_check import RuleChecker, load_rules_from_file
from io.gis_io import (
    build_topology_from_shapefiles,
    export_links_shapefile,
    export_nodes_shapefile,
    export_to_geojson,
    export_to_csv,
    export_consolidated_json,
    HAS_GEOPANDAS,
)
from io.webmap import build_webmap


def print_banner():
    """Imprime banner do sistema."""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                        HYDRO NETWORK v1.0                            ║
║         Sistema de Cálculo Hidráulico para Redes de Saneamento       ║
║                                                                      ║
║   • Esgoto por Gravidade (Manning)                                   ║
║   • Água Pressurizada (Hazen-Williams)                               ║
║   • Drenagem Pluvial (Método Racional)                               ║
╚══════════════════════════════════════════════════════════════════════╝
    """)


def load_node_data(filepath: Path) -> Dict[str, Dict[str, Any]]:
    """Carrega dados de nós de arquivo JSON ou CSV."""
    if not filepath.exists():
        return {}

    if filepath.suffix.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    elif filepath.suffix.lower() == '.csv':
        import csv
        data = {}
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                node_id = row.get('id', row.get('node_id', row.get('ID', '')))
                if node_id:
                    # Converter valores numéricos
                    for key in row:
                        try:
                            row[key] = float(row[key])
                        except (ValueError, TypeError):
                            pass
                    data[node_id] = row
        return data
    return {}


def process_sewer(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]],
    params: SewerParams = None,
) -> tuple:
    """Processa rede de esgoto."""
    print("\n📍 Calculando rede de ESGOTO por gravidade...")

    calculator = SewerCalculator(params)
    calculator.calculate_network(topology, node_data)

    link_results = calculator.get_results_for_export()
    node_results = {}  # Nós de esgoto não têm resultados específicos

    print(f"   ✓ {len(link_results)} trechos calculados")

    return link_results, node_results, calculator


def process_water(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]],
    params: WaterParams = None,
    source_node: str = None,
) -> tuple:
    """Processa rede de água."""
    print("\n💧 Calculando rede de ÁGUA pressurizada...")

    calculator = WaterCalculator(params)
    calculator.calculate_network_simple(topology, node_data, source_node)

    link_results = calculator.get_results_for_export()
    node_results = calculator.get_node_results_for_export()

    print(f"   ✓ {len(link_results)} trechos calculados")
    print(f"   ✓ {len(node_results)} nós calculados")

    return link_results, node_results, calculator


def process_drainage(
    topology: NetworkTopology,
    node_data: Dict[str, Dict[str, Any]],
    params: DrainageParams = None,
) -> tuple:
    """Processa rede de drenagem."""
    print("\n🌧️  Calculando rede de DRENAGEM pluvial...")

    calculator = DrainageCalculator(params)
    calculator.calculate_network(topology, node_data)

    link_results = calculator.get_results_for_export()
    node_results = {}

    print(f"   ✓ {len(link_results)} trechos calculados")

    return link_results, node_results, calculator


def process_quantities(
    link_results: Dict[str, Dict[str, Any]],
    topology: NetworkTopology,
    params: ConstructionParams = None,
    default_pavement: str = 'asfalto',
) -> Dict[str, Dict[str, Any]]:
    """Calcula quantitativos de obra."""
    print("\n🏗️  Calculando quantitativos de obra...")

    calculator = QuantityCalculator(params)

    try:
        pav_tipo = TipoPavimento(default_pavement.lower())
    except ValueError:
        pav_tipo = TipoPavimento.ASFALTO

    for link_id, data in link_results.items():
        DN = data.get('DN_MM', data.get(SHP_FIELD_NAMES['diameter'], 200))
        length = data.get('LENGTH_M', data.get(SHP_FIELD_NAMES['length'], 0))
        cover_up = data.get('COV_UP_M', data.get(SHP_FIELD_NAMES['cover_up'], 1.5))
        cover_down = data.get('COV_DN_M', data.get(SHP_FIELD_NAMES['cover_down'], 1.5))

        calculator.calculate(link_id, DN, length, cover_up, cover_down, pav_tipo)

    # Merge quantitativos com resultados
    for link_id, qty_result in calculator.results.items():
        if link_id in link_results:
            link_results[link_id].update(qty_result.to_dict())

    totals = calculator.calculate_totals()
    print(f"   ✓ Escavação total: {totals['vol_escavacao_total']:,.2f} m³")
    print(f"   ✓ Reaterro total: {totals['vol_reaterro_total']:,.2f} m³")

    return link_results


def run_validation(
    network_type: str,
    link_results: Dict[str, Dict[str, Any]],
    node_results: Dict[str, Dict[str, Any]],
    rules_file: Path = None,
) -> RuleChecker:
    """Executa verificação normativa."""
    print("\n📋 Verificando regras normativas...")

    rules_config = None
    if rules_file and rules_file.exists():
        rules_config = load_rules_from_file(rules_file)

    checker = RuleChecker(rules_config)
    checker.check_network(network_type, link_results, node_results)

    summary = checker.get_summary()
    print(f"   ✓ {summary['total_violations']} violações encontradas")
    print(f"     - ERROR: {summary['by_severity']['ERROR']}")
    print(f"     - WARN: {summary['by_severity']['WARN']}")
    print(f"     - INFO: {summary['by_severity']['INFO']}")

    return checker


def main():
    """Função principal."""
    parser = argparse.ArgumentParser(
        description='HydroNetwork - Cálculo Hidráulico de Redes de Saneamento',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python main.py --input ./data --output ./out
  python main.py --input ./data --output ./out --network sewer
  python main.py --input ./data --output ./out --network water --source-node R1
        """
    )

    parser.add_argument('--input', '-i', required=True,
                        help='Diretório de entrada com shapefiles')
    parser.add_argument('--output', '-o', required=True,
                        help='Diretório de saída')
    parser.add_argument('--network', '-n', choices=['sewer', 'water', 'drainage', 'all'],
                        default='all', help='Tipo de rede a calcular')
    parser.add_argument('--source-node', help='Nó fonte para rede de água')
    parser.add_argument('--pavement', default='asfalto',
                        choices=['terra', 'paralelepipedo', 'asfalto', 'concreto', 'bloquete'],
                        help='Tipo de pavimento para quantitativos')
    parser.add_argument('--rules', help='Arquivo de regras YAML/JSON')
    parser.add_argument('--crs', default='EPSG:31983',
                        help='Sistema de coordenadas (default: SIRGAS 2000 UTM 23S)')
    parser.add_argument('--no-webmap', action='store_true',
                        help='Não gerar webmap')
    parser.add_argument('--quiet', '-q', action='store_true',
                        help='Modo silencioso')

    args = parser.parse_args()

    if not args.quiet:
        print_banner()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Verificar geopandas
    if not HAS_GEOPANDAS:
        print("❌ Erro: geopandas não está instalado.")
        print("   Instale com: pip install geopandas")
        sys.exit(1)

    # Procurar shapefiles
    nodes_shp = input_dir / 'nodes.shp'
    links_shp = input_dir / 'links.shp'

    if not nodes_shp.exists():
        # Tentar encontrar alternativos
        for alt in ['nos.shp', 'pontos.shp', 'vertices.shp']:
            if (input_dir / alt).exists():
                nodes_shp = input_dir / alt
                break

    if not links_shp.exists():
        for alt in ['trechos.shp', 'linhas.shp', 'edges.shp']:
            if (input_dir / alt).exists():
                links_shp = input_dir / alt
                break

    if not nodes_shp.exists() or not links_shp.exists():
        print(f"❌ Erro: Shapefiles não encontrados em {input_dir}")
        print(f"   Esperado: nodes.shp e links.shp")
        sys.exit(1)

    print(f"\n📂 Lendo shapefiles de {input_dir}...")
    print(f"   Nós: {nodes_shp.name}")
    print(f"   Links: {links_shp.name}")

    # Construir topologia
    topology, crs = build_topology_from_shapefiles(
        nodes_shp, links_shp,
        node_z_field='z',
    )

    if not topology.is_valid:
        print("\n⚠️  Avisos de topologia:")
        for err in topology.validation_errors:
            print(f"   ❌ {err}")
        for warn in topology.validation_warnings:
            print(f"   ⚠️  {warn}")

    print(f"\n   ✓ {len(topology.nodes)} nós carregados")
    print(f"   ✓ {len(topology.links)} links carregados")
    print(f"   ✓ CRS: {crs or args.crs}")

    # Carregar dados adicionais dos nós (se existir)
    node_data_file = input_dir / 'node_data.json'
    if not node_data_file.exists():
        node_data_file = input_dir / 'node_data.csv'
    node_data = load_node_data(node_data_file) if node_data_file.exists() else {}

    # Processar redes
    all_results = {}
    all_checkers = []

    networks_to_process = ['sewer', 'water', 'drainage'] if args.network == 'all' else [args.network]

    for network_type in networks_to_process:
        if network_type == 'sewer':
            link_results, node_results, calc = process_sewer(topology, node_data)
        elif network_type == 'water':
            link_results, node_results, calc = process_water(
                topology, node_data, source_node=args.source_node
            )
        elif network_type == 'drainage':
            link_results, node_results, calc = process_drainage(topology, node_data)

        # Quantitativos
        link_results = process_quantities(link_results, topology, default_pavement=args.pavement)

        # Validação
        rules_file = Path(args.rules) if args.rules else None
        checker = run_validation(network_type, link_results, node_results, rules_file)
        all_checkers.append((network_type, checker))

        all_results[network_type] = {
            'links': link_results,
            'nodes': node_results,
        }

    # Exportar resultados
    print("\n💾 Exportando resultados...")

    for network_type, data in all_results.items():
        prefix = network_type[:3].upper()  # SEW, WAT, DRN

        # Shapefiles
        shp_links = output_dir / f'{prefix}_links_out.shp'
        shp_nodes = output_dir / f'{prefix}_nodes_out.shp'

        export_links_shapefile(topology, data['links'], shp_links, crs or args.crs)
        print(f"   ✓ {shp_links.name}")

        if data['nodes']:
            export_nodes_shapefile(topology, data['nodes'], shp_nodes, crs or args.crs)
            print(f"   ✓ {shp_nodes.name}")

        # GeoJSON
        export_to_geojson(topology, data['links'], data['nodes'], output_dir, prefix.lower())
        print(f"   ✓ {prefix.lower()}_links.geojson")
        print(f"   ✓ {prefix.lower()}_nodes.geojson")

        # CSV
        export_to_csv(data['links'], data['nodes'], output_dir, prefix.lower())
        print(f"   ✓ {prefix.lower()}_links.csv")

    # JSON consolidado
    json_path = export_consolidated_json(all_results, output_dir / 'network_results.json')
    print(f"   ✓ network_results.json")

    # Relatórios de validação
    for network_type, checker in all_checkers:
        md_path = output_dir / f'{network_type}_validation.md'
        csv_path = output_dir / f'{network_type}_violations.csv'
        checker.generate_report_markdown(md_path)
        checker.generate_report_csv(csv_path)
        print(f"   ✓ {md_path.name}")

    # Webmap
    if not args.no_webmap:
        print("\n🗺️  Gerando webmap...")

        geojson_files = {
            'sewer_links_file': output_dir / 'sew_links.geojson',
            'sewer_nodes_file': output_dir / 'sew_nodes.geojson',
            'water_links_file': output_dir / 'wat_links.geojson',
            'water_nodes_file': output_dir / 'wat_nodes.geojson',
            'drainage_links_file': output_dir / 'drn_links.geojson',
            'drainage_nodes_file': output_dir / 'drn_nodes.geojson',
        }

        # Filtrar arquivos existentes
        existing_files = {k: v for k, v in geojson_files.items() if v.exists()}

        from io.webmap import build_webmap_from_files
        map_path = build_webmap_from_files(output_dir / 'map.html', **existing_files)
        print(f"   ✓ {map_path.name}")

    print("\n" + "=" * 70)
    print("✅ Processamento concluído!")
    print(f"   Resultados em: {output_dir.absolute()}")
    print("=" * 70 + "\n")


if __name__ == '__main__':
    main()
