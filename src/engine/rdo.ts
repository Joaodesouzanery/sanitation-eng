/**
 * RDO Module - Relatorio Diario de Obra
 *
 * Este modulo implementa:
 * - Modelos de dados para RDO
 * - Engine de gerenciamento de RDOs
 * - Integracao com planejamento
 * - Controle financeiro (CPI, SPI, EVM)
 */

export enum SystemType {
  AGUA = 'agua',
  ESGOTO = 'esgoto',
  DRENAGEM = 'drenagem'
}

export enum RDOStatus {
  RASCUNHO = 'rascunho',
  ENVIADO = 'enviado',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado'
}

export enum ServiceUnit {
  METRO_LINEAR = 'm',
  METRO_QUADRADO = 'm2',
  METRO_CUBICO = 'm3',
  UNIDADE = 'un',
  HORA = 'h',
  DIA = 'dia',
  QUILOGRAMA = 'kg',
  TONELADA = 't',
  LITRO = 'L'
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface WorkFront {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  responsible?: string;
  createdAt: string;
  active: boolean;
}

export interface WorkLocation {
  id: string;
  name: string;
  address?: string;
  coordinates?: Location;
  projectId: string;
  createdAt: string;
  active: boolean;
}

export interface Worker {
  id: string;
  name: string;
  role?: string;
  registration?: string;
  active: boolean;
}

export interface ServiceCatalogItem {
  id: string;
  code?: string;
  name: string;
  description?: string;
  defaultUnit: ServiceUnit;
  category?: string;
  active: boolean;
}

export interface ExecutedService {
  id: string;
  serviceId?: string;
  serviceName: string;
  quantity: number;
  unit: ServiceUnit;
  equipmentUsed?: string[];
  responsibleWorkerId?: string;
  responsibleWorkerName?: string;
  notes?: string;
}

export interface SegmentProgress {
  segmentId: string;
  segmentName?: string;
  projectId: string;
  systemType: SystemType;
  executionDate: string;
  plannedLength?: number;
  executedLength: number;
  progressPercentage: number;
  startCoordinates?: Location;
  endCoordinates?: Location;
  status: string;
  geometryWkt?: string;
}

export interface Visit {
  visitorName: string;
  visitorType: string;
  organization?: string;
  purpose?: string;
  arrivalTime?: string;
  departureTime?: string;
  notes?: string;
}

export interface Occurrence {
  id: string;
  type: string;
  description: string;
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  affectedServices?: string[];
  correctiveActions?: string;
  timestamp: string;
}

export interface FinancialEntry {
  id: string;
  description: string;
  category: 'mao_obra' | 'material' | 'equipamento' | 'outros';
  value: number;
  quantity?: number;
  unit?: string;
  unitValue?: number;
  trechoId?: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  systemType: SystemType;
  client?: string;
  startDate?: string;
  endDate?: string;
  totalPlannedLength?: number;
  active: boolean;
}

export interface RDO {
  id: string;
  projectId: string;
  projectName?: string;
  obraId?: string;
  obraName?: string;
  date: string;
  location?: Location;
  terrainCondition?: string;
  workFronts: string[];
  workFrontNames: string[];
  workLocations: string[];
  workLocationNames: string[];
  executedServices: ExecutedService[];
  segmentProgress: SegmentProgress[];
  visits: Visit[];
  occurrences: Occurrence[];
  financialEntries: FinancialEntry[];
  dailyLaborCost: number;
  dailyMaterialCost: number;
  dailyEquipmentCost: number;
  dailyTotalCost: number;
  generalNotes?: string;
  status: RDOStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  history: Array<{ action: string; timestamp: string; details: Record<string, unknown>; version: number }>;
}

export interface RDOSummary {
  id: string;
  projectName: string;
  obraName?: string;
  date: string;
  status: RDOStatus;
  servicesCount: number;
  segmentsCount: number;
  totalProgressPercentage: number;
  createdAt: string;
}

export interface PlannedFinancial {
  id: string;
  projectId: string;
  referenceDate: string;
  budgetLabor: number;
  budgetMaterials: number;
  budgetEquipment: number;
  budgetIndirect: number;
  budgetContingency: number;
  budgetTotal: number;
  entries: FinancialEntry[];
  plannedCurve: Array<{ date: string; cumulativeValue: number; percentage: number }>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  version: number;
  notes?: string;
}

export interface PhysicalFinancialProgress {
  projectId: string;
  reportDate: string;
  plannedPhysical: number;
  executedPhysical: number;
  physicalPercentage: number;
  plannedFinancial: number;
  executedFinancial: number;
  financialPercentage: number;
  cpi: number; // Cost Performance Index (EV/AC)
  spi: number; // Schedule Performance Index (EV/PV)
  varianceCost: number;
  varianceSchedule: number;
  byCategory: Record<string, { planejado: number; executado: number; variacao: number }>;
  plannedCurve: Array<{ date: string; cumulativeValue: number }>;
  executedCurve: Array<{ date: string; dailyValue: number; cumulativeValue: number }>;
  estimatedAtCompletion: number; // EAC
  varianceAtCompletion: number; // VAC
}

export interface DashboardMetrics {
  totalRdos: number;
  rdosToday: number;
  rdosThisWeek: number;
  rdosThisMonth: number;
  rdosByStatus: Record<string, number>;
  totalPlannedLength: number;
  totalExecutedLength: number;
  overallProgressPercentage: number;
  totalPlannedFinancial: number;
  totalExecutedFinancial: number;
  financialProgressPercentage: number;
  financialVariance: number;
  cpi: number;
  spi: number;
  progressBySystem: Record<string, { planned: number; executed: number; percentage: number }>;
  progressByProject: Record<string, { planned: number; executed: number; percentage: number; rdosCount: number }>;
  topServices: Array<{ name: string; totalQuantity: number; unit: string; occurrences: number }>;
  executionTimeline: Array<{ date: string; dailyExecuted: number; accumulatedExecuted: number; rdosCount: number }>;
  totalOccurrences: number;
  occurrencesBySeverity: Record<string, number>;
}

// Helper functions
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Default service catalog
const DEFAULT_SERVICES: Array<{ code: string; name: string; unit: string; category: string }> = [
  { code: 'ESC001', name: 'Escavacao de vala', unit: 'm3', category: 'Escavacao' },
  { code: 'ESC002', name: 'Escavacao em rocha', unit: 'm3', category: 'Escavacao' },
  { code: 'REA001', name: 'Reaterro compactado', unit: 'm3', category: 'Reaterro' },
  { code: 'REA002', name: 'Reaterro simples', unit: 'm3', category: 'Reaterro' },
  { code: 'TUB001', name: 'Assentamento de tubulacao PVC', unit: 'm', category: 'Tubulacao' },
  { code: 'TUB002', name: 'Assentamento de tubulacao PEAD', unit: 'm', category: 'Tubulacao' },
  { code: 'TUB003', name: 'Assentamento de tubulacao ferro fundido', unit: 'm', category: 'Tubulacao' },
  { code: 'PV001', name: 'Execucao de poco de visita', unit: 'un', category: 'Pocos' },
  { code: 'PV002', name: 'Execucao de caixa de passagem', unit: 'un', category: 'Pocos' },
  { code: 'LIG001', name: 'Ligacao domiciliar de agua', unit: 'un', category: 'Ligacoes' },
  { code: 'LIG002', name: 'Ligacao domiciliar de esgoto', unit: 'un', category: 'Ligacoes' },
  { code: 'PAV001', name: 'Recomposicao de pavimento', unit: 'm2', category: 'Pavimentacao' },
  { code: 'PAV002', name: 'Recomposicao de calcada', unit: 'm2', category: 'Pavimentacao' },
  { code: 'TEST001', name: 'Teste de estanqueidade', unit: 'm', category: 'Testes' },
  { code: 'TEST002', name: 'Teste hidrostatico', unit: 'm', category: 'Testes' },
  { code: 'LIMP001', name: 'Limpeza e desinfeccao', unit: 'm', category: 'Limpeza' }
];

export class RDOEngine {
  private rdos: Map<string, RDO> = new Map();
  private projects: Map<string, Project> = new Map();
  private workFronts: Map<string, WorkFront> = new Map();
  private workLocations: Map<string, WorkLocation> = new Map();
  private serviceCatalog: Map<string, ServiceCatalogItem> = new Map();
  private workers: Map<string, Worker> = new Map();
  private plannedSegments: Map<string, Record<string, unknown>> = new Map();
  private plannedFinancials: Map<string, PlannedFinancial> = new Map();

