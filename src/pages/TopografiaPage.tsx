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
import { SHPReader } from '../core/import/readers/SHPReader';
import { GeoJSONReader } from '../core/import/readers/GeoJSONReader';
import { DXFReader } from '../core/import/readers/DXFReader';
import type { RawEntity } from '../core/import/ImportEngine';

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

// =============================================================================
// ENTITY TO TOPOGRAPHY CONVERSION
// =============================================================================

/**
 * Detecta automaticamente o campo de elevação/cota nos atributos
 */
function detectElevationField(attributes: Record<string, any>): string | null {
  const elevationKeys = [
    'z', 'Z', 'cota', 'COTA', 'elevation', 'ELEVATION', 'elev', 'ELEV',
    'elevacao', 'ELEVACAO', 'altitude', 'ALTITUDE', 'alt', 'ALT',
    'height', 'HEIGHT', 'h', 'H', 'ct', 'CT', 'cota_terreno', 'COTA_TERRENO'
  ];

  for (const key of elevationKeys) {
    if (key in attributes && typeof attributes[key] === 'number') {
      return key;
    }
  }

  // Tentar encontrar qualquer campo numérico que possa ser elevação
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'number' && !['x', 'y', 'X', 'Y'].includes(key)) {
      return key;
    }
  }

  return null;
}

/**
 * Extrai coordenadas de uma geometria GeoJSON
 */
function extractCoordinates(geometry: any): { x: number; y: number; z?: number } | null {
  if (!geometry || !geometry.coordinates) return null;

  const coords = geometry.coordinates;

  switch (geometry.type) {
    case 'Point':
      return { x: coords[0], y: coords[1], z: coords[2] };

    case 'LineString':
    case 'MultiPoint':
      // Pegar o primeiro ponto
      if (coords.length > 0) {
        return { x: coords[0][0], y: coords[0][1], z: coords[0][2] };
      }
      break;

    case 'Polygon':
      // Pegar o centróide aproximado
      if (coords[0] && coords[0].length > 0) {
        const ring = coords[0];
        let sumX = 0, sumY = 0, sumZ = 0, hasZ = false;
        for (const pt of ring) {
          sumX += pt[0];
          sumY += pt[1];
          if (pt[2] !== undefined) {
            sumZ += pt[2];
            hasZ = true;
          }
        }
        const n = ring.length;
        return {
          x: sumX / n,
          y: sumY / n,
          z: hasZ ? sumZ / n : undefined
        };
      }
      break;

    case 'MultiLineString':
      // Pegar o primeiro ponto da primeira linha
      if (coords[0] && coords[0].length > 0) {
        return { x: coords[0][0][0], y: coords[0][0][1], z: coords[0][0][2] };
      }
      break;
  }

  return null;
}

/**
 * Converte entidades brutas em pontos topográficos
 */
function convertEntitiesToTopography(entities: RawEntity[], fileName: string): PontoTopografico[] {
  const pontos: PontoTopografico[] = [];
  let pointIndex = 0;

  for (const entity of entities) {
    const coords = extractCoordinates(entity.geometry);
    if (!coords) continue;

    // Tentar obter elevação do Z da geometria ou dos atributos
    let cota = coords.z;

    if (cota === undefined || cota === 0) {
      const elevField = detectElevationField(entity.attributes);
      if (elevField) {
        cota = entity.attributes[elevField];
      }
    }

    // Se ainda não tem cota, usar 0 (será detectado como problema)
    if (cota === undefined || isNaN(cota)) {
      cota = 0;
    }

    // Gerar ID do ponto
    let id = entity.id || `P${pointIndex + 1}`;

    // Tentar obter ID dos atributos
    const idFields = ['id', 'ID', 'Id', 'name', 'NAME', 'Name', 'ponto', 'PONTO', 'point', 'POINT'];
    for (const field of idFields) {
      if (entity.attributes[field]) {
        id = String(entity.attributes[field]);
        break;
      }
    }

    pontos.push({
      id,
      x: coords.x,
      y: coords.y,
      cota
    });

    pointIndex++;
  }

  return pontos;
}

/**
 * Converte linhas em pontos topográficos (extrai vértices)
 */
