/**
 * TopografiaPage - Topography Module
 *
 * Provides topographic data import, visualization, and interactive map display
 * for sanitation network engineering projects.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  parseCSV,
  readTopographyFile,
  createSampleTopography,
  exportToCSV,
  type PontoTopografico,
  type TopographyData
} from '../engine/reader';
import {
  createTrechosFromTopography,
  summarizeNetwork,
  trechosToRecords,
  type Trecho,
  type NetworkSummary
} from '../engine/domain';

// Leaflet types for when library is loaded
declare const L: any;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  cota: number;
}

interface TopografiaPageProps {
  onDataLoaded?: (pontos: PontoTopografico[], trechos: Trecho[]) => void;
}

export const TopografiaPage: React.FC<TopografiaPageProps> = ({ onDataLoaded }) => {
  // State
  const [pontos, setPontos] = useState<PontoTopografico[]>([]);
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [diametroMm, setDiametroMm] = useState(200);
  const [material, setMaterial] = useState('PVC');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const segmentsLayerRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    // Create map centered on São Paulo
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([-23.5505, -46.6333], 12);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    // Create layer groups
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    segmentsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map when pontos or trechos change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !segmentsLayerRef.current) {
      return;
    }

    // Clear existing layers
    markersLayerRef.current.clearLayers();
    segmentsLayerRef.current.clearLayers();

    if (pontos.length === 0) return;

    const bounds: [number, number][] = [];

    // Add markers for each point
    pontos.forEach((ponto, idx) => {
      // Convert UTM-like coordinates to approximate lat/lng for display
      // In production, use proper coordinate transformation
      const lat = -23.5 - (ponto.y - pontos[0].y) / 111000;
      const lng = -46.6 + (ponto.x - pontos[0].x) / 111000;

      bounds.push([lat, lng]);

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: idx === 0 ? '#22c55e' : idx === pontos.length - 1 ? '#ef4444' : '#3b82f6',
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
      markersLayerRef.current.addLayer(marker);
    });

    // Add polylines for segments
    trechos.forEach((trecho) => {
      const startLat = -23.5 - (trecho.yInicio - pontos[0].y) / 111000;
      const startLng = -46.6 + (trecho.xInicio - pontos[0].x) / 111000;
      const endLat = -23.5 - (trecho.yFim - pontos[0].y) / 111000;
      const endLng = -46.6 + (trecho.xFim - pontos[0].x) / 111000;

      const color = trecho.tipoRede === 'Esgoto por Gravidade' ? '#22c55e' : '#f59e0b';

      const polyline = L.polyline([[startLat, startLng], [endLat, endLng]], {
        color: color,
        weight: 4,
        opacity: 0.8
      });

      polyline.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px; color: #333;">${trecho.idInicio} → ${trecho.idFim}</h4>
          <p style="margin: 4px 0;"><strong>Comprimento:</strong> ${trecho.comprimento.toFixed(2)}m</p>
          <p style="margin: 4px 0;"><strong>Declividade:</strong> ${(trecho.declividade * 100).toFixed(3)}%</p>
          <p style="margin: 4px 0;"><strong>Tipo:</strong> ${trecho.tipoRede}</p>
          <p style="margin: 4px 0;"><strong>Diâmetro:</strong> DN${trecho.diametroMm}</p>
          <p style="margin: 4px 0;"><strong>Material:</strong> ${trecho.material}</p>
        </div>
      `);

      segmentsLayerRef.current.addLayer(polyline);
    });

    // Fit bounds
    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pontos, trechos]);

  // Process imported data
  const processData = useCallback((newPontos: PontoTopografico[]) => {
    setPontos(newPontos);

    try {
      const newTrechos = createTrechosFromTopography(newPontos, diametroMm, material);
      setTrechos(newTrechos);

      const newSummary = summarizeNetwork(newTrechos);
      setSummary(newSummary);

      setError('');

      if (onDataLoaded) {
        onDataLoaded(newPontos, newTrechos);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar dados');
    }
  }, [diametroMm, material, onDataLoaded]);

  // File handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');
    setFileName(file.name);

    try {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Máximo: 50MB');
      }

      let data: TopographyData;

      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
        const content = await file.text();
        try {
          const newPontos = parseCSV(content, ',');
          data = {
            pontos: newPontos,
            metadata: {
              source: file.name,
              totalPoints: newPontos.length,
              bounds: {
                minX: Math.min(...newPontos.map(p => p.x)),
                maxX: Math.max(...newPontos.map(p => p.x)),
                minY: Math.min(...newPontos.map(p => p.y)),
                maxY: Math.max(...newPontos.map(p => p.y)),
                minCota: Math.min(...newPontos.map(p => p.cota)),
                maxCota: Math.max(...newPontos.map(p => p.cota))
              },
              importedAt: new Date().toISOString()
            }
          };
        } catch {
          const newPontos = parseCSV(content, ';');
          data = {
            pontos: newPontos,
            metadata: {
              source: file.name,
              totalPoints: newPontos.length,
              bounds: {
                minX: Math.min(...newPontos.map(p => p.x)),
                maxX: Math.max(...newPontos.map(p => p.x)),
                minY: Math.min(...newPontos.map(p => p.y)),
                maxY: Math.max(...newPontos.map(p => p.y)),
                minCota: Math.min(...newPontos.map(p => p.cota)),
                maxCota: Math.max(...newPontos.map(p => p.cota))
              },
              importedAt: new Date().toISOString()
            }
          };
        }
      } else {
        throw new Error(`Formato não suportado: ${file.name}. Use CSV ou TXT.`);
      }

      processData(data.pontos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo');
    } finally {
      setIsLoading(false);
    }
  }, [processData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Load sample data
  const loadSampleData = () => {
    const samplePontos = createSampleTopography(10);
    setFileName('Dados de Exemplo');
    processData(samplePontos);
  };

  // Export data
  const handleExport = (format: 'csv' | 'json') => {
    if (trechos.length === 0) {
      setError('Nenhum dado para exportar');
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'csv') {
      const records = trechosToRecords(trechos, true);
      const header = Object.keys(records[0]).join(';');
      const rows = records.map(r => Object.values(r).join(';'));
      content = [header, ...rows].join('\n');
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
    } else {
      content = JSON.stringify({ pontos, trechos, summary }, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    }

    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topografia_${new Date().toISOString().slice(0, 10)}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>📍</span> Topografia
      </h1>

      {/* Import Section */}
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginBottom: '15px', color: '#94a3b8' }}>Importar Dados Topográficos</h2>

        {/* Configuration */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>Diâmetro (mm)</label>
            <select
              value={diametroMm}
              onChange={(e) => setDiametroMm(Number(e.target.value))}
              style={{
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                minWidth: '120px'
              }}
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
            <label style={{ display: 'block', marginBottom: '5px', color: '#94a3b8' }}>Material</label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                minWidth: '120px'
              }}
            >
              <option value="PVC">PVC</option>
              <option value="PEAD">PEAD</option>
              <option value="FOFO">Ferro Fundido</option>
              <option value="Concreto">Concreto</option>
            </select>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#3b82f6' : '#475569'}`,
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : '#0f172a',
            transition: 'all 0.2s ease'
          }}
        >
          <p style={{ fontSize: '2rem', marginBottom: '10px' }}>📁</p>
          <p style={{ color: '#94a3b8' }}>Arraste o arquivo aqui ou clique para selecionar</p>
          <p style={{ color: '#3b82f6', fontSize: '0.85rem', marginTop: '10px' }}>Formatos: .txt, .csv</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={loadSampleData}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            📊 Carregar Dados de Exemplo
          </button>

          {pontos.length > 0 && (
            <>
              <button
                onClick={() => handleExport('csv')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                📥 Exportar CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                📥 Exportar JSON
              </button>
            </>
          )}
        </div>

        {/* Status */}
        {isLoading && (
          <p style={{ marginTop: '15px', color: '#3b82f6' }}>⏳ Processando...</p>
        )}
        {error && (
          <p style={{ marginTop: '15px', color: '#ef4444' }}>❌ {error}</p>
        )}
        {fileName && !isLoading && !error && (
          <p style={{ marginTop: '15px', color: '#22c55e' }}>✅ Arquivo: {fileName}</p>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Pontos</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{pontos.length}</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Trechos</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{summary.totalTrechos}</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Comprimento Total</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{summary.comprimentoTotal.toFixed(1)}m</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Por Gravidade</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{summary.trechosGravidade}</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Elevatória</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{summary.trechosElevatoria}</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Declividade Média</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{(summary.declividadeMedia * 100).toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: '#94a3b8', margin: 0 }}>🗺️ Mapa Interativo</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + 1)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              🔍+
            </button>
            <button
              onClick={() => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() - 1)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              🔍-
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            Ponto Inicial
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            Ponto Final
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
            Pontos Intermediários
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ width: '20px', height: '4px', backgroundColor: '#22c55e' }}></span>
            Gravidade
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ width: '20px', height: '4px', backgroundColor: '#f59e0b' }}></span>
            Elevatória
          </span>
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

      {/* Data Table */}
      {trechos.length > 0 && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ color: '#94a3b8', margin: 0 }}>📋 Dados dos Trechos</h2>
            <button
              onClick={() => setShowTable(!showTable)}
              style={{
                padding: '8px 15px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {showTable ? '▲ Ocultar' : '▼ Mostrar'}
            </button>
          </div>

          {showTable && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Início</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #334155' }}>Fim</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Comp. (m)</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #334155' }}>Decliv. (%)</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Tipo</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>DN</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #334155' }}>Material</th>
                  </tr>
                </thead>
                <tbody>
                  {trechos.map((trecho, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px' }}>{trecho.idInicio}</td>
                      <td style={{ padding: '10px' }}>{trecho.idFim}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{trecho.comprimento.toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{(trecho.declividade * 100).toFixed(3)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: trecho.tipoRede === 'Esgoto por Gravidade' ? '#22c55e' : '#f59e0b',
                          color: 'white',
                          fontSize: '0.8rem'
                        }}>
                          {trecho.tipoRede === 'Esgoto por Gravidade' ? 'Gravidade' : 'Elevatória'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{trecho.diametroMm}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{trecho.material}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopografiaPage;
