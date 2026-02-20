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

// =============================================================================
// COORDINATE TRANSFORMATION UTILITIES
// =============================================================================

/**
 * Convert UTM coordinates to Lat/Lon (EPSG:31983 -> WGS84)
 * Simplified formula for display purposes
 */
function utmToLatLon(x: number, y: number, zone: number = 23): { lat: number; lng: number } {
  // Constants for UTM Zone 23S (SIRGAS 2000)
  const k0 = 0.9996;
  const a = 6378137.0;  // WGS84 semi-major axis
  const e = 0.0818191908426;  // WGS84 eccentricity
  const e1sq = 0.006739496742;

  // Remove false easting and northing
  const x0 = x - 500000;
  const y0 = y - 10000000;  // Southern hemisphere

  // Central meridian for zone 23
  const lon0 = -45;  // degrees

  // Footprint latitude
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
}

/**
 * Detect if coordinates are likely UTM (large values) or LatLon (small values)
 */
function isUTMCoordinate(x: number, y: number): boolean {
  // UTM coordinates are typically > 100000 for X and > 1000000 for Y in southern Brazil
  return Math.abs(x) > 10000 || Math.abs(y) > 10000;
}

/**
 * Auto-detect and convert coordinates to LatLon for map display
 */
function toMapCoordinates(x: number, y: number, referencePoint?: { x: number; y: number }): { lat: number; lng: number } {
  if (isUTMCoordinate(x, y)) {
    return utmToLatLon(x, y, 23);
  }

  // Already in lat/lon or relative coordinates
  if (referencePoint && isUTMCoordinate(referencePoint.x, referencePoint.y)) {
    // Relative coordinates based on reference point
    const refLatLon = utmToLatLon(referencePoint.x, referencePoint.y, 23);
    const deltaLat = (y - referencePoint.y) / 111320;  // approx meters to degrees
    const deltaLng = (x - referencePoint.x) / (111320 * Math.cos(refLatLon.lat * Math.PI / 180));
    return {
      lat: refLatLon.lat + deltaLat,
      lng: refLatLon.lng + deltaLng
    };
  }

  // Assume small values are offsets from Sao Paulo
  return {
    lat: -23.5505 + (y / 111320),
    lng: -46.6333 + (x / 111320)
  };
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

  // Initialize map with multiple base layers and controls
  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) {
      return;
    }

    // Create map centered on Sao Paulo
    mapInstanceRef.current = L.map(mapContainerRef.current, {
      center: [-23.5505, -46.6333],
      zoom: 14,
      zoomControl: true,
      attributionControl: true
    });

    // Base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap',
      maxZoom: 17
    });

    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      maxZoom: 19
    });

    // Add default layer
    osmLayer.addTo(mapInstanceRef.current);

    // Create layer groups for markers and segments
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    segmentsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    // Base layers control
    const baseLayers = {
      'OpenStreetMap': osmLayer,
      'Satelite': satelliteLayer,
      'Topografico': topoLayer,
      'Claro': cartoLight
    };

    // Overlay layers control
    const overlays = {
      'Pontos': markersLayerRef.current,
      'Trechos': segmentsLayerRef.current
    };

    // Add layer control
    L.control.layers(baseLayers, overlays, {
      collapsed: true,
      position: 'topright'
    }).addTo(mapInstanceRef.current);

    // Add scale control
    L.control.scale({
      metric: true,
      imperial: false,
      position: 'bottomleft'
    }).addTo(mapInstanceRef.current);

    // Add coordinate display on mouse move
    const coordDisplay = L.control({ position: 'bottomright' });
    coordDisplay.onAdd = function() {
      const div = L.DomUtil.create('div', 'coord-display');
      div.style.cssText = 'background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 4px; font-family: monospace; font-size: 12px;';
      div.innerHTML = 'Lat: -- Lng: --';
      return div;
    };
    coordDisplay.addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('mousemove', (e: any) => {
      const container = document.querySelector('.coord-display');
      if (container) {
        container.innerHTML = `Lat: ${e.latlng.lat.toFixed(6)} Lng: ${e.latlng.lng.toFixed(6)}`;
      }
    });

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
    const referencePoint = pontos.length > 0 ? { x: pontos[0].x, y: pontos[0].y } : undefined;

    // Add markers for each point with proper coordinate transformation
    pontos.forEach((ponto, idx) => {
      const coords = toMapCoordinates(ponto.x, ponto.y, referencePoint);
      const { lat, lng } = coords;

      bounds.push([lat, lng]);

      // Determine marker color and icon
      let markerColor = '#3b82f6';  // Default blue
      let markerLabel = 'PI';  // Ponto Intermediario
      if (idx === 0) {
        markerColor = '#22c55e';  // Green for start
        markerLabel = 'M';  // Montante
      } else if (idx === pontos.length - 1) {
        markerColor = '#ef4444';  // Red for end
        markerLabel = 'J';  // Jusante
      }

      // Create draggable marker
      const marker = L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: markerColor,
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: 3
      });

      // Enhanced popup with more information
      const popupContent = `
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <div style="background: ${markerColor}; color: white; padding: 8px 12px; margin: -13px -19px 10px; border-radius: 4px 4px 0 0;">
            <strong style="font-size: 14px;">${ponto.id}</strong>
            <span style="float: right; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; font-size: 11px;">${markerLabel}</span>
          </div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #666;">X (UTM)</td><td style="text-align: right; font-weight: 500;">${ponto.x.toFixed(3)}</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Y (UTM)</td><td style="text-align: right; font-weight: 500;">${ponto.y.toFixed(3)}</td></tr>
            <tr style="border-top: 1px solid #eee;"><td style="padding: 4px 0; color: #666;">Cota</td><td style="text-align: right; font-weight: 600; color: ${markerColor};">${ponto.cota.toFixed(3)} m</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Latitude</td><td style="text-align: right; font-size: 11px;">${lat.toFixed(6)}</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Longitude</td><td style="text-align: right; font-size: 11px;">${lng.toFixed(6)}</td></tr>
          </table>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 300 });
      marker.bindTooltip(`<strong>${ponto.id}</strong><br/>Cota: ${ponto.cota.toFixed(2)}m`, {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
      });

      // Highlight on hover
      marker.on('mouseover', function() {
        this.setStyle({ weight: 4, radius: 12 });
      });
      marker.on('mouseout', function() {
        this.setStyle({ weight: 3, radius: 10 });
      });

      markersLayerRef.current.addLayer(marker);
    });

    // Add polylines for segments with proper coordinate transformation
    trechos.forEach((trecho, idx) => {
      const startCoords = toMapCoordinates(trecho.xInicio, trecho.yInicio, referencePoint);
      const endCoords = toMapCoordinates(trecho.xFim, trecho.yFim, referencePoint);

      // Color coding by network type
      let lineColor = '#22c55e';  // Green for gravity
      let lineStyle = [];
      if (trecho.tipoRede === 'Elevatoria / Booster') {
        lineColor = '#f59e0b';  // Orange for pumped
        lineStyle = [5, 5];  // Dashed line
      } else if (trecho.declividade < 0) {
        lineColor = '#ef4444';  // Red for adverse slope
      }

      const polyline = L.polyline(
        [[startCoords.lat, startCoords.lng], [endCoords.lat, endCoords.lng]],
        {
          color: lineColor,
          weight: 5,
          opacity: 0.85,
          dashArray: lineStyle.length > 0 ? lineStyle.join(',') : undefined
        }
      );

      // Enhanced popup for segments
      const declividadePercent = (trecho.declividade * 100).toFixed(3);
      const declividadeStatus = Math.abs(trecho.declividade * 100) < 0.5 ? 'ALERTA: Declividade muito baixa' :
                                trecho.declividade < 0 ? 'ALERTA: Declividade adversa!' : 'OK';
      const statusColor = declividadeStatus.includes('ALERTA') ? '#ef4444' : '#22c55e';

      const segmentPopup = `
        <div style="min-width: 220px; font-family: system-ui, sans-serif;">
          <div style="background: ${lineColor}; color: white; padding: 8px 12px; margin: -13px -19px 10px; border-radius: 4px 4px 0 0;">
            <strong style="font-size: 14px;">Trecho ${idx + 1}</strong>
            <span style="float: right; font-size: 12px;">${trecho.idInicio} → ${trecho.idFim}</span>
          </div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #666;">Comprimento</td><td style="text-align: right; font-weight: 600;">${trecho.comprimento.toFixed(2)} m</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Declividade</td><td style="text-align: right; font-weight: 500; color: ${statusColor};">${declividadePercent}%</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Diametro</td><td style="text-align: right;">DN ${trecho.diametroMm}</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Material</td><td style="text-align: right;">${trecho.material}</td></tr>
            <tr style="border-top: 1px solid #eee;"><td style="padding: 4px 0; color: #666;">Tipo</td><td style="text-align: right;">${trecho.tipoRede}</td></tr>
          </table>
          <div style="margin-top: 8px; padding: 6px; background: ${statusColor}15; border-radius: 4px; font-size: 11px; color: ${statusColor};">
            ${declividadeStatus}
          </div>
        </div>
      `;

      polyline.bindPopup(segmentPopup, { maxWidth: 350 });
      polyline.bindTooltip(`L=${trecho.comprimento.toFixed(1)}m | i=${declividadePercent}%`, {
        permanent: false,
        direction: 'center'
      });

      // Highlight on hover
      polyline.on('mouseover', function() {
        this.setStyle({ weight: 7, opacity: 1 });
        this.bringToFront();
      });
      polyline.on('mouseout', function() {
        this.setStyle({ weight: 5, opacity: 0.85 });
      });

      segmentsLayerRef.current.addLayer(polyline);
    });

    // Fit bounds with padding
    if (bounds.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18
        });
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
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
        // parseCSV now auto-detects delimiters and handles files without headers
        const newPontos = parseCSV(content);
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

        <div style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '10px',
          flexWrap: 'wrap',
          padding: '10px',
          backgroundColor: '#0f172a',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>PONTOS</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid white' }}></span>
                Montante (M)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid white' }}></span>
                Jusante (J)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '2px solid white' }}></span>
                Intermediario (PI)
              </span>
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#334155' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>TRECHOS</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '20px', height: '4px', backgroundColor: '#22c55e', borderRadius: '2px' }}></span>
                Gravidade
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '20px', height: '4px', backgroundColor: '#f59e0b', borderRadius: '2px', backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 8px)' }}></span>
                Elevatoria
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ width: '20px', height: '4px', backgroundColor: '#ef4444', borderRadius: '2px' }}></span>
                Decl. Adversa
              </span>
            </div>
          </div>
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