function convertLinesToTopography(entities: RawEntity[], fileName: string): PontoTopografico[] {
  const pontos: PontoTopografico[] = [];
  const seenCoords = new Set<string>();
  let pointIndex = 0;

  for (const entity of entities) {
    if (!entity.geometry || !entity.geometry.coordinates) continue;

    const processCoords = (coordList: number[][]) => {
      for (const coord of coordList) {
        const key = `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
        if (seenCoords.has(key)) continue;
        seenCoords.add(key);

        let cota = coord[2];
        if (cota === undefined || cota === 0) {
          const elevField = detectElevationField(entity.attributes);
          if (elevField) {
            cota = entity.attributes[elevField];
          }
        }

        pontos.push({
          id: `V${pointIndex + 1}`,
          x: coord[0],
          y: coord[1],
          cota: cota ?? 0
        });

        pointIndex++;
      }
    };

    switch (entity.geometry.type) {
      case 'LineString':
        processCoords(entity.geometry.coordinates);
        break;
      case 'MultiLineString':
        for (const line of entity.geometry.coordinates) {
          processCoords(line);
        }
        break;
      case 'Polygon':
        processCoords(entity.geometry.coordinates[0]);
        break;
    }
  }

  return pontos;
}

/**
 * Processa entidades e decide a melhor estratégia de conversão
 */
function processEntitiesToTopography(entities: RawEntity[], fileName: string): PontoTopografico[] {
  // Contar tipos de geometria
  let pointCount = 0;
  let lineCount = 0;

  for (const entity of entities) {
    if (!entity.geometry) continue;
    const type = entity.geometry.type;
    if (type === 'Point' || type === 'MultiPoint') {
      pointCount++;
    } else if (type === 'LineString' || type === 'MultiLineString' || type === 'Polygon') {
      lineCount++;
    }
  }

  // Se maioria são pontos, usar conversão direta
  if (pointCount >= lineCount) {
    return convertEntitiesToTopography(entities, fileName);
  } else {
    // Se maioria são linhas, extrair vértices
    return convertLinesToTopography(entities, fileName);
  }
}

interface TopografiaPageProps {
  onDataLoaded?: (pontos: PontoTopografico[], trechos: Trecho[]) => void;
}

// Tipos para modo de edição/exclusão
type EditMode = 'normal' | 'delete' | 'select' | 'connect';

interface DeleteModalState {
  show: boolean;
  nodesToDelete: string[];
  trechosToDelete: number[];
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

  // Estados do modo de exclusão
  const [editMode, setEditMode] = useState<EditMode>('normal');
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    show: false,
    nodesToDelete: [],
    trechosToDelete: []
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const segmentsLayerRef = useRef<any>(null);
  const markerRefsMap = useRef<Map<string, any>>(new Map());
  const initialBoundsFitted = useRef<boolean>(false);
  const previousPontosCount = useRef<number>(0);

  // =========================================================================
  // FUNÇÕES DE EXCLUSÃO DE NÓS
  // =========================================================================

  // Toggle seleção de nó para exclusão
  const toggleNodeSelection = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Selecionar todos os nós
  const selectAllNodes = useCallback(() => {
    setSelectedNodes(new Set(pontos.map(p => p.id)));
  }, [pontos]);

  // Limpar seleção
  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
  }, []);

  // Entrar no modo de exclusão
  const enterDeleteMode = useCallback(() => {
    setEditMode('delete');
    setSelectedNodes(new Set());
  }, []);

  // Sair do modo de exclusão
  const exitDeleteMode = useCallback(() => {
    setEditMode('normal');
    setSelectedNodes(new Set());
  }, []);

  // Calcular trechos conectados aos nós selecionados
  const getConnectedTrechos = useCallback((nodeIds: Set<string>): number[] => {
    const connectedIndices: number[] = [];
    trechos.forEach((trecho, idx) => {
      if (nodeIds.has(trecho.idInicio) || nodeIds.has(trecho.idFim)) {
        connectedIndices.push(idx);
      }
    });
    return connectedIndices;
  }, [trechos]);

  // Abrir modal de confirmação
  const showDeleteConfirmation = useCallback(() => {
    const nodesToDelete = Array.from(selectedNodes);
    const trechosToDelete = getConnectedTrechos(selectedNodes);

    setDeleteModal({
      show: true,
      nodesToDelete,
      trechosToDelete
    });
  }, [selectedNodes, getConnectedTrechos]);

  // Confirmar exclusão
  const confirmDelete = useCallback(() => {
    const { nodesToDelete, trechosToDelete } = deleteModal;

    // Excluir pontos
    const newPontos = pontos.filter(p => !nodesToDelete.includes(p.id));

    // Excluir trechos conectados
    const newTrechos = trechos.filter((_, idx) => !trechosToDelete.includes(idx));

    // Atualizar estados
    setPontos(newPontos);
    setTrechos(newTrechos);

    // Recalcular resumo
    if (newTrechos.length > 0) {
      const newSummary = summarizeNetwork(newTrechos);
      setSummary(newSummary);
    } else {
      setSummary(null);
    }

    // Fechar modal e sair do modo de exclusão
    setDeleteModal({ show: false, nodesToDelete: [], trechosToDelete: [] });
    exitDeleteMode();

    // Notificar
    if (onDataLoaded) {
      onDataLoaded(newPontos, newTrechos);
    }
  }, [deleteModal, pontos, trechos, exitDeleteMode, onDataLoaded]);

  // Cancelar exclusão
  const cancelDelete = useCallback(() => {
    setDeleteModal({ show: false, nodesToDelete: [], trechosToDelete: [] });
  }, []);

  // Keyboard handler para ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editMode === 'delete') {
        exitDeleteMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, exitDeleteMode]);

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

  // Update map when pontos, trechos, editMode, or selectedNodes change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !segmentsLayerRef.current) {
      return;
    }

    // Clear existing layers
    markersLayerRef.current.clearLayers();
    segmentsLayerRef.current.clearLayers();
    markerRefsMap.current.clear();

    if (pontos.length === 0) return;

    const bounds: [number, number][] = [];
    const referencePoint = pontos.length > 0 ? { x: pontos[0].x, y: pontos[0].y } : undefined;

    // Add markers for each point with proper coordinate transformation
    pontos.forEach((ponto, idx) => {
      const coords = toMapCoordinates(ponto.x, ponto.y, referencePoint);
      const { lat, lng } = coords;

      bounds.push([lat, lng]);

      // Determine marker color and icon based on mode
      let markerColor = '#3b82f6';  // Default blue
      let markerLabel = 'PI';  // Ponto Intermediario

      if (editMode === 'delete') {
        // Modo de exclusão: vermelho para selecionados, amarelo para hover
        if (selectedNodes.has(ponto.id)) {
          markerColor = '#ef4444';  // Red for selected to delete
          markerLabel = '✗';
        } else if (hoveredNode === ponto.id) {
          markerColor = '#f59e0b';  // Orange for hover
          markerLabel = '?';
        } else {
          markerColor = '#64748b';  // Gray for available
          markerLabel = '○';
        }
      } else {
        // Modo normal
        if (idx === 0) {
          markerColor = '#22c55e';  // Green for start
          markerLabel = 'M';  // Montante
        } else if (idx === pontos.length - 1) {
          markerColor = '#ef4444';  // Red for end
          markerLabel = 'J';  // Jusante
        }
      }

      // Create marker with appropriate styling
      const markerRadius = editMode === 'delete' ? (selectedNodes.has(ponto.id) ? 14 : 10) : 10;
      const markerWeight = editMode === 'delete' && selectedNodes.has(ponto.id) ? 4 : 3;

      const marker = L.circleMarker([lat, lng], {
        radius: markerRadius,
        fillColor: markerColor,
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: markerWeight,
        className: editMode === 'delete' ? 'delete-mode-marker' : ''
      });

      // Store reference for updates
      markerRefsMap.current.set(ponto.id, marker);

      // Enhanced popup with more information (only in normal mode)
      if (editMode === 'normal') {
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
        marker.bindPopup(popupContent, { maxWidth: 300, autoPan: false });
      }

      // Tooltip (different for delete mode)
      if (editMode === 'delete') {
        const status = selectedNodes.has(ponto.id) ? '✗ Selecionado para exclusão' : 'Clique para selecionar';
        marker.bindTooltip(`<strong>${ponto.id}</strong><br/>${status}`, {
          permanent: false,
          direction: 'top',
          offset: [0, -10]
        });
      } else {
        marker.bindTooltip(`<strong>${ponto.id}</strong><br/>Cota: ${ponto.cota.toFixed(2)}m`, {
          permanent: false,
          direction: 'top',
          offset: [0, -10]
        });
      }

      // Event handlers
      marker.on('mouseover', function() {
        if (editMode === 'delete') {
          setHoveredNode(ponto.id);
          if (!selectedNodes.has(ponto.id)) {
            this.setStyle({ fillColor: '#f59e0b', radius: 12 });
          }
        } else {
          this.setStyle({ weight: 4, radius: 12 });
        }
      });

      marker.on('mouseout', function() {
        if (editMode === 'delete') {
          setHoveredNode(null);
          if (!selectedNodes.has(ponto.id)) {
            this.setStyle({ fillColor: '#64748b', radius: 10 });
          }
        } else {
          this.setStyle({ weight: 3, radius: 10 });
        }
      });

      marker.on('click', function(e: any) {
        if (editMode === 'delete') {
          // Prevent popup in delete mode
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          toggleNodeSelection(ponto.id);
        }
        // Normal mode: popup will open automatically
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

    // Fit bounds with padding ONLY when new data is loaded (pontos count changes)
    // This prevents zoom changes when clicking on points or changing selection
    const shouldFitBounds = bounds.length > 0 &&
      pontos.length !== previousPontosCount.current;

    if (shouldFitBounds) {
      try {
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18,
          animate: true,
          duration: 0.5
        });
        previousPontosCount.current = pontos.length;
        initialBoundsFitted.current = true;
      } catch (e) {
        console.warn('Could not fit bounds:', e);
      }
    }
  }, [pontos, trechos, editMode, selectedNodes, hoveredNode, toggleNodeSelection]);

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

      const ext = file.name.toLowerCase().split('.').pop() || '';
      let newPontos: PontoTopografico[] = [];

      // CSV / TXT - Usar parseCSV existente
      if (ext === 'csv' || ext === 'txt') {
        const content = await file.text();
        newPontos = parseCSV(content);
      }
      // GeoJSON
      else if (ext === 'geojson' || ext === 'json') {
        const importData = await GeoJSONReader.read(file);
        newPontos = processEntitiesToTopography(importData.entities, file.name);

        if (newPontos.length === 0) {
          throw new Error('Nenhum ponto topográfico encontrado no arquivo GeoJSON.');
        }
      }
      // DXF
      else if (ext === 'dxf') {
        const importData = await DXFReader.read(file);
        newPontos = processEntitiesToTopography(importData.entities, file.name);

        if (newPontos.length === 0) {
          throw new Error('Nenhum ponto topográfico encontrado no arquivo DXF.');
        }
      }
      // Shapefile (.shp) - Precisa de múltiplos arquivos
      else if (ext === 'shp' || ext === 'dbf' || ext === 'shx' || ext === 'prj') {
        // Para shapefile, precisamos de múltiplos arquivos
        // Se o usuário selecionou apenas um arquivo, informar sobre os outros
        setError('');

        // Verificar se existem outros arquivos do shapefile no mesmo input
        const fileInput = fileInputRef.current;
        if (fileInput && fileInput.files && fileInput.files.length > 1) {
          // Múltiplos arquivos selecionados - processar como shapefile
          const files = Array.from(fileInput.files);
          const validation = SHPReader.validateFiles(files);

          if (!validation.isValid) {
            throw new Error('Arquivo .shp principal não encontrado. Selecione todos os arquivos do shapefile (.shp, .dbf, .shx, .prj).');
          }

          // Mostrar warnings se houver
          if (validation.warnings.length > 0) {
            const warningMessages = validation.warnings.map(w => w.message).join('; ');
            console.warn('Shapefile warnings:', warningMessages);
          }

          const importData = await SHPReader.read(files);
          newPontos = processEntitiesToTopography(importData.entities, file.name);

          if (newPontos.length === 0) {
            throw new Error('Nenhum ponto topográfico encontrado no shapefile.');
          }
        } else {
          // Apenas um arquivo .shp selecionado - tentar processar só com ele
          const importData = await SHPReader.read([file]);
          newPontos = processEntitiesToTopography(importData.entities, file.name);

          if (newPontos.length === 0) {
            throw new Error(
              'Shapefile processado mas sem dados de atributos. ' +
              'Para melhor resultado, selecione todos os arquivos (.shp, .dbf, .shx, .prj) juntos.'
            );
          }
        }
      }
      // Formato não suportado
      else {
        const supportedFormats = 'CSV, TXT, GeoJSON, DXF, Shapefile (.shp/.dbf/.shx/.prj)';
        throw new Error(`Formato .${ext} não suportado. Formatos aceitos: ${supportedFormats}`);
      }

      // Validar que temos pontos válidos
      if (newPontos.length === 0) {
        throw new Error('Nenhum ponto topográfico encontrado no arquivo.');
      }

      // Criar TopographyData
      const data: TopographyData = {
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

      processData(data.pontos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo');
    } finally {
      setIsLoading(false);
    }
  }, [processData]);

  // Handle multiple files (for shapefile support)
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsLoading(true);
    setError('');

    try {
      // Check if it's a shapefile set (multiple files with .shp, .dbf, .shx, .prj)
      const extensions = fileArray.map(f => f.name.split('.').pop()?.toLowerCase());
      const hasShp = extensions.includes('shp');
      const hasMultipleShapefileComponents = extensions.some(ext =>
        ['shp', 'dbf', 'shx', 'prj'].includes(ext || '')
      );

      if (hasShp || (fileArray.length > 1 && hasMultipleShapefileComponents)) {
        // Process as shapefile set
        const validation = SHPReader.validateFiles(fileArray);

        if (!validation.isValid) {
          throw new Error('Arquivo .shp principal não encontrado. Selecione todos os arquivos do shapefile.');
        }

        // Show warnings
        if (validation.warnings.length > 0) {
          console.warn('Shapefile warnings:', validation.warnings.map(w => w.message).join('; '));
        }

        const mainFile = fileArray.find(f => f.name.toLowerCase().endsWith('.shp'));
        setFileName(mainFile?.name || 'shapefile');

        const importData = await SHPReader.read(fileArray);
        const newPontos = processEntitiesToTopography(importData.entities, mainFile?.name || 'shapefile');

        if (newPontos.length === 0) {
          throw new Error('Nenhum ponto topográfico encontrado no shapefile.');
        }

        const data: TopographyData = {
          pontos: newPontos,
          metadata: {
            source: mainFile?.name || 'shapefile',
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

        processData(data.pontos);
      } else {
        // Single file - use standard handler
        handleFileSelect(fileArray[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivos');
    } finally {
      setIsLoading(false);
    }
  }, [handleFileSelect, processData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length > 1) {
        handleFiles(files);
      } else {
        handleFileSelect(files[0]);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files.length > 1) {
        handleFiles(files);
      } else {
        handleFileSelect(files[0]);
      }
    }
  }, [handleFileSelect, handleFiles]);

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
          <p style={{ color: '#3b82f6', fontSize: '0.85rem', marginTop: '10px' }}>
            Formatos: CSV, TXT, GeoJSON, DXF, Shapefile (.shp, .dbf, .shx, .prj)
          </p>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '5px' }}>
            Para Shapefile, selecione todos os arquivos juntos (Ctrl+clique)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.geojson,.json,.dxf,.shp,.dbf,.shx,.prj"
            multiple
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

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            border: '2px solid #ef4444'
          }}>
            <h3 style={{ margin: '0 0 15px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚠️ Confirmar Exclusão
            </h3>

            <div style={{ marginBottom: '20px', color: '#e2e8f0' }}>
              <p style={{ marginBottom: '10px' }}>
                Você está prestes a excluir <strong style={{ color: '#ef4444' }}>{deleteModal.nodesToDelete.length} nó(s)</strong>:
              </p>
              <div style={{
                maxHeight: '100px',
                overflowY: 'auto',
                backgroundColor: '#0f172a',
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '15px'
              }}>
                {deleteModal.nodesToDelete.map(id => (
                  <span key={id} style={{
                    display: 'inline-block',
                    margin: '2px',
                    padding: '4px 8px',
                    backgroundColor: '#334155',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>{id}</span>
                ))}
              </div>

              {deleteModal.trechosToDelete.length > 0 && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px'
                }}>
                  <p style={{ margin: 0, color: '#fca5a5' }}>
                    <strong>Atenção:</strong> {deleteModal.trechosToDelete.length} trecho(s) conectado(s) também serão excluídos
                    para manter a integridade topológica.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ color: '#94a3b8', margin: 0 }}>🗺️ Mapa Interativo</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Botões de modo de edição */}
            {editMode === 'normal' && pontos.length > 0 && (
              <button
                onClick={enterDeleteMode}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🗑️ Excluir Nós
              </button>
            )}

            {/* Zoom controls */}
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

        {/* Barra de ferramentas do modo de exclusão */}
        {editMode === 'delete' && (
          <div style={{
            marginBottom: '15px',
            padding: '15px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid #ef4444',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>
                  🗑️ MODO DE EXCLUSÃO
                </span>
                <span style={{ color: '#94a3b8' }}>
                  {selectedNodes.size > 0
                    ? `${selectedNodes.size} nó(s) selecionado(s)`
                    : 'Clique nos nós para selecionar'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={selectAllNodes}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Selecionar Todos
                </button>

                {selectedNodes.size > 0 && (
                  <>
                    <button
                      onClick={clearSelection}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: '#334155',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Limpar Seleção
                    </button>

                    <button
                      onClick={showDeleteConfirmation}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🗑️ Confirmar Exclusão ({selectedNodes.size})
                    </button>
                  </>
                )}

                <button
                  onClick={exitDeleteMode}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#475569',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Cancelar (ESC)
                </button>
              </div>
            </div>

            <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              💡 Dica: Pressione ESC para sair do modo de exclusão. Trechos conectados aos nós selecionados serão excluídos automaticamente.
            </p>
          </div>
        )}

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
