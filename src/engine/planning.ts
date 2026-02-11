/**
 * Planning Module - Cronograma de Execucao com Regra Same-Day Completion
 *
 * REGRA FUNDAMENTAL:
 * Em obras de saneamento, NAO se pode deixar vala aberta de um dia para outro.
 * Todas as atividades de um segmento devem ser concluidas no mesmo dia:
 *   Escavacao -> Nivelamento -> Assentamento -> Escoramento -> Reaterro -> Base
 */

export enum ActivityType {
  ESCAVACAO = 'Escavacao',
  NIVELAMENTO = 'Nivelamento',
  ASSENTAMENTO = 'Assentamento',
  ESCORAMENTO = 'Escoramento',
  BOMBEAMENTO = 'Bombeamento',
  REATERRO = 'Reaterro',
  BASE = 'Base/Berco',
  TESTE = 'Teste Hidrostatico',
  PAVIMENTACAO = 'Pavimentacao'
}

export interface TeamConfig {
  encarregado: number;
  oficiais: number;
  ajudantes: number;
  operador?: number;
  operadorMaquinas?: number;
  metrosDiaBase?: number;
  hoursPerDay?: number;
  hasRetroescavadeira?: boolean;
  hasRetro?: boolean;
  hasCompactador?: boolean;
  hasCompactor?: boolean;
  hasCaminhao?: boolean;
  hasTruck?: boolean;
  hasBomba?: boolean;
  hasPump?: boolean;
}

export interface DailySegment {
  segmentId: string;
  trechoId: string;
  day: number;
  date?: string;
  meters: number;
  team: number;
  activities: string[];
  volEscavacao: number;
  volReaterro: number;
  areaEscoramento: number;
  comprimentoTubo: number;
  custoMaoObra: number;
  custoEquipamentos: number;
  custoMateriais: number;
  custoTotal: number;
  profundidade: number;
  diametro: number;
}

export interface TrechoSchedule {
  trechoId: string;
  comprimentoTotal: number;
  profundidadeMedia: number;
  diametro: number;
  numDias: number;
  segments: DailySegment[];
  startDay: number;
  endDay: number;
  startDate?: string;
  endDate?: string;
  custoTotal: number;
}

export interface CurveSData {
  physical: Array<{ day: number; value: number }>;
  financial: Array<{ day: number; value: number }>;
}

export interface HistogramData {
  workers: Array<{ day: number; value: number }>;
  equipment: Array<{ day: number; value: number }>;
  maxWorkers: number;
  avgWorkers: number;
}

export interface ScheduleItem {
  wbsId: string;
  trechoId: string;
  segmentoId: string;
  activity: string;
  quantidade: number;
  unidade: string;
  metrosDia?: number;
  startDay: number;
  endDay: number;
  duration: number;
  team: number;
  profundidade?: number;
  diametro?: number;
  ordemExecucao: number;
}

export interface DailyPlanItem {
  day: number;
  trechoId: string;
  segmentoId: string;
  activity: string;
  activitiesDetail: string[];
  metrosExecutados: number;
  team: number;
  labor: number;
  equipment: number;
  dailyCost: number;
}

export interface CurveSPoint {
  day: number;
  physicalPlanned: number;
  physicalActual?: number;
  financialPlanned: number;
  financialActual?: number;
}

export interface HistogramDay {
  day: number;
  labor: number;
  equipment: number;
  cost: number;
}

export interface FullSchedule {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  numTeams: number;
  schedule: ScheduleItem[];
  dailyPlan: DailyPlanItem[];
  trechos: TrechoSchedule[];
  allSegments: DailySegment[];
  curveS: CurveSData;
  histogram: HistogramData;
  calendar: string[];
  summary: {
    totalMetros: number;
    totalTrechos: number;
    custoTotal: number;
    mediaMetrosDia: number;
  };
}

export interface TrechoInput {
  id?: string;
  trechoId?: string;
  comprimento?: number;
  length?: number;
  profundidade?: number;
  diametro?: number;
  DN?: number;
}

