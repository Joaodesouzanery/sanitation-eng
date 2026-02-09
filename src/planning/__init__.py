"""
Planning - Planejamento e Cronograma

Implementa regra de conclusão no mesmo dia:
- Todas as atividades de um segmento (escavação, nivelamento, assentamento,
  bombeamento, escoramento, reaterro, base) devem concluir no MESMO DIA.
- Cálculo de metros/dia baseado em profundidade, diâmetro e equipe.
- Gráfico de Gantt consolidado por dia.
"""

from .schedule import (
    SameDayScheduler,
    ScheduleConfig,
    SegmentSchedule,
    calculate_daily_meters
)

from .resources import (
    Resource,
    ResourceType,
    LaborResource,
    EquipmentResource,
    MaterialResource,
    ResourceManager,
    ResourceAllocation,
    DEFAULT_LABOR_CATALOG,
    DEFAULT_EQUIPMENT_CATALOG
)

from .materials import (
    MaterialsScheduler,
    Material,
    MaterialCategory,
    MaterialRequirement,
    PurchaseOrder,
    PurchaseStatus,
    WarehouseMovement,
    generate_materials_schedule,
    get_material_categories,
    get_purchase_statuses,
)

__all__ = [
    # Schedule
    "SameDayScheduler",
    "ScheduleConfig",
    "SegmentSchedule",
    "calculate_daily_meters",
    # Resources
    "Resource",
    "ResourceType",
    "LaborResource",
    "EquipmentResource",
    "MaterialResource",
    "ResourceManager",
    "ResourceAllocation",
    "DEFAULT_LABOR_CATALOG",
    "DEFAULT_EQUIPMENT_CATALOG",
    # Materials
    "MaterialsScheduler",
    "Material",
    "MaterialCategory",
    "MaterialRequirement",
    "PurchaseOrder",
    "PurchaseStatus",
    "WarehouseMovement",
    "generate_materials_schedule",
    "get_material_categories",
    "get_purchase_statuses",
]
