"""
Resources Module - Gestão de recursos (equipes, equipamentos, custos)
"""

from typing import List, Dict, Optional
from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class ResourceType(Enum):
    """Tipos de recursos"""
    LABOR = "MÃO DE OBRA"
    EQUIPMENT = "EQUIPAMENTO"
    MATERIAL = "MATERIAL"
    SUBCONTRACT = "SUBEMPREITEIRO"


@dataclass
class Resource:
    """Recurso genérico"""
    id: str
    name: str
    resource_type: ResourceType
    unit: str
    unit_cost: float
    availability: float = 1.0  # Disponibilidade (0-1)
    calendar: str = "default"


@dataclass
class LaborResource(Resource):
    """Recurso de mão de obra"""
    role: str = ""
    skills: List[str] = field(default_factory=list)
    hourly_cost: float = 0.0
    overtime_multiplier: float = 1.5

    def __post_init__(self):
        self.resource_type = ResourceType.LABOR
        self.unit = "HH"  # Homem-hora


@dataclass
class EquipmentResource(Resource):
    """Recurso de equipamento"""
    capacity: float = 0.0
    fuel_consumption: float = 0.0  # L/hora
    maintenance_cost: float = 0.0

    def __post_init__(self):
        self.resource_type = ResourceType.EQUIPMENT
        self.unit = "HM"  # Hora-máquina


@dataclass
class MaterialResource(Resource):
    """Recurso de material"""
    supplier: str = ""
    lead_time_days: int = 0
    min_order_qty: float = 0.0

    def __post_init__(self):
        self.resource_type = ResourceType.MATERIAL


# Catálogo padrão de recursos para saneamento
DEFAULT_LABOR_CATALOG = {
    "ENC": LaborResource(
        id="ENC", name="Encarregado de Turma", resource_type=ResourceType.LABOR,
        unit="HH", unit_cost=35.0, role="Encarregado", hourly_cost=35.0
    ),
    "OFC": LaborResource(
        id="OFC", name="Oficial de Saneamento", resource_type=ResourceType.LABOR,
        unit="HH", unit_cost=28.0, role="Oficial", hourly_cost=28.0,
        skills=["Assentamento", "Conexões", "Testes"]
    ),
    "AJD": LaborResource(
        id="AJD", name="Ajudante", resource_type=ResourceType.LABOR,
        unit="HH", unit_cost=18.0, role="Ajudante", hourly_cost=18.0
    ),
    "OPM": LaborResource(
        id="OPM", name="Operador de Máquinas", resource_type=ResourceType.LABOR,
        unit="HH", unit_cost=32.0, role="Operador", hourly_cost=32.0,
        skills=["Retroescavadeira", "Rolo Compactador", "Caminhão"]
    ),
}

DEFAULT_EQUIPMENT_CATALOG = {
    "RET": EquipmentResource(
        id="RET", name="Retroescavadeira", resource_type=ResourceType.EQUIPMENT,
        unit="HM", unit_cost=180.0, capacity=50.0, fuel_consumption=12.0
    ),
    "CMP": EquipmentResource(
        id="CMP", name="Compactador de Solo", resource_type=ResourceType.EQUIPMENT,
        unit="HM", unit_cost=45.0, capacity=30.0, fuel_consumption=5.0
    ),
    "CMB": EquipmentResource(
        id="CMB", name="Caminhão Basculante", resource_type=ResourceType.EQUIPMENT,
        unit="HM", unit_cost=120.0, capacity=8.0, fuel_consumption=15.0
    ),
    "BOM": EquipmentResource(
        id="BOM", name="Bomba de Esgotamento", resource_type=ResourceType.EQUIPMENT,
        unit="HM", unit_cost=35.0, capacity=20.0, fuel_consumption=3.0
    ),
    "GER": EquipmentResource(
        id="GER", name="Gerador", resource_type=ResourceType.EQUIPMENT,
        unit="HM", unit_cost=50.0, capacity=10.0, fuel_consumption=8.0
    ),
}


