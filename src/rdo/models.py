"""
Modelos de dados para o módulo RDO (Relatório Diário de Obra).

Este módulo define os modelos Pydantic para:
- Relatório Diário de Obra (RDO)
- Serviços executados
- Frentes de serviço
- Locais de obra
- Integração com planejamento e trechos
"""

from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from uuid import uuid4


class SystemType(str, Enum):
    """Tipo de sistema de saneamento."""
    AGUA = "agua"
    ESGOTO = "esgoto"
    DRENAGEM = "drenagem"


class TerrainCondition(str, Enum):
    """Condição do terreno."""
    SECO = "seco"
    UMIDO = "umido"
    ALAGADO = "alagado"
    ROCHOSO = "rochoso"
    ARENOSO = "arenoso"
    ARGILOSO = "argiloso"


class RDOStatus(str, Enum):
    """Status do RDO."""
    RASCUNHO = "rascunho"
    ENVIADO = "enviado"
    APROVADO = "aprovado"
    REJEITADO = "rejeitado"


class ServiceUnit(str, Enum):
    """Unidades de medida para serviços."""
    METRO_LINEAR = "m"
    METRO_QUADRADO = "m²"
    METRO_CUBICO = "m³"
    UNIDADE = "un"
    HORA = "h"
    DIA = "dia"
    QUILOGRAMA = "kg"
    TONELADA = "t"
    LITRO = "L"


class Location(BaseModel):
    """Localização geográfica."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, description="Precisão em metros")


class WorkFront(BaseModel):
    """Frente de serviço."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1, description="Nome da frente de serviço")
    description: Optional[str] = None
    project_id: str = Field(..., description="ID do projeto associado")
    responsible: Optional[str] = Field(None, description="Responsável pela frente")
    created_at: datetime = Field(default_factory=datetime.now)
    active: bool = True


class WorkLocation(BaseModel):
    """Local de obra."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1, description="Nome do local")
    address: Optional[str] = None
    coordinates: Optional[Location] = None
    project_id: str = Field(..., description="ID do projeto associado")
    created_at: datetime = Field(default_factory=datetime.now)
    active: bool = True


class Worker(BaseModel):
    """Funcionário/trabalhador."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1)
    role: Optional[str] = None
    registration: Optional[str] = Field(None, description="Matrícula")
    active: bool = True


class ServiceCatalogItem(BaseModel):
    """Item do catálogo de serviços."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    code: Optional[str] = Field(None, description="Código do serviço")
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    default_unit: ServiceUnit = ServiceUnit.METRO_LINEAR
    category: Optional[str] = None
    active: bool = True


class ExecutedService(BaseModel):
    """Serviço executado no RDO."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    service_id: Optional[str] = Field(None, description="ID do serviço no catálogo")
    service_name: str = Field(..., min_length=1, description="Nome do serviço")
    quantity: float = Field(..., ge=0, description="Quantidade executada")
    unit: ServiceUnit = Field(..., description="Unidade de medida")
    equipment_used: Optional[List[str]] = Field(None, description="Equipamentos utilizados")
    responsible_worker_id: Optional[str] = Field(None, description="ID do funcionário responsável")
    responsible_worker_name: Optional[str] = Field(None, description="Nome do funcionário responsável")
    notes: Optional[str] = None


class SegmentProgress(BaseModel):
    """Progresso de um trecho específico."""
    segment_id: str = Field(..., description="ID do trecho importado")
    segment_name: Optional[str] = Field(None, description="Nome/identificação do trecho")
    project_id: str = Field(..., description="ID do projeto")
    system_type: SystemType = Field(..., description="Tipo: água ou esgoto")
    execution_date: date = Field(..., description="Data de execução")
    planned_length: Optional[float] = Field(None, description="Comprimento planejado (m)")
    executed_length: float = Field(..., ge=0, description="Comprimento executado (m)")
    progress_percentage: float = Field(0.0, ge=0, le=100, description="Percentual de avanço")
    start_coordinates: Optional[Location] = None
    end_coordinates: Optional[Location] = None
    status: str = Field("em_execucao", description="Status do trecho")
    geometry_wkt: Optional[str] = Field(None, description="Geometria WKT do trecho")

    @field_validator('progress_percentage', mode='before')
    @classmethod
    def calculate_progress(cls, v, info):
        """Calcula o percentual de progresso se não fornecido."""
        if v is None or v == 0:
            data = info.data
            if data.get('planned_length') and data.get('executed_length'):
                return min(100.0, (data['executed_length'] / data['planned_length']) * 100)
        return v


