/**
 * Construction Module - Parametros de Execucao
 *
 * Este modulo fornece enumeracoes e calculos para parametros
 * de execucao de obras de saneamento.
 */

export enum TipoSolo {
  NORMAL = 'normal',
  ROCHOSO = 'rochoso',
  ALAGADO = 'alagado',
  ARENOSO = 'arenoso',
  ARGILOSO = 'argiloso'
}

export enum TipoEscavacao {
  MANUAL = 'manual',
  MECANIZADA = 'mecanizada',
  MISTA = 'mista'
}

export enum TipoPavimento {
  ASFALTO = 'asfalto',
  PARALELEPIPEDO = 'paralelepipedo',
  CONCRETO = 'concreto',
  TERRA = 'terra',
  CALCADA = 'calcada'
}

export enum TipoMaterial {
  PVC = 'PVC',
  PEAD = 'PEAD',
  FOFO = 'FOFO',  // Ferro fundido
  CONCRETO = 'Concreto',
  CERAMICO = 'Ceramico'
}

export enum TipoEscoramento {
  NENHUM = 'nenhum',
  PONTALETEAMENTO = 'pontaleteamento',
  CONTINUO = 'continuo',
  METALICO = 'metalico',
  ESPECIAL = 'especial'
}

export interface ParametrosExecucao {
  tipoSolo: TipoSolo;
  tipoEscavacao: TipoEscavacao;
  tipoPavimento: TipoPavimento;
  tipoMaterial: TipoMaterial;
  tipoEscoramento: TipoEscoramento;
  profundidadeMedia: number;
  larguraVala: number;
  diametroMm: number;
}

export interface ResultadoEquipe {
  encarregado: number;
  pedreiro: number;
  servente: number;
  operadorMaquinas: number;
  totalPessoas: number;
  equipamentos: string[];
  produtividadeMetrosDia: number;
  custoEstimadoDia: number;
}

export interface QuantidadesExecucao {
  volumeEscavacao: number;
  volumeReaterro: number;
  areaEscoramento: number;
  areaPavimento: number;
  comprimentoTubo: number;
  volumeBerco: number;
  volumeBotaFora: number;
}

// Fatores de produtividade por tipo de solo
const FATORES_SOLO: Record<TipoSolo, number> = {
  [TipoSolo.NORMAL]: 1.0,
  [TipoSolo.ARENOSO]: 1.1,
  [TipoSolo.ARGILOSO]: 0.9,
  [TipoSolo.ALAGADO]: 0.6,
  [TipoSolo.ROCHOSO]: 0.3
};

// Fatores de produtividade por tipo de escavacao
const FATORES_ESCAVACAO: Record<TipoEscavacao, number> = {
  [TipoEscavacao.MECANIZADA]: 1.0,
  [TipoEscavacao.MISTA]: 0.7,
  [TipoEscavacao.MANUAL]: 0.3
};

// Custos diarios por funcao (R$)
const CUSTOS_DIARIOS = {
  encarregado: 280,
  pedreiro: 180,
  servente: 120,
  operadorMaquinas: 220
};

// Custos diarios de equipamentos (R$)
const CUSTOS_EQUIPAMENTOS: Record<string, number> = {
  'Retroescavadeira': 450,
  'Compactador de solo': 120,
  'Caminhao basculante': 350,
  'Bomba submersa': 200,
  'Guindaste': 800,
  'Escoramento metalico': 150
};

/**
 * Determina o tipo de escoramento necessario baseado na profundidade.
 */
export function determinarEscoramento(profundidade: number, tipoSolo: TipoSolo): TipoEscoramento {
  if (profundidade <= 1.25) {
    return TipoEscoramento.NENHUM;
  }

  if (tipoSolo === TipoSolo.ALAGADO || tipoSolo === TipoSolo.ARENOSO) {
    if (profundidade > 2.0) {
      return TipoEscoramento.METALICO;
    }
    return TipoEscoramento.CONTINUO;
  }

  if (tipoSolo === TipoSolo.ROCHOSO) {
    return TipoEscoramento.NENHUM;
  }

  if (profundidade > 3.0) {
    return TipoEscoramento.METALICO;
  } else if (profundidade > 2.0) {
    return TipoEscoramento.CONTINUO;
  }

  return TipoEscoramento.PONTALETEAMENTO;
}

/**
 * Calcula a largura da vala baseado no diametro do tubo.
 */
export function calcularLarguraVala(diametroMm: number): number {
  // Largura minima = diametro externo + 0.6m (0.3m cada lado)
  // Mas minimo de 0.6m para trabalho
  const diametroM = diametroMm / 1000;
  return Math.max(0.6, diametroM + 0.4);
}

/**
 * Calcula as quantidades de execucao para um trecho.
 */
export function calcularQuantidades(
  comprimento: number,
  profundidade: number,
  diametroMm: number,
  larguraVala?: number
): QuantidadesExecucao {
  const largura = larguraVala ?? calcularLarguraVala(diametroMm);
  const diametroM = diametroMm / 1000;

  // Volume de escavacao (m3)
  const volumeEscavacao = comprimento * largura * profundidade;

  // Volume do berco (areia) - 15cm abaixo e 15cm laterais
  const volumeBerco = comprimento * (diametroM + 0.3) * 0.15;

  // Volume de reaterro (escavacao - berco - volume do tubo)
  const volumeTubo = comprimento * Math.PI * Math.pow(diametroM / 2, 2);
  const volumeReaterro = volumeEscavacao - volumeBerco - volumeTubo;

  // Volume de bota-fora (30% do reaterro por empolamento)
  const volumeBotaFora = volumeEscavacao * 0.3;

  // Area de escoramento (dois lados da vala)
  const areaEscoramento = comprimento * profundidade * 2;

  // Area de pavimento (largura + 0.2m de cada lado para recomposicao)
  const areaPavimento = comprimento * (largura + 0.4);

  return {
    volumeEscavacao: Math.round(volumeEscavacao * 100) / 100,
    volumeReaterro: Math.round(volumeReaterro * 100) / 100,
    areaEscoramento: Math.round(areaEscoramento * 100) / 100,
    areaPavimento: Math.round(areaPavimento * 100) / 100,
    comprimentoTubo: comprimento,
    volumeBerco: Math.round(volumeBerco * 100) / 100,
    volumeBotaFora: Math.round(volumeBotaFora * 100) / 100
  };
}

