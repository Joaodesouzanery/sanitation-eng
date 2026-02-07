#!/usr/bin/env python3
"""
ENGINE REDE - CLI Avançado com parâmetros de construção e exportação GIS.

Uso Interativo:
    python run_advanced.py

Uso Direto:
    python run_advanced.py topografia.txt custos.csv saida.xlsx --shapefile rede.shp
"""

import sys
from pathlib import Path


def print_banner():
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║                         ENGINE REDE v2.0                              ║
║        Pré-Dimensionamento e Orçamento de Redes de Saneamento         ║
║     Com Parâmetros de Construção e Exportação para QGIS (SHP)         ║
╚═══════════════════════════════════════════════════════════════════════╝
    """)


def get_user_input(prompt: str, default: str = "", options: list = None) -> str:
    """Get input from user with optional default and validation."""
    if options:
        options_str = "/".join(options)
        full_prompt = f"{prompt} [{options_str}]"
        if default:
            full_prompt += f" (padrão: {default})"
        full_prompt += ": "
    elif default:
        full_prompt = f"{prompt} (padrão: {default}): "
    else:
        full_prompt = f"{prompt}: "

    value = input(full_prompt).strip()

    if not value and default:
        return default

    if options and value.lower() not in [o.lower() for o in options]:
        print(f"  ⚠ Valor inválido. Usando padrão: {default}")
        return default

    return value


def collect_construction_parameters():
    """Collect construction parameters interactively."""
    print("\n" + "=" * 60)
    print("        PARÂMETROS DE CONSTRUÇÃO")
    print("=" * 60)

    print("\n📍 TIPO DE SOLO:")
    print("   normal   - Solo comum, sem saturação")
    print("   saturado - Solo com presença de água (requer drenagem)")
    print("   rochoso  - Solo rochoso (requer colchão de areia)")
    tipo_solo = get_user_input(
        "   Escolha",
        default="normal",
        options=["normal", "saturado", "rochoso"]
    )

    print("\n🚜 TIPO DE ESCAVAÇÃO:")
    print("   manual     - Escavação manual")
    print("   mecanizada - Retroescavadeira/Escavadeira")
    print("   mista      - Combinação manual e mecânica")
    tipo_escavacao = get_user_input(
        "   Escolha",
        default="mecanizada",
        options=["manual", "mecanizada", "mista"]
    )

    print("\n🛣️  TIPO DE PAVIMENTO (para recomposição):")
    print("   terra         - Não pavimentado")
    print("   paralelepipedo - Calçamento")
    print("   asfalto       - Requer subbase + base + BGS + CBUQ")
    print("   concreto      - Pavimento rígido")
    print("   bloquete      - Piso intertravado")
    tipo_pavimento = get_user_input(
        "   Escolha",
        default="asfalto",
        options=["terra", "paralelepipedo", "asfalto", "concreto", "bloquete"]
    )

    print("\n📏 PROFUNDIDADE MÉDIA DA VALA:")
    print("   (Até 1,25m: sem escoramento)")
    print("   (Acima de 1,25m: com escoramento)")
    prof_str = get_user_input("   Profundidade em metros", default="1.5")
    try:
        profundidade = float(prof_str)
    except ValueError:
        print("  ⚠ Valor inválido. Usando 1.5m")
        profundidade = 1.5

    return {
        "tipo_solo": tipo_solo,
        "tipo_escavacao": tipo_escavacao,
        "tipo_pavimento": tipo_pavimento,
        "profundidade_media": profundidade,
    }


def collect_files():
    """Collect file paths interactively."""
    print("\n" + "=" * 60)
    print("        ARQUIVOS DE ENTRADA")
    print("=" * 60)

    print("\n📂 ARQUIVO DE TOPOGRAFIA:")
    print("   Formatos aceitos: .txt, .csv, .xlsx")
    print("   Colunas necessárias: id, x, y, cota")
    topo_file = get_user_input("   Caminho do arquivo")

    if not Path(topo_file).exists():
        print(f"   ❌ Arquivo não encontrado: {topo_file}")
        sys.exit(1)

    print("\n💰 ARQUIVO DE BASE DE CUSTOS:")
    print("   Formatos aceitos: .csv, .xlsx")
    print("   Colunas: tipo_rede, diametro_mm, custo_unitario")
    cost_file = get_user_input("   Caminho do arquivo")

    if not Path(cost_file).exists():
        print(f"   ❌ Arquivo não encontrado: {cost_file}")
        sys.exit(1)

    return topo_file, cost_file


def collect_outputs():
    """Collect output file paths."""
    print("\n" + "=" * 60)
    print("        ARQUIVOS DE SAÍDA")
    print("=" * 60)

    excel_file = get_user_input(
        "\n📊 Arquivo Excel de saída",
        default="resultado_rede.xlsx"
    )

    print("\n🗺️  EXPORTAÇÃO GIS (para QGIS):")
    export_shp = get_user_input(
        "   Exportar Shapefile? (s/n)",
        default="s",
        options=["s", "n"]
    )
    shp_file = None
    if export_shp.lower() == "s":
        shp_file = get_user_input("   Nome do Shapefile", default="rede_saneamento.shp")

    export_geojson = get_user_input(
        "   Exportar GeoJSON? (s/n)",
        default="n",
        options=["s", "n"]
    )
    geojson_file = None
    if export_geojson.lower() == "s":
        geojson_file = get_user_input("   Nome do GeoJSON", default="rede_saneamento.geojson")

    return excel_file, shp_file, geojson_file


def print_results(result):
    """Print processing results."""
    print("\n" + "=" * 70)
    print("                         RESULTADOS")
    print("=" * 70)

    print("\n📊 RESUMO DA REDE:")
    print(f"   Total de trechos:        {result.segment_count}")
    print(f"   Comprimento total:       {result.total_length:,.2f} m")
    print(f"   Trechos por gravidade:   {result.network_summary['trechos_gravidade']}")
    print(f"   Trechos com elevatória:  {result.network_summary['trechos_elevatoria']}")

    print("\n💰 RESUMO DO ORÇAMENTO:")
    print(f"   Custo total:             R$ {result.total_cost:,.2f}")
    avg_cost = result.budget_summary.get('average_cost_per_meter', 0)
    print(f"   Custo médio:             R$ {avg_cost:,.2f}/m")

    print("\n🔧 RESUMO DA CONSTRUÇÃO:")
    rc = result.resumo_construcao
    print(f"   Trechos com escoramento: {rc['trechos_com_escoramento']}")
    print(f"   Trechos com embasamento: {rc['trechos_com_embasamento']}")
    print(f"   Trechos com termofusão:  {rc['trechos_com_termofusao']}")
    print(f"   Equipe máxima:           {rc['equipe_total_max']} pessoas")
    print(f"   Equipe média:            {rc['equipe_media']} pessoas")

    print("\n📁 ARQUIVOS GERADOS:")
    if result.excel_path:
        print(f"   ✅ Excel:     {result.excel_path}")
    if result.shapefile_path:
        print(f"   ✅ Shapefile: {result.shapefile_path}")
    if result.geojson_path:
        print(f"   ✅ GeoJSON:   {result.geojson_path}")

    print("\n" + "=" * 70)
    print("  💡 Abra o Shapefile no QGIS para visualizar a rede!")
    print("=" * 70 + "\n")


def run_interactive():
    """Run in interactive mode."""
    from engine_rede.pipeline_advanced import (
        process_topography_advanced,
        ConfiguracaoObra,
    )

    # Collect all inputs
    topo_file, cost_file = collect_files()
    params = collect_construction_parameters()
    excel_file, shp_file, geojson_file = collect_outputs()

    # Create configuration
    config = ConfiguracaoObra(
        tipo_solo=params["tipo_solo"],
        tipo_escavacao=params["tipo_escavacao"],
        tipo_pavimento=params["tipo_pavimento"],
        profundidade_media=params["profundidade_media"],
    )

    print("\n⏳ Processando...")

    # Process
    result = process_topography_advanced(
        topography_file=topo_file,
        cost_file=cost_file,
        output_excel=excel_file,
        config=config,
        output_shapefile=shp_file,
        output_geojson=geojson_file,
    )

    print_results(result)


def run_cli(args):
    """Run with command line arguments."""
    from engine_rede.pipeline_advanced import (
        process_topography_advanced,
        ConfiguracaoObra,
    )

    topo_file = args[0]
    cost_file = args[1]
    excel_file = args[2]

    # Parse optional arguments
    shp_file = None
    geojson_file = None
    config_params = {}

    i = 3
    while i < len(args):
        if args[i] == "--shapefile" and i + 1 < len(args):
            shp_file = args[i + 1]
            i += 2
        elif args[i] == "--geojson" and i + 1 < len(args):
            geojson_file = args[i + 1]
            i += 2
        elif args[i] == "--solo" and i + 1 < len(args):
            config_params["tipo_solo"] = args[i + 1]
            i += 2
        elif args[i] == "--escavacao" and i + 1 < len(args):
            config_params["tipo_escavacao"] = args[i + 1]
            i += 2
        elif args[i] == "--pavimento" and i + 1 < len(args):
            config_params["tipo_pavimento"] = args[i + 1]
            i += 2
        elif args[i] == "--profundidade" and i + 1 < len(args):
            config_params["profundidade_media"] = float(args[i + 1])
            i += 2
        else:
            i += 1

    config = ConfiguracaoObra(**config_params) if config_params else ConfiguracaoObra()

    print(f"📂 Topografia: {topo_file}")
    print(f"💰 Base de custos: {cost_file}")
    print(f"📊 Saída Excel: {excel_file}")
    if shp_file:
        print(f"🗺️  Shapefile: {shp_file}")
    print()

    result = process_topography_advanced(
        topography_file=topo_file,
        cost_file=cost_file,
        output_excel=excel_file,
        config=config,
        output_shapefile=shp_file,
        output_geojson=geojson_file,
    )

    print_results(result)


def print_help():
    print("""
