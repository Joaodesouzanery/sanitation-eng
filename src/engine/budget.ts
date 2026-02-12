/**
 * Budget Module - Base de Custos e Orcamento
 *
 * Este modulo fornece funcionalidades para:
 * - Gerenciamento de base de custos
 * - Calculo de orcamento
 * - Exportacao para Excel
 */

import { Trecho } from './domain';
import { calcularQuantidades, TipoSolo, TipoEscavacao, TipoPavimento } from './construction';

export interface CostItem {
  code: string;
  description: string;
  unit: string;
  unitCost: number;
  category: string;
  source?: string;
}

export interface CostBaseEntry {
  tipoRede: string;
  diametroMm: number;
  custoUnitario: number;
  unidade: string;
  descricao?: string;
}

export interface BudgetItem {
  itemNum: number;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  category: string;
  trechoId?: string;
}

export interface BudgetSummary {
  items: BudgetItem[];
  totalByCategory: Record<string, number>;
  grandTotal: number;
  totalLength: number;
  costPerMeter: number;
  generatedAt: string;
}

// Default cost base for sanitation works
const DEFAULT_COST_BASE: CostItem[] = [
  // Escavacao
  { code: 'ESC-001', description: 'Escavacao mecanizada em solo normal', unit: 'm3', unitCost: 18.50, category: 'Escavacao' },
  { code: 'ESC-002', description: 'Escavacao mecanizada em solo rochoso', unit: 'm3', unitCost: 85.00, category: 'Escavacao' },
  { code: 'ESC-003', description: 'Escavacao manual em solo normal', unit: 'm3', unitCost: 45.00, category: 'Escavacao' },

  // Reaterro
  { code: 'REA-001', description: 'Reaterro compactado mecanicamente', unit: 'm3', unitCost: 22.00, category: 'Reaterro' },
  { code: 'REA-002', description: 'Reaterro compactado manualmente', unit: 'm3', unitCost: 35.00, category: 'Reaterro' },

  // Berco e Envolvimento
  { code: 'BER-001', description: 'Berco de areia para tubulacao', unit: 'm3', unitCost: 95.00, category: 'Berco' },
  { code: 'BER-002', description: 'Envolvimento com areia', unit: 'm3', unitCost: 95.00, category: 'Berco' },

  // Tubulacao PVC
  { code: 'TUB-PVC-100', description: 'Tubo PVC DN100 JEI', unit: 'm', unitCost: 25.00, category: 'Tubulacao' },
  { code: 'TUB-PVC-150', description: 'Tubo PVC DN150 JEI', unit: 'm', unitCost: 42.00, category: 'Tubulacao' },
  { code: 'TUB-PVC-200', description: 'Tubo PVC DN200 JEI', unit: 'm', unitCost: 68.00, category: 'Tubulacao' },
  { code: 'TUB-PVC-250', description: 'Tubo PVC DN250 JEI', unit: 'm', unitCost: 105.00, category: 'Tubulacao' },
  { code: 'TUB-PVC-300', description: 'Tubo PVC DN300 JEI', unit: 'm', unitCost: 148.00, category: 'Tubulacao' },
  { code: 'TUB-PVC-400', description: 'Tubo PVC DN400 JEI', unit: 'm', unitCost: 265.00, category: 'Tubulacao' },

  // Tubulacao PEAD
  { code: 'TUB-PEAD-100', description: 'Tubo PEAD DN100', unit: 'm', unitCost: 35.00, category: 'Tubulacao' },
  { code: 'TUB-PEAD-150', description: 'Tubo PEAD DN150', unit: 'm', unitCost: 58.00, category: 'Tubulacao' },
  { code: 'TUB-PEAD-200', description: 'Tubo PEAD DN200', unit: 'm', unitCost: 92.00, category: 'Tubulacao' },

  // Tubulacao Ferro Fundido
  { code: 'TUB-FF-100', description: 'Tubo Ferro Fundido DN100', unit: 'm', unitCost: 85.00, category: 'Tubulacao' },
  { code: 'TUB-FF-150', description: 'Tubo Ferro Fundido DN150', unit: 'm', unitCost: 125.00, category: 'Tubulacao' },
  { code: 'TUB-FF-200', description: 'Tubo Ferro Fundido DN200', unit: 'm', unitCost: 185.00, category: 'Tubulacao' },

  // Assentamento
  { code: 'ASS-001', description: 'Assentamento de tubos DN ate 200mm', unit: 'm', unitCost: 12.00, category: 'Assentamento' },
  { code: 'ASS-002', description: 'Assentamento de tubos DN 250-400mm', unit: 'm', unitCost: 18.00, category: 'Assentamento' },
  { code: 'ASS-003', description: 'Assentamento de tubos DN > 400mm', unit: 'm', unitCost: 28.00, category: 'Assentamento' },

  // Escoramento
  { code: 'ESCOR-001', description: 'Escoramento pontaleteamento', unit: 'm2', unitCost: 25.00, category: 'Escoramento' },
  { code: 'ESCOR-002', description: 'Escoramento continuo madeira', unit: 'm2', unitCost: 45.00, category: 'Escoramento' },
  { code: 'ESCOR-003', description: 'Escoramento metalico', unit: 'm2', unitCost: 85.00, category: 'Escoramento' },

  // Pavimentacao
  { code: 'PAV-001', description: 'Recomposicao asfalto CBUQ', unit: 'm2', unitCost: 95.00, category: 'Pavimentacao' },
  { code: 'PAV-002', description: 'Recomposicao paralelepipedo', unit: 'm2', unitCost: 65.00, category: 'Pavimentacao' },
  { code: 'PAV-003', description: 'Recomposicao concreto', unit: 'm2', unitCost: 120.00, category: 'Pavimentacao' },
  { code: 'PAV-004', description: 'Recomposicao calcada', unit: 'm2', unitCost: 55.00, category: 'Pavimentacao' },

  // Poco de Visita
  { code: 'PV-001', description: 'Poco de visita concreto H=1.5m', unit: 'un', unitCost: 1850.00, category: 'Poco de Visita' },
  { code: 'PV-002', description: 'Poco de visita concreto H=2.0m', unit: 'un', unitCost: 2350.00, category: 'Poco de Visita' },
  { code: 'PV-003', description: 'Poco de visita concreto H=2.5m', unit: 'un', unitCost: 2850.00, category: 'Poco de Visita' },
  { code: 'PV-004', description: 'Poco de visita concreto H=3.0m', unit: 'un', unitCost: 3450.00, category: 'Poco de Visita' },

  // Testes
  { code: 'TST-001', description: 'Teste de estanqueidade', unit: 'm', unitCost: 3.50, category: 'Testes' },
  { code: 'TST-002', description: 'Teste hidrostatico', unit: 'm', unitCost: 4.50, category: 'Testes' },
  { code: 'TST-003', description: 'Videoinspecao', unit: 'm', unitCost: 8.00, category: 'Testes' },

  // Outros
  { code: 'OUT-001', description: 'Bota-fora de material excedente', unit: 'm3', unitCost: 28.00, category: 'Outros' },
  { code: 'OUT-002', description: 'Sinalizacao de obra', unit: 'vb', unitCost: 850.00, category: 'Outros' },
  { code: 'OUT-003', description: 'Mobilizacao/Desmobilizacao', unit: 'vb', unitCost: 3500.00, category: 'Outros' }
];

