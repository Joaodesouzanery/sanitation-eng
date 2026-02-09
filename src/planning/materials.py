"""
Materials Schedule - Cronograma de Compra de Materiais

Este modulo fornece:
- Calculo automatico de necessidade de materiais baseado no cronograma de obra
- Cronograma de compra considerando lead times
- Integracao com almoxarifado
- Controle de estoque minimo e ponto de pedido
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum


class MaterialCategory(Enum):
    """Categorias de materiais"""
    TUBULACAO = "tubulacao"
    CONEXOES = "conexoes"
    ESTRUTURAS = "estruturas"
    AGREGADOS = "agregados"
    CIMENTO = "cimento"
    ACO = "aco"
    VEDACAO = "vedacao"
    EQUIPAMENTOS = "equipamentos"
    OUTROS = "outros"


class PurchaseStatus(Enum):
    """Status de compra"""
    PLANEJADO = "planejado"
    SOLICITADO = "solicitado"
    COTACAO = "cotacao"
    APROVADO = "aprovado"
    PEDIDO = "pedido"
    EM_TRANSITO = "em_transito"
    RECEBIDO = "recebido"
    PARCIAL = "parcial"
    CANCELADO = "cancelado"


@dataclass
class Material:
    """Material para o projeto"""
    id: str
    code: str
    name: str
    unit: str  # m, un, kg, m3, etc.
    category: MaterialCategory

    # Especificacoes
    specifications: Dict[str, Any] = field(default_factory=dict)

    # Lead times em dias
    lead_time_min: int = 7  # Tempo minimo de entrega
    lead_time_normal: int = 14  # Tempo normal de entrega
    lead_time_max: int = 30  # Tempo maximo (urgente)

    # Estoque
    stock_current: float = 0
    stock_minimum: float = 0
    stock_maximum: float = 0
    reorder_point: float = 0

    # Custos
    unit_cost: float = 0
    last_purchase_cost: float = 0
    last_purchase_date: Optional[date] = None

    # Fornecedores
    suppliers: List[str] = field(default_factory=list)
    preferred_supplier: Optional[str] = None


@dataclass
class MaterialRequirement:
    """Necessidade de material para um trecho/atividade"""
    material_id: str
    material_code: str
    material_name: str
    unit: str
    quantity_required: float
    trecho_id: str
    activity_date: date
    delivery_date: date  # Data que precisa estar no almoxarifado
    order_date: date  # Data limite para fazer o pedido
    status: str = "pendente"
    purchase_order_id: Optional[str] = None


@dataclass
class PurchaseOrder:
    """Ordem de compra"""
    id: str
    number: str
    supplier_id: str
    supplier_name: str
    status: PurchaseStatus = PurchaseStatus.PLANEJADO

    # Datas
    order_date: Optional[date] = None
    expected_delivery: Optional[date] = None
    actual_delivery: Optional[date] = None

    # Itens
    items: List[Dict[str, Any]] = field(default_factory=list)

    # Valores
    total_value: float = 0
    discount: float = 0
    shipping_cost: float = 0

    # Tracking
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None


@dataclass
class WarehouseMovement:
    """Movimentacao de almoxarifado"""
    id: str
    material_id: str
    movement_type: str  # entrada, saida, ajuste, transferencia
    quantity: float
    unit_cost: float
    total_cost: float
    movement_date: date
    trecho_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    notes: Optional[str] = None


class MaterialsScheduler:
    """
    Gerador de cronograma de compra de materiais.

    Calcula:
    - Necessidade de materiais baseado no cronograma de obra
    - Datas de pedido considerando lead times
    - Agrupamento de pedidos por fornecedor
    - Controle de estoque
    """

    # Materiais padrao para saneamento por metro de rede
    DEFAULT_MATERIALS_PER_METER = {
        "tubulacao": {
            "code": "TUB-{dn}",
            "name": "Tubo PVC DN{dn}",
            "unit": "m",
            "quantity_factor": 1.05,  # 5% de perda
            "category": MaterialCategory.TUBULACAO
        },
        "anel_vedacao": {
            "code": "VED-{dn}",
            "name": "Anel de vedacao DN{dn}",
            "unit": "un",
            "quantity_factor": 1 / 6,  # 1 a cada 6 metros
            "category": MaterialCategory.VEDACAO
        },
        "areia": {
            "code": "AGR-AREIA",
            "name": "Areia para berco/reaterro",
            "unit": "m3",
            "quantity_factor": 0.15,  # m3 por metro
            "category": MaterialCategory.AGREGADOS
        },
        "brita": {
            "code": "AGR-BRITA",
            "name": "Brita para base",
            "unit": "m3",
            "quantity_factor": 0.1,
            "category": MaterialCategory.AGREGADOS
        }
    }

    # Materiais por poço de visita
    DEFAULT_MATERIALS_PER_PV = {
        "anel_concreto": {
            "code": "EST-ANEL",
            "name": "Anel de concreto PV",
            "unit": "un",
            "quantity": 3,  # 3 aneis por PV em media
            "category": MaterialCategory.ESTRUTURAS
        },
        "tampao": {
            "code": "EST-TAMPAO",
            "name": "Tampao ferro fundido",
            "unit": "un",
            "quantity": 1,
            "category": MaterialCategory.ESTRUTURAS
        },
        "degrau": {
            "code": "EST-DEGRAU",
            "name": "Degrau PV",
            "unit": "un",
            "quantity": 4,  # 4 degraus por PV
            "category": MaterialCategory.ESTRUTURAS
        },
        "cimento": {
            "code": "CIM-CPII",
            "name": "Cimento CP-II",
            "unit": "kg",
            "quantity": 50,  # 50kg por PV
            "category": MaterialCategory.CIMENTO
        }
    }

    def __init__(self, default_lead_time: int = 14):
        """
        Inicializa o scheduler de materiais.

        Args:
            default_lead_time: Lead time padrao em dias
        """
        self.default_lead_time = default_lead_time
        self.materials: Dict[str, Material] = {}
        self.requirements: List[MaterialRequirement] = []
        self.purchase_orders: Dict[str, PurchaseOrder] = {}
        self.warehouse_movements: List[WarehouseMovement] = []

    def calculate_material_needs(
        self,
        schedule: Dict[str, Any],
        include_pvs: bool = True
    ) -> List[MaterialRequirement]:
        """
        Calcula necessidade de materiais baseado no cronograma de obra.

        Args:
            schedule: Cronograma gerado pelo SameDayScheduler
            include_pvs: Se deve incluir materiais de PVs

        Returns:
            Lista de necessidades de materiais
        """
        requirements = []

        # Parse datas do cronograma
        start_date = date.fromisoformat(schedule.get("start_date", date.today().isoformat()))
        calendar = schedule.get("calendar", [])
        date_map = {i + 1: date.fromisoformat(d) for i, d in enumerate(calendar)}

        # Processa cada trecho
        for trecho in schedule.get("trechos", []):
            trecho_id = trecho.get("trecho_id")
            comprimento = trecho.get("comprimento_total", 0)
            diametro = trecho.get("diametro", 150)

            for segment in trecho.get("segments", []):
                day = segment.get("day", 1)
                meters = segment.get("meters", 0)
                activity_date = date_map.get(day, start_date + timedelta(days=day - 1))

                # Calcula data de entrega (precisa antes da atividade)
                delivery_date = activity_date - timedelta(days=2)

                # Calcula data do pedido
                order_date = delivery_date - timedelta(days=self.default_lead_time)

                # Gera requisitos de materiais por metro
                for mat_key, mat_spec in self.DEFAULT_MATERIALS_PER_METER.items():
                    code = mat_spec["code"].format(dn=diametro)
                    name = mat_spec["name"].format(dn=diametro)
                    quantity = meters * mat_spec["quantity_factor"]

                    if quantity > 0:
                        req = MaterialRequirement(
                            material_id=f"{code}_{trecho_id}_{day}",
                            material_code=code,
                            material_name=name,
                            unit=mat_spec["unit"],
                            quantity_required=round(quantity, 2),
                            trecho_id=trecho_id,
                            activity_date=activity_date,
                            delivery_date=delivery_date,
                            order_date=order_date
                        )
                        requirements.append(req)

            # Adiciona materiais de PV se necessario
            if include_pvs:
                # Estima numero de PVs (1 a cada 50m em media)
                num_pvs = max(1, int(comprimento / 50))

                # PVs sao necessarios no inicio do trecho
                first_day = trecho.get("start_day", 1)
                pv_date = date_map.get(first_day, start_date)
                pv_delivery = pv_date - timedelta(days=3)
                pv_order = pv_delivery - timedelta(days=self.default_lead_time)

                for mat_key, mat_spec in self.DEFAULT_MATERIALS_PER_PV.items():
                    quantity = mat_spec["quantity"] * num_pvs

                    req = MaterialRequirement(
                        material_id=f"{mat_spec['code']}_{trecho_id}_PV",
                        material_code=mat_spec["code"],
                        material_name=mat_spec["name"],
                        unit=mat_spec["unit"],
                        quantity_required=round(quantity, 2),
                        trecho_id=trecho_id,
                        activity_date=pv_date,
                        delivery_date=pv_delivery,
                        order_date=pv_order
                    )
                    requirements.append(req)

        self.requirements = requirements
        return requirements

    def generate_purchase_schedule(
        self,
        requirements: Optional[List[MaterialRequirement]] = None,
        group_by: str = "week"  # week, month, material
    ) -> Dict[str, Any]:
        """
        Gera cronograma de compras agrupado.

        Args:
            requirements: Lista de necessidades (usa self.requirements se None)
            group_by: Agrupamento (week, month, material)

        Returns:
            Cronograma de compras
        """
        reqs = requirements or self.requirements
        if not reqs:
            return {"error": "Nenhuma necessidade de material calculada"}

        # Agrupa por data de pedido
        orders_by_date: Dict[date, List[MaterialRequirement]] = {}
        for req in reqs:
            if req.order_date not in orders_by_date:
                orders_by_date[req.order_date] = []
            orders_by_date[req.order_date].append(req)

        # Agrupa por semana/mes
        if group_by == "week":
            grouped = self._group_by_week(orders_by_date)
        elif group_by == "month":
            grouped = self._group_by_month(orders_by_date)
        else:
            grouped = self._group_by_material(reqs)

        # Gera Gantt de materiais
        gantt_items = []
        for period, items in grouped.items():
            # Consolida por material
            materials_in_period: Dict[str, Dict] = {}
            for req in items:
                code = req.material_code
                if code not in materials_in_period:
                    materials_in_period[code] = {
                        "material_code": code,
                        "material_name": req.material_name,
                        "unit": req.unit,
                        "total_quantity": 0,
                        "trechos": set(),
                        "order_dates": set(),
                        "delivery_dates": set()
                    }
                materials_in_period[code]["total_quantity"] += req.quantity_required
                materials_in_period[code]["trechos"].add(req.trecho_id)
                materials_in_period[code]["order_dates"].add(req.order_date.isoformat())
                materials_in_period[code]["delivery_dates"].add(req.delivery_date.isoformat())

            for code, mat_data in materials_in_period.items():
                order_dates = sorted(mat_data["order_dates"])
                delivery_dates = sorted(mat_data["delivery_dates"])

                gantt_items.append({
                    "id": f"{period}_{code}",
                    "period": period,
                    "material_code": code,
                    "material_name": mat_data["material_name"],
                    "unit": mat_data["unit"],
                    "total_quantity": round(mat_data["total_quantity"], 2),
                    "trechos_count": len(mat_data["trechos"]),
                    "order_start": order_dates[0],
                    "order_end": order_dates[-1],
                    "delivery_start": delivery_dates[0],
                    "delivery_end": delivery_dates[-1],
                    "status": "planejado"
                })

        # Resumo geral
        summary = self._calculate_summary(reqs)

        return {
            "schedule_type": "materials",
            "group_by": group_by,
            "generated_at": datetime.now().isoformat(),
            "gantt_items": gantt_items,
            "summary": summary,
            "details_by_period": {
                period: [
                    {
                        "material_code": r.material_code,
                        "material_name": r.material_name,
                        "unit": r.unit,
                        "quantity": r.quantity_required,
                        "trecho": r.trecho_id,
                        "order_date": r.order_date.isoformat(),
                        "delivery_date": r.delivery_date.isoformat(),
                        "activity_date": r.activity_date.isoformat()
                    }
                    for r in items
                ]
                for period, items in grouped.items()
            }
        }

    def _group_by_week(self, orders_by_date: Dict) -> Dict[str, List]:
        """Agrupa por semana"""
        grouped = {}
        for order_date, items in orders_by_date.items():
            # Calcula inicio da semana
            week_start = order_date - timedelta(days=order_date.weekday())
            week_key = f"Semana {week_start.isocalendar()[1]} ({week_start.isoformat()})"

            if week_key not in grouped:
                grouped[week_key] = []
            grouped[week_key].extend(items)

        return dict(sorted(grouped.items()))

    def _group_by_month(self, orders_by_date: Dict) -> Dict[str, List]:
        """Agrupa por mes"""
        grouped = {}
        for order_date, items in orders_by_date.items():
            month_key = order_date.strftime("%Y-%m")

            if month_key not in grouped:
                grouped[month_key] = []
            grouped[month_key].extend(items)

        return dict(sorted(grouped.items()))

    def _group_by_material(self, requirements: List) -> Dict[str, List]:
        """Agrupa por material"""
        grouped = {}
        for req in requirements:
            code = req.material_code

            if code not in grouped:
                grouped[code] = []
            grouped[code].append(req)

        return grouped

    def _calculate_summary(self, requirements: List[MaterialRequirement]) -> Dict:
        """Calcula resumo de materiais"""
        by_category: Dict[str, Dict] = {}

        for req in requirements:
            code = req.material_code
            if code not in by_category:
                by_category[code] = {
                    "code": code,
                    "name": req.material_name,
                    "unit": req.unit,
                    "total_quantity": 0,
                    "first_order_date": req.order_date,
                    "last_order_date": req.order_date
                }

            by_category[code]["total_quantity"] += req.quantity_required
            if req.order_date < by_category[code]["first_order_date"]:
                by_category[code]["first_order_date"] = req.order_date
            if req.order_date > by_category[code]["last_order_date"]:
                by_category[code]["last_order_date"] = req.order_date

        return {
            "total_items": len(requirements),
            "unique_materials": len(by_category),
            "materials": [
                {
                    **mat,
                    "first_order_date": mat["first_order_date"].isoformat(),
                    "last_order_date": mat["last_order_date"].isoformat(),
                    "total_quantity": round(mat["total_quantity"], 2)
                }
                for mat in by_category.values()
            ]
        }

    def add_to_warehouse(
        self,
        material_code: str,
        quantity: float,
        unit_cost: float,
        purchase_order_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> WarehouseMovement:
        """
        Registra entrada no almoxarifado.

        Args:
            material_code: Codigo do material
            quantity: Quantidade
            unit_cost: Custo unitario
            purchase_order_id: ID da ordem de compra
            notes: Observacoes

        Returns:
            Movimentacao registrada
        """
        movement = WarehouseMovement(
            id=f"MOV-{len(self.warehouse_movements) + 1:06d}",
            material_id=material_code,
            movement_type="entrada",
            quantity=quantity,
            unit_cost=unit_cost,
            total_cost=quantity * unit_cost,
            movement_date=date.today(),
            purchase_order_id=purchase_order_id,
            notes=notes
        )

        self.warehouse_movements.append(movement)

        # Atualiza estoque se material cadastrado
        if material_code in self.materials:
            self.materials[material_code].stock_current += quantity

        return movement

    def withdraw_from_warehouse(
        self,
        material_code: str,
        quantity: float,
        trecho_id: str,
        notes: Optional[str] = None
    ) -> WarehouseMovement:
        """
        Registra saida do almoxarifado para trecho.

        Args:
            material_code: Codigo do material
            quantity: Quantidade
            trecho_id: ID do trecho que recebe
            notes: Observacoes

        Returns:
            Movimentacao registrada
        """
        # Busca custo medio
        unit_cost = 0
        if material_code in self.materials:
            unit_cost = self.materials[material_code].last_purchase_cost

        movement = WarehouseMovement(
            id=f"MOV-{len(self.warehouse_movements) + 1:06d}",
            material_id=material_code,
            movement_type="saida",
            quantity=-quantity,  # Negativo para saida
            unit_cost=unit_cost,
            total_cost=quantity * unit_cost,
            movement_date=date.today(),
            trecho_id=trecho_id,
            notes=notes
        )

        self.warehouse_movements.append(movement)

        # Atualiza estoque
        if material_code in self.materials:
            self.materials[material_code].stock_current -= quantity

        return movement

    def get_stock_status(self) -> Dict[str, Any]:
        """Retorna status atual do estoque"""
        alerts = []
        stocks = []

        for code, material in self.materials.items():
            stock_info = {
                "code": code,
                "name": material.name,
                "unit": material.unit,
                "current": material.stock_current,
                "minimum": material.stock_minimum,
                "reorder_point": material.reorder_point,
                "status": "ok"
            }

            if material.stock_current <= 0:
                stock_info["status"] = "zerado"
                alerts.append(f"{code}: Estoque zerado!")
            elif material.stock_current <= material.stock_minimum:
                stock_info["status"] = "critico"
                alerts.append(f"{code}: Abaixo do minimo ({material.stock_current} de {material.stock_minimum})")
            elif material.stock_current <= material.reorder_point:
                stock_info["status"] = "alerta"
                alerts.append(f"{code}: Ponto de pedido atingido")

            stocks.append(stock_info)

        return {
            "timestamp": datetime.now().isoformat(),
            "alerts_count": len(alerts),
            "alerts": alerts,
            "stocks": stocks
        }


# =====================================================
# Funcoes de conveniencia
# =====================================================

def generate_materials_schedule(
    construction_schedule: Dict[str, Any],
    lead_time_days: int = 14
) -> Dict[str, Any]:
    """
    Funcao de conveniencia para gerar cronograma de materiais.

    Args:
        construction_schedule: Cronograma de obra do SameDayScheduler
        lead_time_days: Lead time padrao

    Returns:
        Cronograma de compra de materiais
    """
    scheduler = MaterialsScheduler(default_lead_time=lead_time_days)
    scheduler.calculate_material_needs(construction_schedule)
    return scheduler.generate_purchase_schedule()


def get_material_categories() -> List[Dict[str, str]]:
    """Retorna lista de categorias de materiais"""
    return [
        {"value": cat.value, "label": cat.name.replace("_", " ").title()}
        for cat in MaterialCategory
    ]


def get_purchase_statuses() -> List[Dict[str, str]]:
    """Retorna lista de status de compra"""
    return [
        {"value": status.value, "label": status.name.replace("_", " ").title()}
        for status in PurchaseStatus
    ]
