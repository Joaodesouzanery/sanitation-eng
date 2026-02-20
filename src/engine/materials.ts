/**
 * Materials Schedule - Cronograma de Compra de Materiais
 *
 * Este modulo fornece:
 * - Calculo automatico de necessidade de materiais baseado no cronograma de obra
 * - Cronograma de compra considerando lead times
 * - Integracao com almoxarifado
 * - Controle de estoque minimo e ponto de pedido
 */

import { FullSchedule } from './planning';

export enum MaterialCategory {
  TUBULACAO = 'tubulacao',
  CONEXOES = 'conexoes',
  ESTRUTURAS = 'estruturas',
  AGREGADOS = 'agregados',
  CIMENTO = 'cimento',
  ACO = 'aco',
  VEDACAO = 'vedacao',
  EQUIPAMENTOS = 'equipamentos',
  OUTROS = 'outros'
}

export enum PurchaseStatus {
  PLANEJADO = 'planejado',
  SOLICITADO = 'solicitado',
  COTACAO = 'cotacao',
  APROVADO = 'aprovado',
  PEDIDO = 'pedido',
  EM_TRANSITO = 'em_transito',
  RECEBIDO = 'recebido',
  PARCIAL = 'parcial',
  CANCELADO = 'cancelado'
}

export interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: MaterialCategory;
  specifications: Record<string, unknown>;
  leadTimeMin: number;
  leadTimeNormal: number;
  leadTimeMax: number;
  stockCurrent: number;
  stockMinimum: number;
  stockMaximum: number;
  reorderPoint: number;
  unitCost: number;
  lastPurchaseCost: number;
  lastPurchaseDate?: string;
  suppliers: string[];
  preferredSupplier?: string;
}

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantityRequired: number;
  trechoId: string;
  activityDate: string;
  deliveryDate: string;
  orderDate: string;
  status: string;
  purchaseOrderId?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseStatus;
  orderDate?: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  items: Array<{
    materialCode: string;
    materialName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalValue: number;
  discount: number;
  shippingCost: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface WarehouseMovement {
  id: string;
  materialId: string;
  movementType: 'entrada' | 'saida' | 'ajuste' | 'transferencia';
  quantity: number;
  unitCost: number;
  totalCost: number;
  movementDate: string;
  trechoId?: string;
  purchaseOrderId?: string;
  notes?: string;
}

export interface MaterialsScheduleResult {
  scheduleType: string;
  groupBy: string;
  generatedAt: string;
  ganttItems: Array<{
    id: string;
    period: string;
    materialCode: string;
    materialName: string;
    unit: string;
    totalQuantity: number;
    trechosCount: number;
    orderStart: string;
    orderEnd: string;
    deliveryStart: string;
    deliveryEnd: string;
    status: string;
  }>;
  summary: {
    totalItems: number;
    uniqueMaterials: number;
    materials: Array<{
      code: string;
      name: string;
      unit: string;
      totalQuantity: number;
      firstOrderDate: string;
      lastOrderDate: string;
    }>;
  };
  detailsByPeriod: Record<string, Array<{
    materialCode: string;
    materialName: string;
    unit: string;
    quantity: number;
    trecho: string;
    orderDate: string;
    deliveryDate: string;
    activityDate: string;
  }>>;
}

interface MaterialSpec {
  code: string;
  name: string;
  unit: string;
  quantityFactor: number;
  category: MaterialCategory;
}

interface PVMaterialSpec {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  category: MaterialCategory;
}

// Materiais padrao para saneamento por metro de rede
const DEFAULT_MATERIALS_PER_METER: Record<string, MaterialSpec> = {
  tubulacao: {
    code: 'TUB-{dn}',
    name: 'Tubo PVC DN{dn}',
    unit: 'm',
    quantityFactor: 1.05, // 5% de perda
    category: MaterialCategory.TUBULACAO
  },
  anel_vedacao: {
    code: 'VED-{dn}',
    name: 'Anel de vedacao DN{dn}',
    unit: 'un',
    quantityFactor: 1 / 6, // 1 a cada 6 metros
    category: MaterialCategory.VEDACAO
  },
  areia: {
    code: 'AGR-AREIA',
    name: 'Areia para berco/reaterro',
    unit: 'm3',
    quantityFactor: 0.15, // m3 por metro
    category: MaterialCategory.AGREGADOS
  },
  brita: {
    code: 'AGR-BRITA',
    name: 'Brita para base',
    unit: 'm3',
    quantityFactor: 0.1,
    category: MaterialCategory.AGREGADOS
  }
};

// Materiais por poco de visita
const DEFAULT_MATERIALS_PER_PV: Record<string, PVMaterialSpec> = {
  anel_concreto: {
    code: 'EST-ANEL',
    name: 'Anel de concreto PV',
    unit: 'un',
    quantity: 3, // 3 aneis por PV em media
    category: MaterialCategory.ESTRUTURAS
  },
  tampao: {
    code: 'EST-TAMPAO',
    name: 'Tampao ferro fundido',
    unit: 'un',
    quantity: 1,
    category: MaterialCategory.ESTRUTURAS
  },
  degrau: {
    code: 'EST-DEGRAU',
    name: 'Degrau PV',
    unit: 'un',
    quantity: 4, // 4 degraus por PV
    category: MaterialCategory.ESTRUTURAS
  },
  cimento: {
    code: 'CIM-CPII',
    name: 'Cimento CP-II',
    unit: 'kg',
    quantity: 50, // 50kg por PV
    category: MaterialCategory.CIMENTO
  }
};

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekNum = Math.ceil(
    (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return `Semana ${weekNum} (${weekStart.toISOString().split('T')[0]})`;
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

export function calculateMaterialNeeds(
  schedule: FullSchedule,
  defaultLeadTime = 14,
  includePVs = true
): MaterialRequirement[] {
  const requirements: MaterialRequirement[] = [];

  // Parse datas do cronograma
  const startDateStr = schedule.startDate instanceof Date
    ? schedule.startDate.toISOString().split('T')[0]
    : schedule.startDate;
  const calendar = schedule.calendar;
  const dateMap: Record<number, string> = {};
  calendar.forEach((d, i) => {
    dateMap[i + 1] = d;
  });

  // Processa cada trecho
  for (const trecho of schedule.trechos) {
    const trechoId = trecho.trechoId;
    const comprimento = trecho.comprimentoTotal;
    const diametro = trecho.diametro;

    for (const segment of trecho.segments) {
      const day = segment.day;
      const meters = segment.meters;
      const activityDate = dateMap[day] || addDays(startDateStr, day - 1);

      // Calcula data de entrega (precisa antes da atividade)
      const deliveryDate = addDays(activityDate, -2);

      // Calcula data do pedido
      const orderDate = addDays(deliveryDate, -defaultLeadTime);

      // Gera requisitos de materiais por metro
      for (const [matKey, matSpec] of Object.entries(DEFAULT_MATERIALS_PER_METER)) {
        const code = matSpec.code.replace('{dn}', String(diametro));
        const name = matSpec.name.replace('{dn}', String(diametro));
        const quantity = meters * matSpec.quantityFactor;

        if (quantity > 0) {
          requirements.push({
            materialId: `${code}_${trechoId}_${day}`,
            materialCode: code,
            materialName: name,
            unit: matSpec.unit,
            quantityRequired: Math.round(quantity * 100) / 100,
            trechoId,
            activityDate,
            deliveryDate,
            orderDate,
            status: 'pendente'
          });
        }
      }
    }

    // Adiciona materiais de PV se necessario
    if (includePVs) {
      // Estima numero de PVs (1 a cada 50m em media)
      const numPVs = Math.max(1, Math.floor(comprimento / 50));

      // PVs sao necessarios no inicio do trecho
      const firstDay = trecho.startDay;
      const pvDate = dateMap[firstDay] || startDateStr;
      const pvDelivery = addDays(pvDate, -3);
      const pvOrder = addDays(pvDelivery, -defaultLeadTime);

      for (const [matKey, matSpec] of Object.entries(DEFAULT_MATERIALS_PER_PV)) {
        const quantity = matSpec.quantity * numPVs;

        requirements.push({
          materialId: `${matSpec.code}_${trechoId}_PV`,
          materialCode: matSpec.code,
          materialName: matSpec.name,
          unit: matSpec.unit,
          quantityRequired: Math.round(quantity * 100) / 100,
          trechoId,
          activityDate: pvDate,
          deliveryDate: pvDelivery,
          orderDate: pvOrder,
          status: 'pendente'
        });
      }
    }
  }

  return requirements;
}

export function generatePurchaseSchedule(
  requirements: MaterialRequirement[],
  groupBy: 'week' | 'month' | 'material' = 'week'
): MaterialsScheduleResult {
  if (!requirements.length) {
    return {
      scheduleType: 'materials',
      groupBy,
      generatedAt: new Date().toISOString(),
      ganttItems: [],
      summary: {
        totalItems: 0,
        uniqueMaterials: 0,
        materials: []
      },
      detailsByPeriod: {}
    };
  }

  // Agrupa por data de pedido
  const ordersByDate: Record<string, MaterialRequirement[]> = {};
  for (const req of requirements) {
    if (!ordersByDate[req.orderDate]) {
      ordersByDate[req.orderDate] = [];
    }
    ordersByDate[req.orderDate].push(req);
  }

  // Agrupa por periodo
  let grouped: Record<string, MaterialRequirement[]>;

  if (groupBy === 'week') {
    grouped = {};
    for (const [orderDate, items] of Object.entries(ordersByDate)) {
      const weekKey = getWeekKey(orderDate);
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(...items);
    }
  } else if (groupBy === 'month') {
    grouped = {};
    for (const [orderDate, items] of Object.entries(ordersByDate)) {
      const monthKey = getMonthKey(orderDate);
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(...items);
    }
  } else {
    grouped = {};
    for (const req of requirements) {
      if (!grouped[req.materialCode]) {
        grouped[req.materialCode] = [];
      }
      grouped[req.materialCode].push(req);
    }
  }

  // Gera Gantt de materiais
  const ganttItems: MaterialsScheduleResult['ganttItems'] = [];

  for (const [period, items] of Object.entries(grouped)) {
    // Consolida por material
    const materialsInPeriod: Record<string, {
      materialCode: string;
      materialName: string;
      unit: string;
      totalQuantity: number;
      trechos: Set<string>;
      orderDates: Set<string>;
      deliveryDates: Set<string>;
    }> = {};

    for (const req of items) {
      const code = req.materialCode;
      if (!materialsInPeriod[code]) {
        materialsInPeriod[code] = {
          materialCode: code,
          materialName: req.materialName,
          unit: req.unit,
          totalQuantity: 0,
          trechos: new Set(),
          orderDates: new Set(),
          deliveryDates: new Set()
        };
      }
      materialsInPeriod[code].totalQuantity += req.quantityRequired;
      materialsInPeriod[code].trechos.add(req.trechoId);
      materialsInPeriod[code].orderDates.add(req.orderDate);
      materialsInPeriod[code].deliveryDates.add(req.deliveryDate);
    }

    for (const [code, matData] of Object.entries(materialsInPeriod)) {
      const orderDates = Array.from(matData.orderDates).sort();
      const deliveryDates = Array.from(matData.deliveryDates).sort();

      ganttItems.push({
        id: `${period}_${code}`,
        period,
        materialCode: code,
        materialName: matData.materialName,
        unit: matData.unit,
        totalQuantity: Math.round(matData.totalQuantity * 100) / 100,
        trechosCount: matData.trechos.size,
        orderStart: orderDates[0],
        orderEnd: orderDates[orderDates.length - 1],
        deliveryStart: deliveryDates[0],
        deliveryEnd: deliveryDates[deliveryDates.length - 1],
        status: 'planejado'
      });
    }
  }

  // Resumo geral
  const byCategory: Record<string, {
    code: string;
    name: string;
    unit: string;
    totalQuantity: number;
    firstOrderDate: string;
    lastOrderDate: string;
  }> = {};

  for (const req of requirements) {
    const code = req.materialCode;
    if (!byCategory[code]) {
      byCategory[code] = {
        code,
        name: req.materialName,
        unit: req.unit,
        totalQuantity: 0,
        firstOrderDate: req.orderDate,
        lastOrderDate: req.orderDate
      };
    }
    byCategory[code].totalQuantity += req.quantityRequired;
    if (req.orderDate < byCategory[code].firstOrderDate) {
      byCategory[code].firstOrderDate = req.orderDate;
    }
    if (req.orderDate > byCategory[code].lastOrderDate) {
      byCategory[code].lastOrderDate = req.orderDate;
    }
  }

  // Details by period
  const detailsByPeriod: MaterialsScheduleResult['detailsByPeriod'] = {};
  for (const [period, items] of Object.entries(grouped)) {
    detailsByPeriod[period] = items.map(r => ({
      materialCode: r.materialCode,
      materialName: r.materialName,
      unit: r.unit,
      quantity: r.quantityRequired,
      trecho: r.trechoId,
      orderDate: r.orderDate,
      deliveryDate: r.deliveryDate,
      activityDate: r.activityDate
    }));
  }

  return {
    scheduleType: 'materials',
    groupBy,
    generatedAt: new Date().toISOString(),
    ganttItems,
    summary: {
      totalItems: requirements.length,
      uniqueMaterials: Object.keys(byCategory).length,
      materials: Object.values(byCategory).map(mat => ({
        ...mat,
        totalQuantity: Math.round(mat.totalQuantity * 100) / 100
      }))
    },
    detailsByPeriod
  };
}

export function generateMaterialsSchedule(
  constructionSchedule: FullSchedule,
  leadTimeDays = 14
): MaterialsScheduleResult {
  const requirements = calculateMaterialNeeds(constructionSchedule, leadTimeDays);
  return generatePurchaseSchedule(requirements);
}

export function getMaterialCategories(): Array<{ value: string; label: string }> {
  return Object.values(MaterialCategory).map(cat => ({
    value: cat,
    label: cat.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
  }));
}

export function getPurchaseStatuses(): Array<{ value: string; label: string }> {
  return Object.values(PurchaseStatus).map(status => ({
    value: status,
    label: status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
  }));
}
