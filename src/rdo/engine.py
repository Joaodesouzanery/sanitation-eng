"""
Engine do módulo RDO (Relatório Diário de Obra).

Este módulo contém a lógica de negócio para:
- Gerenciamento de RDOs
- Integração com planejamento
- Cálculo de avanço por trecho
- Validação de dados
"""

from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict

from .models import (
    RDO,
    RDOSummary,
    RDOStatus,
    ExecutedService,
    SegmentProgress,
    WorkFront,
    WorkLocation,
    Project,
    ServiceCatalogItem,
    Worker,
    Visit,
    Occurrence,
    SystemType,
    DashboardMetrics,
    SegmentGeoJSON,
    Location,
    FinancialEntry,
    PlannedFinancial,
    ExecutedFinancial,
    PhysicalFinancialProgress,
)


class RDOEngine:
    """
    Engine principal para gerenciamento de RDOs.

    Responsável por:
    - CRUD de RDOs
    - Integração com planejamento
    - Cálculo de métricas e avanço
    - Validação de dados
    """

    def __init__(self):
        """Inicializa o engine com armazenamento em memória."""
        self._rdos: Dict[str, RDO] = {}
        self._projects: Dict[str, Project] = {}
        self._work_fronts: Dict[str, WorkFront] = {}
        self._work_locations: Dict[str, WorkLocation] = {}
        self._service_catalog: Dict[str, ServiceCatalogItem] = {}
        self._workers: Dict[str, Worker] = {}

        # Dados de planejamento importados
        self._planned_segments: Dict[str, Dict[str, Any]] = {}

        # Dados financeiros
        self._planned_financials: Dict[str, PlannedFinancial] = {}
        self._executed_financials: Dict[str, ExecutedFinancial] = {}

        # Inicializa catálogo padrão
        self._initialize_default_catalog()

    def _initialize_default_catalog(self) -> None:
        """Inicializa o catálogo de serviços padrão."""
        default_services = [
            ("ESC001", "Escavação de vala", "m³", "Escavação"),
            ("ESC002", "Escavação em rocha", "m³", "Escavação"),
            ("REA001", "Reaterro compactado", "m³", "Reaterro"),
            ("REA002", "Reaterro simples", "m³", "Reaterro"),
            ("TUB001", "Assentamento de tubulação PVC", "m", "Tubulação"),
            ("TUB002", "Assentamento de tubulação PEAD", "m", "Tubulação"),
            ("TUB003", "Assentamento de tubulação ferro fundido", "m", "Tubulação"),
            ("PV001", "Execução de poço de visita", "un", "Poços"),
            ("PV002", "Execução de caixa de passagem", "un", "Poços"),
            ("LIG001", "Ligação domiciliar de água", "un", "Ligações"),
            ("LIG002", "Ligação domiciliar de esgoto", "un", "Ligações"),
            ("PAV001", "Recomposição de pavimento", "m²", "Pavimentação"),
            ("PAV002", "Recomposição de calçada", "m²", "Pavimentação"),
            ("TEST001", "Teste de estanqueidade", "m", "Testes"),
            ("TEST002", "Teste hidrostático", "m", "Testes"),
            ("LIMP001", "Limpeza e desinfecção", "m", "Limpeza"),
        ]

        for code, name, unit, category in default_services:
            from .models import ServiceUnit
            unit_map = {"m": ServiceUnit.METRO_LINEAR, "m²": ServiceUnit.METRO_QUADRADO,
                       "m³": ServiceUnit.METRO_CUBICO, "un": ServiceUnit.UNIDADE}
            item = ServiceCatalogItem(
                code=code,
                name=name,
                default_unit=unit_map.get(unit, ServiceUnit.METRO_LINEAR),
                category=category
            )
            self._service_catalog[item.id] = item

    # ==================== CRUD de RDOs ====================

    def create_rdo(
        self,
        project_id: str,
        rdo_date: date,
        obra_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> RDO:
        """Cria um novo RDO."""
        project = self._projects.get(project_id)

        rdo = RDO(
            project_id=project_id,
            project_name=project.name if project else None,
            obra_id=obra_id,
            date=rdo_date,
            created_by=created_by
        )

        self._rdos[rdo.id] = rdo
        return rdo

    def get_rdo(self, rdo_id: str) -> Optional[RDO]:
        """Obtém um RDO pelo ID."""
        return self._rdos.get(rdo_id)

    def update_rdo(self, rdo: RDO) -> RDO:
        """Atualiza um RDO existente."""
        rdo.updated_at = datetime.now()
        self._rdos[rdo.id] = rdo
        return rdo

    def delete_rdo(self, rdo_id: str) -> bool:
        """Remove um RDO."""
        if rdo_id in self._rdos:
            del self._rdos[rdo_id]
            return True
        return False

    def list_rdos(
        self,
        project_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[RDOStatus] = None
    ) -> List[RDOSummary]:
        """Lista RDOs com filtros opcionais."""
        rdos = list(self._rdos.values())

        if project_id:
            rdos = [r for r in rdos if r.project_id == project_id]
        if start_date:
            rdos = [r for r in rdos if r.date >= start_date]
        if end_date:
            rdos = [r for r in rdos if r.date <= end_date]
        if status:
            rdos = [r for r in rdos if r.status == status]

        # Ordena por data decrescente
        rdos.sort(key=lambda x: x.date, reverse=True)

        return [RDOSummary.from_rdo(rdo) for rdo in rdos]

    # ==================== Gerenciamento de Serviços ====================

    def add_service_to_rdo(
        self,
        rdo_id: str,
        service_name: str,
        quantity: float,
        unit: str,
        service_id: Optional[str] = None,
        equipment_used: Optional[List[str]] = None,
        responsible_worker_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> ExecutedService:
        """Adiciona um serviço executado a um RDO."""
        rdo = self.get_rdo(rdo_id)
        if not rdo:
            raise ValueError(f"RDO não encontrado: {rdo_id}")

        from .models import ServiceUnit
        unit_map = {
            "m": ServiceUnit.METRO_LINEAR,
            "m²": ServiceUnit.METRO_QUADRADO,
            "m³": ServiceUnit.METRO_CUBICO,
            "un": ServiceUnit.UNIDADE,
            "h": ServiceUnit.HORA,
            "dia": ServiceUnit.DIA,
            "kg": ServiceUnit.QUILOGRAMA,
            "t": ServiceUnit.TONELADA,
            "L": ServiceUnit.LITRO,
        }

        worker = self._workers.get(responsible_worker_id) if responsible_worker_id else None

        service = ExecutedService(
            service_id=service_id,
            service_name=service_name,
            quantity=quantity,
            unit=unit_map.get(unit, ServiceUnit.METRO_LINEAR),
            equipment_used=equipment_used,
            responsible_worker_id=responsible_worker_id,
            responsible_worker_name=worker.name if worker else None,
            notes=notes
        )

        rdo.add_service(service)
        self.update_rdo(rdo)

        return service

    # ==================== Integração com Planejamento e Trechos ====================

    def import_planned_segments(
        self,
        project_id: str,
        segments: List[Dict[str, Any]]
    ) -> int:
        """
        Importa trechos planejados de um projeto.

        Args:
            project_id: ID do projeto
            segments: Lista de trechos com dados de planejamento

        Returns:
            Número de trechos importados
        """
        count = 0
        for segment in segments:
            segment_id = segment.get("id") or segment.get("segment_id")
            if not segment_id:
                continue

            self._planned_segments[segment_id] = {
                "project_id": project_id,
                "segment_id": segment_id,
                "name": segment.get("name"),
                "system_type": segment.get("system_type", "esgoto"),
                "planned_length": segment.get("length") or segment.get("planned_length"),
                "planned_start_date": segment.get("start_date") or segment.get("planned_start_date"),
                "planned_end_date": segment.get("end_date") or segment.get("planned_end_date"),
                "geometry": segment.get("geometry"),
                "start_coords": segment.get("start_coords"),
                "end_coords": segment.get("end_coords"),
                "diameter": segment.get("diameter"),
                "material": segment.get("material"),
                "depth": segment.get("depth"),
            }
            count += 1

        return count

    def add_segment_progress_to_rdo(
        self,
        rdo_id: str,
        segment_id: str,
        executed_length: float,
        system_type: str = "esgoto",
        execution_date: Optional[date] = None,
        start_coords: Optional[Tuple[float, float]] = None,
        end_coords: Optional[Tuple[float, float]] = None
    ) -> SegmentProgress:
        """
        Adiciona progresso de um trecho a um RDO.

        Integra com os dados planejados para calcular o avanço.
        """
        rdo = self.get_rdo(rdo_id)
        if not rdo:
            raise ValueError(f"RDO não encontrado: {rdo_id}")

        # Busca dados planejados do trecho
        planned_data = self._planned_segments.get(segment_id, {})

        # Determina comprimento planejado
        planned_length = planned_data.get("planned_length")

        # Calcula percentual de progresso
        progress_pct = 0.0
        if planned_length and planned_length > 0:
            progress_pct = min(100.0, (executed_length / planned_length) * 100)

        # Cria localização se coordenadas fornecidas
        start_location = None
        end_location = None
        if start_coords:
            start_location = Location(latitude=start_coords[0], longitude=start_coords[1])
        if end_coords:
            end_location = Location(latitude=end_coords[0], longitude=end_coords[1])

        progress = SegmentProgress(
            segment_id=segment_id,
            segment_name=planned_data.get("name"),
            project_id=rdo.project_id,
            system_type=SystemType(system_type),
            execution_date=execution_date or rdo.date,
            planned_length=planned_length,
            executed_length=executed_length,
            progress_percentage=progress_pct,
            start_coordinates=start_location,
            end_coordinates=end_location,
            geometry_wkt=planned_data.get("geometry")
        )

        rdo.add_segment_progress(progress)
        self.update_rdo(rdo)

        return progress

    def get_planned_vs_executed(
        self,
        project_id: Optional[str] = None,
        system_type: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Obtém comparativo entre planejado e executado.

        Returns:
            Dicionário com métricas de planejado vs executado
        """
        # Filtra RDOs
        rdos = list(self._rdos.values())
        if project_id:
            rdos = [r for r in rdos if r.project_id == project_id]
        if start_date:
            rdos = [r for r in rdos if r.date >= start_date]
        if end_date:
            rdos = [r for r in rdos if r.date <= end_date]

        # Agrupa progresso por trecho
        segment_totals: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"executed": 0.0, "planned": 0.0}
        )

        for rdo in rdos:
            for progress in rdo.segment_progress:
                if system_type and progress.system_type.value != system_type:
                    continue

                seg_id = progress.segment_id
                segment_totals[seg_id]["executed"] += progress.executed_length
                if progress.planned_length:
                    segment_totals[seg_id]["planned"] = max(
                        segment_totals[seg_id]["planned"],
                        progress.planned_length
                    )

        # Adiciona trechos planejados que ainda não têm execução
        for seg_id, planned_data in self._planned_segments.items():
            if project_id and planned_data.get("project_id") != project_id:
                continue
            if system_type and planned_data.get("system_type") != system_type:
                continue
            if seg_id not in segment_totals:
                segment_totals[seg_id]["planned"] = planned_data.get("planned_length", 0)

        # Calcula totais
        total_planned = sum(s["planned"] for s in segment_totals.values())
        total_executed = sum(s["executed"] for s in segment_totals.values())

        overall_progress = 0.0
        if total_planned > 0:
            overall_progress = (total_executed / total_planned) * 100

        # Detalhes por trecho
        segments_detail = []
        for seg_id, totals in segment_totals.items():
            planned = totals["planned"]
            executed = totals["executed"]
            pct = (executed / planned * 100) if planned > 0 else 0

            planned_data = self._planned_segments.get(seg_id, {})

            segments_detail.append({
                "segment_id": seg_id,
                "segment_name": planned_data.get("name", seg_id),
                "system_type": planned_data.get("system_type", "unknown"),
                "planned_length": round(planned, 2),
                "executed_length": round(executed, 2),
                "progress_percentage": round(pct, 2),
                "remaining": round(max(0, planned - executed), 2),
                "status": self._get_segment_status(pct)
            })

        # Ordena por progresso
        segments_detail.sort(key=lambda x: x["progress_percentage"], reverse=True)

        return {
            "total_planned": round(total_planned, 2),
            "total_executed": round(total_executed, 2),
            "total_remaining": round(max(0, total_planned - total_executed), 2),
            "overall_progress_percentage": round(overall_progress, 2),
            "segments_count": len(segments_detail),
            "completed_segments": len([s for s in segments_detail if s["progress_percentage"] >= 100]),
            "in_progress_segments": len([s for s in segments_detail if 0 < s["progress_percentage"] < 100]),
            "not_started_segments": len([s for s in segments_detail if s["progress_percentage"] == 0]),
            "segments": segments_detail
        }

    def _get_segment_status(self, progress_pct: float) -> str:
        """Determina o status de um trecho baseado no progresso."""
        if progress_pct >= 100:
            return "concluido"
        elif progress_pct > 0:
            return "em_execucao"
        else:
            return "nao_iniciado"

    # ==================== Geração de GeoJSON para Mapa ====================

    def get_segments_geojson(
        self,
        project_id: Optional[str] = None,
        system_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera GeoJSON com todos os trechos para visualização no mapa.

        Returns:
            FeatureCollection GeoJSON com trechos e seu progresso
        """
        features = []

        # Obtém dados de planejado vs executado
        comparison = self.get_planned_vs_executed(project_id, system_type)

        for segment in comparison["segments"]:
            seg_id = segment["segment_id"]
            planned_data = self._planned_segments.get(seg_id, {})

            # Determina geometria
            geometry = None
            if planned_data.get("geometry"):
                # Se tiver WKT, converte para GeoJSON (simplificado)
                geometry = {"type": "LineString", "coordinates": []}
            elif planned_data.get("start_coords") and planned_data.get("end_coords"):
                start = planned_data["start_coords"]
                end = planned_data["end_coords"]
                geometry = {
                    "type": "LineString",
                    "coordinates": [
                        [start[1], start[0]],  # [lng, lat]
                        [end[1], end[0]]
                    ]
                }
            else:
                # Geometria placeholder
                continue

            # Cor baseada no progresso
            progress = segment["progress_percentage"]
            if progress >= 100:
                color = "#28a745"  # Verde - concluído
            elif progress >= 50:
                color = "#ffc107"  # Amarelo - em andamento
            elif progress > 0:
                color = "#fd7e14"  # Laranja - iniciado
            else:
                color = "#dc3545"  # Vermelho - não iniciado

            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    **segment,
                    "color": color,
                    "diameter": planned_data.get("diameter"),
                    "material": planned_data.get("material"),
                    "depth": planned_data.get("depth"),
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "total_planned": comparison["total_planned"],
                "total_executed": comparison["total_executed"],
                "overall_progress": comparison["overall_progress_percentage"],
                "generated_at": datetime.now().isoformat()
            }
        }

    # ==================== Gerenciamento de Projetos ====================

    def create_project(
        self,
        name: str,
        system_type: str = "esgoto",
        code: Optional[str] = None,
        description: Optional[str] = None,
        client: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        total_planned_length: Optional[float] = None
    ) -> Project:
        """Cria um novo projeto."""
        project = Project(
            name=name,
            code=code,
            description=description,
            system_type=SystemType(system_type),
            client=client,
            start_date=start_date,
            end_date=end_date,
            total_planned_length=total_planned_length
        )
        self._projects[project.id] = project
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        """Obtém um projeto pelo ID."""
        return self._projects.get(project_id)

    def list_projects(self, active_only: bool = True) -> List[Project]:
        """Lista todos os projetos."""
        projects = list(self._projects.values())
        if active_only:
            projects = [p for p in projects if p.active]
        return projects

    # ==================== Gerenciamento de Frentes e Locais ====================

    def create_work_front(
        self,
        name: str,
        project_id: str,
        description: Optional[str] = None,
        responsible: Optional[str] = None
    ) -> WorkFront:
        """Cria uma nova frente de serviço."""
        front = WorkFront(
            name=name,
            project_id=project_id,
            description=description,
            responsible=responsible
        )
        self._work_fronts[front.id] = front
        return front

    def list_work_fronts(self, project_id: Optional[str] = None) -> List[WorkFront]:
        """Lista frentes de serviço."""
        fronts = list(self._work_fronts.values())
        if project_id:
            fronts = [f for f in fronts if f.project_id == project_id]
        return [f for f in fronts if f.active]

    def create_work_location(
        self,
        name: str,
        project_id: str,
        address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> WorkLocation:
        """Cria um novo local de obra."""
        coords = None
        if latitude is not None and longitude is not None:
            coords = Location(latitude=latitude, longitude=longitude)

        location = WorkLocation(
            name=name,
            project_id=project_id,
            address=address,
            coordinates=coords
        )
        self._work_locations[location.id] = location
        return location

    def list_work_locations(self, project_id: Optional[str] = None) -> List[WorkLocation]:
        """Lista locais de obra."""
        locations = list(self._work_locations.values())
        if project_id:
            locations = [l for l in locations if l.project_id == project_id]
        return [l for l in locations if l.active]

    # ==================== Catálogo de Serviços ====================

    def add_service_to_catalog(
        self,
        name: str,
        default_unit: str = "m",
        code: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None
    ) -> ServiceCatalogItem:
        """Adiciona um serviço ao catálogo."""
        from .models import ServiceUnit
        unit_map = {
            "m": ServiceUnit.METRO_LINEAR,
            "m²": ServiceUnit.METRO_QUADRADO,
            "m³": ServiceUnit.METRO_CUBICO,
            "un": ServiceUnit.UNIDADE,
        }

        item = ServiceCatalogItem(
            code=code,
            name=name,
            default_unit=unit_map.get(default_unit, ServiceUnit.METRO_LINEAR),
            description=description,
            category=category
        )
        self._service_catalog[item.id] = item
        return item

    def list_service_catalog(self, category: Optional[str] = None) -> List[ServiceCatalogItem]:
        """Lista serviços do catálogo."""
        items = [i for i in self._service_catalog.values() if i.active]
        if category:
            items = [i for i in items if i.category == category]
        return items

    # ==================== Gerenciamento de Funcionários ====================

    def create_worker(
        self,
        name: str,
        role: Optional[str] = None,
        registration: Optional[str] = None
    ) -> Worker:
        """Cria um novo funcionário."""
        worker = Worker(
            name=name,
            role=role,
            registration=registration
        )
        self._workers[worker.id] = worker
        return worker

    def list_workers(self) -> List[Worker]:
        """Lista funcionários ativos."""
        return [w for w in self._workers.values() if w.active]

    # ==================== Controle Financeiro ====================

    def set_planned_financial(
        self,
        project_id: str,
        budget_labor: float = 0,
        budget_materials: float = 0,
        budget_equipment: float = 0,
        budget_indirect: float = 0,
        budget_contingency: float = 0,
        planned_curve: Optional[List[Dict]] = None,
        created_by: Optional[str] = None
    ) -> PlannedFinancial:
        """
        Define o planejado financeiro de um projeto.

        Args:
            project_id: ID do projeto
            budget_labor: Orcamento de mao de obra
            budget_materials: Orcamento de materiais
            budget_equipment: Orcamento de equipamentos
            budget_indirect: Orcamento de custos indiretos
            budget_contingency: Orcamento de contingencia
            planned_curve: Curva S planejada
            created_by: Usuario que criou

        Returns:
            PlannedFinancial criado
        """
        planned = PlannedFinancial(
            project_id=project_id,
            reference_date=date.today(),
            budget_labor=budget_labor,
            budget_materials=budget_materials,
            budget_equipment=budget_equipment,
            budget_indirect=budget_indirect,
            budget_contingency=budget_contingency,
            budget_total=budget_labor + budget_materials + budget_equipment + budget_indirect + budget_contingency,
            planned_curve=planned_curve or [],
            created_by=created_by
        )

        self._planned_financials[project_id] = planned
        return planned

    def add_financial_entry_to_rdo(
        self,
        rdo_id: str,
        description: str,
        category: str,
        value: float,
        quantity: Optional[float] = None,
        unit: Optional[str] = None,
        unit_value: Optional[float] = None,
        trecho_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> FinancialEntry:
        """
        Adiciona uma entrada financeira a um RDO.

        Args:
            rdo_id: ID do RDO
            description: Descricao do item
            category: Categoria (mao_obra, material, equipamento, outros)
            value: Valor total
            quantity: Quantidade (opcional)
            unit: Unidade (opcional)
            unit_value: Valor unitario (opcional)
            trecho_id: ID do trecho (opcional)
            notes: Observacoes (opcional)

        Returns:
            FinancialEntry criada
        """
        rdo = self.get_rdo(rdo_id)
        if not rdo:
            raise ValueError(f"RDO nao encontrado: {rdo_id}")

        entry = FinancialEntry(
            description=description,
            category=category,
            value=value,
            quantity=quantity,
            unit=unit,
            unit_value=unit_value,
            trecho_id=trecho_id,
            notes=notes
        )

        rdo.add_financial_entry(entry)
        self.update_rdo(rdo)

        return entry

    def get_physical_financial_progress(
        self,
        project_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> PhysicalFinancialProgress:
        """
        Calcula o progresso fisico-financeiro de um projeto.

        Args:
            project_id: ID do projeto
            start_date: Data inicial (opcional)
            end_date: Data final (opcional)

        Returns:
            PhysicalFinancialProgress com indicadores
        """
        # Obtem planejado financeiro
        planned = self._planned_financials.get(project_id)
        planned_budget = planned.budget_total if planned else 0

        # Obtem planejado vs executado fisico
        physical_data = self.get_planned_vs_executed(project_id, start_date=start_date, end_date=end_date)

        # Calcula executado financeiro acumulado
        rdos = [r for r in self._rdos.values() if r.project_id == project_id]
        if start_date:
            rdos = [r for r in rdos if r.date >= start_date]
        if end_date:
            rdos = [r for r in rdos if r.date <= end_date]

        executed_financial = sum(r.daily_total_cost for r in rdos)
        executed_labor = sum(r.daily_labor_cost for r in rdos)
        executed_materials = sum(r.daily_material_cost for r in rdos)
        executed_equipment = sum(r.daily_equipment_cost for r in rdos)

        # Calcula percentuais
        physical_pct = physical_data.get("overall_progress_percentage", 0)
        financial_pct = (executed_financial / planned_budget * 100) if planned_budget > 0 else 0

        # Calcula indicadores de valor agregado (EVM)
        # PV = Planned Value (valor planejado para o progresso fisico atual)
        # EV = Earned Value (valor do trabalho realizado)
        # AC = Actual Cost (custo real)

        pv = planned_budget * (physical_pct / 100) if planned_budget > 0 else 0
        ev = planned_budget * (physical_pct / 100) if planned_budget > 0 else 0
        ac = executed_financial

        cpi = ev / ac if ac > 0 else 0  # Cost Performance Index
        spi = ev / pv if pv > 0 else 0  # Schedule Performance Index

        variance_cost = ev - ac
        variance_schedule = ev - pv

        # Projecoes
        eac = planned_budget / cpi if cpi > 0 else planned_budget  # Estimate at Completion
        vac = planned_budget - eac  # Variance at Completion

        # Detalhamento por categoria
        by_category = {
            "mao_obra": {
                "planejado": planned.budget_labor if planned else 0,
                "executado": executed_labor,
                "variacao": (planned.budget_labor if planned else 0) - executed_labor
            },
            "material": {
                "planejado": planned.budget_materials if planned else 0,
                "executado": executed_materials,
                "variacao": (planned.budget_materials if planned else 0) - executed_materials
            },
            "equipamento": {
                "planejado": planned.budget_equipment if planned else 0,
                "executado": executed_equipment,
                "variacao": (planned.budget_equipment if planned else 0) - executed_equipment
            }
        }

        # Monta curvas
        planned_curve = planned.planned_curve if planned else []
        executed_curve = self._build_executed_curve(rdos)

        return PhysicalFinancialProgress(
            project_id=project_id,
            report_date=date.today(),
            planned_physical=physical_data.get("total_planned", 0),
            executed_physical=physical_data.get("total_executed", 0),
            physical_percentage=physical_pct,
            planned_financial=planned_budget,
            executed_financial=executed_financial,
            financial_percentage=round(financial_pct, 2),
            cpi=round(cpi, 3),
            spi=round(spi, 3),
            variance_cost=round(variance_cost, 2),
            variance_schedule=round(variance_schedule, 2),
            by_category=by_category,
            planned_curve=planned_curve,
            executed_curve=executed_curve,
            estimated_at_completion=round(eac, 2),
            variance_at_completion=round(vac, 2)
        )

    def _build_executed_curve(self, rdos: List[RDO]) -> List[Dict]:
        """Constroi curva S executada a partir dos RDOs."""
        if not rdos:
            return []

        # Ordena por data
        rdos_sorted = sorted(rdos, key=lambda r: r.date)

        curve = []
        cumulative = 0

        for rdo in rdos_sorted:
            cumulative += rdo.daily_total_cost
            curve.append({
                "date": rdo.date.isoformat(),
                "daily_value": rdo.daily_total_cost,
                "cumulative_value": round(cumulative, 2)
            })

        return curve

    def get_financial_report(
        self,
        project_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Gera relatorio financeiro detalhado.

        Args:
            project_id: ID do projeto
            start_date: Data inicial
            end_date: Data final

        Returns:
            Relatorio financeiro completo
        """
        progress = self.get_physical_financial_progress(project_id, start_date, end_date)

        # Obtem todos os RDOs do periodo
        rdos = [r for r in self._rdos.values() if r.project_id == project_id]
        if start_date:
            rdos = [r for r in rdos if r.date >= start_date]
        if end_date:
            rdos = [r for r in rdos if r.date <= end_date]

        # Detalhamento diario
        daily_detail = []
        for rdo in sorted(rdos, key=lambda r: r.date):
            daily_detail.append({
                "date": rdo.date.isoformat(),
                "rdo_id": rdo.id,
                "labor": rdo.daily_labor_cost,
                "material": rdo.daily_material_cost,
                "equipment": rdo.daily_equipment_cost,
                "total": rdo.daily_total_cost,
                "entries_count": len(rdo.financial_entries)
            })

        return {
            "project_id": project_id,
            "report_date": date.today().isoformat(),
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            },
            "summary": {
                "planned_financial": progress.planned_financial,
                "executed_financial": progress.executed_financial,
                "variance": progress.planned_financial - progress.executed_financial,
                "financial_percentage": progress.financial_percentage,
                "physical_percentage": progress.physical_percentage
            },
            "indicators": {
                "cpi": progress.cpi,
                "spi": progress.spi,
                "variance_cost": progress.variance_cost,
                "variance_schedule": progress.variance_schedule,
                "eac": progress.estimated_at_completion,
                "vac": progress.variance_at_completion
            },
            "by_category": progress.by_category,
            "curves": {
                "planned": progress.planned_curve,
                "executed": progress.executed_curve
            },
            "daily_detail": daily_detail,
            "total_rdos": len(rdos)
        }

    # ==================== Métodos auxiliares ====================

    def get_rdo_count(self) -> int:
        """Retorna o número total de RDOs."""
        return len(self._rdos)

    def get_all_rdos(self) -> List[RDO]:
        """Retorna todos os RDOs."""
        return list(self._rdos.values())


# Instância global do engine (singleton pattern)
_engine_instance: Optional[RDOEngine] = None


def get_rdo_engine() -> RDOEngine:
    """Obtém a instância singleton do RDOEngine."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RDOEngine()
    return _engine_instance