const DEFAULT_TEAM_CONFIG: TeamConfig = {
  encarregado: 1,
  oficiais: 2,
  ajudantes: 4,
  operadorMaquinas: 1,
  hasRetroescavadeira: true,
  hasCompactador: true,
  hasCaminhao: false,
  hasBomba: false
};

export function createTeamConfig(overrides?: Partial<TeamConfig>): TeamConfig {
  return { ...DEFAULT_TEAM_CONFIG, ...overrides };
}

export function getTotalWorkers(team: TeamConfig): number {
  return team.encarregado + team.oficiais + team.ajudantes + team.operadorMaquinas;
}

export function getDailyLaborCost(team: TeamConfig, avgCostPerWorker = 180): number {
  return getTotalWorkers(team) * avgCostPerWorker;
}

export function getDailyEquipmentCost(team: TeamConfig): number {
  let cost = 0;
  if (team.hasRetroescavadeira) cost += 450;
  if (team.hasCompactador) cost += 120;
  if (team.hasCaminhao) cost += 350;
  if (team.hasBomba) cost += 200;
  return cost;
}

export function calculateDailyMeters(
  profundidade: number,
  diametro: number,
  team: TeamConfig = DEFAULT_TEAM_CONFIG
): number {
  // Base: 12 metros/dia em condicoes normais (prof < 1.5m, DN150)
  let baseMetros = 12.0;

  // Ajuste por profundidade (quanto mais fundo, mais lento)
  if (profundidade > 3.0) {
    baseMetros *= 0.5; // Muito profundo - escoramento pesado
  } else if (profundidade > 2.5) {
    baseMetros *= 0.6;
  } else if (profundidade > 2.0) {
    baseMetros *= 0.7;
  } else if (profundidade > 1.5) {
    baseMetros *= 0.85;
  }

  // Ajuste por diametro (tubos maiores = mais lento)
  if (diametro > 400) {
    baseMetros *= 0.6;
  } else if (diametro > 300) {
    baseMetros *= 0.75;
  } else if (diametro > 200) {
    baseMetros *= 0.9;
  }

  // Ajuste por equipamentos
  if (!team.hasRetroescavadeira) {
    baseMetros *= 0.4; // Escavacao manual e muito lenta
  }
  if (!team.hasCompactador) {
    baseMetros *= 0.8;
  }
  if (team.hasBomba) {
    baseMetros *= 1.1; // Rebaixamento ajuda
  }

  // Ajuste por tamanho da equipe
  if (team.oficiais >= 3 && team.ajudantes >= 6) {
    baseMetros *= 1.2;
  } else if (team.oficiais < 2 || team.ajudantes < 3) {
    baseMetros *= 0.7;
  }

  return Math.max(3.0, Math.round(baseMetros * 10) / 10); // Minimo 3 metros/dia
}

