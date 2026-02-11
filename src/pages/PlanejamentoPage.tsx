/**
 * PlanejamentoPage - Planning Module
 *
 * Provides schedule generation with Same-Day Completion rule,
 * Gantt chart visualization, Curve S, and resource histogram.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  generateFullSchedule,
  calculateDailyMeters,
  generateCurveSData,
  generateHistogramData,
  type FullSchedule,
  type ScheduleItem,
  type TeamConfig,
  type TrechoInput,
  type CurveSPoint,
  type HistogramDay
} from '../engine/planning';

// Chart.js type declaration
declare const Chart: any;

interface PlanejamentoPageProps {
  initialTrechos?: TrechoInput[];
  onScheduleGenerated?: (schedule: FullSchedule) => void;
}

export const PlanejamentoPage: React.FC<PlanejamentoPageProps> = ({
  initialTrechos = [],
  onScheduleGenerated
}) => {
  // State
  const [trechos, setTrechos] = useState<TrechoInput[]>(initialTrechos);
  const [schedule, setSchedule] = useState<FullSchedule | null>(null);
  const [curveS, setCurveS] = useState<CurveSPoint[]>([]);
  const [histogram, setHistogram] = useState<HistogramDay[]>([]);

  // Team configuration
  const [numTeams, setNumTeams] = useState(2);
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

  // View configuration
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [ganttMode, setGanttMode] = useState<'by-segment' | 'by-trecho' | 'by-trecho-activity'>('by-trecho');
  const [histogramView, setHistogramView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [histogramResource, setHistogramResource] = useState<'all' | 'labor' | 'equipment' | 'cost'>('all');

  // Refs for charts
  const scurveCanvasRef = useRef<HTMLCanvasElement>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const scurveChartRef = useRef<any>(null);
  const histogramChartRef = useRef<any>(null);

  // Generate schedule
  const generateScheduleHandler = useCallback(() => {
    if (trechos.length === 0) {
      alert('Adicione trechos antes de gerar o cronograma');
      return;
    }

    const start = new Date(startDate);
    const result = generateFullSchedule(trechos, numTeams, teamConfig, start);
    setSchedule(result);

    // Generate Curve S data
    const curveSData = generateCurveSData(result.schedule, result.dailyPlan, result.totalDays);
    setCurveS(curveSData);

    // Generate histogram data
    const histogramData = generateHistogramData(result.dailyPlan, result.totalDays);
    setHistogram(histogramData);

    if (onScheduleGenerated) {
      onScheduleGenerated(result);
    }
  }, [trechos, numTeams, teamConfig, startDate, onScheduleGenerated]);

  // Load demo data
  const loadDemoData = () => {
    const demoTrechos: TrechoInput[] = [
      { trechoId: 'T01', comprimento: 50, profundidade: 1.5, diametro: 150 },
      { trechoId: 'T02', comprimento: 50, profundidade: 1.8, diametro: 150 },
      { trechoId: 'T03', comprimento: 50, profundidade: 2.0, diametro: 200 },
      { trechoId: 'T04', comprimento: 75, profundidade: 2.2, diametro: 200 },
      { trechoId: 'T05', comprimento: 60, profundidade: 2.5, diametro: 250 },
      { trechoId: 'T06', comprimento: 45, profundidade: 1.5, diametro: 150 }
    ];
    setTrechos(demoTrechos);
  };

  // Render Curve S chart
  useEffect(() => {
    if (!scurveCanvasRef.current || curveS.length === 0 || typeof Chart === 'undefined') return;

    if (scurveChartRef.current) {
      scurveChartRef.current.destroy();
    }

    const ctx = scurveCanvasRef.current.getContext('2d');
    if (!ctx) return;

    scurveChartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: curveS.map(p => `D${p.day}`),
        datasets: [
          {
            label: 'Físico Planejado (%)',
            data: curveS.map(p => p.physicalPlanned),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.3
          },
          {
            label: 'Financeiro Planejado (%)',
            data: curveS.map(p => p.financialPlanned),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
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
          legend: { position: 'top' as const },
          title: { display: true, text: 'Curva S - Avanço Físico-Financeiro' }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: 'Progresso (%)' }
          },
          x: {
            title: { display: true, text: 'Dias' }
          }
        }
      }
    });
  }, [curveS]);

  // Render histogram chart
  useEffect(() => {
    if (!histogramCanvasRef.current || histogram.length === 0 || typeof Chart === 'undefined') return;

    if (histogramChartRef.current) {
      histogramChartRef.current.destroy();
    }

    const ctx = histogramCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // Aggregate data based on view mode
    let labels: string[];
    let laborData: number[];
    let equipData: number[];

    if (histogramView === 'daily') {
      labels = histogram.map(d => `D${d.day}`);
      laborData = histogram.map(d => d.labor);
      equipData = histogram.map(d => d.equipment);
    } else if (histogramView === 'weekly') {
      const weeks = Math.ceil(histogram.length / 7);
      labels = Array.from({ length: weeks }, (_, i) => `S${i + 1}`);
      laborData = [];
      equipData = [];
      for (let i = 0; i < weeks; i++) {
        const weekData = histogram.slice(i * 7, (i + 1) * 7);
        laborData.push(weekData.reduce((sum, d) => sum + d.labor, 0));
        equipData.push(weekData.reduce((sum, d) => sum + d.equipment, 0));
      }
    } else {
      const months = Math.ceil(histogram.length / 30);
      labels = Array.from({ length: months }, (_, i) => `M${i + 1}`);
      laborData = [];
      equipData = [];
      for (let i = 0; i < months; i++) {
        const monthData = histogram.slice(i * 30, (i + 1) * 30);
        laborData.push(monthData.reduce((sum, d) => sum + d.labor, 0));
        equipData.push(monthData.reduce((sum, d) => sum + d.equipment, 0));
      }
    }

    const datasets: any[] = [];

    if (histogramResource === 'all' || histogramResource === 'labor') {
      datasets.push({
        label: 'Mão de Obra',
        data: laborData,
        backgroundColor: '#3b82f6',
        borderRadius: 4
      });
    }

    if (histogramResource === 'all' || histogramResource === 'equipment') {
      datasets.push({
        label: 'Equipamentos',
        data: equipData,
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      });
    }

    histogramChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' as const },
          title: { display: true, text: 'Histograma de Recursos' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } },
          x: { title: { display: true, text: histogramView === 'daily' ? 'Dias' : histogramView === 'weekly' ? 'Semanas' : 'Meses' } }
        }
      }
    });
  }, [histogram, histogramView, histogramResource]);

  // Calculate statistics
  const stats = schedule ? {
    totalDays: schedule.totalDays,
    totalMeters: schedule.schedule.reduce((sum, s) => sum + (s.metrosDia || 0), 0),
    totalCost: schedule.dailyPlan.reduce((sum, d) => sum + d.dailyCost, 0),
    avgMetersDay: schedule.totalDays > 0 ? schedule.schedule.reduce((sum, s) => sum + (s.metrosDia || 0), 0) / schedule.totalDays : 0
  } : null;

  // Get color for activity
  const getActivityColor = (activity: string): string => {
    const lower = activity.toLowerCase();
    if (lower.includes('escava')) return '#f59e0b';
    if (lower.includes('assenta')) return '#3b82f6';
    if (lower.includes('reaterro') || lower.includes('aterro')) return '#22c55e';
    if (lower.includes('teste')) return '#ef4444';
    return '#8b5cf6';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>📅</span> Planejamento
      </h1>

      {/* Alert about Same-Day Completion Rule */}
      <div style={{
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <strong style={{ color: '#3b82f6' }}>Regra de Conclusão no Mesmo Dia</strong>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Em obras de saneamento, não se pode deixar vala aberta. Cada segmento escavado é completado no mesmo dia:
            Escavação → Assentamento → Reaterro.
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginBottom: '15px', color: '#94a3b8' }}>⚙️ Configuração da Equipe</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Nº de Equipes</label>
            <input
              type="number"
              min={1}
              max={10}
              value={numTeams}
              onChange={(e) => setNumTeams(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Encarregados/Equipe</label>
            <input
              type="number"
              min={1}
              value={teamConfig.encarregado}
              onChange={(e) => setTeamConfig({ ...teamConfig, encarregado: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Oficiais/Equipe</label>
            <input
              type="number"
              min={1}
              value={teamConfig.oficiais}
              onChange={(e) => setTeamConfig({ ...teamConfig, oficiais: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Ajudantes/Equipe</label>
            <input
              type="number"
              min={1}
              value={teamConfig.ajudantes}
              onChange={(e) => setTeamConfig({ ...teamConfig, ajudantes: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Metros/Dia Base</label>
            <input
              type="number"
              min={1}
              value={teamConfig.metrosDiaBase}
              onChange={(e) => setTeamConfig({ ...teamConfig, metrosDiaBase: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.85rem' }}>Data de Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0'
              }}
            />
          </div>
        </div>

        {/* Equipment checkboxes */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={teamConfig.hasRetro}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasRetro: e.target.checked })}
            />
            🚜 Retroescavadeira
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={teamConfig.hasCompactor}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasCompactor: e.target.checked })}
            />
            🔨 Compactador
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={teamConfig.hasTruck}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasTruck: e.target.checked })}
            />
            🚛 Caminhão
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={teamConfig.hasPump}
              onChange={(e) => setTeamConfig({ ...teamConfig, hasPump: e.target.checked })}
            />
            💧 Bomba
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={loadDemoData}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📊 Carregar Dados Demo
          </button>
          <button
            onClick={generateScheduleHandler}
            disabled={trechos.length === 0}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              backgroundColor: trechos.length === 0 ? '#475569' : '#22c55e',
              color: 'white',
              border: 'none',
              cursor: trechos.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            🚀 Gerar Cronograma
          </button>
        </div>

        {/* Trechos list */}
        {trechos.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ color: '#94a3b8', marginBottom: '10px' }}>Trechos Carregados: {trechos.length}</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {trechos.map((t, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '15px',
                    fontSize: '0.85rem'
                  }}
                >
                  {t.trechoId}: {t.comprimento}m, DN{t.diametro}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {schedule && (
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Dias de Obra</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats?.totalDays}</p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Data de Início</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#22c55e' }}>
                {new Date(startDate).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Data de Término</p>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {schedule.endDate.toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Custo Total Estimado</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                R$ {stats?.totalCost.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Gantt Chart */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ color: '#94a3b8', margin: 0 }}>📊 Gráfico de Gantt</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={ganttMode}
                  onChange={(e) => setGanttMode(e.target.value as any)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#e2e8f0'
                  }}
                >
                  <option value="by-trecho">Por Trecho Completo</option>
                  <option value="by-trecho-activity">Por Trecho + Atividade</option>
                  <option value="by-segment">Por Segmento Diário</option>
                </select>
              </div>
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '15px',
              padding: '12px',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.85rem' }}>Legenda:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span style={{ width: '20px', height: '16px', background: 'linear-gradient(90deg, #f59e0b, #3b82f6, #22c55e)', borderRadius: '3px' }}></span>
                Ciclo Completo
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span style={{ width: '20px', height: '16px', backgroundColor: '#ef4444', borderRadius: '3px' }}></span>
                Teste Hidrostático
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                marginLeft: 'auto',
                padding: '4px 10px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '4px',
                color: '#60a5fa'
              }}>
                ⚠️ Vala fechada no mesmo dia
              </span>
            </div>

            {/* Gantt content */}
            <div style={{ overflowX: 'auto' }}>
              {/* Header */}
              <div style={{ display: 'flex', gap: '3px', marginBottom: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                <div style={{ width: '100px', fontWeight: 'bold' }}>Trecho</div>
                <div style={{ width: '60px', textAlign: 'center', fontWeight: 'bold' }}>Metros</div>
                {Array.from({ length: schedule.totalDays }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '35px',
                      textAlign: 'center',
                      fontWeight: (i + 1) % 5 === 0 ? 'bold' : 'normal'
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Rows by trecho */}
              {[...new Set(schedule.schedule.map(s => s.trechoId))].map((trechoId, idx) => {
                const trechoItems = schedule.schedule.filter(s => s.trechoId === trechoId);
                const totalMetros = trechoItems.reduce((sum, s) => sum + (s.metrosDia || 0), 0);
                const bgColor = idx % 2 === 0 ? '#0f172a' : '#1e293b';

                // Group by day
                const byDay: { [key: number]: ScheduleItem[] } = {};
                trechoItems.forEach(item => {
                  for (let d = item.startDay; d <= item.endDay; d++) {
                    if (!byDay[d]) byDay[d] = [];
                    byDay[d].push(item);
                  }
                });

                return (
                  <div
                    key={trechoId}
                    style={{
                      display: 'flex',
                      gap: '3px',
                      marginBottom: '2px',
                      alignItems: 'center',
                      padding: '4px',
                      borderRadius: '4px',
                      backgroundColor: bgColor
                    }}
                  >
                    <div style={{ width: '100px', fontSize: '0.85rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {trechoId}
                    </div>
                    <div style={{ width: '60px', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {totalMetros.toFixed(0)}m
                    </div>
                    {Array.from({ length: schedule.totalDays }, (_, dayIdx) => {
                      const day = dayIdx + 1;
                      const dayItems = byDay[day];

                      if (dayItems && dayItems.length > 0) {
                        const isTest = dayItems.some(i => i.activity.toLowerCase().includes('teste'));
                        const metros = dayItems[0].metrosDia || 0;

                        return (
                          <div
                            key={dayIdx}
                            style={{
                              width: '35px',
                              height: '24px',
                              background: isTest
                                ? '#ef4444'
                                : 'linear-gradient(90deg, #f59e0b 0%, #f59e0b 33%, #3b82f6 33%, #3b82f6 66%, #22c55e 66%, #22c55e 100%)',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                            title={`Dia ${day}\n${metros.toFixed(1)}m\n${dayItems.map(i => i.activity).join('\n')}`}
                          >
                            <span style={{ fontSize: '0.6rem', color: 'white', fontWeight: 'bold', textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                              {isTest ? 'T' : metros.toFixed(0)}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={dayIdx}
                          style={{
                            width: '35px',
                            height: '24px',
                            backgroundColor: 'transparent',
                            border: '1px solid #334155',
                            borderRadius: '3px',
                            opacity: 0.3
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {/* Summary row */}
              <div style={{
                display: 'flex',
                gap: '20px',
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Trechos:</span>
                  <span style={{ fontWeight: '600', color: '#3b82f6' }}>
                    {[...new Set(schedule.schedule.map(s => s.trechoId))].length}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Metros:</span>
                  <span style={{ fontWeight: '600', color: '#22c55e' }}>
                    {stats?.totalMeters.toFixed(0)}m
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Dias de Obra:</span>
                  <span style={{ fontWeight: '600', color: '#f59e0b' }}>{schedule.totalDays}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Média:</span>
                  <span style={{ fontWeight: '600', color: '#8b5cf6' }}>
                    {stats?.avgMetersDay.toFixed(1)} m/dia
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' }}>
            {/* Curve S */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ color: '#94a3b8', marginBottom: '15px' }}>📈 Curva S</h2>
              <div style={{ height: '300px' }}>
                <canvas ref={scurveCanvasRef} />
              </div>
            </div>

            {/* Histogram */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ color: '#94a3b8', margin: 0 }}>📊 Histograma de Recursos</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={histogramView}
                    onChange={(e) => setHistogramView(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                  <select
                    value={histogramResource}
                    onChange={(e) => setHistogramResource(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="all">Todos</option>
                    <option value="labor">Mão de Obra</option>
                    <option value="equipment">Equipamentos</option>
                    <option value="cost">Custo</option>
                  </select>
                </div>
              </div>
              <div style={{ height: '300px' }}>
                <canvas ref={histogramCanvasRef} />
              </div>
            </div>
          </div>

          {/* Daily Plan Table */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
            <h2 style={{ color: '#94a3b8', marginBottom: '15px' }}>📋 Plano Diário</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Dia</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Trecho</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Atividade</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Equipe</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Metros</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Mão de Obra</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Custo/Dia</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.dailyPlan.slice(0, 20).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{item.day}</td>
                      <td style={{ padding: '10px' }}>{item.trechoId}</td>
                      <td style={{ padding: '10px' }}>{item.activity}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>Eq. {item.team}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{item.metrosExecutados.toFixed(1)}m</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{item.labor} pessoas</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>R$ {item.dailyCost.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedule.dailyPlan.length > 20 && (
                <p style={{ textAlign: 'center', marginTop: '15px', color: '#94a3b8' }}>
                  ... e mais {schedule.dailyPlan.length - 20} registros
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlanejamentoPage;
