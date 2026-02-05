"""
Exemplo de uso do engine_rede.

Execute este script a partir da raiz do projeto:
    python examples/exemplo_uso.py
"""

from pathlib import Path

from engine_rede.pipeline import process_topography

# Diretório dos exemplos
EXAMPLES_DIR = Path(__file__).parent


def main() -> None:
    """Executa o processamento de topografia com dados de exemplo."""

    topography_file = EXAMPLES_DIR / "topografia.csv"
    cost_file = EXAMPLES_DIR / "base_custos.csv"
    output_file = EXAMPLES_DIR / "orcamento_rede.xlsx"

    print("=" * 60)
    print("Engine Rede - Processamento de Topografia")
    print("=" * 60)
    print(f"\nArquivo de topografia: {topography_file}")
    print(f"Base de custos: {cost_file}")
    print(f"Arquivo de saída: {output_file}")

    result = process_topography(
        topography_file=topography_file,
        cost_file=cost_file,
        output_file=output_file,
    )

    print("\n" + "-" * 60)
    print("RESUMO DA REDE")
    print("-" * 60)
    print(f"Total de trechos: {result.segment_count}")
    print(f"Comprimento total: {result.total_length:,.2f} m")
    print(f"Trechos por gravidade: {result.network_summary['trechos_gravidade']}")
    print(f"Trechos com elevatória: {result.network_summary['trechos_elevatoria']}")

    print("\n" + "-" * 60)
    print("RESUMO DO ORÇAMENTO")
    print("-" * 60)
    print(f"Custo total: R$ {result.total_cost:,.2f}")
    print(f"Custo médio por metro: R$ {result.budget_summary['average_cost_per_meter']:,.2f}/m")

    print("\n" + "-" * 60)
    print("CUSTO POR TIPO DE REDE")
    print("-" * 60)
    for tipo, custo in result.budget_summary["cost_by_network_type"].items():
        print(f"  {tipo}: R$ {custo:,.2f}")

    print("\n" + "-" * 60)
    print("DETALHES DOS TRECHOS")
    print("-" * 60)
    print(result.budget_df.to_string(index=False))

    print(f"\n\nArquivo Excel gerado: {output_file}")
    print("=" * 60)


if __name__ == "__main__":
    main()
