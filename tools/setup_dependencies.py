#!/usr/bin/env python3
"""
Script de Setup de Dependências - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Uso:
    python tools/setup_dependencies.py [--dev] [--projectlibre]

Opções:
    --dev           Instala dependências de desenvolvimento
    --projectlibre  Configura submódulo ProjectLibre
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(cmd: list, description: str) -> bool:
    """Executa comando e retorna sucesso"""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"{'='*60}")
    print(f"Comando: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERRO: {e.stderr}")
        return False


def install_requirements():
    """Instala dependências do requirements.txt"""
    req_file = Path(__file__).parent.parent / "requirements.txt"

    if not req_file.exists():
        print(f"ERRO: {req_file} não encontrado")
        return False

    return run_command(
        [sys.executable, "-m", "pip", "install", "-r", str(req_file)],
        "Instalando dependências do requirements.txt"
    )


def setup_projectlibre_submodule():
    """Configura submódulo Git do ProjectLibre"""
    vendor_dir = Path(__file__).parent.parent / "vendor"
    projectlibre_dir = vendor_dir / "projectlibre"

    # Verificar se já existe
    if projectlibre_dir.exists():
        print("ProjectLibre já configurado em vendor/projectlibre")
        return True

    # Criar diretório vendor
    vendor_dir.mkdir(exist_ok=True)

    # Adicionar submódulo
    os.chdir(Path(__file__).parent.parent)

    commands = [
        (
            ["git", "submodule", "add", "-b", "master",
             "https://github.com/smartqubit/projectlibre.git",
             "vendor/projectlibre"],
            "Adicionando submódulo ProjectLibre"
        ),
        (
            ["git", "submodule", "update", "--init", "--recursive"],
            "Atualizando submódulos"
        )
    ]

    for cmd, desc in commands:
        if not run_command(cmd, desc):
            print("AVISO: Falha ao configurar submódulo. Verifique permissões Git.")
            return False

    return True


def create_directories():
    """Cria diretórios necessários"""
    base_dir = Path(__file__).parent.parent

    dirs = [
        "cache/tiles",
        "logs",
        "output/shapefiles",
        "output/reports",
        "data/imports",
        "data/exports"
    ]

    print("\nCriando diretórios...")
    for d in dirs:
        path = base_dir / d
        path.mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {d}")

    return True


def verify_installation():
    """Verifica se instalação está correta"""
    print("\n" + "="*60)
    print("  Verificando instalação")
    print("="*60)

    checks = [
        ("pydantic", "Pydantic"),
        ("pyproj", "PyProj"),
        ("shapefile", "PyShp"),
    ]

    all_ok = True
    for module, name in checks:
        try:
            __import__(module)
            print(f"  ✓ {name} instalado")
        except ImportError:
            print(f"  ✗ {name} NÃO instalado")
            all_ok = False

    return all_ok


def main():
    """Função principal"""
    print("""
╔════════════════════════════════════════════════════════════╗
║          HydroNetwork - Setup de Dependências              ║
║       Motor de Cálculo Hidráulico para Saneamento          ║
╚════════════════════════════════════════════════════════════╝
    """)

    args = sys.argv[1:]

    # Criar diretórios
    create_directories()

    # Instalar dependências
    if not install_requirements():
        print("\nERRO: Falha ao instalar dependências")
        sys.exit(1)

    # ProjectLibre submódulo
    if "--projectlibre" in args:
        setup_projectlibre_submodule()

    # Verificar instalação
    if verify_installation():
        print("\n" + "="*60)
        print("  ✓ Setup concluído com sucesso!")
        print("="*60)
        print("""
Próximos passos:
  1. Configure o CRS padrão se necessário (EPSG:31983 = SIRGAS 2000 UTM 23S)
  2. Importe seus dados na interface web
  3. Execute as análises hidráulicas

Para iniciar a API:
  uvicorn src.api.main:app --reload

Para executar testes:
  pytest tests/
        """)
    else:
        print("\nAVISO: Algumas dependências não foram instaladas corretamente")
        sys.exit(1)


if __name__ == "__main__":
    main()