  constructor() {
    this.initializeDefaultCatalog();
  }

  private initializeDefaultCatalog(): void {
    const unitMap: Record<string, ServiceUnit> = {
      m: ServiceUnit.METRO_LINEAR,
      m2: ServiceUnit.METRO_QUADRADO,
      m3: ServiceUnit.METRO_CUBICO,
      un: ServiceUnit.UNIDADE
    };

    for (const service of DEFAULT_SERVICES) {
      const item: ServiceCatalogItem = {
        id: generateId(),
        code: service.code,
        name: service.name,
        defaultUnit: unitMap[service.unit] || ServiceUnit.METRO_LINEAR,
        category: service.category,
        active: true
      };
      this.serviceCatalog.set(item.id, item);
    }
  }

  // CRUD de RDOs
  createRDO(projectId: string, date: string, obraId?: string, createdBy?: string): RDO {
    const project = this.projects.get(projectId);
    const now = new Date().toISOString();

    const rdo: RDO = {
      id: generateId(),
      projectId,
      projectName: project?.name,
      obraId,
      date,
      workFronts: [],
      workFrontNames: [],
      workLocations: [],
      workLocationNames: [],
      executedServices: [],
      segmentProgress: [],
      visits: [],
      occurrences: [],
      financialEntries: [],
      dailyLaborCost: 0,
      dailyMaterialCost: 0,
      dailyEquipmentCost: 0,
      dailyTotalCost: 0,
      status: RDOStatus.RASCUNHO,
      createdAt: now,
      updatedAt: now,
      createdBy,
      version: 1,
      history: []
    };

    this.rdos.set(rdo.id, rdo);
    return rdo;
  }