export function generateTrechoSchedule(
  trechoId: string,
  comprimento: number,
  profundidade: number,
  diametro: number,
  startDay = 1,
  teamNum = 1,
  teamConfig: TeamConfig = DEFAULT_TEAM_CONFIG
): TrechoSchedule {
  const metrosDia = calculateDailyMeters(profundidade, diametro, teamConfig);
  const numDias = Math.max(1, Math.ceil(comprimento / metrosDia));
  const larguraVala = Math.max(0.6, diametro / 1000 + 0.4);

  const schedule: TrechoSchedule = {
    trechoId,
    comprimentoTotal: comprimento,
    profundidadeMedia: profundidade,
    diametro,
    numDias,
    startDay,
    endDay: startDay + numDias - 1,
    segments: [],
    custoTotal: 0
  };

  let metrosRestantes = comprimento;

  for (let dia = 0; dia < numDias; dia++) {
    const dayNumber = startDay + dia;
    const metrosHoje = Math.min(metrosDia, metrosRestantes);
    metrosRestantes -= metrosHoje;

    // Calcula quantidades proporcionais
    const volEsc = metrosHoje * larguraVala * profundidade;
    const volReat = volEsc * 0.7; // 30% vai para bota-fora
    const areaEsc = metrosHoje * profundidade * 2; // Dois lados da vala

    const activities: string[] = [
      ActivityType.ESCAVACAO,
      ActivityType.NIVELAMENTO,
      ActivityType.ASSENTAMENTO
    ];

    if (profundidade > 1.25) {
      activities.push(ActivityType.ESCORAMENTO);
    }
    if (teamConfig.hasBomba) {
      activities.push(ActivityType.BOMBEAMENTO);
    }
    activities.push(ActivityType.REATERRO, ActivityType.BASE);

    const custoMaoObra = getDailyLaborCost(teamConfig);
    const custoEquipamentos = getDailyEquipmentCost(teamConfig);

    const segment: DailySegment = {
      segmentId: `${trechoId}.D${dia + 1}`,
      trechoId,
      day: dayNumber,
      meters: metrosHoje,
      team: teamNum,
      activities,
      volEscavacao: volEsc,
      volReaterro: volReat,
      areaEscoramento: profundidade > 1.25 ? areaEsc : 0,
      comprimentoTubo: metrosHoje,
      profundidade,
      diametro,
      custoMaoObra,
      custoEquipamentos,
      custoMateriais: 0,
      custoTotal: custoMaoObra + custoEquipamentos
    };

    schedule.segments.push(segment);
    schedule.custoTotal += segment.custoTotal;
  }

  return schedule;
}

function generateCurveS(segments: DailySegment[], totalDays: number): CurveSData {
  const totalMetros = segments.reduce((sum, seg) => sum + seg.meters, 0);
  const totalCusto = segments.reduce((sum, seg) => sum + seg.custoTotal, 0);

  const physical: Array<{ day: number; value: number }> = [];
  const financial: Array<{ day: number; value: number }> = [];

  let cumMetros = 0;
  let cumCusto = 0;

  for (let day = 1; day <= totalDays; day++) {
    const daySegments = segments.filter(s => s.day === day);
    cumMetros += daySegments.reduce((sum, s) => sum + s.meters, 0);
    cumCusto += daySegments.reduce((sum, s) => sum + s.custoTotal, 0);

    physical.push({
      day,
      value: totalMetros > 0 ? (cumMetros / totalMetros) * 100 : 0
    });
    financial.push({
      day,
      value: totalCusto > 0 ? (cumCusto / totalCusto) * 100 : 0
    });
  }

  return { physical, financial };
}

function generateHistogram(
  segments: DailySegment[],
  totalDays: number,
  teamConfig: TeamConfig
): HistogramData {
  const workers: Array<{ day: number; value: number }> = [];
  const equipment: Array<{ day: number; value: number }> = [];
  const totalWorkers = getTotalWorkers(teamConfig);

  for (let day = 1; day <= totalDays; day++) {
    const daySegments = segments.filter(s => s.day === day && s.team > 0);
    const teamsWorking = new Set(daySegments.map(s => s.team)).size;

    workers.push({ day, value: teamsWorking * totalWorkers });
    equipment.push({ day, value: teamsWorking });
  }

  const workerValues = workers.map(w => w.value);

  return {
    workers,
    equipment,
    maxWorkers: Math.max(...workerValues, 0),
    avgWorkers: workerValues.length > 0
      ? workerValues.reduce((a, b) => a + b, 0) / workerValues.length
      : 0
  };
}

