"""
Importers - Importadores GIS (DXF, IFC, SHP, LandXML)

Workflow obrigatório:
1. scan_file() - Analisa arquivo SEM importar
2. validate_mapping() - Valida mapeamento do usuário
3. import_with_mapping() - Importa com mapeamento explícito

NUNCA auto-importa dados. NUNCA sobrescreve valores autoritativos.
Apenas preenche campos ausentes com confidence="ASSUMED".
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

from .dxf_dwg import (
    DXFDWGImporter,
    scan_cad_file,
    import_cad_with_mapping
)

from .dxf_advanced import (
    DXFAdvancedImporter,
    DXFScanResult,
    ExtractedEntity,
    LayerSummary,
    EntityCategory,
    GeometryType,
    scan_dxf_file,
    get_available_categories,
    scan_result_to_json,
    create_utm_to_wgs84_transform,
    create_local_to_wgs84_transform,
)

__all__ = [
    # Base classes
    "BaseImporter",
    "ScanMode",
    "ScanReport",
    "LayerInfo",
    "LayerMapping",
    "ImportConfig",
    "ImportResult",
    "UserMappingWorkflow",
    "get_importer",
    "register_importer",
    # DXF/DWG
    "DXFDWGImporter",
    "scan_cad_file",
    "import_cad_with_mapping",
    # DXF Advanced
    "DXFAdvancedImporter",
    "DXFScanResult",
    "ExtractedEntity",
    "LayerSummary",
    "EntityCategory",
    "GeometryType",
    "scan_dxf_file",
    "get_available_categories",
    "scan_result_to_json",
    "create_utm_to_wgs84_transform",
    "create_local_to_wgs84_transform",
]
