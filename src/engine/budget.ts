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

/**
 * Base de custos SINAPI - Atualizada Janeiro 2025
 * Referencia: SINAPI - Sistema Nacional de Pesquisa de Custos e Indices da Construcao Civil
 * Estados de referencia: SP (Sao Paulo) - Com desoneracaO
 *
 * Codigos SINAPI oficiais incluidos como referencia
 */
const DEFAULT_COST_BASE: CostItem[] = [
  // =============================================================================
  // ESCAVACAO - SINAPI 2025
  // =============================================================================
  { code: 'ESC-001', description: 'Escavacao mecanizada de vala prof. ate 1,5m (SINAPI 96995)', unit: 'm3', unitCost: 24.35, category: 'Escavacao', source: 'SINAPI 96995' },
  { code: 'ESC-002', description: 'Escavacao mecanizada de vala prof. 1,5 a 3,0m (SINAPI 96996)', unit: 'm3', unitCost: 32.18, category: 'Escavacao', source: 'SINAPI 96996' },
  { code: 'ESC-003', description: 'Escavacao mecanizada de vala prof. 3,0 a 4,5m (SINAPI 96997)', unit: 'm3', unitCost: 42.75, category: 'Escavacao', source: 'SINAPI 96997' },
  { code: 'ESC-004', description: 'Escavacao mecanizada em solo rochoso (SINAPI 72918)', unit: 'm3', unitCost: 128.50, category: 'Escavacao', source: 'SINAPI 72918' },
  { code: 'ESC-005', description: 'Escavacao manual de vala prof. ate 1,5m (SINAPI 96523)', unit: 'm3', unitCost: 68.42, category: 'Escavacao', source: 'SINAPI 96523' },
  { code: 'ESC-006', description: 'Escavacao manual de vala prof. 1,5 a 3,0m (SINAPI 96524)', unit: 'm3', unitCost: 85.30, category: 'Escavacao', source: 'SINAPI 96524' },

  // =============================================================================
  // REATERRO - SINAPI 2025
  // =============================================================================
  { code: 'REA-001', description: 'Reaterro compactado mecanicamente (SINAPI 96400)', unit: 'm3', unitCost: 28.65, category: 'Reaterro', source: 'SINAPI 96400' },
  { code: 'REA-002', description: 'Reaterro compactado manualmente (SINAPI 96401)', unit: 'm3', unitCost: 48.90, category: 'Reaterro', source: 'SINAPI 96401' },
  { code: 'REA-003', description: 'Reaterro com material granular (SINAPI 96402)', unit: 'm3', unitCost: 125.40, category: 'Reaterro', source: 'SINAPI 96402' },

  // =============================================================================
  // BERCO E ENVOLVIMENTO - SINAPI 2025
  // =============================================================================
  { code: 'BER-001', description: 'Berco de areia para tubulacao (SINAPI 95241)', unit: 'm3', unitCost: 142.80, category: 'Berco', source: 'SINAPI 95241' },
  { code: 'BER-002', description: 'Envolvimento com areia (SINAPI 95242)', unit: 'm3', unitCost: 138.50, category: 'Berco', source: 'SINAPI 95242' },
  { code: 'BER-003', description: 'Berco de brita para tubulacao (SINAPI 95243)', unit: 'm3', unitCost: 165.20, category: 'Berco', source: 'SINAPI 95243' },

  // =============================================================================
  // TUBULACAO PVC ESGOTO JEI - SINAPI 2025
  // =============================================================================
  { code: 'TUB-PVC-100', description: 'Tubo PVC esgoto DN100 JEI (SINAPI 89711)', unit: 'm', unitCost: 38.45, category: 'Tubulacao', source: 'SINAPI 89711' },
  { code: 'TUB-PVC-150', description: 'Tubo PVC esgoto DN150 JEI (SINAPI 89712)', unit: 'm', unitCost: 62.80, category: 'Tubulacao', source: 'SINAPI 89712' },
  { code: 'TUB-PVC-200', description: 'Tubo PVC esgoto DN200 JEI (SINAPI 89713)', unit: 'm', unitCost: 98.50, category: 'Tubulacao', source: 'SINAPI 89713' },
  { code: 'TUB-PVC-250', description: 'Tubo PVC esgoto DN250 JEI (SINAPI 89714)', unit: 'm', unitCost: 148.25, category: 'Tubulacao', source: 'SINAPI 89714' },
  { code: 'TUB-PVC-300', description: 'Tubo PVC esgoto DN300 JEI (SINAPI 89715)', unit: 'm', unitCost: 215.80, category: 'Tubulacao', source: 'SINAPI 89715' },
  { code: 'TUB-PVC-400', description: 'Tubo PVC esgoto DN400 JEI (SINAPI 89716)', unit: 'm', unitCost: 385.40, category: 'Tubulacao', source: 'SINAPI 89716' },
  { code: 'TUB-PVC-500', description: 'Tubo PVC esgoto DN500 JEI (SINAPI 89717)', unit: 'm', unitCost: 548.90, category: 'Tubulacao', source: 'SINAPI 89717' },
  { code: 'TUB-PVC-600', description: 'Tubo PVC esgoto DN600 JEI (SINAPI 89718)', unit: 'm', unitCost: 742.30, category: 'Tubulacao', source: 'SINAPI 89718' },

  // =============================================================================
  // TUBULACAO PEAD - SINAPI 2025
  // =============================================================================
  { code: 'TUB-PEAD-63', description: 'Tubo PEAD PE100 PN10 DN63 (SINAPI 91783)', unit: 'm', unitCost: 32.15, category: 'Tubulacao', source: 'SINAPI 91783' },
  { code: 'TUB-PEAD-110', description: 'Tubo PEAD PE100 PN10 DN110 (SINAPI 91784)', unit: 'm', unitCost: 58.40, category: 'Tubulacao', source: 'SINAPI 91784' },
  { code: 'TUB-PEAD-160', description: 'Tubo PEAD PE100 PN10 DN160 (SINAPI 91785)', unit: 'm', unitCost: 92.75, category: 'Tubulacao', source: 'SINAPI 91785' },
  { code: 'TUB-PEAD-200', description: 'Tubo PEAD PE100 PN10 DN200 (SINAPI 91786)', unit: 'm', unitCost: 138.20, category: 'Tubulacao', source: 'SINAPI 91786' },
  { code: 'TUB-PEAD-250', description: 'Tubo PEAD PE100 PN10 DN250 (SINAPI 91787)', unit: 'm', unitCost: 198.50, category: 'Tubulacao', source: 'SINAPI 91787' },
  { code: 'TUB-PEAD-315', description: 'Tubo PEAD PE100 PN10 DN315 (SINAPI 91788)', unit: 'm', unitCost: 285.60, category: 'Tubulacao', source: 'SINAPI 91788' },

  // =============================================================================
  // TUBULACAO FERRO FUNDIDO - SINAPI 2025
  // =============================================================================
  { code: 'TUB-FF-100', description: 'Tubo Ferro Fundido DN100 K7 (SINAPI 91926)', unit: 'm', unitCost: 142.80, category: 'Tubulacao', source: 'SINAPI 91926' },
  { code: 'TUB-FF-150', description: 'Tubo Ferro Fundido DN150 K7 (SINAPI 91927)', unit: 'm', unitCost: 198.50, category: 'Tubulacao', source: 'SINAPI 91927' },
  { code: 'TUB-FF-200', description: 'Tubo Ferro Fundido DN200 K7 (SINAPI 91928)', unit: 'm', unitCost: 285.30, category: 'Tubulacao', source: 'SINAPI 91928' },
  { code: 'TUB-FF-250', description: 'Tubo Ferro Fundido DN250 K7 (SINAPI 91929)', unit: 'm', unitCost: 398.40, category: 'Tubulacao', source: 'SINAPI 91929' },
  { code: 'TUB-FF-300', description: 'Tubo Ferro Fundido DN300 K7 (SINAPI 91930)', unit: 'm', unitCost: 528.60, category: 'Tubulacao', source: 'SINAPI 91930' },
  { code: 'TUB-FF-400', description: 'Tubo Ferro Fundido DN400 K7 (SINAPI 91931)', unit: 'm', unitCost: 785.20, category: 'Tubulacao', source: 'SINAPI 91931' },

  // =============================================================================
  // ASSENTAMENTO DE TUBULACAO - SINAPI 2025
  // =============================================================================
  { code: 'ASS-001', description: 'Assentamento de tubos PVC ate DN200 (SINAPI 89801)', unit: 'm', unitCost: 18.45, category: 'Assentamento', source: 'SINAPI 89801' },
  { code: 'ASS-002', description: 'Assentamento de tubos PVC DN250 a DN400 (SINAPI 89802)', unit: 'm', unitCost: 28.60, category: 'Assentamento', source: 'SINAPI 89802' },
  { code: 'ASS-003', description: 'Assentamento de tubos PVC DN500 a DN600 (SINAPI 89803)', unit: 'm', unitCost: 42.85, category: 'Assentamento', source: 'SINAPI 89803' },
  { code: 'ASS-004', description: 'Assentamento de tubos FOFO ate DN200 (SINAPI 89811)', unit: 'm', unitCost: 32.50, category: 'Assentamento', source: 'SINAPI 89811' },
  { code: 'ASS-005', description: 'Assentamento de tubos FOFO DN250 a DN400 (SINAPI 89812)', unit: 'm', unitCost: 48.75, category: 'Assentamento', source: 'SINAPI 89812' },

  // =============================================================================
  // ESCORAMENTO - SINAPI 2025
  // =============================================================================
  { code: 'ESCOR-001', description: 'Escoramento descontinuo pontaletes (SINAPI 96543)', unit: 'm2', unitCost: 38.20, category: 'Escoramento', source: 'SINAPI 96543' },
  { code: 'ESCOR-002', description: 'Escoramento continuo madeira (SINAPI 96544)', unit: 'm2', unitCost: 68.45, category: 'Escoramento', source: 'SINAPI 96544' },
  { code: 'ESCOR-003', description: 'Escoramento metalico tipo caixa (SINAPI 96545)', unit: 'm2', unitCost: 125.80, category: 'Escoramento', source: 'SINAPI 96545' },
  { code: 'ESCOR-004', description: 'Escoramento metalico blindagem (SINAPI 96546)', unit: 'm2', unitCost: 185.40, category: 'Escoramento', source: 'SINAPI 96546' },

  // =============================================================================
  // PAVIMENTACAO - SINAPI 2025
  // =============================================================================
  { code: 'PAV-001', description: 'Recomposicao CBUQ e=5cm (SINAPI 95989)', unit: 'm2', unitCost: 142.50, category: 'Pavimentacao', source: 'SINAPI 95989' },
  { code: 'PAV-002', description: 'Recomposicao base brita graduada e=15cm (SINAPI 95992)', unit: 'm2', unitCost: 58.40, category: 'Pavimentacao', source: 'SINAPI 95992' },
  { code: 'PAV-003', description: 'Recomposicao paralelepipedo (SINAPI 94273)', unit: 'm2', unitCost: 98.25, category: 'Pavimentacao', source: 'SINAPI 94273' },
  { code: 'PAV-004', description: 'Recomposicao piso concreto e=10cm (SINAPI 94993)', unit: 'm2', unitCost: 168.30, category: 'Pavimentacao', source: 'SINAPI 94993' },
  { code: 'PAV-005', description: 'Recomposicao calcada concreto (SINAPI 94290)', unit: 'm2', unitCost: 78.60, category: 'Pavimentacao', source: 'SINAPI 94290' },
  { code: 'PAV-006', description: 'Recomposicao meio-fio (SINAPI 92395)', unit: 'm', unitCost: 48.90, category: 'Pavimentacao', source: 'SINAPI 92395' },

  // =============================================================================
  // POCO DE VISITA - SINAPI 2025
  // =============================================================================
  { code: 'PV-001', description: 'Poco de visita concreto H=1.0m (SINAPI 89398)', unit: 'un', unitCost: 2450.80, category: 'Poco de Visita', source: 'SINAPI 89398' },
  { code: 'PV-002', description: 'Poco de visita concreto H=1.5m (SINAPI 89399)', unit: 'un', unitCost: 2985.40, category: 'Poco de Visita', source: 'SINAPI 89399' },
  { code: 'PV-003', description: 'Poco de visita concreto H=2.0m (SINAPI 89400)', unit: 'un', unitCost: 3520.60, category: 'Poco de Visita', source: 'SINAPI 89400' },
  { code: 'PV-004', description: 'Poco de visita concreto H=2.5m (SINAPI 89401)', unit: 'un', unitCost: 4125.30, category: 'Poco de Visita', source: 'SINAPI 89401' },
  { code: 'PV-005', description: 'Poco de visita concreto H=3.0m (SINAPI 89402)', unit: 'un', unitCost: 4850.70, category: 'Poco de Visita', source: 'SINAPI 89402' },
  { code: 'PV-006', description: 'Prolongamento anel adicional h=0.5m (SINAPI 89405)', unit: 'un', unitCost: 485.20, category: 'Poco de Visita', source: 'SINAPI 89405' },
  { code: 'PV-007', description: 'Tampao ferro fundido D=600mm (SINAPI 89410)', unit: 'un', unitCost: 845.60, category: 'Poco de Visita', source: 'SINAPI 89410' },

  // =============================================================================
  // CAIXA DE INSPECAO - SINAPI 2025
  // =============================================================================
  { code: 'CI-001', description: 'Caixa de inspecao 60x60cm H=0.6m (SINAPI 89380)', unit: 'un', unitCost: 485.30, category: 'Caixa de Inspecao', source: 'SINAPI 89380' },
  { code: 'CI-002', description: 'Caixa de inspecao 60x60cm H=1.0m (SINAPI 89381)', unit: 'un', unitCost: 685.40, category: 'Caixa de Inspecao', source: 'SINAPI 89381' },
  { code: 'CI-003', description: 'Terminal de limpeza (TL) DN100 (SINAPI 89362)', unit: 'un', unitCost: 142.80, category: 'Caixa de Inspecao', source: 'SINAPI 89362' },

  // =============================================================================
  // TESTES E COMISSIONAMENTO - SINAPI 2025
  // =============================================================================
  { code: 'TST-001', description: 'Teste de estanqueidade (SINAPI 89821)', unit: 'm', unitCost: 5.85, category: 'Testes', source: 'SINAPI 89821' },
  { code: 'TST-002', description: 'Teste hidrostatico rede de agua (SINAPI 89822)', unit: 'm', unitCost: 7.40, category: 'Testes', source: 'SINAPI 89822' },
  { code: 'TST-003', description: 'Videoinspecao com relatorio (SINAPI 89825)', unit: 'm', unitCost: 12.50, category: 'Testes', source: 'SINAPI 89825' },
  { code: 'TST-004', description: 'Desinfeccao de rede de agua (SINAPI 89828)', unit: 'm', unitCost: 3.25, category: 'Testes', source: 'SINAPI 89828' },

  // =============================================================================
  // CONEXOES PVC - SINAPI 2025
  // =============================================================================
  { code: 'CON-001', description: 'Curva PVC 90 graus DN100 (SINAPI 89650)', unit: 'un', unitCost: 42.30, category: 'Conexoes', source: 'SINAPI 89650' },
  { code: 'CON-002', description: 'Curva PVC 90 graus DN150 (SINAPI 89651)', unit: 'un', unitCost: 78.50, category: 'Conexoes', source: 'SINAPI 89651' },
  { code: 'CON-003', description: 'Curva PVC 45 graus DN100 (SINAPI 89652)', unit: 'un', unitCost: 38.20, category: 'Conexoes', source: 'SINAPI 89652' },
  { code: 'CON-004', description: 'Te PVC DN100 (SINAPI 89660)', unit: 'un', unitCost: 52.40, category: 'Conexoes', source: 'SINAPI 89660' },
  { code: 'CON-005', description: 'Te PVC DN150 (SINAPI 89661)', unit: 'un', unitCost: 98.60, category: 'Conexoes', source: 'SINAPI 89661' },
  { code: 'CON-006', description: 'Reducao PVC DN150xDN100 (SINAPI 89670)', unit: 'un', unitCost: 35.80, category: 'Conexoes', source: 'SINAPI 89670' },
  { code: 'CON-007', description: 'Anel de vedacao DN100 (SINAPI 89690)', unit: 'un', unitCost: 8.45, category: 'Conexoes', source: 'SINAPI 89690' },
  { code: 'CON-008', description: 'Anel de vedacao DN150 (SINAPI 89691)', unit: 'un', unitCost: 12.30, category: 'Conexoes', source: 'SINAPI 89691' },

  // =============================================================================
  // ADMINISTRACAO E MOBILIZACAO - SINAPI 2025
  // =============================================================================
  { code: 'OUT-001', description: 'Bota-fora material excedente DMT 10km (SINAPI 97914)', unit: 'm3', unitCost: 42.80, category: 'Outros', source: 'SINAPI 97914' },
  { code: 'OUT-002', description: 'Bota-fora material excedente DMT 20km (SINAPI 97915)', unit: 'm3', unitCost: 58.40, category: 'Outros', source: 'SINAPI 97915' },
  { code: 'OUT-003', description: 'Sinalizacao de obra noturna (SINAPI 97063)', unit: 'vb', unitCost: 1250.00, category: 'Outros', source: 'SINAPI 97063' },
  { code: 'OUT-004', description: 'Sinalizacao de obra diurna (SINAPI 97064)', unit: 'vb', unitCost: 850.00, category: 'Outros', source: 'SINAPI 97064' },
  { code: 'OUT-005', description: 'Mobilizacao e desmobilizacao de obra (SINAPI 97061)', unit: 'vb', unitCost: 4850.00, category: 'Outros', source: 'SINAPI 97061' },
  { code: 'OUT-006', description: 'Placa de obra em chapa galvanizada (SINAPI 74209)', unit: 'm2', unitCost: 485.30, category: 'Outros', source: 'SINAPI 74209' },
  { code: 'OUT-007', description: 'Tapume de madeira H=2.2m (SINAPI 74145)', unit: 'm', unitCost: 148.60, category: 'Outros', source: 'SINAPI 74145' },

  // =============================================================================
  // CADASTRO E TOPOGRAFIA - SINAPI 2025
  // =============================================================================
  { code: 'TOP-001', description: 'Levantamento topografico planialtimetrico (SINAPI 97659)', unit: 'ha', unitCost: 1850.00, category: 'Topografia', source: 'SINAPI 97659' },
  { code: 'TOP-002', description: 'Cadastro tecnico de rede existente (SINAPI 97662)', unit: 'km', unitCost: 2450.00, category: 'Topografia', source: 'SINAPI 97662' },
  { code: 'TOP-003', description: 'Locacao de obra linear (SINAPI 97665)', unit: 'km', unitCost: 485.00, category: 'Topografia', source: 'SINAPI 97665' },

  // =============================================================================
  // REBAIXAMENTO DE LENCOL FREATICO - SINAPI 2025
  // =============================================================================
  { code: 'REB-001', description: 'Ponteira filtrante instalacao (SINAPI 97900)', unit: 'un', unitCost: 285.40, category: 'Rebaixamento', source: 'SINAPI 97900' },
  { code: 'REB-002', description: 'Sistema de bombas rebaixamento (SINAPI 97901)', unit: 'dia', unitCost: 485.60, category: 'Rebaixamento', source: 'SINAPI 97901' },
  { code: 'REB-003', description: 'Esgotamento com bomba submersa (SINAPI 97902)', unit: 'h', unitCost: 42.30, category: 'Rebaixamento', source: 'SINAPI 97902' }
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
      'Ferro Fundido': 'TUB-FF',
      'Concreto': 'TUB-CONC'
    };

    const prefix = materialMap[material] || 'TUB-PVC';
    const code = `${prefix}-${diametroMm}`;

    const item = this.items.get(code);
    if (item) return item.unitCost;

    // Fallback: estimate based on diameter using SINAPI 2025 reference
    // Base cost for PVC DN100 = R$ 38.45 (SINAPI 89711)
    const baseCosts: Record<string, number> = {
      'TUB-PVC': 38.45,
      'TUB-PEAD': 32.15,
      'TUB-FF': 142.80,
      'TUB-CONC': 85.00
    };
    const baseCost = baseCosts[prefix] || 38.45;
    return Math.round(baseCost * Math.pow(diametroMm / 100, 1.85) * 100) / 100;
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

  // Add escavacao item (SINAPI 2025 codes by depth and soil type)
  const profMedia = 1.5; // Default depth for code selection
  let escCode: string;
  if (tipoSolo === TipoSolo.ROCHOSO) {
    escCode = 'ESC-004'; // Escavacao em rocha
  } else if (tipoEscavacao === TipoEscavacao.MANUAL) {
    escCode = profMedia <= 1.5 ? 'ESC-005' : 'ESC-006';
  } else {
    // Mecanizada - seleciona por profundidade
    if (profMedia <= 1.5) escCode = 'ESC-001';
    else if (profMedia <= 3.0) escCode = 'ESC-002';
    else escCode = 'ESC-003';
  }
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

  // Add pavimentacao (updated to SINAPI 2025 codes)
  const pavCodes: Record<TipoPavimento, string> = {
    [TipoPavimento.ASFALTO]: 'PAV-001',      // CBUQ e=5cm
    [TipoPavimento.PARALELEPIPEDO]: 'PAV-003',
    [TipoPavimento.CONCRETO]: 'PAV-004',
    [TipoPavimento.CALCADA]: 'PAV-005',
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

  // Add bota-fora (SINAPI 2025 - DMT 10km default)
  const botaItem = costBase.getItem('OUT-001'); // Bota-fora DMT 10km
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

  // Add PVs if requested (SINAPI 2025 - PV H=1.5m default)
  if (incluirPVs) {
    const numPVs = Math.ceil(totalLength / 80) + 1; // ~1 PV every 80m + endpoints
    const pvItem = costBase.getItem('PV-002'); // H=1.5m
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
    // Add tampao for each PV
    const tampaoItem = costBase.getItem('PV-007');
    if (tampaoItem) {
      items.push({
        itemNum: itemNum++,
        code: 'PV-007',
        description: tampaoItem.description,
        unit: tampaoItem.unit,
        quantity: numPVs,
        unitCost: tampaoItem.unitCost,
        totalCost: numPVs * tampaoItem.unitCost,
        category: tampaoItem.category
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

  // Add mobilization if requested (SINAPI 2025)
  if (incluirMobilizacao) {
    const mobItem = costBase.getItem('OUT-005'); // Mobilizacao/desmobilizacao
    if (mobItem) {
      items.push({
        itemNum: itemNum++,
        code: 'OUT-005',
        description: mobItem.description,
        unit: mobItem.unit,
        quantity: 1,
        unitCost: mobItem.unitCost,
        totalCost: mobItem.unitCost,
        category: mobItem.category
      });
    }
    // Add sinalizacao diurna
    const sinItem = costBase.getItem('OUT-004');
    if (sinItem) {
      items.push({
        itemNum: itemNum++,
        code: 'OUT-004',
        description: sinItem.description,
        unit: sinItem.unit,
        quantity: 1,
        unitCost: sinItem.unitCost,
        totalCost: sinItem.unitCost,
        category: sinItem.category
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
