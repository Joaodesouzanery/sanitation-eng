/**
 * Constantes e parametros de engenharia para calculos hidraulicos.
 *
 * PADRONIZADO COM: hydro_network/core/constants.py
 *
 * LEGENDA DE NOMENCLATURAS:
 * ========================
 * HIDRAULICA GERAL:
 *     Q       = Vazao (m3/s ou L/s)
 *     V       = Velocidade (m/s)
 *     D, DN   = Diametro nominal (mm ou m)
 *     S       = Declividade (m/m)
 *     n       = Coeficiente de Manning
 *     C       = Coeficiente de Hazen-Williams
 *     H       = Carga hidraulica / Head (m)
 *     hf      = Perda de carga (m)
 *
 * ESGOTO:
 *     Qm      = Vazao media (L/s)
 *     Qp      = Vazao de pico (L/s)
 *     Qinf    = Vazao de infiltracao (L/s)
 *     Kp      = Coeficiente de pico
 *     y/D     = Relacao lamina/diametro
 *
 * AGUA:
 *     Qmd     = Vazao media diaria (L/s)
 *     Qmh     = Vazao maxima horaria (L/s)
 *     Pmin    = Pressao minima (mca)
 *     Pmax    = Pressao maxima (mca)
 *     K1      = Coeficiente do dia de maior consumo
 *     K2      = Coeficiente da hora de maior consumo
 *
 * DRENAGEM:
 *     A       = Area de contribuicao (ha)
 *     Cr      = Coeficiente de runoff
 *     i       = Intensidade de chuva (mm/h)
 *     tc      = Tempo de concentracao (min)
 *     T       = Periodo de retorno (anos)
 *
 * CONSTRUCAO:
 *     EXC     = Escavacao (m3)
 *     SHOR    = Escoramento (m2)
 *     BED     = Berco (m3)
 *     ENV     = Envoltoria (m3)
 *     BFILL   = Reaterro (backfill) (m3)
 *     WASTE   = Bota-fora (m3)
 */

// =============================================================================
// CONSTANTES FISICAS
// =============================================================================
export const GRAVITY = 9.81;  // m/s2
export const WATER_DENSITY = 1000;  // kg/m3
export const PI = Math.PI;

// =============================================================================
// ESGOTO - PARAMETROS PADRAO (ABNT NBR 9649)
// =============================================================================
export const SewerDefaults = {
  // Contribuicoes
  QPC: 200,  // Consumo per capita (L/hab.dia)
  HAB_POR_UH: 3.5,  // Habitantes por unidade habitacional
  COEF_RETORNO: 0.8,  // Coeficiente de retorno esgoto/agua

  // Infiltracao
  TAXA_INFILTRACAO: 0.0005,  // L/s por metro de rede (0.5 L/s.km)

  // Hidraulica
  MANNING_N: 0.013,  // PVC/Concreto liso
  S_MIN: 0.005,  // Declividade minima (0.5%)
  S_MAX: 0.15,  // Declividade maxima (15%)
  V_MIN: 0.6,  // Velocidade minima (m/s)
  V_MAX: 5.0,  // Velocidade maxima (m/s)
  YD_MIN: 0.2,  // Lamina minima (y/D)
  YD_MAX: 0.75,  // Lamina maxima (y/D)

  // Cobertura
  COBERTURA_MIN: 0.90,  // Cobertura minima sobre o tubo (m)
  COBERTURA_MAX: 6.0,  // Cobertura maxima (m)

  // Diametros comerciais (mm)
  DN_COMERCIAIS: [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1200],
  DN_MIN: 150,  // Diametro minimo (mm)

  // Fator de pico (Harmon)
  fatorPicoHarmon: (popMilhares: number): number => {
    if (popMilhares <= 0) return 4.0;
    return 1 + 14 / (4 + Math.sqrt(popMilhares));
  }
} as const;