USO:
    python run_advanced.py                              # Modo interativo
    python run_advanced.py <topo> <custos> <saida.xlsx> # Modo direto

ARGUMENTOS:
    topo        Arquivo de topografia (.txt, .csv, .xlsx)
    custos      Arquivo de base de custos (.csv, .xlsx)
    saida.xlsx  Arquivo de saída Excel

OPÇÕES:
    --shapefile <arquivo.shp>   Exportar Shapefile para QGIS
    --geojson <arquivo.geojson> Exportar GeoJSON
    --solo <tipo>               normal/saturado/rochoso
    --escavacao <tipo>          manual/mecanizada/mista
    --pavimento <tipo>          terra/paralelepipedo/asfalto/concreto/bloquete
    --profundidade <metros>     Profundidade média da vala

EXEMPLO:
    python run_advanced.py topografia.txt custos.csv resultado.xlsx \\
        --shapefile rede.shp \\
        --solo saturado \\
        --pavimento asfalto \\
        --profundidade 1.8

DEPENDÊNCIAS PARA GIS:
    pip install geopandas shapely
    """)


def main():
    print_banner()

    if len(sys.argv) == 1:
        # Interactive mode
        run_interactive()
    elif sys.argv[1] in ("--help", "-h"):
        print_help()
    elif len(sys.argv) >= 4:
        # CLI mode
        try:
            run_cli(sys.argv[1:])
        except Exception as e:
            print(f"❌ Erro: {e}")
            sys.exit(1)
    else:
        print("❌ Argumentos insuficientes!")
        print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