@dataclass
class ResourceAllocation:
    """Alocação de recurso em uma atividade"""
    resource_id: str
    quantity: float
    start_date: date
    end_date: date
    daily_hours: float = 8.0
    cost_total: float = 0.0


class ResourceManager:
    """
    Gerenciador de recursos do projeto.

    Controla alocação, disponibilidade e custos de recursos.
    """

    def __init__(self):
        self.labor: Dict[str, LaborResource] = dict(DEFAULT_LABOR_CATALOG)
        self.equipment: Dict[str, EquipmentResource] = dict(DEFAULT_EQUIPMENT_CATALOG)
        self.materials: Dict[str, MaterialResource] = {}
        self.allocations: List[ResourceAllocation] = []

    def add_resource(self, resource: Resource):
        """Adiciona recurso ao catálogo"""
        if isinstance(resource, LaborResource):
            self.labor[resource.id] = resource
        elif isinstance(resource, EquipmentResource):
            self.equipment[resource.id] = resource
        elif isinstance(resource, MaterialResource):
            self.materials[resource.id] = resource

    def get_resource(self, resource_id: str) -> Optional[Resource]:
        """Busca recurso pelo ID"""
        return (self.labor.get(resource_id) or
                self.equipment.get(resource_id) or
                self.materials.get(resource_id))

    def calculate_team_cost(self, team_composition: Dict[str, int],
                           daily_hours: float = 8.0) -> Dict:
        """
        Calcula custo de uma composição de equipe.

        Args:
            team_composition: Dict {resource_id: quantidade}
            daily_hours: Horas de trabalho por dia

        Returns:
            Dict com custos detalhados
        """
        labor_cost = 0.0
        equipment_cost = 0.0

        details = []

        for res_id, qty in team_composition.items():
            resource = self.get_resource(res_id)
            if not resource:
                continue

            daily_cost = resource.unit_cost * daily_hours * qty

            details.append({
                "id": res_id,
                "name": resource.name,
                "quantity": qty,
                "unit_cost": resource.unit_cost,
                "hours": daily_hours,
                "daily_cost": daily_cost
            })

            if isinstance(resource, LaborResource):
                labor_cost += daily_cost
            elif isinstance(resource, EquipmentResource):
                equipment_cost += daily_cost

        return {
            "labor_cost": labor_cost,
            "equipment_cost": equipment_cost,
            "total_daily_cost": labor_cost + equipment_cost,
            "details": details
        }

    def standard_sewer_team(self) -> Dict[str, int]:
        """Retorna composição padrão de equipe de esgoto"""
        return {
            "ENC": 1,
            "OFC": 2,
            "AJD": 4,
            "OPM": 1,
            "RET": 1,
            "CMP": 1
        }

    def standard_water_team(self) -> Dict[str, int]:
        """Retorna composição padrão de equipe de água"""
        return {
            "ENC": 1,
            "OFC": 2,
            "AJD": 3,
            "OPM": 1,
            "RET": 1,
            "CMP": 1
        }

    def standard_drainage_team(self) -> Dict[str, int]:
        """Retorna composição padrão de equipe de drenagem"""
        return {
            "ENC": 1,
            "OFC": 3,
            "AJD": 6,
            "OPM": 2,
            "RET": 1,
            "CMP": 1,
            "CMB": 1
        }

    def export_catalog(self) -> Dict:
        """Exporta catálogo de recursos"""
        return {
            "labor": {k: {
                "id": v.id,
                "name": v.name,
                "unit": v.unit,
                "unit_cost": v.unit_cost,
                "role": v.role,
                "skills": v.skills
            } for k, v in self.labor.items()},
            "equipment": {k: {
                "id": v.id,
                "name": v.name,
                "unit": v.unit,
                "unit_cost": v.unit_cost,
                "capacity": v.capacity,
                "fuel_consumption": v.fuel_consumption
            } for k, v in self.equipment.items()},
            "materials": {k: {
                "id": v.id,
                "name": v.name,
                "unit": v.unit,
                "unit_cost": v.unit_cost,
                "supplier": v.supplier,
                "lead_time_days": v.lead_time_days
            } for k, v in self.materials.items()}
        }