// =============================================================================
// AGUA - PARAMETROS PADRAO (ABNT NBR 12218)
// =============================================================================
export const WaterDefaults = {
  // Demandas
  QPC: 200,  // Consumo per capita (L/hab.dia)
  HAB_POR_UH: 3.5,  // Habitantes por unidade habitacional
  K1: 1.2,  // Coeficiente do dia de maior consumo
  K2: 1.5,  // Coeficiente da hora de maior consumo

  // Pressoes
  P_MIN: 10.0,  // Pressao minima (mca)
  P_MAX: 50.0,  // Pressao maxima (mca)
  P_ESTATICA_MAX: 50.0,  // Pressao estatica maxima (mca)

  // Hidraulica
  HAZEN_WILLIAMS_C: 140,  // PVC
  V_MIN: 0.5,  // Velocidade minima (m/s)
  V_MAX: 3.5,  // Velocidade maxima (m/s)

  // Diametros comerciais (mm)
  DN_COMERCIAIS: [50, 75, 100, 150, 200, 250, 300, 400, 500, 600],
  DN_MIN: 50,  // Diametro minimo (mm)

  // Bombeamento
  RENDIMENTO_BOMBA: 0.75  // Rendimento tipico
} as const;

// =============================================================================
// DRENAGEM - PARAMETROS PADRAO
// =============================================================================
export const DrainageDefaults = {
  // Metodo racional
  PERIODO_RETORNO: 10,  // anos

  // Coeficientes de runoff tipicos
  COEF_RUNOFF: {
    telhado: 0.95,
    asfalto: 0.90,
    concreto: 0.85,
    paralelepipedo: 0.75,
    solo_compactado: 0.60,
    grama: 0.25,
    area_verde: 0.15,
    misto_urbano: 0.70
  } as Record<string, number>,

  // Hidraulica (Manning)
  MANNING_N_CONCRETO: 0.015,
  MANNING_N_PEAD: 0.012,

  // Limites
  V_MIN: 0.75,  // Velocidade minima (m/s)
  V_MAX: 5.0,  // Velocidade maxima (m/s)
  S_MIN: 0.005,  // Declividade minima
  YD_MAX: 0.85,  // Lamina maxima (y/D)

  // Diametros comerciais (mm)
  DN_COMERCIAIS: [300, 400, 500, 600, 800, 1000, 1200, 1500, 2000],
  DN_MIN: 300  // Diametro minimo (mm)
} as const;

// =============================================================================
// CONSTRUCAO - PARAMETROS PADRAO
// =============================================================================
export const ConstructionDefaults = {
  // Geometria da vala
  LARGURA_MINIMA_VALA: 0.60,  // m
  FOLGA_LATERAL: 0.15,  // m de cada lado do tubo
  TALUDE_PADRAO: 0,  // Vertical (0 = sem talude, 1:1 = 45)

  // Escoramento
  PROF_ESCORAMENTO: 1.25,  // Profundidade a partir da qual e obrigatorio

  // Camadas
  ESPESSURA_BERCO: 0.10,  // m
  ESPESSURA_ENVOLTORIA: 0.30,  // m acima do tubo

  // Pavimento
  FAIXA_TECNICA: 0.30,  // m de cada lado da vala
  ESP_SUBBASE: 0.20,  // m
  ESP_BASE: 0.15,  // m
  ESP_ASFALTO: 0.05,  // m (CBUQ)

  // Fatores
  FATOR_EMPOLAMENTO: 1.25  // Expansao do solo escavado
} as const;

// =============================================================================
// MATERIAIS - COEFICIENTES
// =============================================================================
export const MANNING_N: Record<string, number> = {
  pvc: 0.010,
  pead: 0.012,
  concreto_liso: 0.013,
  concreto_rugoso: 0.016,
  ferro_fundido: 0.015,
  aco: 0.012,
  ceramica: 0.014
};

export const HAZEN_WILLIAMS_C: Record<string, number> = {
  pvc: 140,
  pead: 140,
  ferro_fundido_novo: 130,
  ferro_fundido_usado: 100,
  aco_novo: 120,
  aco_usado: 90,
  concreto: 120,
  cimento_amianto: 140
};

// =============================================================================
// IDF - INTENSIDADE-DURACAO-FREQUENCIA (SAO PAULO)
// =============================================================================
export const IDFSaoPaulo = {
  K: 3462.6,
  a: 0.172,
  b: 20,
  c: 1.025,

  /**
   * Calcula intensidade de chuva em mm/h.
   * @param T - Periodo de retorno (anos)
   * @param t - Duracao (minutos)
   */
  intensidade: (T: number, t: number): number => {
    return IDFSaoPaulo.K * Math.pow(T, IDFSaoPaulo.a) / Math.pow(t + IDFSaoPaulo.b, IDFSaoPaulo.c);
  }
};

