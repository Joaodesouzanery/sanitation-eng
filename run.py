#!/usr/bin/env python3
"""
ENGINE REDE - CLI para processamento de redes de saneamento.

Uso:
    python run.py topografia.txt base_custos.csv saida.xlsx
    python run.py --demo
"""

import sys
from pathlib import Path


def print_banner():
    """Imprime banner do sistema."""
    print("""
╔═══════════════════════════════════════════════════════════════╗
║                       ENGINE REDE                             ║
║     Pré-Dimensionamento e Orçamento de Redes de Saneamento    ║
╚═══════════════════════════════════════════════════════════════╝
    """)


def run_demo():
    """Executa demonstração com dados de exemplo."""
    from engine_rede.pipeline import process_topography

    examples_dir = Path(__file__).parent / "examples"

    topo_file = examples_dir / "topografia.csv"
    cost_file = examples_dir / "base_custos.csv"
    output_file = examples_dir / "resultado_demo.xlsx"

    if not topo_file.exists():
        print("❌ Arquivos de exemplo não encontrados!")
        print("   Certifique-se de que a pasta 'examples' existe.")
        sys.exit(1)

    print(f"📂 Topografia: {topo_file}")
    print(f"💰 Base de custos: {cost_file}")
    print(f"📊 Saída: {output_file}")
    print()

    result = process_topography(
        topography_file=topo_file,
        cost_file=cost_file,
        output_file=output_file,
    )

    print_results(result)


def run_process(topo_file: str, cost_file: str, output_file: str):
    """Processa arquivos fornecidos pelo usuário."""
    from engine_rede.pipeline import process_topography

    topo_path = Path(topo_file)
    cost_path = Path(cost_file)

    if not topo_path.exists():
        print(f"❌ Arquivo de topografia não encontrado: {topo_file}")
        sys.exit(1)

    if not cost_path.exists():
        print(f"❌ Arquivo de base de custos não encontrado: {cost_file}")
        sys.exit(1)

    print(f"📂 Topografia: {topo_path.absolute()}")
    print(f"💰 Base de custos: {cost_path.absolute()}")
    print(f"📊 Saída: {output_file}")
    print()

    result = process_topography(
        topography_file=topo_file,
        cost_file=cost_file,
        output_file=output_file,
    )

    print_results(result)


def print_results(result):
    """Imprime resultados do processamento."""
    print("=" * 60)
    print("                    RESUMO DA REDE")
    print("=" * 60)
    print(f"  Total de trechos:      {result.segment_count}")
    print(f"  Comprimento total:     {result.total_length:,.2f} m")
    print(f"  Trechos por gravidade: {result.network_summary['trechos_gravidade']}")
    print(f"  Trechos elevatória:    {result.network_summary['trechos_elevatoria']}")
    print()
    print("=" * 60)
    print("                  RESUMO DO ORÇAMENTO")
    print("=" * 60)
    print(f"  Custo total:           R$ {result.total_cost:,.2f}")
    print(f"  Custo médio:           R$ {result.budget_summary['average_cost_per_meter']:,.2f}/m")
    print()

    if result.budget_summary["cost_by_network_type"]:
        print("  Custo por tipo:")
        for tipo, custo in result.budget_summary["cost_by_network_type"].items():
            print(f"    • {tipo}: R$ {custo:,.2f}")

    print()
    print("=" * 60)
    print("                   TABELA DE TRECHOS")
    print("=" * 60)
    print(result.budget_df.to_string(index=False))
    print()
    print(f"✅ Arquivo Excel gerado: {result.output_path}")
    print()


def print_help():
    """Imprime ajuda de uso."""
    print("""
USO:
    python run.py <topografia> <base_custos> <saida.xlsx>
    python run.py --demo

ARGUMENTOS:
    topografia      Arquivo de topografia (.txt, .csv, .xlsx)
    base_custos     Arquivo de base de custos (.csv, .xlsx)
    saida.xlsx      Arquivo de saída Excel

OPÇÕES:
    --demo          Executa com dados de exemplo
    --help, -h      Mostra esta ajuda

FORMATOS DE TOPOGRAFIA SUPORTADOS:
    .txt    Texto com delimitador (tab, vírgula, ponto-vírgula, espaço)
    .csv    Valores separados por vírgula
    .xlsx   Excel

EXEMPLO DE ARQUIVO DE TOPOGRAFIA (topografia.txt):
    id,x,y,cota
    P1,0,0,100.0
    P2,50,0,99.5
    P3,120,0,98.8

EXEMPLO DE BASE DE CUSTOS (custos.csv):
    tipo_rede,diametro_mm,custo_unitario
    Esgoto por Gravidade,200,120.00
    Elevatória / Booster,200,320.00

EXEMPLO:
    python run.py minha_topografia.txt custos.csv orcamento.xlsx
    """)


def main():
    """Ponto de entrada principal."""
    print_banner()

    if len(sys.argv) < 2:
        print_help()
        sys.exit(0)

    if sys.argv[1] in ("--help", "-h"):
        print_help()
        sys.exit(0)

    if sys.argv[1] == "--demo":
        run_demo()
        sys.exit(0)

    if len(sys.argv) < 4:
        print("❌ Argumentos insuficientes!")
        print("   Use: python run.py <topografia> <base_custos> <saida.xlsx>")
        print("   Ou:  python run.py --help")
        sys.exit(1)

    topo_file = sys.argv[1]
    cost_file = sys.argv[2]
    output_file = sys.argv[3]

    try:
        run_process(topo_file, cost_file, output_file)
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
