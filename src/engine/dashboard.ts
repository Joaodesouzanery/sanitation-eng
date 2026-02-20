/**
 * Dashboard Module - Metricas e Visualizacoes
 *
 * Este modulo fornece:
 * - Metricas gerais de RDOs
 * - Progresso por projeto/sistema
 * - Timeline de execucao
 * - Dados para graficos (Chart.js)
 */

import {
  RDO,
  RDOStatus,
  SystemType,
  DashboardMetrics
} from './rdo';

export interface ChartData {
  statusChart: {
    labels: string[];
    values: number[];
    colors: string[];
  };
  systemChart: {
    labels: string[];
    planned: number[];
    executed: number[];
    colors: { planned: string; executed: string };
  };
  timelineChart: {
    labels: string[];
    daily: number[];
    accumulated: number[];
  };
  progressChart: {
    completed: number;
    remaining: number;
    totalPlanned: number;
    totalExecuted: number;
  };
  servicesChart: {
    labels: string[];
    values: number[];
    units: string[];
  };
  segmentStatusChart: {
    labels: string[];
    values: number[];
    colors: string[];
  };
  summary: {
    totalRdos: number;
    totalPlanned: number;
    totalExecuted: number;
    overallProgress: number;
    totalSegments: number;
    completedSegments: number;
    totalOccurrences: number;
  };
}

export interface SegmentDetail {
  segmentId: string;
  segmentName?: string;
  systemType: string;
  projectId: string;
  plannedLength: number;
  executedLength: number;
  progressPercentage: number;
  remainingLength: number;
  status: string;
  color: string;
  firstExecution?: string;
  lastExecution?: string;
  executionDates: string[];
  rdoIds: string[];
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
}

export interface MapData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point' | 'LineString';
      coordinates: number[] | number[][];
    };
    properties: {
      segmentId: string;
      segmentName?: string;
      systemType: string;
      plannedLength: number;
      executedLength: number;
      progressPercentage: number;
      remainingLength: number;
      status: string;
      color: string;
      firstExecution?: string;
      lastExecution?: string;
    };
  }>;
  metadata: {
    totalFeatures: number;
    bounds?: {
      south: number;
      north: number;
      west: number;
      east: number;
      center: { lat: number; lng: number };
    };
    generatedAt: string;
  };
}