function generateCalendar(
  startDate: Date,
  totalDays: number,
  workDaysPerWeek = 5,
  holidays: Date[] = []
): string[] {
  const calendar: string[] = [];
  const currentDate = new Date(startDate);
  let workDaysAdded = 0;

  const holidayStrings = holidays.map(h => h.toISOString().split('T')[0]);

  while (workDaysAdded < totalDays) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = currentDate.toISOString().split('T')[0];

    // Verifica se e dia util (seg-sex = 1-5) e nao e feriado
    if (dayOfWeek > 0 && dayOfWeek <= workDaysPerWeek && !holidayStrings.includes(dateStr)) {
      calendar.push(dateStr);
      workDaysAdded++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return calendar;
}

export function generateFullSchedule(
  trechos: TrechoInput[],
  numTeams = 2,
  teamConfig: TeamConfig = DEFAULT_TEAM_CONFIG,
  startDate?: Date
): FullSchedule {
  const start = startDate || new Date();

  // Normalize teamConfig to handle both naming conventions
  const normalizedConfig: TeamConfig = {
    ...teamConfig,
    operadorMaquinas: teamConfig.operadorMaquinas ?? teamConfig.operador ?? 1,
    hasRetroescavadeira: teamConfig.hasRetroescavadeira ?? teamConfig.hasRetro ?? true,
    hasCompactador: teamConfig.hasCompactador ?? teamConfig.hasCompactor ?? true,
    hasCaminhao: teamConfig.hasCaminhao ?? teamConfig.hasTruck ?? false,
    hasBomba: teamConfig.hasBomba ?? teamConfig.hasPump ?? false
  };

  // Rastreia quando cada equipe estara livre
  const teamAvailability = new Array(numTeams).fill(0);

  const trechoSchedules: TrechoSchedule[] = [];
  const allSegments: DailySegment[] = [];
  const schedule: ScheduleItem[] = [];
  const dailyPlan: DailyPlanItem[] = [];

  for (const trecho of trechos) {
    // Encontra equipe mais disponivel
    const teamIdx = teamAvailability.indexOf(Math.min(...teamAvailability));
    const trechoStartDay = teamAvailability[teamIdx] + 1;

    const trechoSchedule = generateTrechoSchedule(
      trecho.id || trecho.trechoId || '',
      trecho.comprimento || trecho.length || 50,
      trecho.profundidade || 1.5,
      trecho.diametro || trecho.DN || 150,
      trechoStartDay,
      teamIdx + 1,
      normalizedConfig
    );

    // Atualiza disponibilidade da equipe
    teamAvailability[teamIdx] = trechoSchedule.endDay;

    // Create schedule items for each segment
    trechoSchedule.segments.forEach((seg, idx) => {
      schedule.push({
        wbsId: seg.segmentId,
        trechoId: seg.trechoId,
        segmentoId: seg.segmentId,
        activity: `Ciclo completo DN${seg.diametro}`,
        quantidade: seg.meters,
        unidade: 'm',
        metrosDia: seg.meters,
        startDay: seg.day,
        endDay: seg.day,
        duration: 1,
        team: seg.team,
        profundidade: seg.profundidade,
        diametro: seg.diametro,
        ordemExecucao: idx + 1
      });
    });

    // Create daily plan items
    trechoSchedule.segments.forEach(seg => {
      const totalWorkers = getTotalWorkers(normalizedConfig);
      const equipCount = [
        normalizedConfig.hasRetroescavadeira,
        normalizedConfig.hasCompactador,
        normalizedConfig.hasCaminhao,
        normalizedConfig.hasBomba
      ].filter(Boolean).length;

      dailyPlan.push({
        day: seg.day,
        trechoId: seg.trechoId,
        segmentoId: seg.segmentId,
        activity: `Ciclo completo (${seg.meters.toFixed(1)}m)`,
        activitiesDetail: seg.activities,
        metrosExecutados: seg.meters,
        team: seg.team,
        labor: totalWorkers,
        equipment: equipCount,
        dailyCost: seg.custoTotal
      });
    });

    // Adiciona teste hidrostatico apos conclusao do trecho
    const testSegment: DailySegment = {
      segmentId: `${trechoSchedule.trechoId}.TESTE`,
      trechoId: trechoSchedule.trechoId,
      day: trechoSchedule.endDay + 1,
      meters: 0,
      team: 0, // Equipe de teste separada
      activities: [ActivityType.TESTE],
      volEscavacao: 0,
      volReaterro: 0,
      areaEscoramento: 0,
      comprimentoTubo: 0,
      profundidade: 0,
      diametro: 0,
      custoMaoObra: 0,
      custoEquipamentos: 0,
      custoMateriais: 0,
      custoTotal: 500 // Custo fixo de teste
    };
    trechoSchedule.segments.push(testSegment);

    // Add test to schedule
    schedule.push({
      wbsId: testSegment.segmentId,
      trechoId: testSegment.trechoId,
      segmentoId: testSegment.segmentId,
      activity: 'Teste hidrostático',
      quantidade: 1,
      unidade: 'vb',
      startDay: testSegment.day,
      endDay: testSegment.day,
      duration: 1,
      team: 0,
      ordemExecucao: 99
    });

    trechoSchedules.push(trechoSchedule);
    allSegments.push(...trechoSchedule.segments);
  }

  const totalDays = allSegments.length > 0
    ? Math.max(...allSegments.map(seg => seg.day))
    : 0;

  const curveS = generateCurveS(allSegments, totalDays);
  const histogram = generateHistogram(allSegments, totalDays, normalizedConfig);
  const calendar = generateCalendar(start, totalDays);

  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + totalDays);

  return {
    startDate: start,
    endDate,
    totalDays,
    numTeams,
    schedule,
    dailyPlan,
    trechos: trechoSchedules,
    allSegments,
    curveS,
    histogram,
    calendar,
    summary: {
      totalMetros: trechoSchedules.reduce((sum, ts) => sum + ts.comprimentoTotal, 0),
      totalTrechos: trechoSchedules.length,
      custoTotal: trechoSchedules.reduce((sum, ts) => sum + ts.custoTotal, 0),
      mediaMetrosDia: totalDays > 0
        ? trechoSchedules.reduce((sum, ts) => sum + ts.comprimentoTotal, 0) / totalDays
        : 0
    }
  };
}

