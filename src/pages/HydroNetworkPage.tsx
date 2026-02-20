/**
 * HydroNetworkPage - Unified Sanitation Engineering Platform
 *
 * Combines all modules: Topografia, Orcamento, Execucao, Planejamento, RDO, Resultados
 * into a single tabbed interface for complete sanitation network management.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  parseCSV,
  createSampleTopography,
  exportToCSV,
  type PontoTopografico,
} from '../engine/reader';
import {
  createTrechosFromTopography,
  summarizeNetwork,
  trechosToRecords,
  type Trecho,
  type NetworkSummary
} from '../engine/domain';
import {
  generateFullSchedule,
  generateCurveSData,
  generateHistogramData,
  type FullSchedule,
  type TeamConfig,
  type TrechoInput,
  type CurveSPoint,
  type HistogramDay
} from '../engine/planning';
import {
  RDOEngine,
  type ExecutedService,
  type SegmentProgress as BaseSegmentProgress,
  ServiceUnit
} from '../engine/rdo';
import { RDODashboard } from '../engine/dashboard';
import {
  generateBudgetFromTrechos,
  type BudgetSummary
} from '../engine/budget';
import { TopografiaImportNovo } from '../components/hydronetwork/TopografiaImportNovo';

// Declare external libraries
declare const L: any;
declare const Chart: any;

// Extended SegmentProgress for form compatibility
interface SegmentProgress extends BaseSegmentProgress {
  id?: string;
  plannedTotal?: number;
  executedBefore?: number;
  executedToday?: number;
}

type TabType = 'topografia' | 'orcamento' | 'execucao' | 'planejamento' | 'rdo' | 'resultados';
type RDOViewMode = 'dashboard' | 'list' | 'form' | 'detail';

// Simplified RDO interface for local state management
interface RDO {
  id: string;
  projectId: string;
  date: string;
  status: string;
  services: ExecutedService[];
  segments: Array<SegmentProgress & { executedToday?: number; plannedTotal?: number; executedBefore?: number; segmentName?: string }>;
  notes: string;
  occurrences: string;
  createdAt: string;
  updatedAt: string;
}

// UTM to Lat/Lng conversion
const EQUATORIAL_RADIUS = 6378137.0;
const E_SQUARED = 0.00669437999014;
const K0 = 0.9996;

function isUTM(x: number, y: number): boolean {
  return x > 1000 && x < 1000000 && y > 100000;
}

function utmToLatLng(
  easting: number,
  northing: number,
  zone: number = 23,
  hemisphere: 'N' | 'S' = 'S'
): { lat: number; lng: number } {
  const x = easting - 500000;
  const y = hemisphere === 'S' ? northing - 10000000 : northing;

  const m = y / K0;
  const mu = m / (EQUATORIAL_RADIUS * (1 - E_SQUARED / 4 - 3 * E_SQUARED ** 2 / 64));

  const e1 = (1 - Math.sqrt(1 - E_SQUARED)) / (1 + Math.sqrt(1 - E_SQUARED));
  const phi1 = mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const n1 = EQUATORIAL_RADIUS / Math.sqrt(1 - E_SQUARED * sinPhi1 ** 2);
  const r1 = EQUATORIAL_RADIUS * (1 - E_SQUARED) / (1 - E_SQUARED * sinPhi1 ** 2) ** 1.5;
  const d = x / (n1 * K0);

  const lat = phi1 - (n1 * tanPhi1 / r1) * (
    d ** 2 / 2 -
    (5 + 3 * tanPhi1 ** 2) * d ** 4 / 24 +
    (61 + 90 * tanPhi1 ** 2) * d ** 6 / 720
  );

  const lng = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180 +
    (d - (1 + 2 * tanPhi1 ** 2) * d ** 3 / 6 +
    (5 - 2 * tanPhi1 ** 2 + 28 * tanPhi1 ** 2) * d ** 5 / 120) / cosPhi1;

  return {
    lat: lat * 180 / Math.PI,
    lng: lng * 180 / Math.PI
  };
}

function getMapCoordinates(x: number, y: number, refX?: number, refY?: number): [number, number] {
  if (isUTM(x, y)) {
    const { lat, lng } = utmToLatLng(x, y);
    return [lat, lng];
  }
  // Fallback to relative positioning if not UTM
  const baseLat = -23.5505;
  const baseLng = -46.6333;
  const offsetLat = refY !== undefined ? (y - refY) / 111000 : 0;
  const offsetLng = refX !== undefined ? (x - refX) / 111000 : 0;
  return [baseLat + offsetLat, baseLng + offsetLng];
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e2e8f0',
    padding: '20px 40px'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px'
  },
  headerIcon: {
    width: '32px',
    height: '32px',
    color: '#3b82f6'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: '#1e293b',
    margin: 0
  },
  subtitle: {
    color: '#64748b',
    fontSize: '14px',
    margin: 0
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#f1f5f9',
    padding: '6px',
    borderRadius: '12px',
    margin: '20px 40px'
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500' as const,
    transition: 'all 0.2s'
  },
  tabActive: {
    backgroundColor: 'white',
    color: '#1e293b',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  tabInactive: {
    backgroundColor: 'transparent',
    color: '#64748b'
  },
  content: {
    padding: '0 40px 40px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    marginBottom: '20px'
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#1e293b'
  },
  cardSubtitle: {
    color: '#64748b',
    fontSize: '13px',
    marginBottom: '20px'
  },
  dropZone: {
    border: '2px dashed #cbd5e1',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  dropZoneActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)'
  },
  select: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#1e293b',
    fontSize: '14px',
    minWidth: '140px',
    cursor: 'pointer'
  },
  button: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  buttonSuccess: {
    backgroundColor: '#22c55e',
    color: 'white'
  },
  buttonSecondary: {
    backgroundColor: '#f1f5f9',
    color: '#64748b'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e2e8f0'
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: '12px',
    marginBottom: '4px'
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700' as const,
    color: '#1e293b'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px'
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: '600' as const,
    color: '#64748b'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b'
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#1e293b',
    fontSize: '14px',
    width: '100%'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#64748b',
    fontSize: '13px',
    cursor: 'pointer'
  }
};

export const HydroNetworkPage: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('topografia');

  // Topografia state
  const [pontos, setPontos] = useState<PontoTopografico[]>([]);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [diametroMm, setDiametroMm] = useState(200);
  const [material, setMaterial] = useState('PVC');

  // Orcamento state
  const [budget, setBudget] = useState<BudgetSummary | null>(null);

  // Planejamento state
  const [schedule, setSchedule] = useState<FullSchedule | null>(null);
  const [curveS, setCurveS] = useState<CurveSPoint[]>([]);
  const [histogram, setHistogram] = useState<HistogramDay[]>([]);
  const [numTeams, setNumTeams] = useState(2);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [teamConfig, setTeamConfig] = useState<TeamConfig>({
    encarregado: 1,
    oficiais: 2,
    ajudantes: 4,
    operador: 1,
    metrosDiaBase: 12,
    hoursPerDay: 8,
    hasRetro: true,
    hasCompactor: true,
    hasTruck: true,
    hasPump: false
  });

  // RDO state
  const [rdoView, setRdoView] = useState<RDOViewMode>('dashboard');
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [selectedRDO, setSelectedRDO] = useState<RDO | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formServices, setFormServices] = useState<Partial<ExecutedService>[]>([]);
  const [formSegments, setFormSegments] = useState<Partial<SegmentProgress>[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formOccurrences, setFormOccurrences] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const segmentsLayerRef = useRef<any>(null);
  const curveChartRef = useRef<any>(null);
  const histogramChartRef = useRef<any>(null);

  // Load RDOs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('rdoData');
    if (stored) {
      try {
        setRdos(JSON.parse(stored));
      } catch (e) {
        console.warn('Could not load RDOs');
      }
    }
  }, []);

  // Initialize map - re-runs when pontos/trechos change so the container is available in the DOM
  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapContainerRef.current).setView([-23.5505, -46.6333], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    segmentsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pontos, trechos]);

  // Update map when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !segmentsLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    segmentsLayerRef.current.clearLayers();

    if (pontos.length === 0) return;

    const bounds: [number, number][] = [];
    const refX = pontos[0].x;
    const refY = pontos[0].y;

    pontos.forEach((ponto, idx) => {
      const [lat, lng] = getMapCoordinates(ponto.x, ponto.y, refX, refY);
      bounds.push([lat, lng]);

      const originalColor = idx === 0 ? '#22c55e' : idx === pontos.length - 1 ? '#ef4444' : '#3b82f6';
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: originalColor,
        fillOpacity: 0.9,
        color: '#fff',
        weight: 2
      });

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <h4 style="margin: 0 0 8px; color: #333;">${ponto.id}</h4>
          <p style="margin: 4px 0;"><strong>X:</strong> ${ponto.x.toFixed(3)}</p>
          <p style="margin: 4px 0;"><strong>Y:</strong> ${ponto.y.toFixed(3)}</p>
          <p style="margin: 4px 0;"><strong>Cota:</strong> ${ponto.cota.toFixed(3)}m</p>
        </div>
      `);
      marker.bindTooltip(ponto.id, { permanent: false, direction: 'top' });

      // Click handler: highlight without zoom if visible, pan only if not visible
      marker.on('click', function(e: any) {
        const clickedLatLng = e.latlng;
        const mapBounds = mapInstanceRef.current?.getBounds();

        // Check if point is already visible in current viewport
        const isVisible = mapBounds?.contains(clickedLatLng);

        if (!isVisible) {
          // Only pan to center if not visible (no zoom change)
          mapInstanceRef.current?.panTo(clickedLatLng);
        }

        // Visual highlight effect - pulse animation
        marker.setStyle({
          fillColor: '#ffff00',
          color: '#ffff00',
          weight: 4,
          radius: 12
        });

        // Reset to original style after 1.5 seconds
        setTimeout(() => {
          marker.setStyle({
            fillColor: originalColor,
            color: '#fff',
            weight: 2,
            radius: 8
          });
        }, 1500);
      });

      markersLayerRef.current.addLayer(marker);
    });

    trechos.forEach(trecho => {
      const [startLat, startLng] = getMapCoordinates(trecho.xInicio, trecho.yInicio, refX, refY);
      const [endLat, endLng] = getMapCoordinates(trecho.xFim, trecho.yFim, refX, refY);
      const originalColor = trecho.tipoRede === 'Esgoto por Gravidade' ? '#22c55e' : '#f59e0b';

      const polyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color: originalColor,
        weight: 4,
        opacity: 0.8
      });

      polyline.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px; color: #333;">${trecho.idInicio} -> ${trecho.idFim}</h4>
          <p style="margin: 4px 0;"><strong>Comprimento:</strong> ${trecho.comprimento.toFixed(2)}m</p>
          <p style="margin: 4px 0;"><strong>Declividade:</strong> ${(trecho.declividade * 100).toFixed(3)}%</p>
          <p style="margin: 4px 0;"><strong>Tipo:</strong> ${trecho.tipoRede}</p>
          <p style="margin: 4px 0;"><strong>Diametro:</strong> DN${trecho.diametroMm}</p>
          <p style="margin: 4px 0;"><strong>Material:</strong> ${trecho.material}</p>
        </div>
      `);

      // Click handler: highlight without zoom if visible
      polyline.on('click', function(e: any) {
        const clickedLatLng = e.latlng;
        const mapBounds = mapInstanceRef.current?.getBounds();

        // Check if clicked point is visible
        const isVisible = mapBounds?.contains(clickedLatLng);

        if (!isVisible) {
          mapInstanceRef.current?.panTo(clickedLatLng);
        }

        // Visual highlight effect
        polyline.setStyle({
          color: '#ffff00',
          weight: 8,
          opacity: 1
        });

        // Reset to original style after 1.5 seconds
        setTimeout(() => {
          polyline.setStyle({
            color: originalColor,
            weight: 4,
            opacity: 0.8
          });
        }, 1500);
      });

      segmentsLayerRef.current.addLayer(polyline);
    });

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pontos, trechos]);

  // Process topography data
  const processData = useCallback((newPontos: PontoTopografico[]) => {
    setPontos(newPontos);
    try {
      const newTrechos = createTrechosFromTopography(newPontos, diametroMm, material);
      setTrechos(newTrechos);
      const newSummary = summarizeNetwork(newTrechos);
      setSummary(newSummary);
      setError('');

      // Auto-generate budget
      if (typeof generateBudgetFromTrechos === 'function') {
        try {
          const newBudget = generateBudgetFromTrechos(newTrechos);
          setBudget(newBudget);
        } catch (e) {
          console.warn('Could not generate budget', e);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar dados');
    }
  }, [diametroMm, material]);

  // Handle DXF import from TopografiaImportNovo component
  const handleDxfImportComplete = useCallback((data: { nodes: Array<{ id: string; x: number; y: number; z: number; layer?: string }>; edges: Array<{ id: string; coordinates: number[][]; layer?: string }> }) => {
    try {
      // Convert nodes to PontoTopografico format
      const newPontos: PontoTopografico[] = data.nodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        cota: node.z
      }));

      // Create trechos from edges
      const newTrechos: Trecho[] = data.edges.map((edge, idx) => {
        const coords = edge.coordinates;
        const start = coords[0];
        const end = coords[coords.length - 1];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const dz = (end[2] || 0) - (start[2] || 0);
        const comprimento = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const declividade = comprimento > 0 ? dz / comprimento : 0;

        return {
          idInicio: `P${idx + 1}`,
          idFim: `P${idx + 2}`,
          xInicio: start[0],
          yInicio: start[1],
          cotaInicio: start[2] || 0,
          xFim: end[0],
          yFim: end[1],
          cotaFim: end[2] || 0,
          comprimento,
          declividade,
          diametroMm,
          material,
          tipoRede: declividade >= 0.005 ? 'Esgoto por Gravidade' : 'Elevatoria / Booster'
        };
      });

      // If no nodes from DXF, create them from edge endpoints
      if (newPontos.length === 0 && newTrechos.length > 0) {
        const uniquePoints = new Map<string, PontoTopografico>();
        newTrechos.forEach(t => {
          const startKey = `${t.xInicio.toFixed(3)},${t.yInicio.toFixed(3)}`;
          const endKey = `${t.xFim.toFixed(3)},${t.yFim.toFixed(3)}`;
          if (!uniquePoints.has(startKey)) {
            uniquePoints.set(startKey, { id: t.idInicio, x: t.xInicio, y: t.yInicio, cota: t.cotaInicio });
          }
          if (!uniquePoints.has(endKey)) {
            uniquePoints.set(endKey, { id: t.idFim, x: t.xFim, y: t.yFim, cota: t.cotaFim });
          }
        });
        newPontos.push(...uniquePoints.values());
      }

      setPontos(newPontos);
      setTrechos(newTrechos);

      if (newTrechos.length > 0) {
        const newSummary = summarizeNetwork(newTrechos);
        setSummary(newSummary);

        // Auto-generate budget
        if (typeof generateBudgetFromTrechos === 'function') {
          try {
            const newBudget = generateBudgetFromTrechos(newTrechos);
            setBudget(newBudget);
          } catch (e) {
            console.warn('Could not generate budget', e);
          }
        }
      }

      setError('');
      setFileName('DXF Import');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar DXF');
    }
  }, [diametroMm, material]);

  // File handling
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');
    setFileName(file.name);

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Maximo: 50MB');
      }

      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
        const content = await file.text();
        const newPontos = parseCSV(content);
        processData(newPontos);
      } else {
        throw new Error('Formato nao suportado. Use CSV ou TXT.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo');
    } finally {
      setIsLoading(false);
    }
  }, [processData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const loadSampleData = () => {
    const samplePontos = createSampleTopography(10);
    setFileName('Dados de Exemplo');
    processData(samplePontos);
  };

  // Generate schedule
  const generateScheduleHandler = () => {
    if (trechos.length === 0) {
      alert('Importe dados topograficos primeiro');
      return;
    }

    const trechosInput: TrechoInput[] = trechos.map((t, idx) => ({
      trechoId: `T${String(idx + 1).padStart(2, '0')}`,
      comprimento: t.comprimento,
      profundidade: 1.5 + Math.random() * 1.5,
      diametro: t.diametroMm
    }));

    const start = new Date(startDate);
    const result = generateFullSchedule(trechosInput, numTeams, teamConfig, start);
    setSchedule(result);

    const curveSData = generateCurveSData(result.schedule, result.dailyPlan, result.totalDays);
    setCurveS(curveSData);

    const histogramData = generateHistogramData(result.dailyPlan, result.totalDays);
    setHistogram(histogramData);
  };

  // Render charts
  useEffect(() => {
    if (activeTab !== 'planejamento' || curveS.length === 0 || typeof Chart === 'undefined') return;

    const canvas = document.getElementById('curve-s-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    if (curveChartRef.current) curveChartRef.current.destroy();

    curveChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: curveS.map(p => `D${p.day}`),
        datasets: [
          {
            label: 'Fisico Planejado (%)',
            data: curveS.map(p => p.physicalPlanned),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          },
          {
            label: 'Financeiro Planejado (%)',
            data: curveS.map(p => p.financialPlanned),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Curva S - Avanco Fisico-Financeiro' }
        },
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Progresso (%)' } }
        }
      }
    });
  }, [activeTab, curveS]);

  useEffect(() => {
    if (activeTab !== 'planejamento' || histogram.length === 0 || typeof Chart === 'undefined') return;

    const canvas = document.getElementById('histogram-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    if (histogramChartRef.current) histogramChartRef.current.destroy();

    histogramChartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: histogram.map(d => `D${d.day}`),
        datasets: [
          {
            label: 'Mao de Obra',
            data: histogram.map(d => d.labor),
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: 'Equipamentos',
            data: histogram.map(d => d.equipment),
            backgroundColor: '#8b5cf6',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Histograma de Recursos' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }, [activeTab, histogram]);

  // RDO handlers
  const saveRDO = (status: 'rascunho' | 'enviado') => {
    const newRDO: RDO = {
      id: `rdo-${Date.now()}`,
      projectId: 'default',
      date: formDate,
      status,
      services: formServices.filter(s => s.serviceName && s.quantity) as ExecutedService[],
      segments: formSegments.filter(s => s.segmentName) as any[],
      notes: formNotes,
      occurrences: formOccurrences,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [...rdos, newRDO];
    setRdos(updated);
    localStorage.setItem('rdoData', JSON.stringify(updated));

    // Reset form
    setFormServices([]);
    setFormSegments([]);
    setFormNotes('');
    setFormOccurrences('');
    setRdoView('dashboard');
  };

  const deleteRDO = (id: string) => {
    const updated = rdos.filter(r => r.id !== id);
    setRdos(updated);
    localStorage.setItem('rdoData', JSON.stringify(updated));
  };

  // Tab content renderers
  const renderTopografia = () => (
    <div>
      {/* Side-by-side import cards */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {/* Existing CSV/TXT import card */}
        <div style={{ ...styles.card, flex: '1', minWidth: '320px' }}>
          <div style={styles.cardTitle}>
            <span>&#8593;</span> Carregar Topografia (CSV/TXT)
          </div>
          <div style={styles.cardSubtitle}>
            Arquivo CSV, TXT ou Excel com colunas: id, x, y, cota
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...styles.dropZone,
              ...(isDragging ? styles.dropZoneActive : {})
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#8593;</div>
            <p style={{ color: '#64748b', marginBottom: '8px' }}>
              Arraste o arquivo aqui ou clique para selecionar
            </p>
            <p style={{ color: '#94a3b8', fontSize: '12px' }}>
              Formatos: .csv, .txt, .xlsx, .xls
            </p>
            {fileName && (
              <p style={{ color: '#3b82f6', marginTop: '12px', fontSize: '13px' }}>
                Arquivo selecionado: {fileName}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
                Diametro (mm)
              </label>
              <select
                value={diametroMm}
                onChange={(e) => setDiametroMm(Number(e.target.value))}
                style={styles.select}
              >
                <option value={100}>DN100</option>
                <option value={150}>DN150</option>
                <option value={200}>DN200</option>
                <option value={250}>DN250</option>
                <option value={300}>DN300</option>
                <option value={400}>DN400</option>
                <option value={500}>DN500</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
                Material
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                style={styles.select}
              >
                <option value="PVC">PVC</option>
                <option value="PEAD">PEAD</option>
                <option value="FOFO">Ferro Fundido</option>
                <option value="Concreto">Concreto</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={loadSampleData} style={{ ...styles.button, ...styles.buttonSecondary }}>
              Carregar Exemplo
            </button>
          </div>

          {isLoading && <p style={{ marginTop: '16px', color: '#3b82f6' }}>Processando...</p>}
          {error && <p style={{ marginTop: '16px', color: '#ef4444' }}>{error}</p>}
        </div>

        {/* New DXF import card */}
        <div style={{ flex: '1', minWidth: '320px' }}>
          <TopografiaImportNovo onImportComplete={handleDxfImportComplete} />
        </div>
      </div>

      {/* Mapa da Rede - visivel sempre que houver pontos ou trechos */}
      {(pontos.length > 0 || trechos.length > 0) && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Mapa da Rede</div>
          <div
            ref={mapContainerRef}
            style={{ height: '400px', borderRadius: '8px', overflow: 'hidden', marginTop: '16px' }}
          />
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '13px' }}>
            <span><span style={{ color: '#22c55e' }}>●</span> Gravidade</span>
            <span><span style={{ color: '#f59e0b' }}>●</span> Elevatoria/Booster</span>
            <span><span style={{ color: '#22c55e' }}>●</span> Ponto Inicial</span>
            <span><span style={{ color: '#ef4444' }}>●</span> Ponto Final</span>
            <span><span style={{ color: '#3b82f6' }}>●</span> Pontos Intermediarios</span>
          </div>
        </div>
      )}

      {summary && (
        <>
          <div style={styles.grid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total de Pontos</div>
              <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>{pontos.length}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total de Trechos</div>
              <div style={{ ...styles.summaryValue, color: '#22c55e' }}>{summary.totalTrechos}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Comprimento Total</div>
              <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>{summary.comprimentoTotal.toFixed(1)}m</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Por Gravidade</div>
              <div style={{ ...styles.summaryValue, color: '#22c55e' }}>{summary.trechosGravidade}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Elevatoria</div>
              <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>{summary.trechosElevatoria}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Declividade Media</div>
              <div style={{ ...styles.summaryValue, color: '#8b5cf6' }}>{(summary.declividadeMedia * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Tabela de Trechos</div>
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Inicio</th>
                    <th style={styles.th}>Fim</th>
                    <th style={styles.th}>Comp.(m)</th>
                    <th style={styles.th}>Decliv.(%)</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>DN</th>
                    <th style={styles.th}>Material</th>
                  </tr>
                </thead>
                <tbody>
                  {trechos.map((t, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{t.idInicio}</td>
                      <td style={styles.td}>{t.idFim}</td>
                      <td style={styles.td}>{t.comprimento.toFixed(2)}</td>
                      <td style={styles.td}>{(t.declividade * 100).toFixed(3)}</td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: t.tipoRede === 'Esgoto por Gravidade' ? '#dcfce7' : '#fef3c7',
                          color: t.tipoRede === 'Esgoto por Gravidade' ? '#166534' : '#92400e'
                        }}>
                          {t.tipoRede}
                        </span>
                      </td>
                      <td style={styles.td}>DN{t.diametroMm}</td>
                      <td style={styles.td}>{t.material}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderOrcamento = () => (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Orcamento da Obra</div>
        <div style={styles.cardSubtitle}>
          Gere o orcamento automaticamente a partir dos trechos importados
        </div>

        {!summary ? (
          <p style={{ color: '#64748b' }}>Importe dados topograficos primeiro na aba Topografia</p>
        ) : budget ? (
          <>
            <div style={styles.grid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Total Geral</div>
                <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>
                  R$ {budget.grandTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                </div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Comprimento</div>
                <div style={{ ...styles.summaryValue, color: '#22c55e' }}>
                  {budget.totalLength?.toFixed(1) || 0}m
                </div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Custo/Metro</div>
                <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>
                  R$ {budget.costPerMeter?.toFixed(2) || '0,00'}
                </div>
              </div>
            </div>

            {budget.items && budget.items.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: '20px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item</th>
                      <th style={styles.th}>Descricao</th>
                      <th style={styles.th}>Un</th>
                      <th style={styles.th}>Qtd</th>
                      <th style={styles.th}>Preco Unit.</th>
                      <th style={styles.th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>{item.itemNum}</td>
                        <td style={styles.td}>{item.description}</td>
                        <td style={styles.td}>{item.unit}</td>
                        <td style={styles.td}>{item.quantity?.toFixed(2)}</td>
                        <td style={styles.td}>R$ {item.unitCost?.toFixed(2)}</td>
                        <td style={styles.td}>R$ {item.totalCost?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: '#64748b' }}>Processando orcamento...</p>
        )}
      </div>
    </div>
  );

  const renderExecucao = () => (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Execucao da Obra</div>
        <div style={styles.cardSubtitle}>
          Acompanhe o progresso da execucao
        </div>

        {!summary ? (
          <p style={{ color: '#64748b' }}>Importe dados topograficos primeiro na aba Topografia</p>
        ) : (
          <>
            <div style={styles.grid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Planejado</div>
                <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>{summary.comprimentoTotal.toFixed(1)}m</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Executado</div>
                <div style={{ ...styles.summaryValue, color: '#22c55e' }}>
                  {rdos.reduce((sum, rdo) =>
                    sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0).toFixed(1)}m
                </div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Progresso</div>
                <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>
                  {summary.comprimentoTotal > 0
                    ? ((rdos.reduce((sum, rdo) =>
                        sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0) /
                        summary.comprimentoTotal) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Progresso Geral</span>
                <span style={{ color: '#1e293b', fontWeight: '600' }}>
                  {summary.comprimentoTotal > 0
                    ? ((rdos.reduce((sum, rdo) =>
                        sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0) /
                        summary.comprimentoTotal) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div style={{ backgroundColor: '#e2e8f0', borderRadius: '4px', height: '8px' }}>
                <div style={{
                  backgroundColor: '#3b82f6',
                  height: '100%',
                  borderRadius: '4px',
                  width: `${Math.min(
                    summary.comprimentoTotal > 0
                      ? (rdos.reduce((sum, rdo) =>
                          sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0) /
                          summary.comprimentoTotal) * 100
                      : 0,
                    100
                  )}%`
                }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderPlanejamento = () => (
    <div>
      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>&#9888;</span>
          <div>
            <strong style={{ color: '#92400e' }}>Regra de Conclusao no Mesmo Dia</strong>
            <p style={{ color: '#a16207', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
              Em obras de saneamento, NAO se pode deixar vala aberta de um dia para outro.
              Cada segmento escavado DEVE ser completado no mesmo dia: Escavacao → Assentamento → Reaterro.
            </p>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Configuracao da Equipe</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Numero de Equipes
            </label>
            <input
              type="number"
              value={numTeams}
              onChange={(e) => setNumTeams(Number(e.target.value))}
              min={1}
              max={10}
              style={styles.input}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Encarregados/Equipe
            </label>
            <input
              type="number"
              value={teamConfig.encarregado}
              onChange={(e) => setTeamConfig({ ...teamConfig, encarregado: Number(e.target.value) })}
              min={0}
              style={styles.input}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Oficiais/Equipe
            </label>
            <input
              type="number"
              value={teamConfig.oficiais}
              onChange={(e) => setTeamConfig({ ...teamConfig, oficiais: Number(e.target.value) })}
              min={0}
              style={styles.input}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Ajudantes/Equipe
            </label>
            <input
              type="number"
              value={teamConfig.ajudantes}
              onChange={(e) => setTeamConfig({ ...teamConfig, ajudantes: Number(e.target.value) })}
              min={0}
              style={styles.input}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Metros/Dia Base
            </label>
            <input
              type="number"
              value={teamConfig.metrosDiaBase}
              onChange={(e) => setTeamConfig({ ...teamConfig, metrosDiaBase: Number(e.target.value) })}
              min={3}
              style={styles.input}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Data de Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={teamConfig.hasRetro}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasRetro: e.target.checked })}
            />
            Retroescavadeira
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={teamConfig.hasCompactor}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasCompactor: e.target.checked })}
            />
            Compactador
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={teamConfig.hasTruck}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasTruck: e.target.checked })}
            />
            Caminhao
          </label>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={teamConfig.hasPump}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasPump: e.target.checked })}
            />
            Bomba
          </label>
        </div>

        <button
          onClick={generateScheduleHandler}
          style={{ ...styles.button, ...styles.buttonPrimary, marginTop: '20px' }}
        >
          Gerar Cronograma
        </button>
      </div>

      {schedule && (
        <>
          <div style={styles.grid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Dias de Obra</div>
              <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>{schedule.totalDays}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Data Inicio</div>
              <div style={{ ...styles.summaryValue, color: '#22c55e', fontSize: '18px' }}>
                {schedule.startDate.toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Data Termino</div>
              <div style={{ ...styles.summaryValue, color: '#f59e0b', fontSize: '18px' }}>
                {schedule.endDate.toLocaleDateString('pt-BR')}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Custo Total</div>
              <div style={{ ...styles.summaryValue, color: '#8b5cf6' }}>
                R$ {schedule.summary?.custoTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Gantt - Cronograma</div>
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Trecho</th>
                    <th style={styles.th}>Metros</th>
                    {Array.from({ length: Math.min(schedule.totalDays, 15) }, (_, i) => (
                      <th key={i} style={{ ...styles.th, textAlign: 'center', padding: '8px 4px' }}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.trechos?.slice(0, 10).map((trecho, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>{trecho.trechoId}</td>
                      <td style={styles.td}>{trecho.comprimentoTotal?.toFixed(0)}m</td>
                      {Array.from({ length: Math.min(schedule.totalDays, 15) }, (_, day) => {
                        const seg = schedule.allSegments?.find(s =>
                          s.trechoId === trecho.trechoId && s.day === day + 1
                        );
                        if (!seg) return <td key={day} style={{ ...styles.td, padding: '4px' }} />;

                        const isTest = seg.activities?.includes('Teste Hidrostatico');
                        return (
                          <td key={day} style={{
                            ...styles.td,
                            padding: '4px',
                            background: isTest
                              ? '#8b5cf6'
                              : 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 50%, #22c55e 100%)',
                            color: 'white',
                            textAlign: 'center',
                            fontSize: '11px'
                          }}>
                            {isTest ? 'T' : seg.meters?.toFixed(0)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Curva S</div>
              <div style={{ height: '300px', marginTop: '16px' }}>
                <canvas id="curve-s-canvas" />
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitle}>Histograma de Recursos</div>
              <div style={{ height: '300px', marginTop: '16px' }}>
                <canvas id="histogram-canvas" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderRDO = () => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['dashboard', 'list', 'form'] as RDOViewMode[]).map(view => (
          <button
            key={view}
            onClick={() => setRdoView(view)}
            style={{
              ...styles.button,
              ...(rdoView === view ? styles.buttonPrimary : styles.buttonSecondary)
            }}
          >
            {view === 'dashboard' && 'Dashboard'}
            {view === 'list' && 'Lista de RDOs'}
            {view === 'form' && 'Novo RDO'}
          </button>
        ))}
      </div>

      {rdoView === 'dashboard' && (
        <div>
          <div style={styles.grid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Planejado</div>
              <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>{summary?.comprimentoTotal?.toFixed(1) || 0}m</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Executado</div>
              <div style={{ ...styles.summaryValue, color: '#22c55e' }}>
                {rdos.reduce((sum, rdo) =>
                  sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0).toFixed(1)}m
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total RDOs</div>
              <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>{rdos.length}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Progresso</div>
              <div style={{ ...styles.summaryValue, color: '#8b5cf6' }}>
                {summary?.comprimentoTotal && summary.comprimentoTotal > 0
                  ? ((rdos.reduce((sum, rdo) =>
                      sum + (rdo.segments?.reduce((s, seg) => s + (seg.executedToday || 0), 0) || 0), 0) /
                      summary.comprimentoTotal) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {rdoView === 'list' && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Lista de RDOs</div>
          {rdos.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: '16px' }}>Nenhum RDO registrado ainda.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Servicos</th>
                    <th style={styles.th}>Trechos</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {rdos.map(rdo => (
                    <tr key={rdo.id}>
                      <td style={styles.td}>{new Date(rdo.date).toLocaleDateString('pt-BR')}</td>
                      <td style={styles.td}>{rdo.services?.length || 0}</td>
                      <td style={styles.td}>{rdo.segments?.length || 0}</td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: rdo.status === 'enviado' ? '#dbeafe' :
                            rdo.status === 'aprovado' ? '#dcfce7' :
                            rdo.status === 'rejeitado' ? '#fee2e2' : '#fef3c7',
                          color: rdo.status === 'enviado' ? '#1d4ed8' :
                            rdo.status === 'aprovado' ? '#166534' :
                            rdo.status === 'rejeitado' ? '#991b1b' : '#92400e'
                        }}>
                          {rdo.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => deleteRDO(rdo.id)}
                          style={{ ...styles.button, padding: '4px 8px', fontSize: '12px', backgroundColor: '#fee2e2', color: '#991b1b' }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {rdoView === 'form' && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Novo RDO</div>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Data do Relatorio
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={{ ...styles.input, maxWidth: '200px' }}
            />
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>Servicos Executados</span>
              <button
                onClick={() => setFormServices([...formServices, { id: `s-${Date.now()}` }])}
                style={{ ...styles.button, ...styles.buttonSecondary, padding: '6px 12px', fontSize: '12px' }}
              >
                + Adicionar
              </button>
            </div>
            {formServices.map((service, idx) => (
              <div key={service.id || idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  placeholder="Nome do servico"
                  value={service.serviceName || ''}
                  onChange={(e) => {
                    const updated = [...formServices];
                    updated[idx] = { ...updated[idx], serviceName: e.target.value };
                    setFormServices(updated);
                  }}
                  style={{ ...styles.input, flex: 2 }}
                />
                <input
                  type="number"
                  placeholder="Qtd"
                  value={service.quantity || ''}
                  onChange={(e) => {
                    const updated = [...formServices];
                    updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                    setFormServices(updated);
                  }}
                  style={{ ...styles.input, flex: 1 }}
                />
                <select
                  value={service.unit || 'm'}
                  onChange={(e) => {
                    const updated = [...formServices];
                    updated[idx] = { ...updated[idx], unit: e.target.value as ServiceUnit };
                    setFormServices(updated);
                  }}
                  style={{ ...styles.select, flex: 1 }}
                >
                  <option value="m">m</option>
                  <option value="m2">m2</option>
                  <option value="m3">m3</option>
                  <option value="un">un</option>
                </select>
                <button
                  onClick={() => setFormServices(formServices.filter((_, i) => i !== idx))}
                  style={{ ...styles.button, padding: '8px 12px', backgroundColor: '#fee2e2', color: '#991b1b' }}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', color: '#1e293b' }}>Avanco por Trecho</span>
              <button
                onClick={() => setFormSegments([...formSegments, { id: `seg-${Date.now()}` }])}
                style={{ ...styles.button, ...styles.buttonSecondary, padding: '6px 12px', fontSize: '12px' }}
              >
                + Adicionar
              </button>
            </div>
            {formSegments.map((segment, idx) => (
              <div key={segment.id || idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  placeholder="Nome do trecho"
                  value={segment.segmentName || ''}
                  onChange={(e) => {
                    const updated = [...formSegments];
                    updated[idx] = { ...updated[idx], segmentName: e.target.value };
                    setFormSegments(updated);
                  }}
                  style={{ ...styles.input, flex: 2 }}
                />
                <input
                  type="number"
                  placeholder="Planejado"
                  value={segment.plannedTotal || ''}
                  onChange={(e) => {
                    const updated = [...formSegments];
                    updated[idx] = { ...updated[idx], plannedTotal: Number(e.target.value) };
                    setFormSegments(updated);
                  }}
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="Exec. Anterior"
                  value={segment.executedBefore || ''}
                  onChange={(e) => {
                    const updated = [...formSegments];
                    updated[idx] = { ...updated[idx], executedBefore: Number(e.target.value) };
                    setFormSegments(updated);
                  }}
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="Exec. Hoje"
                  value={segment.executedToday || ''}
                  onChange={(e) => {
                    const updated = [...formSegments];
                    updated[idx] = { ...updated[idx], executedToday: Number(e.target.value) };
                    setFormSegments(updated);
                  }}
                  style={{ ...styles.input, flex: 1 }}
                />
                <button
                  onClick={() => setFormSegments(formSegments.filter((_, i) => i !== idx))}
                  style={{ ...styles.button, padding: '8px 12px', backgroundColor: '#fee2e2', color: '#991b1b' }}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Observacoes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: '#64748b', fontSize: '13px' }}>
              Ocorrencias
            </label>
            <textarea
              value={formOccurrences}
              onChange={(e) => setFormOccurrences(e.target.value)}
              rows={3}
              style={{ ...styles.input, resize: 'vertical', borderColor: '#fca5a5' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={() => setRdoView('dashboard')}
              style={{ ...styles.button, ...styles.buttonSecondary }}
            >
              Cancelar
            </button>
            <button
              onClick={() => saveRDO('rascunho')}
              style={{ ...styles.button, backgroundColor: '#f59e0b', color: 'white' }}
            >
              Salvar Rascunho
            </button>
            <button
              onClick={() => saveRDO('enviado')}
              style={{ ...styles.button, ...styles.buttonSuccess }}
            >
              Enviar RDO
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderResultados = () => (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Resultados e Relatorios</div>
        <div style={styles.cardSubtitle}>
          Resumo geral do projeto e exportacao de dados
        </div>

        {!summary ? (
          <p style={{ color: '#64748b' }}>Importe dados topograficos primeiro na aba Topografia</p>
        ) : (
          <>
            <div style={styles.grid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Trechos</div>
                <div style={{ ...styles.summaryValue, color: '#3b82f6' }}>{summary.totalTrechos}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Comprimento</div>
                <div style={{ ...styles.summaryValue, color: '#22c55e' }}>{summary.comprimentoTotal.toFixed(1)}m</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Dias de Obra</div>
                <div style={{ ...styles.summaryValue, color: '#f59e0b' }}>{schedule?.totalDays || '-'}</div>
              </div>
              <div style={styles.summaryCard}>
                <div style={styles.summaryLabel}>Custo Estimado</div>
                <div style={{ ...styles.summaryValue, color: '#8b5cf6', fontSize: '18px' }}>
                  R$ {budget?.grandTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || schedule?.summary?.custoTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => {
                  const records = trechosToRecords(trechos, true);
                  const header = Object.keys(records[0]).join(';');
                  const rows = records.map(r => Object.values(r).join(';'));
                  const content = [header, ...rows].join('\n');
                  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `topografia_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ ...styles.button, ...styles.buttonSuccess }}
              >
                Exportar Trechos (CSV)
              </button>
              <button
                onClick={() => {
                  const data = { pontos, trechos, summary, schedule, budget, rdos };
                  const content = JSON.stringify(data, null, 2);
                  const blob = new Blob([content], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `projeto_completo_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ ...styles.button, ...styles.buttonPrimary }}
              >
                Exportar Projeto (JSON)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'topografia', label: 'Topografia', icon: '&#9872;' },
    { id: 'orcamento', label: 'Orcamento', icon: '&#128196;' },
    { id: 'execucao', label: 'Execucao', icon: '&#128736;' },
    { id: 'planejamento', label: 'Planejamento', icon: '&#128197;' },
    { id: 'rdo', label: 'RDO', icon: '&#128203;' },
    { id: 'resultados', label: 'Resultados', icon: '&#128200;' }
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <svg style={styles.headerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h1 style={styles.title}>HydroNetwork</h1>
        </div>
        <p style={styles.subtitle}>Plataforma completa de engenharia de saneamento</p>
      </header>

      <nav style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : styles.tabInactive)
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: tab.icon }} />
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={styles.content}>
        {activeTab === 'topografia' && renderTopografia()}
        {activeTab === 'orcamento' && renderOrcamento()}
        {activeTab === 'execucao' && renderExecucao()}
        {activeTab === 'planejamento' && renderPlanejamento()}
        {activeTab === 'rdo' && renderRDO()}
        {activeTab === 'resultados' && renderResultados()}
      </main>
    </div>
  );
};

export default HydroNetworkPage;
