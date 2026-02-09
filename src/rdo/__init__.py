"""
Módulo RDO (Relatório Diário de Obra) para o HydroNetwork.

Este módulo fornece funcionalidades completas para:
- Criação e gerenciamento de Relatórios Diários de Obra
- Integração com planejamento e trechos importados
- Dashboard com métricas e visualizações
- Exportação em múltiplos formatos (PDF, JSON, Excel, Shapefile)
- Mapa interativo com avanço por trecho

Uso básico:
    from src.rdo import RDOEngine, get_rdo_engine, RDO, RDODashboard

    # Obtém o engine singleton
    engine = get_rdo_engine()

    # Cria um novo projeto
    project = engine.create_project("Rede de Esgoto Centro", system_type="esgoto")

    # Cria um novo RDO
    rdo = engine.create_rdo(
        project_id=project.id,
        rdo_date=date.today(),
        created_by="João Silva"
    )

    # Adiciona serviços executados
    engine.add_service_to_rdo(
        rdo_id=rdo.id,
        service_name="Escavação de vala",
        quantity=120.5,
        unit="m³"
    )

    # Adiciona progresso de trecho
    engine.add_segment_progress_to_rdo(
        rdo_id=rdo.id,
        segment_id="SEG-001",
        executed_length=85.0,
        system_type="esgoto"
    )

    # Gera dashboard
    dashboard = RDODashboard(engine.get_all_rdos())
    metrics = dashboard.calculate_metrics()
    chart_data = dashboard.get_chart_data()
    map_data = dashboard.get_map_data()

    # Exporta RDO
    from src.rdo import JSONExporter, PDFExporter, ExcelExporter, ShapefileExporter

    json_content = JSONExporter(rdo).export()
    html_content = PDFExporter(rdo).export_html()
    excel_data = ExcelExporter(rdo).export()
    geojson = ShapefileExporter(rdo).export_geojson()
"""

# Models
from .models import (
    # Enums
    SystemType,
    TerrainCondition,
    RDOStatus,
    ServiceUnit,
    # Classes de dados
    Location,
    WorkFront,
    WorkLocation,
    Worker,
    ServiceCatalogItem,
    ExecutedService,
    SegmentProgress,
    Visit,
    Occurrence,
    Project,
    RDO,
    RDOSummary,
    DashboardMetrics,
    SegmentGeoJSON,
)

# Engine
from .engine import (
    RDOEngine,
    get_rdo_engine,
)

# Dashboard
from .dashboard import (
    RDODashboard,
)

# Exporters
from .exporters import (
    RDOExporter,
    JSONExporter,
    ExcelExporter,
    PDFExporter,
    ShapefileExporter,
    BatchExporter,
)


__all__ = [
    # Enums
    "SystemType",
    "TerrainCondition",
    "RDOStatus",
    "ServiceUnit",
    # Models
    "Location",
    "WorkFront",
    "WorkLocation",
    "Worker",
    "ServiceCatalogItem",
    "ExecutedService",
    "SegmentProgress",
    "Visit",
    "Occurrence",
    "Project",
    "RDO",
    "RDOSummary",
    "DashboardMetrics",
    "SegmentGeoJSON",
    # Engine
    "RDOEngine",
    "get_rdo_engine",
    # Dashboard
    "RDODashboard",
    # Exporters
    "RDOExporter",
    "JSONExporter",
    "ExcelExporter",
    "PDFExporter",
    "ShapefileExporter",
    "BatchExporter",
]

__version__ = "1.0.0"