// Funcao de conveniencia para uso direto
export function generateSchedule(
  trechos: TrechoInput[],
  numTeams = 2,
  teamConfig?: Partial<TeamConfig>,
  startDate?: Date
): FullSchedule {
  const config = teamConfig ? createTeamConfig(teamConfig) : DEFAULT_TEAM_CONFIG;
  return generateFullSchedule(trechos, numTeams, config, startDate);
}

/**
 * Generate Curve S data points for charting.
 */
export function generateCurveSData(
  schedule: ScheduleItem[],
  dailyPlan: DailyPlanItem[],
  totalDays: number
): CurveSPoint[] {
  const totalQty = schedule.reduce((sum, s) => sum + s.quantidade, 0);
  const totalCost = dailyPlan.reduce((sum, d) => sum + d.dailyCost, 0);

  const points: CurveSPoint[] = [];
  let cumQty = 0;
  let cumCost = 0;

  for (let day = 1; day <= totalDays; day++) {
    const daySchedule = schedule.filter(s => s.startDay <= day && s.endDay >= day);
    daySchedule.forEach(s => {
      cumQty += s.quantidade / s.duration;
    });

    const dayCosts = dailyPlan.filter(d => d.day === day);
    dayCosts.forEach(d => {
      cumCost += d.dailyCost;
    });

    points.push({
      day,
      physicalPlanned: totalQty > 0 ? Math.min(100, (cumQty / totalQty) * 100) : 0,
      financialPlanned: totalCost > 0 ? Math.min(100, (cumCost / totalCost) * 100) : 0
    });
  }

  return points;
}

/**
 * Generate histogram data for resource visualization.
 */
export function generateHistogramData(
  dailyPlan: DailyPlanItem[],
  totalDays: number
): HistogramDay[] {
  const data: HistogramDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const dayItems = dailyPlan.filter(d => d.day === day);
    const labor = dayItems.reduce((sum, d) => sum + d.labor, 0);
    const equipment = dayItems.reduce((sum, d) => sum + d.equipment, 0);
    const cost = dayItems.reduce((sum, d) => sum + d.dailyCost, 0);

    data.push({ day, labor, equipment, cost });
  }

  return data;
}