export interface ComparisonReport {
  status: string;
  filters: {
    projectId?: string;
    systemType?: string;
  };
  totals: {
    totalSegments: number;
    totalPlannedLength: number;
    totalExecutedLength: number;
    totalRemainingLength: number;
    overallProgressPercentage: number;
  };
  analysis: {
    completed: { count: number; percentage: number; segments: string[] };
    onTrack: { count: number; percentage: number; segments: string[] };
    slightlyDelayed: { count: number; percentage: number; segments: string[] };
    delayed: { count: number; percentage: number; segments: string[] };
    notStarted: { count: number; percentage: number; segments: string[] };
  };
  segmentsDetail: SegmentDetail[];
  generatedAt: string;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export class RDODashboard {
  private rdos: RDO[];
  private plannedSegments: Map<string, Record<string, unknown>>;

  constructor(rdos: RDO[], plannedSegments?: Map<string, Record<string, unknown>>) {
    this.rdos = rdos;
    this.plannedSegments = plannedSegments || new Map();
  }

  calculateMetrics(): DashboardMetrics {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = addDays(today, -new Date().getDay());
    const monthStart = today.substring(0, 8) + '01';

    const metrics: DashboardMetrics = {
      totalRdos: this.rdos.length,
      rdosToday: this.rdos.filter(r => r.date === today).length,
      rdosThisWeek: this.rdos.filter(r => r.date >= weekStart).length,
      rdosThisMonth: this.rdos.filter(r => r.date >= monthStart).length,
      rdosByStatus: {},
      totalPlannedLength: 0,
      totalExecutedLength: 0,
      overallProgressPercentage: 0,
      totalPlannedFinancial: 0,
      totalExecutedFinancial: 0,
      financialProgressPercentage: 0,
      financialVariance: 0,
      cpi: 0,
      spi: 0,
      progressBySystem: {},
      progressByProject: {},
      topServices: [],
      executionTimeline: [],
      totalOccurrences: 0,
      occurrencesBySeverity: {}
    };

    // RDOs por status
    for (const status of Object.values(RDOStatus)) {
      metrics.rdosByStatus[status] = this.rdos.filter(r => r.status === status).length;
    }

    // Progresso geral
    const progressData = this.calculateOverallProgress();
    metrics.totalPlannedLength = progressData.totalPlanned;
    metrics.totalExecutedLength = progressData.totalExecuted;
    metrics.overallProgressPercentage = progressData.percentage;

    // Progresso por sistema
    metrics.progressBySystem = this.calculateProgressBySystem();

    // Progresso por projeto
    metrics.progressByProject = this.calculateProgressByProject();

    // Top servicos
    metrics.topServices = this.getTopServices(10);

    // Timeline de execucao
    metrics.executionTimeline = this.generateExecutionTimeline(30);

    // Ocorrencias
    const occData = this.analyzeOccurrences();
    metrics.totalOccurrences = occData.total;
    metrics.occurrencesBySeverity = occData.bySeverity;

    return metrics;
  }

  private calculateOverallProgress(): { totalPlanned: number; totalExecuted: number; percentage: number } {
    const segmentExecuted: Map<string, number> = new Map();
    const segmentPlanned: Map<string, number> = new Map();

    for (const rdo of this.rdos) {
      for (const segment of rdo.segmentProgress) {
        const existing = segmentExecuted.get(segment.segmentId) || 0;
        segmentExecuted.set(segment.segmentId, existing + segment.executedLength);

        if (segment.plannedLength) {
          const existingPlanned = segmentPlanned.get(segment.segmentId) || 0;
          segmentPlanned.set(segment.segmentId, Math.max(existingPlanned, segment.plannedLength));
        }
      }
    }

    // Adiciona planejados sem execucao
    for (const [segId, data] of this.plannedSegments) {
      if (!segmentPlanned.has(segId)) {
        segmentPlanned.set(segId, (data.plannedLength as number) || 0);
      }
    }

    const totalExecuted = Array.from(segmentExecuted.values()).reduce((a, b) => a + b, 0);
    const totalPlanned = Array.from(segmentPlanned.values()).reduce((a, b) => a + b, 0);
    const percentage = totalPlanned > 0 ? Math.min(100, (totalExecuted / totalPlanned) * 100) : 0;

    return {
      totalPlanned: Math.round(totalPlanned * 100) / 100,
      totalExecuted: Math.round(totalExecuted * 100) / 100,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  private calculateProgressBySystem(): Record<string, { planned: number; executed: number; percentage: number }> {
    const bySystem: Record<string, { planned: number; executed: number; percentage: number }> = {};

    for (const systemType of Object.values(SystemType)) {
      const segmentExecuted: Map<string, number> = new Map();
      const segmentPlanned: Map<string, number> = new Map();

      for (const rdo of this.rdos) {
        for (const segment of rdo.segmentProgress) {
          if (segment.systemType === systemType) {
            const existing = segmentExecuted.get(segment.segmentId) || 0;
            segmentExecuted.set(segment.segmentId, existing + segment.executedLength);

            if (segment.plannedLength) {
              const existingPlanned = segmentPlanned.get(segment.segmentId) || 0;
              segmentPlanned.set(segment.segmentId, Math.max(existingPlanned, segment.plannedLength));
            }
          }
        }
      }

      // Adiciona planejados
      for (const [segId, data] of this.plannedSegments) {
        if (data.systemType === systemType && !segmentPlanned.has(segId)) {
          segmentPlanned.set(segId, (data.plannedLength as number) || 0);
        }
      }

      const executed = Array.from(segmentExecuted.values()).reduce((a, b) => a + b, 0);
      const planned = Array.from(segmentPlanned.values()).reduce((a, b) => a + b, 0);
      const percentage = planned > 0 ? Math.min(100, (executed / planned) * 100) : 0;

      bySystem[systemType] = {
        planned: Math.round(planned * 100) / 100,
        executed: Math.round(executed * 100) / 100,
        percentage: Math.round(percentage * 100) / 100
      };
    }

    return bySystem;
  }

  private calculateProgressByProject(): Record<string, { planned: number; executed: number; percentage: number; rdosCount: number }> {
    const byProject: Record<string, {
      planned: number;
      executed: number;
      percentage: number;
      rdosCount: number;
      segmentExecuted: Map<string, number>;
      segmentPlanned: Map<string, number>;
    }> = {};

    for (const rdo of this.rdos) {
      const projectName = rdo.projectName || rdo.projectId;

      if (!byProject[projectName]) {
        byProject[projectName] = {
          planned: 0,
          executed: 0,
          percentage: 0,
          rdosCount: 0,
          segmentExecuted: new Map(),
          segmentPlanned: new Map()
        };
      }

      byProject[projectName].rdosCount++;

      for (const segment of rdo.segmentProgress) {
        const existing = byProject[projectName].segmentExecuted.get(segment.segmentId) || 0;
        byProject[projectName].segmentExecuted.set(segment.segmentId, existing + segment.executedLength);

        if (segment.plannedLength) {
          const existingPlanned = byProject[projectName].segmentPlanned.get(segment.segmentId) || 0;
          byProject[projectName].segmentPlanned.set(
            segment.segmentId,
            Math.max(existingPlanned, segment.plannedLength)
          );
        }
      }
    }

    // Calcula totais
    const result: Record<string, { planned: number; executed: number; percentage: number; rdosCount: number }> = {};

    for (const [projectName, data] of Object.entries(byProject)) {
      const executed = Array.from(data.segmentExecuted.values()).reduce((a, b) => a + b, 0);
      const planned = Array.from(data.segmentPlanned.values()).reduce((a, b) => a + b, 0);
      const percentage = planned > 0 ? Math.min(100, (executed / planned) * 100) : 0;

      result[projectName] = {
        planned: Math.round(planned * 100) / 100,
        executed: Math.round(executed * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
        rdosCount: data.rdosCount
      };
    }

    return result;
  }

  private getTopServices(limit = 10): Array<{ name: string; totalQuantity: number; unit: string; occurrences: number }> {
    const serviceTotals: Map<string, { quantity: number; unit: string; count: number }> = new Map();

    for (const rdo of this.rdos) {
      for (const service of rdo.executedServices) {
        const existing = serviceTotals.get(service.serviceName) || { quantity: 0, unit: service.unit, count: 0 };
        existing.quantity += service.quantity;
        existing.count++;
        serviceTotals.set(service.serviceName, existing);
      }
    }

    const sorted = Array.from(serviceTotals.entries())
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, limit);

    return sorted.map(([name, data]) => ({
      name,
      totalQuantity: Math.round(data.quantity * 100) / 100,
      unit: data.unit,
      occurrences: data.count
    }));
  }

  private generateExecutionTimeline(days = 30): Array<{
    date: string;
    dateFormatted: string;
    dailyExecuted: number;
    accumulatedExecuted: number;
    rdosCount: number;
    servicesCount: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const startDate = addDays(today, -(days - 1));

    const dailyData: Map<string, { executed: number; rdosCount: number; servicesCount: number }> = new Map();

    // Inicializa todos os dias
    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i);
      dailyData.set(date, { executed: 0, rdosCount: 0, servicesCount: 0 });
    }

    // Agrega dados
    for (const rdo of this.rdos) {
      if (rdo.date >= startDate && rdo.date <= today) {
        const data = dailyData.get(rdo.date);
        if (data) {
          data.rdosCount++;
          data.servicesCount += rdo.executedServices.length;
          for (const segment of rdo.segmentProgress) {
            data.executed += segment.executedLength;
          }
        }
      }
    }

    // Calcula acumulado
    let accumulated = 0;
    const timeline: Array<{
      date: string;
      dateFormatted: string;
      dailyExecuted: number;
      accumulatedExecuted: number;
      rdosCount: number;
      servicesCount: number;
    }> = [];

    const sortedDates = Array.from(dailyData.keys()).sort();
    for (const date of sortedDates) {
      const data = dailyData.get(date)!;
      accumulated += data.executed;

      timeline.push({
        date,
        dateFormatted: formatDateBR(date),
        dailyExecuted: Math.round(data.executed * 100) / 100,
        accumulatedExecuted: Math.round(accumulated * 100) / 100,
        rdosCount: data.rdosCount,
        servicesCount: data.servicesCount
      });
    }

    return timeline;
  }

  private analyzeOccurrences(): { total: number; bySeverity: Record<string, number>; byType: Record<string, number> } {
    let total = 0;
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const rdo of this.rdos) {
      for (const occ of rdo.occurrences) {
        total++;
        bySeverity[occ.severity] = (bySeverity[occ.severity] || 0) + 1;
        byType[occ.type] = (byType[occ.type] || 0) + 1;
      }
    }

    return { total, bySeverity, byType };
  }