  getRDO(rdoId: string): RDO | undefined {
    return this.rdos.get(rdoId);
  }

  updateRDO(rdo: RDO): RDO {
    rdo.updatedAt = new Date().toISOString();
    this.rdos.set(rdo.id, rdo);
    return rdo;
  }

  deleteRDO(rdoId: string): boolean {
    return this.rdos.delete(rdoId);
  }

  listRDOs(filters?: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
    status?: RDOStatus;
  }): RDOSummary[] {
    let rdos = Array.from(this.rdos.values());

    if (filters?.projectId) {
      rdos = rdos.filter(r => r.projectId === filters.projectId);
    }
    if (filters?.startDate) {
      rdos = rdos.filter(r => r.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      rdos = rdos.filter(r => r.date <= filters.endDate!);
    }
    if (filters?.status) {
      rdos = rdos.filter(r => r.status === filters.status);
    }

    rdos.sort((a, b) => b.date.localeCompare(a.date));

    return rdos.map(rdo => this.toSummary(rdo));
  }

  private toSummary(rdo: RDO): RDOSummary {
    const progress = this.calculateTotalProgress(rdo);
    return {
      id: rdo.id,
      projectName: rdo.projectName || 'Sem projeto',
      obraName: rdo.obraName,
      date: rdo.date,
      status: rdo.status,
      servicesCount: rdo.executedServices.length,
      segmentsCount: rdo.segmentProgress.length,
      totalProgressPercentage: progress.percentage,
      createdAt: rdo.createdAt
    };
  }

  private calculateTotalProgress(rdo: RDO): { totalExecuted: number; totalPlanned: number; percentage: number } {
    if (!rdo.segmentProgress.length) {
      return { totalExecuted: 0, totalPlanned: 0, percentage: 0 };
    }

    const totalExecuted = rdo.segmentProgress.reduce((sum, sp) => sum + sp.executedLength, 0);
    const totalPlanned = rdo.segmentProgress.reduce((sum, sp) => sum + (sp.plannedLength || 0), 0);

    const percentage = totalPlanned > 0
      ? Math.min(100, (totalExecuted / totalPlanned) * 100)
      : 0;

    return {
      totalExecuted,
      totalPlanned,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  // Servicos
  addServiceToRDO(
    rdoId: string,
    serviceName: string,
    quantity: number,
    unit: ServiceUnit,
    options?: {
      serviceId?: string;
      equipmentUsed?: string[];
      responsibleWorkerId?: string;
      notes?: string;
    }
  ): ExecutedService {
    const rdo = this.getRDO(rdoId);
    if (!rdo) throw new Error(`RDO nao encontrado: ${rdoId}`);

    const worker = options?.responsibleWorkerId
      ? this.workers.get(options.responsibleWorkerId)
      : undefined;

    const service: ExecutedService = {
      id: generateId(),
      serviceId: options?.serviceId,
      serviceName,
      quantity,
      unit,
      equipmentUsed: options?.equipmentUsed,
      responsibleWorkerId: options?.responsibleWorkerId,
      responsibleWorkerName: worker?.name,
      notes: options?.notes
    };

    rdo.executedServices.push(service);
    this.addHistory(rdo, 'service_added', { serviceId: service.id });
    this.updateRDO(rdo);

    return service;
  }

  // Progresso de trechos
  importPlannedSegments(projectId: string, segments: Array<Record<string, unknown>>): number {
    let count = 0;
    for (const segment of segments) {
      const segmentId = (segment.id || segment.segmentId) as string;
      if (!segmentId) continue;

      this.plannedSegments.set(segmentId, {
        projectId,
        segmentId,
        name: segment.name,
        systemType: segment.systemType || 'esgoto',
        plannedLength: segment.length || segment.plannedLength,
        plannedStartDate: segment.startDate || segment.plannedStartDate,
        plannedEndDate: segment.endDate || segment.plannedEndDate,
        geometry: segment.geometry,
        startCoords: segment.startCoords,
        endCoords: segment.endCoords,
        diameter: segment.diameter,
        material: segment.material,
        depth: segment.depth
      });
      count++;
    }
    return count;
  }

  addSegmentProgressToRDO(
    rdoId: string,
    segmentId: string,
    executedLength: number,
    systemType: SystemType = SystemType.ESGOTO,
    executionDate?: string,
    startCoords?: { lat: number; lng: number },
    endCoords?: { lat: number; lng: number }
  ): SegmentProgress {
    const rdo = this.getRDO(rdoId);
    if (!rdo) throw new Error(`RDO nao encontrado: ${rdoId}`);

    const plannedData = this.plannedSegments.get(segmentId) || {};
    const plannedLength = plannedData.plannedLength as number | undefined;

    const progressPct = plannedLength && plannedLength > 0
      ? Math.min(100, (executedLength / plannedLength) * 100)
      : 0;

    const progress: SegmentProgress = {
      segmentId,
      segmentName: plannedData.name as string | undefined,
      projectId: rdo.projectId,
      systemType,
      executionDate: executionDate || rdo.date,
      plannedLength,
      executedLength,
      progressPercentage: progressPct,
      startCoordinates: startCoords ? { latitude: startCoords.lat, longitude: startCoords.lng } : undefined,
      endCoordinates: endCoords ? { latitude: endCoords.lat, longitude: endCoords.lng } : undefined,
      status: 'em_execucao',
      geometryWkt: plannedData.geometry as string | undefined
    };

    rdo.segmentProgress.push(progress);
    this.addHistory(rdo, 'segment_added', { segmentId });
    this.updateRDO(rdo);

    return progress;
  }

  // Controle financeiro
  addFinancialEntryToRDO(
    rdoId: string,
    description: string,
    category: 'mao_obra' | 'material' | 'equipamento' | 'outros',
    value: number,
    options?: {
      quantity?: number;
      unit?: string;
      unitValue?: number;
      trechoId?: string;
      notes?: string;
    }
  ): FinancialEntry {
    const rdo = this.getRDO(rdoId);
    if (!rdo) throw new Error(`RDO nao encontrado: ${rdoId}`);

    const entry: FinancialEntry = {
      id: generateId(),
      description,
      category,
      value,
      ...options
    };

    rdo.financialEntries.push(entry);
    this.recalculateDailyCosts(rdo);
    this.addHistory(rdo, 'financial_entry_added', { entryId: entry.id });
    this.updateRDO(rdo);

    return entry;
  }

  private recalculateDailyCosts(rdo: RDO): void {
    rdo.dailyLaborCost = rdo.financialEntries
      .filter(e => e.category === 'mao_obra')
      .reduce((sum, e) => sum + e.value, 0);

    rdo.dailyMaterialCost = rdo.financialEntries
      .filter(e => e.category === 'material')
      .reduce((sum, e) => sum + e.value, 0);

    rdo.dailyEquipmentCost = rdo.financialEntries
      .filter(e => e.category === 'equipamento')
      .reduce((sum, e) => sum + e.value, 0);

    const otherCosts = rdo.financialEntries
      .filter(e => e.category === 'outros')
      .reduce((sum, e) => sum + e.value, 0);

    rdo.dailyTotalCost = rdo.dailyLaborCost + rdo.dailyMaterialCost + rdo.dailyEquipmentCost + otherCosts;
  }

  setPlannedFinancial(
    projectId: string,
    budget: {
      labor?: number;
      materials?: number;
      equipment?: number;
      indirect?: number;
      contingency?: number;
    },
    plannedCurve?: Array<{ date: string; cumulativeValue: number; percentage: number }>,
    createdBy?: string
  ): PlannedFinancial {
    const now = new Date().toISOString();
    const budgetLabor = budget.labor || 0;
    const budgetMaterials = budget.materials || 0;
    const budgetEquipment = budget.equipment || 0;
    const budgetIndirect = budget.indirect || 0;
    const budgetContingency = budget.contingency || 0;

    const planned: PlannedFinancial = {
      id: generateId(),
      projectId,
      referenceDate: formatDate(new Date()),
      budgetLabor,
      budgetMaterials,
      budgetEquipment,
      budgetIndirect,
      budgetContingency,
      budgetTotal: budgetLabor + budgetMaterials + budgetEquipment + budgetIndirect + budgetContingency,
      entries: [],
      plannedCurve: plannedCurve || [],
      createdAt: now,
      updatedAt: now,
      createdBy,
      version: 1
    };

    this.plannedFinancials.set(projectId, planned);
    return planned;
  }

  getPhysicalFinancialProgress(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): PhysicalFinancialProgress {
    const planned = this.plannedFinancials.get(projectId);
    const plannedBudget = planned?.budgetTotal || 0;

    // Calcula planejado vs executado fisico
    const physicalData = this.getPlannedVsExecuted(projectId, startDate, endDate);

    // Calcula executado financeiro acumulado
    let rdos = Array.from(this.rdos.values()).filter(r => r.projectId === projectId);
    if (startDate) rdos = rdos.filter(r => r.date >= startDate);
    if (endDate) rdos = rdos.filter(r => r.date <= endDate);

    const executedFinancial = rdos.reduce((sum, r) => sum + r.dailyTotalCost, 0);
    const executedLabor = rdos.reduce((sum, r) => sum + r.dailyLaborCost, 0);
    const executedMaterials = rdos.reduce((sum, r) => sum + r.dailyMaterialCost, 0);
    const executedEquipment = rdos.reduce((sum, r) => sum + r.dailyEquipmentCost, 0);

    const physicalPct = physicalData.overallProgressPercentage;
    const financialPct = plannedBudget > 0 ? (executedFinancial / plannedBudget) * 100 : 0;

    // Calcula indicadores EVM
    const pv = plannedBudget * (physicalPct / 100);
    const ev = plannedBudget * (physicalPct / 100);
    const ac = executedFinancial;

    const cpi = ac > 0 ? ev / ac : 0;
    const spi = pv > 0 ? ev / pv : 0;

    const varianceCost = ev - ac;
    const varianceSchedule = ev - pv;

    const eac = cpi > 0 ? plannedBudget / cpi : plannedBudget;
    const vac = plannedBudget - eac;

    // Detalhamento por categoria
    const byCategory: Record<string, { planejado: number; executado: number; variacao: number }> = {
      mao_obra: {
        planejado: planned?.budgetLabor || 0,
        executado: executedLabor,
        variacao: (planned?.budgetLabor || 0) - executedLabor
      },
      material: {
        planejado: planned?.budgetMaterials || 0,
        executado: executedMaterials,
        variacao: (planned?.budgetMaterials || 0) - executedMaterials
      },
      equipamento: {
        planejado: planned?.budgetEquipment || 0,
        executado: executedEquipment,
        variacao: (planned?.budgetEquipment || 0) - executedEquipment
      }
    };

    // Curva executada
    const executedCurve = this.buildExecutedCurve(rdos);

    return {
      projectId,
      reportDate: formatDate(new Date()),
      plannedPhysical: physicalData.totalPlanned,
      executedPhysical: physicalData.totalExecuted,
      physicalPercentage: physicalPct,
      plannedFinancial: plannedBudget,
      executedFinancial,
      financialPercentage: Math.round(financialPct * 100) / 100,
      cpi: Math.round(cpi * 1000) / 1000,
      spi: Math.round(spi * 1000) / 1000,
      varianceCost: Math.round(varianceCost * 100) / 100,
      varianceSchedule: Math.round(varianceSchedule * 100) / 100,
      byCategory,
      plannedCurve: planned?.plannedCurve || [],
      executedCurve,
      estimatedAtCompletion: Math.round(eac * 100) / 100,
      varianceAtCompletion: Math.round(vac * 100) / 100
    };
  }

  private buildExecutedCurve(rdos: RDO[]): Array<{ date: string; dailyValue: number; cumulativeValue: number }> {
    if (!rdos.length) return [];

    const sorted = [...rdos].sort((a, b) => a.date.localeCompare(b.date));
    const curve: Array<{ date: string; dailyValue: number; cumulativeValue: number }> = [];
    let cumulative = 0;

    for (const rdo of sorted) {
      cumulative += rdo.dailyTotalCost;
      curve.push({
        date: rdo.date,
        dailyValue: rdo.dailyTotalCost,
        cumulativeValue: Math.round(cumulative * 100) / 100
      });
    }

    return curve;
  }

  getPlannedVsExecuted(
    projectId?: string,
    startDate?: string,
    endDate?: string,
    systemType?: SystemType
  ): {
    totalPlanned: number;
    totalExecuted: number;
    totalRemaining: number;
    overallProgressPercentage: number;
    segmentsCount: number;
    completedSegments: number;
    inProgressSegments: number;
    notStartedSegments: number;
    segments: Array<{
      segmentId: string;
      segmentName?: string;
      systemType: string;
      plannedLength: number;
      executedLength: number;
      progressPercentage: number;
      remaining: number;
      status: string;
    }>;
  } {
    let rdos = Array.from(this.rdos.values());
    if (projectId) rdos = rdos.filter(r => r.projectId === projectId);
    if (startDate) rdos = rdos.filter(r => r.date >= startDate);
    if (endDate) rdos = rdos.filter(r => r.date <= endDate);

    const segmentTotals: Map<string, { executed: number; planned: number }> = new Map();

    for (const rdo of rdos) {
      for (const progress of rdo.segmentProgress) {
        if (systemType && progress.systemType !== systemType) continue;

        const existing = segmentTotals.get(progress.segmentId) || { executed: 0, planned: 0 };
        existing.executed += progress.executedLength;
        if (progress.plannedLength) {
          existing.planned = Math.max(existing.planned, progress.plannedLength);
        }
        segmentTotals.set(progress.segmentId, existing);
      }
    }

    // Adiciona trechos planejados sem execucao
    for (const [segId, plannedData] of this.plannedSegments) {
      if (projectId && plannedData.projectId !== projectId) continue;
      if (systemType && plannedData.systemType !== systemType) continue;
      if (!segmentTotals.has(segId)) {
        segmentTotals.set(segId, {
          executed: 0,
          planned: (plannedData.plannedLength as number) || 0
        });
      }
    }

    const totalPlanned = Array.from(segmentTotals.values()).reduce((sum, s) => sum + s.planned, 0);
    const totalExecuted = Array.from(segmentTotals.values()).reduce((sum, s) => sum + s.executed, 0);
    const overallProgress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

    const segments: Array<{
      segmentId: string;
      segmentName?: string;
      systemType: string;
      plannedLength: number;
      executedLength: number;
      progressPercentage: number;
      remaining: number;
      status: string;
    }> = [];

    for (const [segId, totals] of segmentTotals) {
      const plannedData = this.plannedSegments.get(segId) || {};
      const pct = totals.planned > 0 ? (totals.executed / totals.planned) * 100 : 0;

      let status: string;
      if (pct >= 100) status = 'concluido';
      else if (pct > 0) status = 'em_execucao';
      else status = 'nao_iniciado';

      segments.push({
        segmentId: segId,
        segmentName: plannedData.name as string | undefined,
        systemType: (plannedData.systemType as string) || 'unknown',
        plannedLength: Math.round(totals.planned * 100) / 100,
        executedLength: Math.round(totals.executed * 100) / 100,
        progressPercentage: Math.round(pct * 100) / 100,
        remaining: Math.round(Math.max(0, totals.planned - totals.executed) * 100) / 100,
        status
      });
    }

    segments.sort((a, b) => b.progressPercentage - a.progressPercentage);

    return {
      totalPlanned: Math.round(totalPlanned * 100) / 100,
      totalExecuted: Math.round(totalExecuted * 100) / 100,
      totalRemaining: Math.round(Math.max(0, totalPlanned - totalExecuted) * 100) / 100,
      overallProgressPercentage: Math.round(overallProgress * 100) / 100,
      segmentsCount: segments.length,
      completedSegments: segments.filter(s => s.progressPercentage >= 100).length,
      inProgressSegments: segments.filter(s => s.progressPercentage > 0 && s.progressPercentage < 100).length,
      notStartedSegments: segments.filter(s => s.progressPercentage === 0).length,
      segments
    };
  }

  // Projetos
  createProject(
    name: string,
    systemType: SystemType = SystemType.ESGOTO,
    options?: {
      code?: string;
      description?: string;
      client?: string;
      startDate?: string;
      endDate?: string;
      totalPlannedLength?: number;
    }
  ): Project {
    const project: Project = {
      id: generateId(),
      name,
      systemType,
      active: true,
      ...options
    };
    this.projects.set(project.id, project);
    return project;
  }

  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  listProjects(activeOnly = true): Project[] {
    const projects = Array.from(this.projects.values());
    return activeOnly ? projects.filter(p => p.active) : projects;
  }

  // Catalogo de servicos
  listServiceCatalog(category?: string): ServiceCatalogItem[] {
    let items = Array.from(this.serviceCatalog.values()).filter(i => i.active);
    if (category) {
      items = items.filter(i => i.category === category);
    }
    return items;
  }

  // Helpers
  private addHistory(rdo: RDO, action: string, details: Record<string, unknown>): void {
    rdo.history.push({
      action,
      timestamp: new Date().toISOString(),
      details,
      version: rdo.version
    });
    rdo.version++;
  }

  // Getters
  getRDOCount(): number {
    return this.rdos.size;
  }

  getAllRDOs(): RDO[] {
    return Array.from(this.rdos.values());
  }
}

// Singleton instance
let engineInstance: RDOEngine | null = null;

export function getRDOEngine(): RDOEngine {
  if (!engineInstance) {
    engineInstance = new RDOEngine();
  }
  return engineInstance;
}