/**
 * Calcula produtividade em metros por dia.
 */
export function calcularProdutividade(
  profundidade: number,
  diametroMm: number,
  tipoSolo: TipoSolo,
  tipoEscavacao: TipoEscavacao
): number {
  // Base: 12 metros/dia em condicoes normais
  let produtividade = 12.0;

  // Ajuste por profundidade
  if (profundidade > 3.0) {
    produtividade *= 0.5;
  } else if (profundidade > 2.5) {
    produtividade *= 0.6;
  } else if (profundidade > 2.0) {
    produtividade *= 0.7;
  } else if (profundidade > 1.5) {
    produtividade *= 0.85;
  }

  // Ajuste por diametro
  if (diametroMm > 400) {
    produtividade *= 0.6;
  } else if (diametroMm > 300) {
    produtividade *= 0.75;
  } else if (diametroMm > 200) {
    produtividade *= 0.9;
  }

  // Ajuste por tipo de solo
  produtividade *= FATORES_SOLO[tipoSolo];

  // Ajuste por tipo de escavacao
  produtividade *= FATORES_ESCAVACAO[tipoEscavacao];

  return Math.max(3.0, Math.round(produtividade * 10) / 10);
}

/**
 * Calcula a equipe necessaria para execucao.
 */
export function calcularEquipe(parametros: ParametrosExecucao): ResultadoEquipe {
  const { tipoSolo, tipoEscavacao, profundidadeMedia: profundidade, diametroMm } = parametros;

  let encarregado = 1;
  let pedreiro = 2;
  let servente = 4;
  let operadorMaquinas = tipoEscavacao !== TipoEscavacao.MANUAL ? 1 : 0;

  const equipamentos: string[] = [];

  // Ajustes por tipo de escavacao
  if (tipoEscavacao === TipoEscavacao.MECANIZADA) {
    equipamentos.push('Retroescavadeira');
    servente = 3;
  } else if (tipoEscavacao === TipoEscavacao.MANUAL) {
    servente = 6;
    pedreiro = 3;
  }

  // Ajustes por profundidade
  if (profundidade > 2.5) {
    servente += 2;
    pedreiro += 1;
  }

  // Ajustes por diametro
  if (diametroMm > 300) {
    pedreiro += 1;
    servente += 1;
  }

  // Ajustes por tipo de solo
  if (tipoSolo === TipoSolo.ALAGADO) {
    equipamentos.push('Bomba submersa');
    servente += 1;
  }

  if (tipoSolo === TipoSolo.ROCHOSO) {
    equipamentos.push('Guindaste');
    operadorMaquinas += 1;
  }

  // Equipamentos padrao
  equipamentos.push('Compactador de solo');

  // Escoramento
  const tipoEscoramento = determinarEscoramento(profundidade, tipoSolo);
  if (tipoEscoramento === TipoEscoramento.METALICO) {
    equipamentos.push('Escoramento metalico');
    pedreiro += 1;
  }

  // Calculo de produtividade
  const produtividadeMetrosDia = calcularProdutividade(
    profundidade,
    diametroMm,
    tipoSolo,
    tipoEscavacao
  );

  // Calculo de custo diario
  const custoMaoObra =
    encarregado * CUSTOS_DIARIOS.encarregado +
    pedreiro * CUSTOS_DIARIOS.pedreiro +
    servente * CUSTOS_DIARIOS.servente +
    operadorMaquinas * CUSTOS_DIARIOS.operadorMaquinas;

  const custoEquipamentos = equipamentos.reduce(
    (sum, eq) => sum + (CUSTOS_EQUIPAMENTOS[eq] || 0),
    0
  );

  return {
    encarregado,
    pedreiro,
    servente,
    operadorMaquinas,
    totalPessoas: encarregado + pedreiro + servente + operadorMaquinas,
    equipamentos,
    produtividadeMetrosDia,
    custoEstimadoDia: custoMaoObra + custoEquipamentos
  };
}

/**
 * Retorna as opcoes de tipos de solo.
 */
export function getTiposSolo(): Array<{ value: string; label: string }> {
  return Object.values(TipoSolo).map(tipo => ({
    value: tipo,
    label: tipo.charAt(0).toUpperCase() + tipo.slice(1)
  }));
}

/**
 * Retorna as opcoes de tipos de escavacao.
 */
export function getTiposEscavacao(): Array<{ value: string; label: string }> {
  return Object.values(TipoEscavacao).map(tipo => ({
    value: tipo,
    label: tipo.charAt(0).toUpperCase() + tipo.slice(1)
  }));
}

/**
 * Retorna as opcoes de tipos de pavimento.
 */
export function getTiposPavimento(): Array<{ value: string; label: string }> {
  return Object.values(TipoPavimento).map(tipo => ({
    value: tipo,
    label: tipo.charAt(0).toUpperCase() + tipo.slice(1)
  }));
}

/**
 * Retorna as opcoes de tipos de material.
 */
export function getTiposMaterial(): Array<{ value: string; label: string }> {
  return Object.values(TipoMaterial).map(tipo => ({
    value: tipo,
    label: tipo
  }));
}