  getSegmentDetails(): SegmentDetail[] {
    const segmentData: Map<string, SegmentDetail> = new Map();

    // Processa execucoes dos RDOs
    for (const rdo of this.rdos) {
      for (const segment of rdo.segmentProgress) {
        const existing = segmentData.get(segment.segmentId);

        if (!existing) {
          segmentData.set(segment.segmentId, {
            segmentId: segment.segmentId,
            segmentName: segment.segmentName,
            systemType: segment.systemType,
            projectId: segment.projectId,
            plannedLength: segment.plannedLength || 0,
            executedLength: segment.executedLength,
            progressPercentage: 0,
            remainingLength: 0,
            status: '',
            color: '',
            executionDates: [segment.executionDate],
            rdoIds: [rdo.id],
            startCoords: segment.startCoordinates
              ? { lat: segment.startCoordinates.latitude, lng: segment.startCoordinates.longitude }
              : undefined,
            endCoords: segment.endCoordinates
              ? { lat: segment.endCoordinates.latitude, lng: segment.endCoordinates.longitude }
              : undefined
          });
        } else {
          existing.executedLength += segment.executedLength;
          existing.executionDates.push(segment.executionDate);
          existing.rdoIds.push(rdo.id);

          if (segment.plannedLength) {
            existing.plannedLength = Math.max(existing.plannedLength, segment.plannedLength);
          }

          if (segment.startCoordinates && !existing.startCoords) {
            existing.startCoords = {
              lat: segment.startCoordinates.latitude,
              lng: segment.startCoordinates.longitude
            };
          }
          if (segment.endCoordinates && !existing.endCoords) {
            existing.endCoords = {
              lat: segment.endCoordinates.latitude,
              lng: segment.endCoordinates.longitude
            };
          }
        }
      }
    }

    // Adiciona planejados sem execucao
    for (const [segId, data] of this.plannedSegments) {
      if (!segmentData.has(segId)) {
        segmentData.set(segId, {
          segmentId: segId,
          segmentName: data.name as string | undefined,
          systemType: (data.systemType as string) || 'unknown',
          projectId: data.projectId as string,
          plannedLength: (data.plannedLength as number) || 0,
          executedLength: 0,
          progressPercentage: 0,
          remainingLength: 0,
          status: '',
          color: '',
          executionDates: [],
          rdoIds: [],
          startCoords: data.startCoords as { lat: number; lng: number } | undefined,
          endCoords: data.endCoords as { lat: number; lng: number } | undefined
        });
      }
    }

    // Calcula progresso e status
    const result: SegmentDetail[] = [];

    for (const [, data] of segmentData) {
      const progress = data.plannedLength > 0
        ? Math.min(100, (data.executedLength / data.plannedLength) * 100)
        : 0;

      let status: string;
      let color: string;

      if (progress >= 100) {
        status = 'concluido';
        color = '#28a745';
      } else if (progress >= 75) {
        status = 'quase_concluido';
        color = '#8bc34a';
      } else if (progress >= 50) {
        status = 'em_andamento';
        color = '#ffc107';
      } else if (progress > 0) {
        status = 'iniciado';
        color = '#fd7e14';
      } else {
        status = 'nao_iniciado';
        color = '#dc3545';
      }

      const sortedDates = data.executionDates.filter(d => d).sort();

      result.push({
        ...data,
        progressPercentage: Math.round(progress * 100) / 100,
        remainingLength: Math.round(Math.max(0, data.plannedLength - data.executedLength) * 100) / 100,
        status,
        color,
        firstExecution: sortedDates[0],
        lastExecution: sortedDates[sortedDates.length - 1]
      });
    }

    result.sort((a, b) => b.progressPercentage - a.progressPercentage);
    return result;
  }