// =============================================================================
// SISTEMAS DE COORDENADAS BRASILEIROS
// =============================================================================
export const CRS_DEFINITIONS = {
  WGS84: 'EPSG:4326',
  SIRGAS_2000: 'EPSG:4674',
  UTM_22S: 'EPSG:31982',
  UTM_23S: 'EPSG:31983',
  UTM_24S: 'EPSG:31984',
  UTM_25S: 'EPSG:31985'
} as const;

// Zona UTM por faixa de longitude (Brasil)
export const UTM_ZONES: Record<string, { zone: number; epsg: number }> = {
  '-54_-48': { zone: 22, epsg: 31982 },
  '-48_-42': { zone: 23, epsg: 31983 },
  '-42_-36': { zone: 24, epsg: 31984 },
  '-36_-30': { zone: 25, epsg: 31985 }
};

/**
 * Determina a zona UTM baseada na longitude.
 */
export function getUTMZone(longitude: number): { zone: number; epsg: number } {
  if (longitude >= -54 && longitude < -48) return { zone: 22, epsg: 31982 };
  if (longitude >= -48 && longitude < -42) return { zone: 23, epsg: 31983 };
  if (longitude >= -42 && longitude < -36) return { zone: 24, epsg: 31984 };
  if (longitude >= -36 && longitude < -30) return { zone: 25, epsg: 31985 };
  return { zone: 23, epsg: 31983 }; // Default: Sao Paulo
}

// =============================================================================
// NOMENCLATURA PARA CAMPOS SHP (max 10 caracteres)
// =============================================================================
export const SHP_FIELD_NAMES: Record<string, string> = {
  // Identificacao
  id: 'ID',
  from_node: 'FROM_ND',
  to_node: 'TO_ND',
  network_type: 'NET_TYPE',

  // Geometria
  length: 'LENGTH_M',
  diameter: 'DN_MM',
  slope: 'SLOPE',

  // Hidraulica - Esgoto
  flow: 'Q_LS',
  velocity: 'V_MS',
  y_d_ratio: 'YD_RATIO',
  invert_up: 'INV_UP_M',
  invert_down: 'INV_DN_M',
  cover_up: 'COV_UP_M',
  cover_down: 'COV_DN_M',

  // Hidraulica - Agua
  pressure: 'PRESS_M',
  head: 'HEAD_M',
  headloss: 'HLOSS_M',

  // Hidraulica - Drenagem
  area_contrib: 'AREA_HA',
  runoff_coef: 'RUNOFF_C',
  intensity: 'I_MMH',

  // Construcao
  excavation: 'EXC_M3',
  shoring: 'SHOR_M2',
  bedding: 'BED_M3',
  envelope: 'ENV_M3',
  backfill: 'BFILL_M3',
  waste: 'WASTE_M3',
  subbase: 'SUBB_M3',
  base: 'BASE_M3',
  asphalt: 'ASPH_M3',
  pavement_area: 'PAV_M2',

  // Validacao
  status: 'STATUS',
  alerts: 'ALERTS',

  // Nos
  elevation: 'ELEV_M',
  ground_elev: 'GND_M',
  demand: 'DEM_LS',
  population: 'POP'
};

// =============================================================================
// LEGENDAS PARA WEBMAP E RELATORIOS
// =============================================================================
export const FIELD_LEGENDS: Record<string, string> = {
  ID: 'Identificador unico do elemento',
  FROM_ND: 'No de montante (inicio)',
  TO_ND: 'No de jusante (fim)',
  NET_TYPE: 'Tipo de rede: SEW=Esgoto, WAT=Agua, DRN=Drenagem',
  LENGTH_M: 'Comprimento do trecho (m)',
  DN_MM: 'Diametro nominal (mm)',
  SLOPE: 'Declividade (m/m)',
  Q_LS: 'Vazao (L/s)',
  V_MS: 'Velocidade (m/s)',
  YD_RATIO: 'Relacao lamina/diametro (y/D)',
  INV_UP_M: 'Cota de fundo montante (m)',
  INV_DN_M: 'Cota de fundo jusante (m)',
  COV_UP_M: 'Cobertura montante (m)',
  COV_DN_M: 'Cobertura jusante (m)',
  PRESS_M: 'Pressao no no (mca)',
  HEAD_M: 'Carga hidraulica (m)',
  HLOSS_M: 'Perda de carga (m)',
  AREA_HA: 'Area de contribuicao (ha)',
  RUNOFF_C: 'Coeficiente de escoamento',
  I_MMH: 'Intensidade de chuva (mm/h)',
  EXC_M3: 'Volume de escavacao (m3)',
  SHOR_M2: 'Area de escoramento (m2)',
  BED_M3: 'Volume do berco (m3)',
  ENV_M3: 'Volume da envoltoria (m3)',
  BFILL_M3: 'Volume de reaterro (m3)',
  WASTE_M3: 'Volume de bota-fora (m3)',
  SUBB_M3: 'Volume de sub-base (m3)',
  BASE_M3: 'Volume de base (m3)',
  ASPH_M3: 'Volume de asfalto CBUQ (m3)',
  PAV_M2: 'Area de recomposicao de pavimento (m2)',
  STATUS: 'Status da verificacao: OK, WARN, ERROR',
  ALERTS: 'Alertas e violacoes normativas',
  ELEV_M: 'Cota do no (m)',
  GND_M: 'Cota do terreno (m)',
  DEM_LS: 'Demanda no no (L/s)',
  POP: 'Populacao contribuinte'
};

