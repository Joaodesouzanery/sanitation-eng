"""
Importers - Importadores GIS (DXF, IFC, SHP, LandXML)

Workflow obrigatório:
1. scan_file() - Analisa arquivo SEM importar
2. validate_mapping() - Valida mapeamento do usuário
3. import_with_mapping() - Importa com mapeamento explícito
"""

from .base import (
    BaseImporter,
    ScanMode,
    ScanReport,
    LayerInfo,
    LayerMapping,
    ImportConfig,
    ImportResult,
    UserMappingWorkflow,
    get_importer,
    register_importer
)

__all__ = [
    "BaseImporter",
    "ScanMode",
    "ScanReport",
    "LayerInfo",
    "LayerMapping",
    "ImportConfig",
    "ImportResult",
    "UserMappingWorkflow",
    "get_importer",
    "register_importer"
]
