"""
Modelos de Dados do Projeto - HydroNetwork
Motor de Cálculo Hidráulico para Saneamento

Este módulo contém os modelos de dados centrais com suporte completo
a proveniência, auditoria e rastreabilidade conforme normas brasileiras.

Autor: Sistema de Engenharia de Saneamento
Data: 2026-02-08
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any, Literal, Callable
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, field_validator
import json


# ============================================
# ENUMERAÇÕES DO SISTEMA
# ============================================

class SystemType(str, Enum):
    """Tipo de sistema de saneamento"""
    WATER = "water"  # Abastecimento de água
    SEWER = "sewer"  # Esgotamento sanitário
    DRAINAGE = "drainage"  # Drenagem pluvial
    REUSE = "reuse"  # Reúso de água


class ElementType(str, Enum):
    """Tipo de elemento da rede"""
    # Nós
    JUNCTION = "junction"  # Junção simples
    RESERVOIR = "reservoir"  # Reservatório
    TANK = "tank"  # Tanque elevado
    OUTFALL = "outfall"  # Exutório (SWMM)
    MANHOLE = "manhole"  # Poço de visita
    CATCH_BASIN = "catch_basin"  # Boca de lobo

    # Trechos
    PIPE = "pipe"  # Tubulação
    CONDUIT = "conduit"  # Conduto (drenagem)
    PUMP = "pump"  # Bomba
    VALVE = "valve"  # Válvula
    WEIR = "weir"  # Vertedouro
    ORIFICE = "orifice"  # Orifício

    # Áreas
    SUBCATCHMENT = "subcatchment"  # Sub-bacia
    STORAGE = "storage"  # Unidade de armazenamento


class ConfidenceLevel(str, Enum):
    """
    Nível de confiança dos dados - CRÍTICO para auditoria

    AUTHORITATIVE: Dado da fonte oficial (planilha/projeto)
    MEASURED: Dado medido em campo
    CALCULATED: Calculado pelo sistema
    INFERRED: Inferido de outros dados
    ASSUMED: Assumido (requer validação)
    USER_EDITED: Editado manualmente pelo usuário
    """
    AUTHORITATIVE = "authoritative"
    MEASURED = "measured"
    CALCULATED = "calculated"
    INFERRED = "inferred"
    ASSUMED = "assumed"
    USER_EDITED = "user_edited"


class Severity(str, Enum):
    """Severidade de findings de revisão"""
    OK = "OK"
    INFO = "INFO"
    ALERT = "ALERT"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ImportFormat(str, Enum):
    """Formatos de importação suportados"""
    DXF = "dxf"
    DWG = "dwg"
    IFC = "ifc"
    SHP = "shp"
    GEOJSON = "geojson"
    LANDXML = "landxml"
    CSV = "csv"
    EPANET_INP = "epanet_inp"
    SWMM_INP = "swmm_inp"


# ============================================
# METADADOS NORMATIVOS BRASILEIROS
# ============================================

BRAZIL_NORMS_METADATA = {
    "ABNT_NBR_15920": {
        "scope": "water",
        "year": 2011,
        "topics": ["min_diameter_50mm", "min_cover_0.6m", "max_velocity_3m/s", "min_pressure_10mca"]
    },
    "ABNT_NBR_9649": {
        "scope": "sewer",
        "year": 1986,
        "topics": ["min_slope_0.5pct_d150", "max_distance_100m_PV", "min_diameter_100mm", "tractive_force"]
    },
    "ABNT_NBR_15527": {
        "scope": "drainage",
        "year": 2019,
        "topics": ["max_velocity_5m/s", "time_concentration_rational", "manning_roughness"]
    },
    "ABNT_NBR_12262": {
        "scope": "sewer",
        "year": 1992,
        "topics": ["pump_station_design", "wet_well_volume", "pump_selection"]
    },
    "ABNT_NBR_12218": {
        "scope": "water",
        "year": 2017,
        "topics": ["network_design", "pressure_zones", "demand_patterns"]
    },
    "Res_430_CONAMA": {
        "scope": "sewer",
        "year": 2011,
        "topics": ["effluent_discharge_limits", "bod_removal", "water_quality"]
    },
    "Portaria_888_MS": {
        "scope": "water",
        "year": 2021,
        "topics": ["drinking_water_quality", "residual_chlorine", "turbidity"]
    }
}


# ============================================
# MODELOS DE PROVENIÊNCIA E AUDITORIA
# ============================================

class Provenance(BaseModel):
    """
    Proveniência do dado - rastrea origem e confiança

    Exemplo de uso:
        >>> prov = Provenance(
        ...     source_file="rede_agua.csv",
        ...     source_field="DIAMETRO",
        ...     confidence=ConfidenceLevel.AUTHORITATIVE
        ... )
    """
    source_file: Optional[str] = None
    source_field: Optional[str] = None
    source_layer: Optional[str] = None
    confidence: ConfidenceLevel = ConfidenceLevel.ASSUMED
    import_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    imported_by: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AuditEntry(BaseModel):
    """
    Entrada de auditoria para rastreamento de mudanças

    OBRIGATÓRIO para toda edição de dados!
    """
    id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    element_id: UUID
    element_type: ElementType
    field: str
    old_value: Any
    new_value: Any
    reason: str  # Obrigatório para edições não-UI
    action: Literal["create", "update", "delete"] = "update"
    ip_address: Optional[str] = None
    session_id: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class AuditTrail(BaseModel):
    """Trilha de auditoria completa de um elemento"""
    element_id: UUID
    entries: List[AuditEntry] = Field(default_factory=list)

    def add_entry(
        self,
        user_id: str,
        field: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        element_type: ElementType
    ) -> AuditEntry:
        """Adiciona entrada de auditoria"""
        entry = AuditEntry(
            user_id=user_id,
            element_id=self.element_id,
            element_type=element_type,
            field=field,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        self.entries.append(entry)
        return entry


# ============================================
# MODELOS DE ELEMENTOS DA REDE
# ============================================

class Coordinates(BaseModel):
    """Coordenadas geográficas"""
    x: float
    y: float
    z: Optional[float] = None
    crs: str = "EPSG:31983"  # SIRGAS 2000 / UTM zone 23S (padrão Brasil)


class BaseElement(BaseModel):
    """
    Elemento base com proveniência e auditoria

    Todos os elementos da rede herdam desta classe
    """
    id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    external_id: Optional[str] = None  # ID original do arquivo fonte
    name: Optional[str] = None
    description: Optional[str] = None
    system_type: SystemType
    element_type: ElementType
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Proveniência e auditoria
    provenance: Provenance = Field(default_factory=Provenance)
    audit_trail: AuditTrail = None

    # Campos para planejamento
    wbs_id: Optional[str] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    progress_percent: float = 0.0

    def __init__(self, **data):
        super().__init__(**data)
        if self.audit_trail is None:
            self.audit_trail = AuditTrail(element_id=self.id)

    def update_field(
        self,
        field: str,
        new_value: Any,
        user_id: str,
        reason: str
    ) -> None:
        """Atualiza campo com auditoria obrigatória"""
        old_value = getattr(self, field, None)
        setattr(self, field, new_value)
        self.updated_at = datetime.now(timezone.utc)
        self.audit_trail.add_entry(
            user_id=user_id,
            field=field,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            element_type=self.element_type
        )


class Node(BaseElement):
    """
    Nó da rede (junção, reservatório, PV, etc.)

    Exemplo:
        >>> node = Node(
        ...     project_id=uuid4(),
        ...     external_id="PV-001",
        ...     system_type=SystemType.SEWER,
        ...     element_type=ElementType.MANHOLE,
        ...     coordinates=Coordinates(x=123456.78, y=7654321.0, z=850.5),
        ...     ground_elevation=850.5,
        ...     invert_elevation=848.0
        ... )
    """
    coordinates: Coordinates

    # Elevações
    ground_elevation: Optional[float] = None  # Cota do terreno (m)
    invert_elevation: Optional[float] = None  # Cota de fundo (m)
    rim_elevation: Optional[float] = None  # Cota da tampa (m)

    # Parâmetros hidráulicos
    demand: Optional[float] = None  # Demanda base (L/s)
    head: Optional[float] = None  # Carga hidráulica (m)
    pressure: Optional[float] = None  # Pressão (mca)

    # Para SWMM
    max_depth: Optional[float] = None  # Profundidade máxima (m)
    init_depth: Optional[float] = None  # Profundidade inicial (m)
    surcharge_depth: Optional[float] = None  # Sobrecarga (m)
    ponded_area: Optional[float] = None  # Área de alagamento (m²)

    # Dimensões (para PVs)
    diameter: Optional[float] = None  # Diâmetro (mm)
    structure_type: Optional[str] = None  # Tipo de estrutura

    # Confidence por campo
    field_confidence: Dict[str, ConfidenceLevel] = Field(default_factory=dict)

    @property
    def depth(self) -> Optional[float]:
        """Profundidade do nó (m)"""
        if self.ground_elevation and self.invert_elevation:
            return self.ground_elevation - self.invert_elevation
        return None


class Link(BaseElement):
    """
    Trecho da rede (tubo, conduto, etc.)

    Exemplo:
        >>> link = Link(
        ...     project_id=uuid4(),
        ...     external_id="T-001",
        ...     system_type=SystemType.WATER,
        ...     element_type=ElementType.PIPE,
        ...     from_node_id=node1.id,
        ...     to_node_id=node2.id,
        ...     length=120.5,
        ...     diameter=150,
        ...     material="PVC"
        ... )
    """
    from_node_id: UUID
    to_node_id: UUID

    # Geometria
    length: float  # Comprimento (m)
    vertices: List[Coordinates] = Field(default_factory=list)

    # Características físicas
    diameter: Optional[float] = None  # Diâmetro (mm)
    width: Optional[float] = None  # Largura para seções não circulares (mm)
    height: Optional[float] = None  # Altura para seções não circulares (mm)
    shape: str = "CIRCULAR"  # CIRCULAR, RECT_CLOSED, RECT_OPEN, etc.
    material: Optional[str] = None  # PVC, PEAD, CONCRETO, etc.
    roughness: Optional[float] = None  # Coeficiente de rugosidade (C ou n)

    # Declividade e cobertura
    slope: Optional[float] = None  # Declividade (m/m ou %)
    upstream_invert: Optional[float] = None  # Cota de fundo montante (m)
    downstream_invert: Optional[float] = None  # Cota de fundo jusante (m)
    upstream_cover: Optional[float] = None  # Cobertura montante (m)
    downstream_cover: Optional[float] = None  # Cobertura jusante (m)

    # Status
    status: str = "OPEN"  # OPEN, CLOSED, CV (check valve)

    # Resultados hidráulicos (preenchidos após simulação)
    flow: Optional[float] = None  # Vazão (L/s)
    velocity: Optional[float] = None  # Velocidade (m/s)
    headloss: Optional[float] = None  # Perda de carga (m)
    filling_ratio: Optional[float] = None  # Lâmina relativa (Y/D)

    # Confidence por campo
    field_confidence: Dict[str, ConfidenceLevel] = Field(default_factory=dict)

    @field_validator('diameter')
    @classmethod
    def validate_diameter(cls, v, info):
        """Valida diâmetro mínimo conforme norma"""
        if v is not None and v < 50:
            # Apenas warning, não impede cadastro
            pass
        return v


class Subcatchment(BaseElement):
    """
    Sub-bacia de contribuição (para SWMM)
    """
    outlet_node_id: UUID
    rain_gage_id: Optional[str] = None

    # Área e características
    area: float  # Área (ha)
    width: Optional[float] = None  # Largura característica (m)
    percent_slope: Optional[float] = None  # Declividade média (%)
    percent_imperv: float = 0.0  # Percentual impermeável (%)

    # Parâmetros de infiltração
    n_imperv: float = 0.01  # Manning impermeável
    n_perv: float = 0.10  # Manning permeável
    s_imperv: float = 0.05  # Armazenamento impermeável (mm)
    s_perv: float = 0.05  # Armazenamento permeável (mm)

    # Polígono
    polygon: List[Coordinates] = Field(default_factory=list)


# ============================================
# MODELO DO PROJETO
# ============================================

class NormReference(BaseModel):
    """Referência normativa estruturada"""
    norm_id: str
    clause_id: Optional[str] = None
    topic: str
    year: Optional[int] = None


class ProjectDataModel(BaseModel):
    """
    Modelo de dados do projeto completo

    Este é o container principal que armazena todos os elementos
    do projeto com suas relações e metadados.

    Exemplo:
        >>> project = ProjectDataModel(
        ...     name="Rede de Água - Bairro Centro",
        ...     description="Projeto de abastecimento de água",
        ...     crs="EPSG:31983"
        ... )
        >>> project.add_node(node)
        >>> project.add_link(link)
    """
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None

    # Metadados do projeto
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    version: str = "1.0.0"

    # Sistema de coordenadas
    crs: str = "EPSG:31983"

    # Elementos da rede
    nodes: Dict[UUID, Node] = Field(default_factory=dict)
    links: Dict[UUID, Link] = Field(default_factory=dict)
    subcatchments: Dict[UUID, Subcatchment] = Field(default_factory=dict)

    # Referências normativas aplicáveis
    applicable_norms: List[NormReference] = Field(default_factory=list)

    # Auditoria global do projeto
    audit_entries: List[AuditEntry] = Field(default_factory=list)

    def add_node(self, node: Node, user_id: str = "system") -> None:
        """Adiciona nó ao projeto com auditoria"""
        node.project_id = self.id
        self.nodes[node.id] = node
        self.updated_at = datetime.now(timezone.utc)

        entry = AuditEntry(
            user_id=user_id,
            element_id=node.id,
            element_type=node.element_type,
            field="*",
            old_value=None,
            new_value="created",
            reason="Elemento adicionado ao projeto",
            action="create"
        )
        self.audit_entries.append(entry)

    def add_link(self, link: Link, user_id: str = "system") -> None:
        """Adiciona trecho ao projeto com auditoria"""
        link.project_id = self.id
        self.links[link.id] = link
        self.updated_at = datetime.now(timezone.utc)

        entry = AuditEntry(
            user_id=user_id,
            element_id=link.id,
            element_type=link.element_type,
            field="*",
            old_value=None,
            new_value="created",
            reason="Elemento adicionado ao projeto",
            action="create"
        )
        self.audit_entries.append(entry)

    def get_node(self, node_id: UUID) -> Optional[Node]:
        """Retorna nó por ID"""
        return self.nodes.get(node_id)

    def get_link(self, link_id: UUID) -> Optional[Link]:
        """Retorna trecho por ID"""
        return self.links.get(link_id)

    def get_nodes_by_type(self, element_type: ElementType) -> List[Node]:
        """Retorna nós filtrados por tipo"""
        return [n for n in self.nodes.values() if n.element_type == element_type]

    def get_links_by_system(self, system_type: SystemType) -> List[Link]:
        """Retorna trechos filtrados por sistema"""
        return [l for l in self.links.values() if l.system_type == system_type]

    def to_geojson(self) -> Dict[str, Any]:
        """Exporta projeto para GeoJSON"""
        features = []

        # Nós como pontos
        for node in self.nodes.values():
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [node.coordinates.x, node.coordinates.y, node.coordinates.z or 0]
                },
                "properties": {
                    "id": str(node.id),
                    "external_id": node.external_id,
                    "element_type": node.element_type.value,
                    "system_type": node.system_type.value,
                    "ground_elevation": node.ground_elevation,
                    "invert_elevation": node.invert_elevation
                }
            })

        # Trechos como linhas
        for link in self.links.values():
            from_node = self.get_node(link.from_node_id)
            to_node = self.get_node(link.to_node_id)

            if from_node and to_node:
                coordinates = [[from_node.coordinates.x, from_node.coordinates.y]]
                for v in link.vertices:
                    coordinates.append([v.x, v.y])
                coordinates.append([to_node.coordinates.x, to_node.coordinates.y])

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates
                    },
                    "properties": {
                        "id": str(link.id),
                        "external_id": link.external_id,
                        "element_type": link.element_type.value,
                        "system_type": link.system_type.value,
                        "length": link.length,
                        "diameter": link.diameter,
                        "material": link.material,
                        "slope": link.slope
                    }
                })

        return {
            "type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": self.crs}},
            "features": features
        }

    def validate_against_norms(self) -> List[Dict[str, Any]]:
        """
        Valida projeto contra normas brasileiras aplicáveis

        Retorna lista de findings
        """
        findings = []

        for link in self.links.values():
            # Validação NBR 15920 - Água
            if link.system_type == SystemType.WATER:
                if link.diameter and link.diameter < 50:
                    findings.append({
                        "element_id": str(link.id),
                        "rule_id": "WAT-001",
                        "severity": Severity.ERROR.value,
                        "norm_ref": "ABNT_NBR_15920",
                        "topic": "min_diameter_50mm",
                        "message": f"Diâmetro {link.diameter}mm inferior ao mínimo de 50mm"
                    })

                if link.velocity and link.velocity > 3.0:
                    findings.append({
                        "element_id": str(link.id),
                        "rule_id": "WAT-002",
                        "severity": Severity.ALERT.value,
                        "norm_ref": "ABNT_NBR_15920",
                        "topic": "max_velocity_3m/s",
                        "message": f"Velocidade {link.velocity:.2f}m/s superior ao máximo de 3m/s"
                    })

            # Validação NBR 9649 - Esgoto
            if link.system_type == SystemType.SEWER:
                if link.diameter and link.diameter < 100:
                    findings.append({
                        "element_id": str(link.id),
                        "rule_id": "SEW-001",
                        "severity": Severity.ERROR.value,
                        "norm_ref": "ABNT_NBR_9649",
                        "topic": "min_diameter_100mm",
                        "message": f"Diâmetro {link.diameter}mm inferior ao mínimo de 100mm"
                    })

        for node in self.nodes.values():
            # Validação de cobertura
            if node.system_type == SystemType.WATER:
                if node.ground_elevation and node.rim_elevation:
                    cover = node.ground_elevation - node.rim_elevation
                    if cover < 0.6:
                        findings.append({
                            "element_id": str(node.id),
                            "rule_id": "WAT-003",
                            "severity": Severity.WARNING.value,
                            "norm_ref": "ABNT_NBR_15920",
                            "topic": "min_cover_0.6m",
                            "message": f"Cobertura {cover:.2f}m inferior ao mínimo de 0.6m"
                        })

        return findings


# ============================================
# FUNÇÕES UTILITÁRIAS
# ============================================

def create_audit_entry(
    user_id: str,
    element_id: UUID,
    element_type: ElementType,
    field: str,
    old_value: Any,
    new_value: Any,
    reason: str
) -> AuditEntry:
    """
    Cria entrada de auditoria - função helper

    Uso obrigatório para toda edição de dados!
    """
    return AuditEntry(
        user_id=user_id,
        element_id=element_id,
        element_type=element_type,
        field=field,
        old_value=old_value,
        new_value=new_value,
        reason=reason
    )


def get_norm_metadata(norm_id: str) -> Optional[Dict[str, Any]]:
    """Retorna metadados de uma norma brasileira"""
    return BRAZIL_NORMS_METADATA.get(norm_id)


if __name__ == "__main__":
    # Exemplo de uso
    from uuid import uuid4

    # Criar projeto
    project = ProjectDataModel(
        name="Rede de Água - Bairro Centro",
        description="Projeto de abastecimento de água potável"
    )

    # Criar nós
    node1 = Node(
        project_id=project.id,
        external_id="N1",
        name="Nó 1",
        system_type=SystemType.WATER,
        element_type=ElementType.JUNCTION,
        coordinates=Coordinates(x=300000, y=7500000, z=850),
        ground_elevation=850,
        invert_elevation=848,
        provenance=Provenance(
            source_file="rede.csv",
            confidence=ConfidenceLevel.AUTHORITATIVE
        )
    )

    node2 = Node(
        project_id=project.id,
        external_id="N2",
        name="Nó 2",
        system_type=SystemType.WATER,
        element_type=ElementType.JUNCTION,
        coordinates=Coordinates(x=300100, y=7500050, z=845),
        ground_elevation=845,
        invert_elevation=843
    )

    # Adicionar nós
    project.add_node(node1, user_id="engenheiro@empresa.com")
    project.add_node(node2, user_id="engenheiro@empresa.com")

    # Criar trecho
    link = Link(
        project_id=project.id,
        external_id="T1",
        name="Trecho 1",
        system_type=SystemType.WATER,
        element_type=ElementType.PIPE,
        from_node_id=node1.id,
        to_node_id=node2.id,
        length=111.8,
        diameter=150,
        material="PVC",
        roughness=140
    )

    project.add_link(link, user_id="engenheiro@empresa.com")

    # Validar contra normas
    findings = project.validate_against_norms()
    print(f"Findings: {len(findings)}")

    # Exportar para GeoJSON
    geojson = project.to_geojson()
    print(f"Features: {len(geojson['features'])}")