  getChartData(): ChartData {
    const metrics = this.calculateMetrics();
    const segments = this.getSegmentDetails();

    // Status dos RDOs
    const statusChart = {
      labels: Object.keys(metrics.rdosByStatus),
      values: Object.values(metrics.rdosByStatus),
      colors: ['#ffc107', '#2196f3', '#28a745', '#dc3545']
    };

    // Progresso por sistema
    const systemLabels = Object.keys(metrics.progressBySystem).map(s =>
      s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    );
    const systemChart = {
      labels: systemLabels,
      planned: Object.values(metrics.progressBySystem).map(d => d.planned),
      executed: Object.values(metrics.progressBySystem).map(d => d.executed),
      colors: { planned: '#e0e0e0', executed: '#2196f3' }
    };

    // Timeline
    const timelineChart = {
      labels: metrics.executionTimeline.map(t => t.date),
      daily: metrics.executionTimeline.map(t => t.dailyExecuted),
      accumulated: metrics.executionTimeline.map(t => t.accumulatedExecuted)
    };

    // Progresso geral
    const progressChart = {
      completed: metrics.overallProgressPercentage,
      remaining: 100 - metrics.overallProgressPercentage,
      totalPlanned: metrics.totalPlannedLength,
      totalExecuted: metrics.totalExecutedLength
    };

    // Top servicos
    const servicesChart = {
      labels: metrics.topServices.map(s => s.name.length > 30 ? s.name.substring(0, 30) + '...' : s.name),
      values: metrics.topServices.map(s => s.totalQuantity),
      units: metrics.topServices.map(s => s.unit)
    };

    // Status dos trechos
    const statusCounts: Record<string, number> = {};
    for (const seg of segments) {
      statusCounts[seg.status] = (statusCounts[seg.status] || 0) + 1;
    }

    const segmentStatusChart = {
      labels: ['Concluido', 'Quase Concluido', 'Em Andamento', 'Iniciado', 'Nao Iniciado'],
      values: [
        statusCounts['concluido'] || 0,
        statusCounts['quase_concluido'] || 0,
        statusCounts['em_andamento'] || 0,
        statusCounts['iniciado'] || 0,
        statusCounts['nao_iniciado'] || 0
      ],
      colors: ['#28a745', '#8bc34a', '#ffc107', '#fd7e14', '#dc3545']
    };

    return {
      statusChart,
      systemChart,
      timelineChart,
      progressChart,
      servicesChart,
      segmentStatusChart,
      summary: {
        totalRdos: metrics.totalRdos,
        totalPlanned: metrics.totalPlannedLength,
        totalExecuted: metrics.totalExecutedLength,
        overallProgress: metrics.overallProgressPercentage,
        totalSegments: segments.length,
        completedSegments: statusCounts['concluido'] || 0,
        totalOccurrences: metrics.totalOccurrences
      }
    };
  }