export class CostBase {
  private items: Map<string, CostItem> = new Map();

  constructor(initialItems?: CostItem[]) {
    const items = initialItems || DEFAULT_COST_BASE;
    for (const item of items) {
      this.items.set(item.code, item);
    }
  }

  getItem(code: string): CostItem | undefined {
    return this.items.get(code);
  }

  addItem(item: CostItem): void {
    this.items.set(item.code, item);
  }

  updateItem(code: string, updates: Partial<CostItem>): boolean {
    const item = this.items.get(code);
    if (!item) return false;

    this.items.set(code, { ...item, ...updates });
    return true;
  }

  getAllItems(): CostItem[] {
    return Array.from(this.items.values());
  }

  getItemsByCategory(category: string): CostItem[] {
    return Array.from(this.items.values()).filter(item => item.category === category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const item of this.items.values()) {
      categories.add(item.category);
    }
    return Array.from(categories).sort();
  }

  getTubeCost(material: string, diametroMm: number): number {
    const materialMap: Record<string, string> = {
      'PVC': 'TUB-PVC',
      'PEAD': 'TUB-PEAD',
      'FOFO': 'TUB-FF',
      'Ferro Fundido': 'TUB-FF'
    };

    const prefix = materialMap[material] || 'TUB-PVC';
    const code = `${prefix}-${diametroMm}`;

    const item = this.items.get(code);
    if (item) return item.unitCost;

    // Fallback: estimate based on diameter
    const baseCost = 25; // PVC DN100
    return baseCost * Math.pow(diametroMm / 100, 1.8);
  }