// =============================================================================
// CORES PADRÃO PARA VISUALIZAÇÃO
// =============================================================================
export const NETWORK_COLORS = {
  sewer: {
    primary: '#8B4513',  // Marrom
    gravity: '#22c55e',  // Verde
    pumped: '#f59e0b'    // Amarelo
  },
  water: {
    primary: '#2196F3',  // Azul
    main: '#1976D2',
    distribution: '#64B5F6'
  },
  drainage: {
    primary: '#4CAF50',  // Verde
    channel: '#2E7D32',
    pipe: '#81C784'
  },
  status: {
    ok: '#22c55e',
    warn: '#f59e0b',
    error: '#ef4444'
  },
  progress: {
    completed: '#28a745',
    almostDone: '#20c997',
    inProgress: '#ffc107',
    started: '#fd7e14',
    notStarted: '#dc3545'
  }
} as const;

// =============================================================================
// DIAMETROS NOMINAIS PADRÃO
// =============================================================================
export const DN_OPTIONS = {
  sewer: [
    { value: 100, label: 'DN 100' },
    { value: 150, label: 'DN 150' },
    { value: 200, label: 'DN 200' },
    { value: 250, label: 'DN 250' },
    { value: 300, label: 'DN 300' },
    { value: 400, label: 'DN 400' },
    { value: 500, label: 'DN 500' },
    { value: 600, label: 'DN 600' }
  ],
  water: [
    { value: 50, label: 'DN 50' },
    { value: 75, label: 'DN 75' },
    { value: 100, label: 'DN 100' },
    { value: 150, label: 'DN 150' },
    { value: 200, label: 'DN 200' },
    { value: 250, label: 'DN 250' },
    { value: 300, label: 'DN 300' },
    { value: 400, label: 'DN 400' }
  ],
  drainage: [
    { value: 300, label: 'DN 300' },
    { value: 400, label: 'DN 400' },
    { value: 500, label: 'DN 500' },
    { value: 600, label: 'DN 600' },
    { value: 800, label: 'DN 800' },
    { value: 1000, label: 'DN 1000' },
    { value: 1200, label: 'DN 1200' },
    { value: 1500, label: 'DN 1500' }
  ]
} as const;

// =============================================================================
// MATERIAIS DISPONÍVEIS
// =============================================================================
export const MATERIAL_OPTIONS = [
  { value: 'PVC', label: 'PVC', manning: 0.010, hazenWilliams: 140 },
  { value: 'PEAD', label: 'PEAD', manning: 0.012, hazenWilliams: 140 },
  { value: 'FOFO', label: 'Ferro Fundido', manning: 0.015, hazenWilliams: 130 },
  { value: 'Concreto', label: 'Concreto', manning: 0.013, hazenWilliams: 120 },
  { value: 'Ceramico', label: 'Ceramico', manning: 0.014, hazenWilliams: 110 }
] as const;

// =============================================================================
// DEFAULT VALUES
// =============================================================================
export const DEFAULT_DIAMETRO_MM = 200;
export const DEFAULT_MATERIAL = 'PVC';
export const DEFAULT_PROFUNDIDADE = 1.5;
export const DEFAULT_METROS_POR_DIA = 50;
export const DEFAULT_BDI = 25;  // Percentual de BDI