class Visit(BaseModel):
    """Visita recebida na obra."""
    visitor_name: str = Field(..., min_length=1)
    visitor_type: str = Field(..., description="Tipo: fiscalização, fornecedor, cliente, etc.")
    organization: Optional[str] = None
    purpose: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    notes: Optional[str] = None


class Occurrence(BaseModel):
    """Ocorrência registrada no RDO."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str = Field(..., description="Tipo: acidente, atraso, problema, etc.")
    description: str = Field(..., min_length=1)
    severity: str = Field("baixa", description="Severidade: baixa, média, alta, crítica")
    affected_services: Optional[List[str]] = None
    corrective_actions: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class Project(BaseModel):
    """Projeto associado ao RDO."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1)
    code: Optional[str] = None
    description: Optional[str] = None
    system_type: SystemType = SystemType.ESGOTO
    client: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_planned_length: Optional[float] = Field(None, description="Extensão total planejada (m)")
    active: bool = True


class RDO(BaseModel):
    """
    Relatório Diário de Obra (RDO).

    Contém todas as informações necessárias para o relatório diário,
    incluindo integração com planejamento e trechos.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))

    # Informações básicas
    project_id: str = Field(..., description="ID do projeto")
    project_name: Optional[str] = Field(None, description="Nome do projeto")
    obra_id: Optional[str] = Field(None, description="ID da obra específica")
    obra_name: Optional[str] = Field(None, description="Nome da obra")

    # Data e localização
    date: date = Field(..., description="Data do RDO")
    location: Optional[Location] = Field(None, description="Localização GPS")
    terrain_condition: Optional[TerrainCondition] = None

    # Frentes e locais
    work_fronts: List[str] = Field(default_factory=list, description="IDs das frentes de serviço")
    work_front_names: List[str] = Field(default_factory=list, description="Nomes das frentes")
    work_locations: List[str] = Field(default_factory=list, description="IDs dos locais de obra")
    work_location_names: List[str] = Field(default_factory=list, description="Nomes dos locais")

    # Serviços executados
    executed_services: List[ExecutedService] = Field(default_factory=list)

    # Integração com planejamento e trechos
    segment_progress: List[SegmentProgress] = Field(
        default_factory=list,
        description="Progresso dos trechos executados"
    )

    # Visitas e ocorrências
    visits: List[Visit] = Field(default_factory=list, description="Visitas recebidas")
    occurrences: List[Occurrence] = Field(default_factory=list, description="Ocorrências")

    # Observações
    general_notes: Optional[str] = Field(None, description="Observações gerais")

    # Metadados
    status: RDOStatus = Field(RDOStatus.RASCUNHO)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    # Campos para auditoria
    version: int = Field(1, description="Versão do RDO")
    history: List[Dict[str, Any]] = Field(default_factory=list, description="Histórico de alterações")

    def add_service(self, service: ExecutedService) -> None:
        """Adiciona um serviço executado ao RDO."""
        self.executed_services.append(service)
        self.updated_at = datetime.now()
        self._add_history("service_added", {"service_id": service.id})

    def add_segment_progress(self, progress: SegmentProgress) -> None:
        """Adiciona progresso de um trecho ao RDO."""
        self.segment_progress.append(progress)
        self.updated_at = datetime.now()
        self._add_history("segment_added", {"segment_id": progress.segment_id})

    def add_occurrence(self, occurrence: Occurrence) -> None:
        """Adiciona uma ocorrência ao RDO."""
        self.occurrences.append(occurrence)
        self.updated_at = datetime.now()
        self._add_history("occurrence_added", {"occurrence_id": occurrence.id})

    def add_visit(self, visit: Visit) -> None:
        """Adiciona uma visita ao RDO."""
        self.visits.append(visit)
        self.updated_at = datetime.now()
        self._add_history("visit_added", {"visitor": visit.visitor_name})

    def approve(self, approved_by: str) -> None:
        """Aprova o RDO."""
        self.status = RDOStatus.APROVADO
        self.approved_by = approved_by
        self.approved_at = datetime.now()
        self.updated_at = datetime.now()
        self._add_history("approved", {"approved_by": approved_by})

    def reject(self, rejected_by: str, reason: str) -> None:
        """Rejeita o RDO."""
        self.status = RDOStatus.REJEITADO
        self.updated_at = datetime.now()
        self._add_history("rejected", {"rejected_by": rejected_by, "reason": reason})

    def _add_history(self, action: str, details: Dict[str, Any]) -> None:
        """Adiciona entrada ao histórico."""
        self.history.append({
            "action": action,
            "timestamp": datetime.now().isoformat(),
            "details": details,
            "version": self.version
        })
        self.version += 1

    def calculate_total_progress(self) -> Dict[str, Any]:
        """Calcula o progresso total do RDO."""
        if not self.segment_progress:
            return {"total_executed": 0, "total_planned": 0, "percentage": 0}

        total_executed = sum(sp.executed_length for sp in self.segment_progress)
        total_planned = sum(sp.planned_length or 0 for sp in self.segment_progress)

        percentage = 0
        if total_planned > 0:
            percentage = min(100, (total_executed / total_planned) * 100)

        return {
            "total_executed": total_executed,
            "total_planned": total_planned,
            "percentage": round(percentage, 2)
        }

    def get_services_summary(self) -> Dict[str, float]:
        """Retorna resumo dos serviços executados por tipo."""
        summary = {}
        for service in self.executed_services:
            key = f"{service.service_name} ({service.unit.value})"
            summary[key] = summary.get(key, 0) + service.quantity
        return summary


class RDOSummary(BaseModel):
    """Resumo do RDO para listagem."""
    id: str
    project_name: str
    obra_name: Optional[str]
    date: date
    status: RDOStatus
    services_count: int
    segments_count: int
    total_progress_percentage: float
    created_at: datetime

    @classmethod
    def from_rdo(cls, rdo: RDO) -> "RDOSummary":
        """Cria resumo a partir de um RDO completo."""
        progress = rdo.calculate_total_progress()
        return cls(
            id=rdo.id,
            project_name=rdo.project_name or "Sem projeto",
            obra_name=rdo.obra_name,
            date=rdo.date,
            status=rdo.status,
            services_count=len(rdo.executed_services),
            segments_count=len(rdo.segment_progress),
            total_progress_percentage=progress["percentage"],
            created_at=rdo.created_at
        )


class DashboardMetrics(BaseModel):
    """Métricas do dashboard de RDOs."""
    total_rdos: int = 0
    rdos_today: int = 0
    rdos_this_week: int = 0
    rdos_this_month: int = 0

    # Por status
    rdos_by_status: Dict[str, int] = Field(default_factory=dict)

    # Progresso geral
    total_planned_length: float = 0.0
    total_executed_length: float = 0.0
    overall_progress_percentage: float = 0.0

    # Por tipo de sistema
    progress_by_system: Dict[str, Dict[str, float]] = Field(default_factory=dict)

    # Por projeto
    progress_by_project: Dict[str, Dict[str, float]] = Field(default_factory=dict)

    # Serviços mais executados
    top_services: List[Dict[str, Any]] = Field(default_factory=list)

    # Timeline de execução
    execution_timeline: List[Dict[str, Any]] = Field(default_factory=list)

    # Ocorrências
    total_occurrences: int = 0
    occurrences_by_severity: Dict[str, int] = Field(default_factory=dict)


class SegmentGeoJSON(BaseModel):
    """Representação GeoJSON de um trecho."""
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

    @classmethod
    def from_segment_progress(cls, segment: SegmentProgress) -> "SegmentGeoJSON":
        """Cria GeoJSON a partir de um SegmentProgress."""
        # Se tiver coordenadas de início e fim, cria uma LineString
        if segment.start_coordinates and segment.end_coordinates:
            geometry = {
                "type": "LineString",
                "coordinates": [
                    [segment.start_coordinates.longitude, segment.start_coordinates.latitude],
                    [segment.end_coordinates.longitude, segment.end_coordinates.latitude]
                ]
            }
        elif segment.geometry_wkt:
            # Parse WKT (simplificado)
            geometry = {"type": "LineString", "coordinates": []}
        else:
            geometry = {"type": "Point", "coordinates": [0, 0]}

        properties = {
            "segment_id": segment.segment_id,
            "segment_name": segment.segment_name,
            "project_id": segment.project_id,
            "system_type": segment.system_type.value,
            "execution_date": segment.execution_date.isoformat(),
            "planned_length": segment.planned_length,
            "executed_length": segment.executed_length,
            "progress_percentage": segment.progress_percentage,
            "status": segment.status
        }

        return cls(geometry=geometry, properties=properties)
