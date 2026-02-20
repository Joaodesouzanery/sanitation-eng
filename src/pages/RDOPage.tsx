/**
 * RDOPage - Relatório Diário de Obra Module
 *
 * Provides daily work report management with dashboard,
 * form entry, list view, and interactive georeferenced map.
 *
 * IMPORTAÇÃO DE TOPOGRAFIA:
 * - Permite importar dados topográficos diretamente
 * - Identifica automaticamente trechos e nós
 * - Sincroniza com dados de campo
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RDOEngine,
  type RDO as BaseRDO,
  type ExecutedService,
  type SegmentProgress as BaseSegmentProgress,
  type Worker,
  type Occurrence,
  ServiceUnit,
  RDOStatus
} from '../engine/rdo';
import { RDODashboard, type MapData } from '../engine/dashboard';
import {
  parseCSV,
  type PontoTopografico,
} from '../engine/reader';
import {
  createTrechosFromTopography,
  type Trecho
} from '../engine/domain';

// Leaflet types
declare const L: any;
declare const Chart: any;

type ViewMode = 'dashboard' | 'list' | 'form' | 'detail' | 'map' | 'import';

// Extended local interfaces for backward compatibility with existing code
interface SegmentProgress extends BaseSegmentProgress {
  plannedTotal?: number;
  executedBefore?: number;
  executedToday?: number;
}

interface RDO extends BaseRDO {
  services?: ExecutedService[];
  segments?: SegmentProgress[];
  workers?: Worker[];
  notes?: string;
}

interface DashboardMetrics {
  totalPlanned: number;
  totalExecuted: number;
  remaining: number;
  progressPercent: number;
  totalRDOs: number;
  todayRDOs: number;
  aguaProgress: { planned: number; executed: number; percent: number };
  esgotoProgress: { planned: number; executed: number; percent: number };
  drenagemProgress: { planned: number; executed: number; percent: number };
  segmentsByStatus: { completed: number; inProgress: number; notStarted: number };
}

interface ChartData {
  timeline: { labels: string[]; planned: number[]; executed: number[] };
  status: { completed: number; inProgress: number; notStarted: number };
  services: Record<string, number>;
}

interface RDOPageProps {
  projectId?: string;
  onRDOCreated?: (rdo: RDO) => void;
}

export const RDOPage: React.FC<RDOPageProps> = ({
  projectId = 'default-project',
  onRDOCreated
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [selectedRDO, setSelectedRDO] = useState<RDO | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formServices, setFormServices] = useState<Partial<ExecutedService>[]>([]);
  const [formSegments, setFormSegments] = useState<Partial<SegmentProgress>[]>([]);
  const [formWorkers, setFormWorkers] = useState<Partial<Worker>[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formOccurrences, setFormOccurrences] = useState('');

  // Estados de topografia importada
  const [topoPontos, setTopoPontos] = useState<PontoTopografico[]>([]);
  const [topoTrechos, setTopoTrechos] = useState<Trecho[]>([]);
  const [topoFileName, setTopoFileName] = useState<string>('');
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoError, setTopoError] = useState<string>('');

  // Refs
  const engineRef = useRef<RDOEngine | null>(null);
  const dashboardRef = useRef<RDODashboard | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const timelineChartRef = useRef<any>(null);
  const statusChartRef = useRef<any>(null);
  const topoFileInputRef = useRef<HTMLInputElement>(null);
  const topoMarkersRef = useRef<any>(null);
  const topoSegmentsRef = useRef<any>(null);

  // =========================================================================
  // IMPORTAÇÃO DE TOPOGRAFIA
  // =========================================================================

  // Handler para importar arquivo de topografia
  const handleTopoFileSelect = useCallback(async (file: File) => {
    setTopoLoading(true);
    setTopoError('');
    setTopoFileName(file.name);

    try {
      const content = await file.text();
      const pontos = parseCSV(content);

      if (pontos.length === 0) {
        throw new Error('Nenhum ponto encontrado no arquivo');
      }

      // Criar trechos a partir dos pontos
      const trechos = createTrechosFromTopography(pontos, 200, 'PVC');

      setTopoPontos(pontos);
      setTopoTrechos(trechos);

      // Salvar no localStorage para persistência
      localStorage.setItem('rdoTopoPontos', JSON.stringify(pontos));
      localStorage.setItem('rdoTopoTrechos', JSON.stringify(trechos));
      localStorage.setItem('rdoTopoFileName', file.name);

    } catch (err) {
      setTopoError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
    } finally {
      setTopoLoading(false);
    }
  }, []);

  // Carregar topografia do localStorage
  useEffect(() => {
    try {
      const storedPontos = localStorage.getItem('rdoTopoPontos');
      const storedTrechos = localStorage.getItem('rdoTopoTrechos');
      const storedFileName = localStorage.getItem('rdoTopoFileName');

      if (storedPontos && storedTrechos) {
        setTopoPontos(JSON.parse(storedPontos));
        setTopoTrechos(JSON.parse(storedTrechos));
        setTopoFileName(storedFileName || 'Dados importados');
      }
    } catch (e) {
      console.warn('Erro ao carregar topografia:', e);
    }
  }, []);

  // Limpar topografia importada
  const clearTopography = useCallback(() => {
    setTopoPontos([]);
    setTopoTrechos([]);
    setTopoFileName('');
    localStorage.removeItem('rdoTopoPontos');
    localStorage.removeItem('rdoTopoTrechos');
    localStorage.removeItem('rdoTopoFileName');
  }, []);

  // Transformar coordenadas UTM para LatLon
  const utmToLatLon = (x: number, y: number): { lat: number; lng: number } => {
    // Constantes para UTM Zone 23S (SIRGAS 2000)
    const k0 = 0.9996;
    const a = 6378137.0;
    const e = 0.0818191908426;
    const e1sq = 0.006739496742;
    const x0 = x - 500000;
    const y0 = y - 10000000;
    const lon0 = -45;

    const M = y0 / k0;
    const mu = M / (a * (1 - e * e / 4 - 3 * e * e * e * e / 64));
    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

    const J1 = (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32);
    const J2 = (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32);
    const J3 = (151 * e1 * e1 * e1 / 96);
    const J4 = (1097 * e1 * e1 * e1 * e1 / 512);

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const C1 = e1sq * Math.cos(fp) * Math.cos(fp);
    const T1 = Math.tan(fp) * Math.tan(fp);
    const R1 = a * (1 - e * e) / Math.pow(1 - e * e * Math.sin(fp) * Math.sin(fp), 1.5);
    const N1 = a / Math.sqrt(1 - e * e * Math.sin(fp) * Math.sin(fp));
    const D = x0 / (N1 * k0);

    const Q1 = N1 * Math.tan(fp) / R1;
    const Q2 = D * D / 2;
    const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * D * D * D * D / 24;
    const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 3 * C1 * C1 - 252 * e1sq) * D * D * D * D * D * D / 720;

    const lat = (fp - Q1 * (Q2 - Q3 + Q4)) * 180 / Math.PI;

    const Q5 = D;
    const Q6 = (1 + 2 * T1 + C1) * D * D * D / 6;
    const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * D * D * D * D * D / 120;

    const lng = lon0 + ((Q5 - Q6 + Q7) / Math.cos(fp)) * 180 / Math.PI;

    return { lat, lng };
  };

  // Converter coordenadas para mapa
  const toMapCoords = (x: number, y: number): { lat: number; lng: number } => {
    if (Math.abs(x) > 10000 || Math.abs(y) > 10000) {
      return utmToLatLon(x, y);
    }
    return {
      lat: -23.5505 + (y / 111320),
      lng: -46.6333 + (x / 111320)
    };
  };

  // Initialize engine and dashboard
  useEffect(() => {
    engineRef.current = new RDOEngine();
    dashboardRef.current = new RDODashboard([]);

    // Load RDOs from localStorage
    loadRDOsFromStorage();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [projectId]);

  // Load RDOs from localStorage
  const loadRDOsFromStorage = () => {
    try {
      const stored = localStorage.getItem('rdoData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRdos(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not load RDOs from localStorage', e);
    }
  };

  // Save RDOs to localStorage
  const saveRDOsToStorage = (newRdos: RDO[]) => {
    try {
      localStorage.setItem('rdoData', JSON.stringify(newRdos));
    } catch (e) {
      console.warn('Could not save RDOs to localStorage', e);
    }
  };

  // Calculate dashboard metrics
  useEffect(() => {
    if (viewMode === 'dashboard' && dashboardRef.current) {
      // Calculate metrics from RDOs
      const totalExecuted = rdos.reduce((sum, rdo) => {
        return sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0);
      }, 0);

      const todayStr = new Date().toISOString().slice(0, 10);
      const todayRDOs = rdos.filter(r => r.date === todayStr).length;

      setMetrics({
        totalPlanned: 1000,
        totalExecuted,
        remaining: 1000 - totalExecuted,
        progressPercent: totalExecuted / 10,
        totalRDOs: rdos.length,
        todayRDOs,
        aguaProgress: { planned: 300, executed: totalExecuted * 0.3, percent: (totalExecuted * 0.3 / 300) * 100 },
        esgotoProgress: { planned: 500, executed: totalExecuted * 0.5, percent: (totalExecuted * 0.5 / 500) * 100 },
        drenagemProgress: { planned: 200, executed: totalExecuted * 0.2, percent: (totalExecuted * 0.2 / 200) * 100 },
        segmentsByStatus: {
          completed: Math.floor(rdos.length * 0.3),
          inProgress: Math.floor(rdos.length * 0.5),
          notStarted: Math.floor(rdos.length * 0.2)
        }
      });

      // Generate chart data
      const labels = [];
      const plannedData = [];
      const executedData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        plannedData.push(1000);
        executedData.push(Math.min(1000 * (1 - i * 0.12), 1000));
      }

      setChartData({
        timeline: { labels, planned: plannedData, executed: executedData },
        status: {
          completed: Math.floor(rdos.length * 0.3),
          inProgress: Math.floor(rdos.length * 0.5),
          notStarted: Math.floor(rdos.length * 0.2)
        },
        services: rdos.reduce((acc, rdo) => {
          rdo.services?.forEach(s => {
            if (!acc[s.serviceName]) acc[s.serviceName] = 0;
            acc[s.serviceName] += s.quantity;
          });
          return acc;
        }, {} as Record<string, number>)
      });
    }
  }, [viewMode, rdos]);

  // Render charts
  useEffect(() => {
    if (viewMode !== 'dashboard' || !chartData || typeof Chart === 'undefined') return;

    // Timeline chart
    const timelineCanvas = document.getElementById('rdo-chart-timeline') as HTMLCanvasElement;
    if (timelineCanvas) {
      if (timelineChartRef.current) timelineChartRef.current.destroy();

      timelineChartRef.current = new Chart(timelineCanvas, {
        type: 'line',
        data: {
          labels: chartData.timeline.labels,
          datasets: [
            {
              label: 'Planejado',
              data: chartData.timeline.planned,
              borderColor: '#3b82f6',
              borderDash: [5, 5],
              fill: false,
              tension: 0.1
            },
            {
              label: 'Executado',
              data: chartData.timeline.executed,
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' as const } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Metros (m)' } } }
        }
      });
    }

    // Status chart
    const statusCanvas = document.getElementById('rdo-chart-status') as HTMLCanvasElement;
    if (statusCanvas) {
      if (statusChartRef.current) statusChartRef.current.destroy();

      statusChartRef.current = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Concluído', 'Em Execução', 'Não Iniciado'],
          datasets: [{
            data: [chartData.status.completed, chartData.status.inProgress, chartData.status.notStarted],
            backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'right' as const } }
        }
      });
    }
  }, [chartData, viewMode]);

  // Update map with segments and topography data
  const updateMap = useCallback(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing layers (except tile layer)
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Polyline || layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        if (!layer._url) { // Don't remove tile layers
          mapInstanceRef.current.removeLayer(layer);
        }
      }
    });

    const bounds: [number, number][] = [];

    // =========================================================================
    // RENDER IMPORTED TOPOGRAPHY DATA
    // =========================================================================
    if (topoPontos.length > 0) {
      const referencePoint = { x: topoPontos[0].x, y: topoPontos[0].y };

      // Add topography markers (nós)
      topoPontos.forEach((ponto, idx) => {
        const coords = toMapCoords(ponto.x, ponto.y);
        bounds.push([coords.lat, coords.lng]);

        // Color based on position
        let markerColor = '#8b5cf6';  // Purple for topography
        let label = 'PI';
        if (idx === 0) {
          markerColor = '#22c55e';  // Green for start
          label = 'M';
        } else if (idx === topoPontos.length - 1) {
          markerColor = '#ef4444';  // Red for end
          label = 'J';
        }

        const marker = L.circleMarker([coords.lat, coords.lng], {
          radius: 8,
          fillColor: markerColor,
          fillOpacity: 0.9,
          color: '#ffffff',
          weight: 2
        }).addTo(mapInstanceRef.current);

        marker.bindTooltip(`<strong>${ponto.id}</strong><br/>Cota: ${ponto.cota.toFixed(2)}m`, {
          permanent: false,
          direction: 'top',
          offset: [0, -8]
        });

        marker.bindPopup(`
          <div style="min-width: 160px; font-family: system-ui, sans-serif;">
            <div style="background: ${markerColor}; color: white; padding: 6px 10px; margin: -10px -16px 8px; border-radius: 4px 4px 0 0;">
              <strong>${ponto.id}</strong> <span style="float: right; font-size: 0.8rem;">${label}</span>
            </div>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color: #666;">X (UTM)</td><td style="text-align: right;">${ponto.x.toFixed(2)}</td></tr>
              <tr><td style="color: #666;">Y (UTM)</td><td style="text-align: right;">${ponto.y.toFixed(2)}</td></tr>
              <tr><td style="color: #666;">Cota</td><td style="text-align: right; font-weight: bold;">${ponto.cota.toFixed(2)}m</td></tr>
            </table>
          </div>
        `, { maxWidth: 250, autoPan: false });
      });

      // Add topography segments (trechos)
      topoTrechos.forEach((trecho, idx) => {
        const startCoords = toMapCoords(trecho.xInicio, trecho.yInicio);
        const endCoords = toMapCoords(trecho.xFim, trecho.yFim);

        // Color based on network type
        let lineColor = '#8b5cf6';  // Purple for topography
        let lineStyle: string | undefined;
        if (trecho.tipoRede === 'Elevatoria / Booster') {
          lineColor = '#f59e0b';
          lineStyle = '5, 5';
        } else if (trecho.declividade < 0) {
          lineColor = '#ef4444';
        }

        const polyline = L.polyline(
          [[startCoords.lat, startCoords.lng], [endCoords.lat, endCoords.lng]],
          {
            color: lineColor,
            weight: 4,
            opacity: 0.8,
            dashArray: lineStyle
          }
        ).addTo(mapInstanceRef.current);

        const declPercent = (trecho.declividade * 100).toFixed(3);
        polyline.bindPopup(`
          <div style="min-width: 180px; font-family: system-ui, sans-serif;">
            <div style="background: ${lineColor}; color: white; padding: 6px 10px; margin: -10px -16px 8px; border-radius: 4px 4px 0 0;">
              <strong>Trecho ${idx + 1}</strong>
            </div>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color: #666;">De → Para</td><td>${trecho.idInicio} → ${trecho.idFim}</td></tr>
              <tr><td style="color: #666;">Comprimento</td><td style="text-align: right; font-weight: bold;">${trecho.comprimento.toFixed(2)}m</td></tr>
              <tr><td style="color: #666;">Declividade</td><td style="text-align: right;">${declPercent}%</td></tr>
              <tr><td style="color: #666;">DN</td><td style="text-align: right;">${trecho.diametroMm}mm</td></tr>
              <tr><td style="color: #666;">Material</td><td style="text-align: right;">${trecho.material}</td></tr>
            </table>
          </div>
        `, { maxWidth: 280, autoPan: false });
      });
    }

    // =========================================================================
    // RENDER RDO SEGMENTS (existing sample data)
    // =========================================================================
    const segmentCoords: Record<string, [number, number][]> = {
      'seg1': [[-23.5500, -46.6340], [-23.5510, -46.6320]],
      'seg2': [[-23.5510, -46.6320], [-23.5525, -46.6300]],
      'seg3': [[-23.5525, -46.6300], [-23.5540, -46.6280]],
      'seg4': [[-23.5495, -46.6350], [-23.5505, -46.6330]],
      'seg5': [[-23.5505, -46.6330], [-23.5520, -46.6310]],
      'seg6': [[-23.5530, -46.6350], [-23.5545, -46.6320]]
    };

    // Only show sample segments if no topography is loaded
    if (topoPontos.length === 0) {
      Object.entries(segmentCoords).forEach(([segId, coords]) => {
        const system = segId.includes('1') || segId.includes('2') ? 'agua' :
                       segId.includes('3') || segId.includes('4') ? 'esgoto' : 'drenagem';

        if (systemFilter && system !== systemFilter) return;

        bounds.push(...coords);

        const progress = Math.random() * 100;
        const color = progress >= 100 ? '#22c55e' : progress > 0 ? '#f59e0b' : '#ef4444';

        const polyline = L.polyline(coords, {
          color: color,
          weight: progress >= 100 ? 6 : 4,
          opacity: 0.8
        }).addTo(mapInstanceRef.current);

        const systemIcon = system === 'agua' ? '💧' : system === 'esgoto' ? '🚰' : '🌧️';

        polyline.bindPopup(`
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px; color: #333;">${segId}</h4>
            <p style="margin: 4px 0;"><strong>Sistema:</strong> ${systemIcon} ${system}</p>
            <p style="margin: 4px 0;"><strong>Planejado:</strong> 100m</p>
            <p style="margin: 4px 0;"><strong>Executado:</strong> ${progress.toFixed(1)}m</p>
            <p style="margin: 4px 0;"><strong>Progresso:</strong> ${progress.toFixed(1)}%</p>
            <div style="background: #eee; border-radius: 10px; height: 10px; margin-top: 8px;">
              <div style="background: ${color}; height: 100%; width: ${Math.min(progress, 100)}%; border-radius: 10px;"></div>
            </div>
          </div>
        `);

        L.circleMarker(coords[0], {
          radius: 6,
          fillColor: color,
          fillOpacity: 1,
          color: 'white',
          weight: 2
        }).addTo(mapInstanceRef.current);

        L.circleMarker(coords[1], {
          radius: 6,
          fillColor: color,
          fillOpacity: 1,
          color: 'white',
          weight: 2
        }).addTo(mapInstanceRef.current);
      });
    }

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [systemFilter, topoPontos, topoTrechos]);

  // Initialize map
  useEffect(() => {
    if (viewMode !== 'map' || typeof L === 'undefined' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current).setView([-23.5505, -46.6333], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    updateMap();
  }, [viewMode, updateMap, topoPontos, topoTrechos]);

  // Create new RDO
  const handleCreateRDO = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormServices([{ serviceName: '', quantity: 0, unit: 'm' as ServiceUnit }]);
    setFormSegments([{ segmentName: '', plannedTotal: 0, executedBefore: 0, executedToday: 0 }]);
    setFormWorkers([]);
    setFormNotes('');
    setFormOccurrences('');
    setViewMode('form');
  };

  // Save RDO
  const handleSaveRDO = (status: RDOStatus = RDOStatus.RASCUNHO) => {
    const now = new Date().toISOString();
    const newRDO: RDO = {
      id: `rdo-${Date.now()}`,
      projectId,
      date: formDate,
      projectName: 'Projeto Saneamento',
      status,
      workFronts: [],
      workFrontNames: [],
      workLocations: [],
      workLocationNames: [],
      executedServices: formServices.filter(s => s.serviceName) as ExecutedService[],
      segmentProgress: formSegments.filter(s => s.segmentName) as SegmentProgress[],
      visits: [],
      occurrences: formOccurrences ? [{
        id: `occ-${Date.now()}`,
        type: 'geral',
        description: formOccurrences,
        severity: 'baixa',
        timestamp: now
      }] : [],
      financialEntries: [],
      dailyLaborCost: 0,
      dailyMaterialCost: 0,
      dailyEquipmentCost: 0,
      dailyTotalCost: 0,
      generalNotes: formNotes,
      createdAt: now,
      updatedAt: now,
      version: 1,
      history: [],
      // Extended fields for local compatibility
      services: formServices.filter(s => s.serviceName) as ExecutedService[],
      segments: formSegments.filter(s => s.segmentName) as SegmentProgress[],
      workers: formWorkers.filter(w => w.name) as Worker[],
      notes: formNotes
    };

    const newRdos = [...rdos, newRDO];
    setRdos(newRdos);
    saveRDOsToStorage(newRdos);

    if (onRDOCreated) {
      onRDOCreated(newRDO);
    }

    setViewMode('list');
  };

  // Delete RDO
  const handleDeleteRDO = (rdoId: string) => {
    if (confirm('Tem certeza que deseja excluir este RDO?')) {
      const newRdos = rdos.filter(r => r.id !== rdoId);
      setRdos(newRdos);
      saveRDOsToStorage(newRdos);
    }
  };

  // View RDO detail
  const handleViewDetail = (rdo: RDO) => {
    setSelectedRDO(rdo);
    setViewMode('detail');
  };

  // Filter RDOs
  const filteredRDOs = rdos.filter(rdo => {
    if (searchTerm && !rdo.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !rdo.date.includes(searchTerm)) {
      return false;
    }
    if (statusFilter && rdo.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Get progress color
  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return '#22c55e';
    if (progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Add service row
  const addServiceRow = () => {
    setFormServices([...formServices, { serviceName: '', quantity: 0, unit: 'm' as ServiceUnit }]);
  };

  // Add segment row
  const addSegmentRow = () => {
    setFormSegments([...formSegments, { segmentName: '', plannedTotal: 0, executedBefore: 0, executedToday: 0 }]);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>📋</span> RDO - Relatório Diário de Obra
      </h1>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setViewMode('dashboard')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: viewMode === 'dashboard' ? '#3b82f6' : '#334155',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: viewMode === 'list' ? '#3b82f6' : '#334155',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          📋 Lista de RDOs
        </button>
        <button
          onClick={handleCreateRDO}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: viewMode === 'form' ? '#22c55e' : '#22c55e',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ➕ Novo RDO
        </button>
        <button
          onClick={() => setViewMode('map')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: viewMode === 'map' ? '#3b82f6' : '#334155',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          🗺️ Mapa
        </button>
        <button
          onClick={() => setViewMode('import')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: viewMode === 'import' ? '#8b5cf6' : '#334155',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          📥 Importar Topografia
        </button>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && metrics && (
        <div>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Planejado</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{metrics.totalPlanned}m</p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Executado</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{metrics.totalExecuted.toFixed(0)}m</p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Restante</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{metrics.remaining.toFixed(0)}m</p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Progresso</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{metrics.progressPercent.toFixed(1)}%</p>
              <div style={{ backgroundColor: '#334155', borderRadius: '10px', height: '8px', marginTop: '10px' }}>
                <div style={{
                  backgroundColor: '#8b5cf6',
                  height: '100%',
                  width: `${Math.min(metrics.progressPercent, 100)}%`,
                  borderRadius: '10px'
                }} />
              </div>
            </div>
          </div>

          {/* System Progress */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '20px'
          }}>
            {/* Água */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
                  💧 Água
                </span>
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{metrics.aguaProgress.percent.toFixed(1)}%</span>
              </div>
              <div style={{ backgroundColor: '#334155', borderRadius: '10px', height: '8px' }}>
                <div style={{
                  backgroundColor: '#60a5fa',
                  height: '100%',
                  width: `${Math.min(metrics.aguaProgress.percent, 100)}%`,
                  borderRadius: '10px'
                }} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>
                {metrics.aguaProgress.executed.toFixed(0)}m / {metrics.aguaProgress.planned}m
              </p>
            </div>

            {/* Esgoto */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e' }}>
                  🚰 Esgoto
                </span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{metrics.esgotoProgress.percent.toFixed(1)}%</span>
              </div>
              <div style={{ backgroundColor: '#334155', borderRadius: '10px', height: '8px' }}>
                <div style={{
                  backgroundColor: '#22c55e',
                  height: '100%',
                  width: `${Math.min(metrics.esgotoProgress.percent, 100)}%`,
                  borderRadius: '10px'
                }} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>
                {metrics.esgotoProgress.executed.toFixed(0)}m / {metrics.esgotoProgress.planned}m
              </p>
            </div>

            {/* Drenagem */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                  🌧️ Drenagem
                </span>
                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{metrics.drenagemProgress.percent.toFixed(1)}%</span>
              </div>
              <div style={{ backgroundColor: '#334155', borderRadius: '10px', height: '8px' }}>
                <div style={{
                  backgroundColor: '#f59e0b',
                  height: '100%',
                  width: `${Math.min(metrics.drenagemProgress.percent, 100)}%`,
                  borderRadius: '10px'
                }} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>
                {metrics.drenagemProgress.executed.toFixed(0)}m / {metrics.drenagemProgress.planned}m
              </p>
            </div>
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px'
          }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ color: '#94a3b8', marginBottom: '15px' }}>📈 Evolução Semanal</h3>
              <canvas id="rdo-chart-timeline" height="200" />
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ color: '#94a3b8', marginBottom: '15px' }}>📊 Status dos Trechos</h3>
              <canvas id="rdo-chart-status" height="200" />
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '10px 15px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '10px 15px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            >
              <option value="">Todos os Status</option>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>

          {filteredRDOs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <p style={{ fontSize: '2rem', marginBottom: '10px' }}>📋</p>
              <p>Nenhum RDO encontrado</p>
              <button
                onClick={handleCreateRDO}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ➕ Criar Primeiro RDO
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#0f172a' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Data</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Projeto</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Serviços</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Trechos</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Executado</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRDOs.map((rdo) => {
                  const totalExecuted = rdo.segments?.reduce((sum, s) => sum + (s.executedToday || 0), 0) || 0;
                  const statusColors: Record<string, string> = {
                    'rascunho': '#f59e0b',
                    'enviado': '#3b82f6',
                    'aprovado': '#22c55e',
                    'rejeitado': '#ef4444'
                  };

                  return (
                    <tr key={rdo.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px' }}>{formatDate(rdo.date)}</td>
                      <td style={{ padding: '10px' }}>{rdo.projectName}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{rdo.services?.length || 0}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{rdo.segments?.length || 0}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{totalExecuted.toFixed(2)}m</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: statusColors[rdo.status] || '#334155',
                          color: 'white',
                          fontSize: '0.8rem'
                        }}>
                          {rdo.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleViewDetail(rdo)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#334155',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            marginRight: '5px'
                          }}
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleDeleteRDO(rdo.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Form View */}
      {viewMode === 'form' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ color: '#94a3b8', marginBottom: '20px' }}>📝 Novo Relatório Diário de Obra</h2>

          {/* Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>Data</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                width: '200px'
              }}
            />
          </div>

          {/* Services */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#3b82f6', margin: 0 }}>🔧 Serviços Executados</h3>
              <button
                onClick={addServiceRow}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ➕ Adicionar
              </button>
            </div>

            {formServices.map((service, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Nome do serviço"
                  value={service.serviceName || ''}
                  onChange={(e) => {
                    const newServices = [...formServices];
                    newServices[idx] = { ...newServices[idx], serviceName: e.target.value };
                    setFormServices(newServices);
                  }}
                  style={{
                    flex: 2,
                    minWidth: '200px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <input
                  type="number"
                  placeholder="Qtd"
                  value={service.quantity || ''}
                  onChange={(e) => {
                    const newServices = [...formServices];
                    newServices[idx] = { ...newServices[idx], quantity: Number(e.target.value) };
                    setFormServices(newServices);
                  }}
                  style={{
                    width: '100px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <select
                  value={service.unit || 'm'}
                  onChange={(e) => {
                    const newServices = [...formServices];
                    newServices[idx] = { ...newServices[idx], unit: e.target.value as ServiceUnit };
                    setFormServices(newServices);
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                >
                  <option value="m">m</option>
                  <option value="m2">m²</option>
                  <option value="m3">m³</option>
                  <option value="un">un</option>
                  <option value="vb">vb</option>
                </select>
                <button
                  onClick={() => setFormServices(formServices.filter((_, i) => i !== idx))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Segments */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#22c55e', margin: 0 }}>📏 Avanço por Trecho</h3>
              <button
                onClick={addSegmentRow}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ➕ Adicionar
              </button>
            </div>

            {formSegments.map((segment, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Nome do trecho"
                  value={segment.segmentName || ''}
                  onChange={(e) => {
                    const newSegments = [...formSegments];
                    newSegments[idx] = { ...newSegments[idx], segmentName: e.target.value };
                    setFormSegments(newSegments);
                  }}
                  style={{
                    flex: 2,
                    minWidth: '150px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <input
                  type="number"
                  placeholder="Planejado"
                  value={segment.plannedTotal || ''}
                  onChange={(e) => {
                    const newSegments = [...formSegments];
                    newSegments[idx] = { ...newSegments[idx], plannedTotal: Number(e.target.value) };
                    setFormSegments(newSegments);
                  }}
                  style={{
                    width: '100px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <input
                  type="number"
                  placeholder="Exec. Anterior"
                  value={segment.executedBefore || ''}
                  onChange={(e) => {
                    const newSegments = [...formSegments];
                    newSegments[idx] = { ...newSegments[idx], executedBefore: Number(e.target.value) };
                    setFormSegments(newSegments);
                  }}
                  style={{
                    width: '100px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <input
                  type="number"
                  placeholder="Exec. Hoje"
                  value={segment.executedToday || ''}
                  onChange={(e) => {
                    const newSegments = [...formSegments];
                    newSegments[idx] = { ...newSegments[idx], executedToday: Number(e.target.value) };
                    setFormSegments(newSegments);
                  }}
                  style={{
                    width: '100px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                />
                <button
                  onClick={() => setFormSegments(formSegments.filter((_, i) => i !== idx))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Notes & Occurrences */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>Observações</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Observações gerais..."
                style={{
                  width: '100%',
                  height: '100px',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  resize: 'vertical'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>Ocorrências</label>
              <textarea
                value={formOccurrences}
                onChange={(e) => setFormOccurrences(e.target.value)}
                placeholder="Ocorrências do dia..."
                style={{
                  width: '100%',
                  height: '100px',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSaveRDO(RDOStatus.RASCUNHO)}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              💾 Salvar Rascunho
            </button>
            <button
              onClick={() => handleSaveRDO(RDOStatus.ENVIADO)}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              📤 Enviar RDO
            </button>
          </div>
        </div>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && selectedRDO && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#94a3b8', margin: 0 }}>📋 Detalhes do RDO</h2>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ← Voltar
            </button>
          </div>

          {/* Info Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ padding: '15px', backgroundColor: '#0f172a', borderRadius: '10px' }}>
              <small style={{ color: '#94a3b8' }}>Projeto</small>
              <div style={{ fontWeight: '600', marginTop: '5px' }}>{selectedRDO.projectName}</div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#0f172a', borderRadius: '10px' }}>
              <small style={{ color: '#94a3b8' }}>Data</small>
              <div style={{ fontWeight: '600', marginTop: '5px' }}>{formatDate(selectedRDO.date)}</div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#0f172a', borderRadius: '10px' }}>
              <small style={{ color: '#94a3b8' }}>Status</small>
              <div style={{ fontWeight: '600', marginTop: '5px', textTransform: 'capitalize' }}>{selectedRDO.status}</div>
            </div>
          </div>

          {/* Services */}
          {selectedRDO.services && selectedRDO.services.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#3b82f6', marginBottom: '10px' }}>🔧 Serviços Executados</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Serviço</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRDO.services.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px' }}>{s.serviceName}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{s.quantity} {s.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Segments */}
          {selectedRDO.segments && selectedRDO.segments.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#22c55e', marginBottom: '10px' }}>📏 Avanço por Trecho</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Trecho</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Planejado</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Exec. Anterior</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Exec. Hoje</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRDO.segments.map((s, idx) => {
                    const total = (s.executedBefore || 0) + (s.executedToday || 0);
                    const progress = s.plannedTotal ? (total / s.plannedTotal) * 100 : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '10px', fontWeight: '600' }}>{s.segmentName}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{s.plannedTotal}m</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{s.executedBefore}m</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#22c55e', fontWeight: '600' }}>+{s.executedToday}m</td>
                        <td style={{ padding: '10px', width: '120px' }}>
                          <div style={{ backgroundColor: '#334155', borderRadius: '10px', height: '10px' }}>
                            <div style={{
                              backgroundColor: getProgressColor(progress),
                              height: '100%',
                              width: `${Math.min(progress, 100)}%`,
                              borderRadius: '10px'
                            }} />
                          </div>
                          <small style={{ color: '#94a3b8' }}>{progress.toFixed(1)}%</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          {selectedRDO.notes && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '10px' }}>
              <h4 style={{ marginBottom: '10px' }}>📝 Observações</h4>
              <p>{selectedRDO.notes}</p>
            </div>
          )}

          {/* Occurrences */}
          {selectedRDO.occurrences && selectedRDO.occurrences.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '10px', borderLeft: '4px solid #ef4444' }}>
              <h4 style={{ marginBottom: '10px', color: '#ef4444' }}>⚠️ Ocorrências</h4>
              {selectedRDO.occurrences.map((occ, idx) => (
                <p key={idx}>{occ.description}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ color: '#94a3b8', margin: 0 }}>🗺️ Mapa Georreferenciado</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={systemFilter}
                onChange={(e) => {
                  setSystemFilter(e.target.value);
                  setTimeout(updateMap, 100);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0'
                }}
              >
                <option value="">Todos os Sistemas</option>
                <option value="agua">💧 Água</option>
                <option value="esgoto">🚰 Esgoto</option>
                <option value="drenagem">🌧️ Drenagem</option>
              </select>
              <button
                onClick={updateMap}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🔄 Atualizar
              </button>
            </div>
          </div>

          {/* Indicador de Topografia Importada */}
          {topoPontos.length > 0 && (
            <div style={{
              marginBottom: '10px',
              padding: '10px 15px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: '#a78bfa' }}>
                📍 Topografia carregada: <strong>{topoPontos.length} nós</strong> e <strong>{topoTrechos.length} trechos</strong>
                {topoFileName && ` (${topoFileName})`}
              </span>
              <button
                onClick={() => setViewMode('import')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Gerenciar
              </button>
            </div>
          )}

          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '10px',
            flexWrap: 'wrap',
            color: '#94a3b8',
            fontSize: '0.85rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '20px', height: '4px', backgroundColor: '#22c55e' }}></span>
              Concluído
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '20px', height: '4px', backgroundColor: '#f59e0b' }}></span>
              Em Execução
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '20px', height: '4px', backgroundColor: '#ef4444' }}></span>
              Não Iniciado
            </span>
            {topoPontos.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8b5cf6', border: '2px solid white' }}></span>
                Topografia
              </span>
            )}
          </div>

          <div
            ref={mapContainerRef}
            style={{
              height: '500px',
              borderRadius: '8px',
              backgroundColor: '#0f172a'
            }}
          >
            {typeof L === 'undefined' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#94a3b8'
              }}>
                <p>Carregue a biblioteca Leaflet para visualizar o mapa</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Topography View */}
      {viewMode === 'import' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ color: '#94a3b8', marginBottom: '20px' }}>📥 Importar Dados Topográficos</h2>

          {/* Drop Zone */}
          <div
            onClick={() => topoFileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleTopoFileSelect(file);
            }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: '2px dashed #475569',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#0f172a',
              marginBottom: '20px'
            }}
          >
            {topoLoading ? (
              <p style={{ color: '#3b82f6' }}>⏳ Processando...</p>
            ) : (
              <>
                <p style={{ fontSize: '2rem', marginBottom: '10px' }}>📍</p>
                <p style={{ color: '#94a3b8' }}>Arraste o arquivo de topografia aqui ou clique para selecionar</p>
                <p style={{ color: '#3b82f6', fontSize: '0.85rem', marginTop: '10px' }}>Formatos: .txt, .csv</p>
              </>
            )}
            <input
              ref={topoFileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTopoFileSelect(file);
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Error Message */}
          {topoError && (
            <div style={{
              padding: '15px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              marginBottom: '20px',
              color: '#fca5a5'
            }}>
              ❌ {topoError}
            </div>
          )}

          {/* Imported Data Summary */}
          {topoPontos.length > 0 && (
            <div>
              <div style={{
                padding: '15px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22c55e',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ color: '#86efac', margin: 0 }}>
                  ✅ Topografia importada com sucesso: <strong>{topoFileName}</strong>
                </p>
              </div>

              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '15px',
                marginBottom: '20px'
              }}>
                <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '15px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Nós</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{topoPontos.length}</p>
                </div>
                <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '15px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Trechos</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{topoTrechos.length}</p>
                </div>
                <div style={{ backgroundColor: '#0f172a', borderRadius: '10px', padding: '15px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Comprimento Total</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    {topoTrechos.reduce((sum, t) => sum + t.comprimento, 0).toFixed(1)}m
                  </p>
                </div>
              </div>

              {/* Nós Table */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#8b5cf6', marginBottom: '10px' }}>📍 Nós Identificados</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #334155' }}>ID</th>
                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>X (UTM)</th>
                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Y (UTM)</th>
                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Cota (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topoPontos.slice(0, 20).map((ponto, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{ponto.id}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{ponto.x.toFixed(3)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{ponto.y.toFixed(3)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{ponto.cota.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {topoPontos.length > 20 && (
                    <p style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>
                      ... e mais {topoPontos.length - 20} nós
                    </p>
                  )}
                </div>
              </div>

              {/* Trechos Table */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#22c55e', marginBottom: '10px' }}>📏 Trechos Identificados</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ backgroundColor: '#0f172a' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #334155' }}>De</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Para</th>
                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Comp. (m)</th>
                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Decliv. (%)</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topoTrechos.slice(0, 20).map((trecho, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '8px' }}>{trecho.idInicio}</td>
                          <td style={{ padding: '8px' }}>{trecho.idFim}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{trecho.comprimento.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{(trecho.declividade * 100).toFixed(3)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              backgroundColor: trecho.tipoRede === 'Esgoto por Gravidade' ? '#22c55e' : '#f59e0b',
                              color: 'white'
                            }}>
                              {trecho.tipoRede === 'Esgoto por Gravidade' ? 'Gravidade' : 'Elevatória'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {topoTrechos.length > 20 && (
                    <p style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>
                      ... e mais {topoTrechos.length - 20} trechos
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={clearTopography}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Limpar Dados
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🗺️ Ver no Mapa
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RDOPage;