  loadFromCSV(csvContent: string, delimiter = ';'): number {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return 0;

    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      if (values.length >= 4) {
        const item: CostItem = {
          code: values[0],
          description: values[1],
          unit: values[2],
          unitCost: parseFloat(values[3].replace(',', '.')),
          category: values[4] || 'Outros'
        };
        this.items.set(item.code, item);
        count++;
      }
    }
    return count;
  }

  loadFromJSON(data: CostItem[]): number {
    let count = 0;
    for (const item of data) {
      this.items.set(item.code, item);
      count++;
    }
    return count;
  }
}

export interface BudgetOptions {
  tipoSolo?: TipoSolo;
  tipoEscavacao?: TipoEscavacao;
  tipoPavimento?: TipoPavimento;
  incluirPVs?: boolean;
  incluirTestes?: boolean;
  incluirMobilizacao?: boolean;
  bdi?: number; // Beneficios e Despesas Indiretas (%)
}

export function calculateBudget(
  trechos: Trecho[],
  costBase: CostBase,
  options: BudgetOptions = {}
): BudgetSummary {
  const {
    tipoSolo = TipoSolo.NORMAL,
    tipoEscavacao = TipoEscavacao.MECANIZADA,
    tipoPavimento = TipoPavimento.ASFALTO,
    incluirPVs = true,
    incluirTestes = true,
    incluirMobilizacao = true,
    bdi = 25
  } = options;

  const items: BudgetItem[] = [];
  let itemNum = 1;
  let totalLength = 0;

  // Group by diameter for efficiency
  const trechosByDiameter: Map<number, Trecho[]> = new Map();
  for (const trecho of trechos) {
    const diametro = trecho.diametroMm;
    if (!trechosByDiameter.has(diametro)) {
      trechosByDiameter.set(diametro, []);
    }
    trechosByDiameter.get(diametro)!.push(trecho);
  }

  // Calculate quantities for each trecho
  let totalEscavacao = 0;
  let totalReaterro = 0;
  let totalBerco = 0;
  let totalEscoramento = 0;
  let totalPavimento = 0;
  let totalBotaFora = 0;
  const tubeQuantities: Map<string, { quantity: number; unitCost: number; description: string }> = new Map();

  for (const trecho of trechos) {
    const profundidade = 1.5; // Default depth - could be parameter
    const qtd = calcularQuantidades(trecho.comprimento, profundidade, trecho.diametroMm);

    totalEscavacao += qtd.volumeEscavacao;
    totalReaterro += qtd.volumeReaterro;
    totalBerco += qtd.volumeBerco;
    totalEscoramento += profundidade > 1.25 ? qtd.areaEscoramento : 0;
    totalPavimento += qtd.areaPavimento;
    totalBotaFora += qtd.volumeBotaFora;
    totalLength += trecho.comprimento;

    // Tube quantities
    const tubeKey = `${trecho.material}-${trecho.diametroMm}`;
    const tubeCost = costBase.getTubeCost(trecho.material, trecho.diametroMm);
    if (!tubeQuantities.has(tubeKey)) {
      tubeQuantities.set(tubeKey, {
        quantity: 0,
        unitCost: tubeCost,
        description: `Tubo ${trecho.material} DN${trecho.diametroMm}`
      });
    }
    tubeQuantities.get(tubeKey)!.quantity += trecho.comprimento * 1.05; // 5% loss
  }

  // Add escavacao item
  const escCode = tipoSolo === TipoSolo.ROCHOSO ? 'ESC-002' :
    tipoEscavacao === TipoEscavacao.MANUAL ? 'ESC-003' : 'ESC-001';
  const escItem = costBase.getItem(escCode);
  if (escItem && totalEscavacao > 0) {
    items.push({
      itemNum: itemNum++,
      code: escCode,
      description: escItem.description,
      unit: escItem.unit,
      quantity: Math.round(totalEscavacao * 100) / 100,
      unitCost: escItem.unitCost,
      totalCost: Math.round(totalEscavacao * escItem.unitCost * 100) / 100,
      category: escItem.category
    });
  }

  // Add reaterro item
  const reaCode = tipoEscavacao === TipoEscavacao.MANUAL ? 'REA-002' : 'REA-001';
  const reaItem = costBase.getItem(reaCode);
  if (reaItem && totalReaterro > 0) {
    items.push({
      itemNum: itemNum++,
      code: reaCode,
      description: reaItem.description,
      unit: reaItem.unit,
      quantity: Math.round(totalReaterro * 100) / 100,
      unitCost: reaItem.unitCost,
      totalCost: Math.round(totalReaterro * reaItem.unitCost * 100) / 100,
      category: reaItem.category
    });
  }

  // Add berco item
  const berItem = costBase.getItem('BER-001');
  if (berItem && totalBerco > 0) {
    items.push({
      itemNum: itemNum++,
      code: 'BER-001',
      description: berItem.description,
      unit: berItem.unit,
      quantity: Math.round(totalBerco * 100) / 100,
      unitCost: berItem.unitCost,
      totalCost: Math.round(totalBerco * berItem.unitCost * 100) / 100,
      category: berItem.category
    });
  }

  // Add tube items
  for (const [key, data] of tubeQuantities) {
    items.push({
      itemNum: itemNum++,
      code: `TUB-${key}`,
      description: data.description,
      unit: 'm',
      quantity: Math.round(data.quantity * 100) / 100,
      unitCost: data.unitCost,
      totalCost: Math.round(data.quantity * data.unitCost * 100) / 100,
      category: 'Tubulacao'
    });
  }

  // Add assentamento
  const assCode = Array.from(tubeQuantities.keys()).some(k => parseInt(k.split('-')[1]) > 400) ? 'ASS-003' :
    Array.from(tubeQuantities.keys()).some(k => parseInt(k.split('-')[1]) > 200) ? 'ASS-002' : 'ASS-001';
  const assItem = costBase.getItem(assCode);
  if (assItem && totalLength > 0) {
    items.push({
      itemNum: itemNum++,
      code: assCode,
      description: assItem.description,
      unit: assItem.unit,
      quantity: Math.round(totalLength * 100) / 100,
      unitCost: assItem.unitCost,
      totalCost: Math.round(totalLength * assItem.unitCost * 100) / 100,
      category: assItem.category
    });
  }

  // Add escoramento if needed
  if (totalEscoramento > 0) {
    const escorItem = costBase.getItem('ESCOR-002');
    if (escorItem) {
      items.push({
        itemNum: itemNum++,
        code: 'ESCOR-002',
        description: escorItem.description,
        unit: escorItem.unit,
        quantity: Math.round(totalEscoramento * 100) / 100,
        unitCost: escorItem.unitCost,
        totalCost: Math.round(totalEscoramento * escorItem.unitCost * 100) / 100,
        category: escorItem.category
      });
    }
  }

  // Add pavimentacao
  const pavCodes: Record<TipoPavimento, string> = {
    [TipoPavimento.ASFALTO]: 'PAV-001',
    [TipoPavimento.PARALELEPIPEDO]: 'PAV-002',
    [TipoPavimento.CONCRETO]: 'PAV-003',
    [TipoPavimento.CALCADA]: 'PAV-004',
    [TipoPavimento.TERRA]: ''
  };
  const pavCode = pavCodes[tipoPavimento];
  if (pavCode && totalPavimento > 0) {
    const pavItem = costBase.getItem(pavCode);
    if (pavItem) {
      items.push({
        itemNum: itemNum++,
        code: pavCode,
        description: pavItem.description,
        unit: pavItem.unit,
        quantity: Math.round(totalPavimento * 100) / 100,
        unitCost: pavItem.unitCost,
        totalCost: Math.round(totalPavimento * pavItem.unitCost * 100) / 100,
        category: pavItem.category
      });
    }
  }

  // Add bota-fora
  const botaItem = costBase.getItem('OUT-001');
  if (botaItem && totalBotaFora > 0) {
    items.push({
      itemNum: itemNum++,
      code: 'OUT-001',
      description: botaItem.description,
      unit: botaItem.unit,
      quantity: Math.round(totalBotaFora * 100) / 100,
      unitCost: botaItem.unitCost,
      totalCost: Math.round(totalBotaFora * botaItem.unitCost * 100) / 100,
      category: botaItem.category
    });
  }

  // Add PVs if requested
  if (incluirPVs) {
    const numPVs = Math.ceil(totalLength / 80) + 1; // ~1 PV every 80m + endpoints
    const pvItem = costBase.getItem('PV-002');
    if (pvItem) {
      items.push({
        itemNum: itemNum++,
        code: 'PV-002',
        description: pvItem.description,
        unit: pvItem.unit,
        quantity: numPVs,
        unitCost: pvItem.unitCost,
        totalCost: numPVs * pvItem.unitCost,
        category: pvItem.category
      });
    }
  }

  // Add tests if requested
  if (incluirTestes && totalLength > 0) {
    const testItem = costBase.getItem('TST-001');
    if (testItem) {
      items.push({
        itemNum: itemNum++,
        code: 'TST-001',
        description: testItem.description,
        unit: testItem.unit,
        quantity: Math.round(totalLength * 100) / 100,
        unitCost: testItem.unitCost,
        totalCost: Math.round(totalLength * testItem.unitCost * 100) / 100,
        category: testItem.category
      });
    }
  }

  // Add mobilization if requested
  if (incluirMobilizacao) {
    const mobItem = costBase.getItem('OUT-003');
    if (mobItem) {
      items.push({
        itemNum: itemNum++,
        code: 'OUT-003',
        description: mobItem.description,
        unit: mobItem.unit,
        quantity: 1,
        unitCost: mobItem.unitCost,
        totalCost: mobItem.unitCost,
        category: mobItem.category
      });
    }
  }

  // Calculate totals by category
  const totalByCategory: Record<string, number> = {};
  let subtotal = 0;

  for (const item of items) {
    if (!totalByCategory[item.category]) {
      totalByCategory[item.category] = 0;
    }
    totalByCategory[item.category] += item.totalCost;
    subtotal += item.totalCost;
  }

  // Apply BDI
  const bdiValue = subtotal * (bdi / 100);
  const grandTotal = subtotal + bdiValue;

  // Add BDI as a line item
  if (bdi > 0) {
    items.push({
      itemNum: itemNum++,
      code: 'BDI',
      description: `BDI (${bdi}%)`,
      unit: 'vb',
      quantity: 1,
      unitCost: bdiValue,
      totalCost: bdiValue,
      category: 'BDI'
    });
    totalByCategory['BDI'] = bdiValue;
  }

  return {
    items,
    totalByCategory,
    grandTotal: Math.round(grandTotal * 100) / 100,
    totalLength: Math.round(totalLength * 100) / 100,
    costPerMeter: totalLength > 0 ? Math.round((grandTotal / totalLength) * 100) / 100 : 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Export budget to CSV format.
 */
export function exportBudgetToCSV(budget: BudgetSummary, delimiter = ';'): string {
  const headers = ['Item', 'Codigo', 'Descricao', 'Unidade', 'Quantidade', 'Preco Unitario', 'Total', 'Categoria'];
  const rows = budget.items.map(item => [
    item.itemNum,
    item.code,
    item.description,
    item.unit,
    item.quantity.toFixed(2),
    item.unitCost.toFixed(2),
    item.totalCost.toFixed(2),
    item.category
  ].join(delimiter));

  const summaryRows = [
    '',
    ['', '', '', '', '', 'TOTAL GERAL', budget.grandTotal.toFixed(2), ''].join(delimiter),
    ['', '', '', '', '', 'Extensao Total (m)', budget.totalLength.toFixed(2), ''].join(delimiter),
    ['', '', '', '', '', 'Custo por Metro (R$/m)', budget.costPerMeter.toFixed(2), ''].join(delimiter)
  ];

  return [headers.join(delimiter), ...rows, ...summaryRows].join('\n');
}

// Create default cost base instance
export const defaultCostBase = new CostBase();

/**
 * Generate budget from trechos using default cost base.
 * This is a convenience function for quick budget generation.
 */
export function generateBudgetFromTrechos(
  trechos: Trecho[],
  options: BudgetOptions = {}
): BudgetSummary {
  return calculateBudget(trechos, defaultCostBase, options);
}