  getMapData(): MapData {
    const segments = this.getSegmentDetails();
    const features: MapData['features'] = [];

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const segment of segments) {
      if (!segment.startCoords && !segment.endCoords) continue;

      let geometry: MapData['features'][0]['geometry'];

      if (segment.startCoords && segment.endCoords) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [segment.startCoords.lng, segment.startCoords.lat],
            [segment.endCoords.lng, segment.endCoords.lat]
          ]
        };

        minLat = Math.min(minLat, segment.startCoords.lat, segment.endCoords.lat);
        maxLat = Math.max(maxLat, segment.startCoords.lat, segment.endCoords.lat);
        minLng = Math.min(minLng, segment.startCoords.lng, segment.endCoords.lng);
        maxLng = Math.max(maxLng, segment.startCoords.lng, segment.endCoords.lng);
      } else if (segment.startCoords) {
        geometry = {
          type: 'Point',
          coordinates: [segment.startCoords.lng, segment.startCoords.lat]
        };

        minLat = Math.min(minLat, segment.startCoords.lat);
        maxLat = Math.max(maxLat, segment.startCoords.lat);
        minLng = Math.min(minLng, segment.startCoords.lng);
        maxLng = Math.max(maxLng, segment.startCoords.lng);
      } else {
        continue;
      }

      features.push({
        type: 'Feature',
        geometry,
        properties: {
          segmentId: segment.segmentId,
          segmentName: segment.segmentName,
          systemType: segment.systemType,
          plannedLength: segment.plannedLength,
          executedLength: segment.executedLength,
          progressPercentage: segment.progressPercentage,
          remainingLength: segment.remainingLength,
          status: segment.status,
          color: segment.color,
          firstExecution: segment.firstExecution,
          lastExecution: segment.lastExecution
        }
      });
    }

    const bounds = features.length > 0 && minLat !== Infinity
      ? {
        south: minLat,
        north: maxLat,
        west: minLng,
        east: maxLng,
        center: {
          lat: (minLat + maxLat) / 2,
          lng: (minLng + maxLng) / 2
        }
      }
      : undefined;

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        totalFeatures: features.length,
        bounds,
        generatedAt: new Date().toISOString()
      }
    };
  }

  getComparisonReport(projectId?: string, systemType?: string): ComparisonReport {
    let segments = this.getSegmentDetails();

    if (projectId) {
      segments = segments.filter(s => s.projectId === projectId);
    }
    if (systemType) {
      segments = segments.filter(s => s.systemType === systemType);
    }

    if (!segments.length) {
      return {
        status: 'no_data',
        filters: { projectId, systemType },
        totals: {
          totalSegments: 0,
          totalPlannedLength: 0,
          totalExecutedLength: 0,
          totalRemainingLength: 0,
          overallProgressPercentage: 0
        },
        analysis: {
          completed: { count: 0, percentage: 0, segments: [] },
          onTrack: { count: 0, percentage: 0, segments: [] },
          slightlyDelayed: { count: 0, percentage: 0, segments: [] },
          delayed: { count: 0, percentage: 0, segments: [] },
          notStarted: { count: 0, percentage: 0, segments: [] }
        },
        segmentsDetail: [],
        generatedAt: new Date().toISOString()
      };
    }

    const totalPlanned = segments.reduce((sum, s) => sum + s.plannedLength, 0);
    const totalExecuted = segments.reduce((sum, s) => sum + s.executedLength, 0);
    const totalRemaining = segments.reduce((sum, s) => sum + s.remainingLength, 0);
    const overallProgress = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

    const aheadOfSchedule = segments.filter(s => s.progressPercentage >= 100);
    const onTrack = segments.filter(s => s.progressPercentage >= 80 && s.progressPercentage < 100);
    const slightlyDelayed = segments.filter(s => s.progressPercentage >= 50 && s.progressPercentage < 80);
    const delayed = segments.filter(s => s.progressPercentage > 0 && s.progressPercentage < 50);
    const notStarted = segments.filter(s => s.progressPercentage === 0);

    const getPercentage = (count: number) => segments.length > 0
      ? Math.round((count / segments.length) * 1000) / 10
      : 0;

    return {
      status: 'success',
      filters: { projectId, systemType },
      totals: {
        totalSegments: segments.length,
        totalPlannedLength: Math.round(totalPlanned * 100) / 100,
        totalExecutedLength: Math.round(totalExecuted * 100) / 100,
        totalRemainingLength: Math.round(totalRemaining * 100) / 100,
        overallProgressPercentage: Math.round(overallProgress * 100) / 100
      },
      analysis: {
        completed: {
          count: aheadOfSchedule.length,
          percentage: getPercentage(aheadOfSchedule.length),
          segments: aheadOfSchedule.map(s => s.segmentName || s.segmentId)
        },
        onTrack: {
          count: onTrack.length,
          percentage: getPercentage(onTrack.length),
          segments: onTrack.map(s => s.segmentName || s.segmentId)
        },
        slightlyDelayed: {
          count: slightlyDelayed.length,
          percentage: getPercentage(slightlyDelayed.length),
          segments: slightlyDelayed.map(s => s.segmentName || s.segmentId)
        },
        delayed: {
          count: delayed.length,
          percentage: getPercentage(delayed.length),
          segments: delayed.map(s => s.segmentName || s.segmentId)
        },
        notStarted: {
          count: notStarted.length,
          percentage: getPercentage(notStarted.length),
          segments: notStarted.map(s => s.segmentName || s.segmentId)
        }
      },
      segmentsDetail: segments,
      generatedAt: new Date().toISOString()
    };
  }
}
