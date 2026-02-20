import React, { useState, useCallback, useRef, useEffect } from 'react';

declare const L: any;

interface DXFEntity {
  type: string;
  layer: string;
  handle: string;
  coordinates: Array<{ x: number; y: number; z: number }>;
  x2?: number;
  y2?: number;
  z2?: number;
}

interface LayerInfo {
  name: string;
  count: number;
  types: string[];
  importAs: 'point' | 'edge' | 'ignore';
}

export interface ImportedData {
  nodes: Array<{ id: string; x: number; y: number; z: number; layer: string }>;
  edges: Array<{ id: string; coordinates: number[][]; layer: string }>;
  layers: string[];
}

// ============================================================================
// PARSER DXF
// ============================================================================

function parseDXF(content: string): { entities: DXFEntity[]; layers: LayerInfo[] } {
  var lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  var pairs: Array<{ code: number; value: string }> = [];
  var i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    var code = parseInt(lines[i].trim(), 10);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    var value = lines[i].trim();
    i++;
    if (!isNaN(code)) pairs.push({ code: code, value: value });
  }

  var entities: DXFEntity[] = [];
  var layerMap = new Map<string, { count: number; types: Set<string> }>();
  var inEntities = false;
  var cur: Partial<DXFEntity> | null = null;
  var cc = { x: 0, y: 0, z: 0 };
  var hasC = false;
  var vt = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'INSERT', 'SPLINE'];

  function fin() {
    if (cur && cur.type && vt.indexOf(cur.type) >= 0) {
      if (hasC) {
        cur.coordinates = cur.coordinates || [];
        cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z });
      }
      if ((cur.coordinates && cur.coordinates.length > 0) || cur.x2 !== undefined) {
        entities.push(cur as DXFEntity);
        var ln = cur.layer || '0';
        if (!layerMap.has(ln)) layerMap.set(ln, { count: 0, types: new Set() });
        var info = layerMap.get(ln)!;
        info.count++;
        info.types.add(cur.type!);
      }
    }
  }

  for (var p = 0; p < pairs.length; p++) {
    var cd = pairs[p].code;
    var vl = pairs[p].value;
    if (cd === 0 && vl === 'SECTION') {
      var nx = pairs[p + 1];
      if (nx && nx.code === 2 && nx.value === 'ENTITIES') { inEntities = true; p++; continue; }
    }
    if (cd === 2 && vl === 'ENTITIES' && !inEntities) { inEntities = true; continue; }
    if ((cd === 0 && vl === 'ENDSEC' && inEntities) || (cd === 0 && vl === 'EOF')) {
      fin(); if (vl === 'EOF') break; inEntities = false; continue;
    }
    if (!inEntities) continue;
    if (cd === 0 && vt.indexOf(vl) >= 0) {
      fin(); cur = { type: vl, layer: '0', handle: '', coordinates: [] };
      cc = { x: 0, y: 0, z: 0 }; hasC = false; continue;
    }
    if (cd === 0 && vl === 'VERTEX' && cur && cur.type === 'POLYLINE') {
      if (hasC) { cur.coordinates = cur.coordinates || []; cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z }); cc = { x: 0, y: 0, z: 0 }; hasC = false; }
      continue;
    }
    if (cd === 0 && vl === 'SEQEND') {
      if (hasC && cur) { cur.coordinates = cur.coordinates || []; cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z }); cc = { x: 0, y: 0, z: 0 }; hasC = false; }
      continue;
    }
    if (cd === 0) continue;
    if (!cur) continue;
    if (cd === 5) cur.handle = vl;
    if (cd === 8) cur.layer = vl;
    if (cd === 10) {
      if (cur.type === 'LWPOLYLINE' && hasC) {
        cur.coordinates = cur.coordinates || [];
        cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z });
        cc = { x: 0, y: 0, z: 0 };
      }
      cc.x = parseFloat(vl); hasC = true;
    }
    if (cd === 20) { cc.y = parseFloat(vl); hasC = true; }
    if (cd === 30) cc.z = parseFloat(vl);
    if (cd === 11) cur.x2 = parseFloat(vl);
    if (cd === 21) cur.y2 = parseFloat(vl);
    if (cd === 31) cur.z2 = parseFloat(vl);
  }

  var layerList: LayerInfo[] = [];
  layerMap.forEach(function(info, name) {
    var typesArr = Array.from(info.types);
    var hasPointType = typesArr.some(function(t) { return t === 'POINT' || t === 'INSERT'; });
    layerList.push({
      name: name,
      count: info.count,
      types: typesArr,
      importAs: hasPointType ? 'point' : 'edge'
    });
  });

  return { entities: entities, layers: layerList.sort(function(a, b) { return a.name.localeCompare(b.name); }) };
}

// ============================================================================
// CONVERTER COM BASE NA DECISAO DO USUARIO
// ============================================================================

function convertWithDecisions(entities: DXFEntity[], decisions: Map<string, string>): ImportedData {
  var nodes: ImportedData['nodes'] = [];
  var edges: ImportedData['edges'] = [];
  var usedLayers = new Set<string>();
  var nc = 1;
  var ec = 1;

  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    var layer = e.layer || '0';
    var dec = decisions.get(layer);
    if (!dec || dec === 'ignore') continue;
    usedLayers.add(layer);

    if (dec === 'point') {
      for (var j = 0; j < e.coordinates.length; j++) {
        var c = e.coordinates[j];
        nodes.push({ id: 'N' + nc, x: c.x, y: c.y, z: c.z, layer: layer });
        nc++;
      }
      if (e.x2 !== undefined) {
        nodes.push({ id: 'N' + nc, x: e.x2, y: e.y2 || 0, z: e.z2 || 0, layer: layer });
        nc++;
      }
    } else if (dec === 'edge') {
      var coords: number[][] = [];
      if (e.type === 'LINE' && e.coordinates.length > 0 && e.x2 !== undefined) {
        var cl = e.coordinates[0];
        coords = [[cl.x, cl.y, cl.z], [e.x2, e.y2 || 0, e.z2 || 0]];
      } else if (e.coordinates.length >= 2) {
        coords = e.coordinates.map(function(c) { return [c.x, c.y, c.z]; });
      } else if (e.coordinates.length === 1) {
        var cs = e.coordinates[0];
        nodes.push({ id: 'N' + nc, x: cs.x, y: cs.y, z: cs.z, layer: layer });
        nc++;
        continue;
      }
      if (coords.length >= 2) {
        edges.push({ id: 'E' + ec, coordinates: coords, layer: layer });
        ec++;
      }
    }
  }

  return { nodes: nodes, edges: edges, layers: Array.from(usedLayers) };
}

// ============================================================================
// COMPONENTE COM MAPA EMBUTIDO
// ============================================================================

export var TopografiaImportNovo: React.FC<{
  onImportComplete?: (data: ImportedData) => void;
}> = function(props) {

  var _s1 = useState<string | null>(null); var fileName = _s1[0]; var setFileName = _s1[1];
  var _s2 = useState(false); var isDragging = _s2[0]; var setIsDragging = _s2[1];
  var _s3 = useState(false); var isLoading = _s3[0]; var setIsLoading = _s3[1];
  var _s4 = useState(false); var isImporting = _s4[0]; var setIsImporting = _s4[1];
  var _s5 = useState(false); var importDone = _s5[0]; var setImportDone = _s5[1];
  var _s6 = useState<ImportedData | null>(null); var importResult = _s6[0]; var setImportResult = _s6[1];
  var _s7 = useState<string | null>(null); var error = _s7[0]; var setError = _s7[1];
  var _s8 = useState<DXFEntity[]>([]); var entities = _s8[0]; var setEntities = _s8[1];
  var _s9 = useState<LayerInfo[]>([]); var layers = _s9[0]; var setLayers = _s9[1];
  var fileInputRef = useRef<HTMLInputElement>(null);
  var mapRef = useRef<HTMLDivElement>(null);
  var mapInstanceRef = useRef<any>(null);

  // --- Upload ---
  var handleFile = useCallback(async function(file: File) {
    if (!file.name.toLowerCase().endsWith('.dxf')) { setError('Use arquivos .dxf'); return; }
    setFileName(file.name); setIsLoading(true); setError(null);
    setEntities([]); setLayers([]); setImportDone(false); setImportResult(null);
    try {
      var result = parseDXF(await file.text());
      if (result.entities.length === 0) setError('Nenhuma entidade geometrica encontrada.');
      else { setEntities(result.entities); setLayers(result.layers); }
    } catch (err: any) { setError('Erro: ' + err.message); }
    finally { setIsLoading(false); }
  }, []);

  // --- Layer toggle ---
  function setLayerAs(name: string, val: string) {
    setLayers(function(prev) {
      return prev.map(function(l) {
        return l.name === name ? { name: l.name, count: l.count, types: l.types, importAs: val as any } : l;
      });
    });
  }

  // --- CONFIRMAR IMPORTACAO (com try-catch total) ---
  function doImport() {
    if (entities.length === 0) return;
    setIsImporting(true);
    setError(null);

    setTimeout(function() {
      try {
        var decisions = new Map<string, string>();
        layers.forEach(function(l) { decisions.set(l.name, l.importAs); });

        var data = convertWithDecisions(entities, decisions);
        console.log('[DXF Import] Resultado:', data.nodes.length, 'pontos,', data.edges.length, 'trechos,', data.layers.length, 'camadas');

        // Salvar no localStorage
        try {
          localStorage.setItem('dxfImportData', JSON.stringify(data));
          localStorage.setItem('importedNodes', JSON.stringify(data.nodes));
          localStorage.setItem('importedEdges', JSON.stringify(data.edges));
          localStorage.setItem('dxfImportTimestamp', new Date().toISOString());
        } catch (e) { /* localStorage cheio */ }

        // Callback seguro para o pai
        try {
          if (props.onImportComplete && typeof props.onImportComplete === 'function') {
            props.onImportComplete(data);
          }
        } catch (cbErr) {
          console.warn('[DXF Import] Callback error (ignorado):', cbErr);
        }

        // Evento global para outros componentes
        try {
          window.dispatchEvent(new CustomEvent('dxfDataImported', { detail: data }));
        } catch (evErr) { /* ok */ }

        setImportResult(data);
        setIsImporting(false);
        setImportDone(true);
      } catch (err: any) {
        console.error('[DXF Import] Erro:', err);
        setError('Erro na importacao: ' + err.message);
        setIsImporting(false);
      }
    }, 200);
  }

  // --- MAPA EMBUTIDO: renderizar apos importacao ---
  useEffect(function() {
    if (!importDone || !importResult || !mapRef.current) return;
    if (typeof L === 'undefined') return;

    // Limpar mapa anterior
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    var map = L.map(mapRef.current).setView([-23.55, -46.63], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap'
    }).addTo(map);

    var bounds: Array<[number, number]> = [];
    var allCoords: number[][] = [];

    // Coletar todas as coordenadas
    importResult.nodes.forEach(function(n) { allCoords.push([n.x, n.y]); });
    importResult.edges.forEach(function(e) {
      e.coordinates.forEach(function(c) { allCoords.push([c[0], c[1]]); });
    });

    if (allCoords.length === 0) return;

    // Detectar se coordenadas sao UTM (valores grandes) ou lat/lng
    var isUTM = Math.abs(allCoords[0][0]) > 360 || Math.abs(allCoords[0][1]) > 360;
    var refX = allCoords[0][0];
    var refY = allCoords[0][1];

    function toLatLng(x: number, y: number): [number, number] {
      if (isUTM) {
        // Converter UTM relativo para pseudo lat/lng para visualizacao
        var lat = -23.55 + (y - refY) / 111320;
        var lng = -46.63 + (x - refX) / (111320 * Math.cos(-23.55 * Math.PI / 180));
        return [lat, lng];
      }
      return [y, x]; // GeoJSON: [lng, lat] -> Leaflet: [lat, lng]
    }

    // Desenhar TRECHOS como polilinhas
    importResult.edges.forEach(function(edge) {
      var latlngs = edge.coordinates.map(function(c) { return toLatLng(c[0], c[1]); });
      bounds = bounds.concat(latlngs);

      var polyline = L.polyline(latlngs, {
        color: '#22c55e', weight: 3, opacity: 0.8
      }).addTo(map);

      polyline.bindPopup(
        '<div style="min-width:120px">' +
        '<b>Trecho: ' + edge.id + '</b><br>' +
        'Camada: ' + edge.layer + '<br>' +
        'Vertices: ' + edge.coordinates.length +
        '</div>'
      );

      // Destaque ao clicar sem mudar zoom
      polyline.on('click', function() {
        polyline.setStyle({ color: '#ffff00', weight: 5 });
        setTimeout(function() { polyline.setStyle({ color: '#22c55e', weight: 3 }); }, 1500);
      });
    });

    // Desenhar PONTOS como marcadores
    importResult.nodes.forEach(function(node) {
      var ll = toLatLng(node.x, node.y);
      bounds.push(ll);

      var marker = L.circleMarker(ll, {
        radius: 6, fillColor: '#3b82f6', fillOpacity: 0.9,
        color: '#fff', weight: 2
      }).addTo(map);

      marker.bindPopup(
        '<div style="min-width:120px">' +
        '<b>' + node.id + '</b><br>' +
        'X: ' + node.x.toFixed(3) + '<br>' +
        'Y: ' + node.y.toFixed(3) + '<br>' +
        'Z: ' + node.z.toFixed(3) + '<br>' +
        'Camada: ' + node.layer +
        '</div>'
      );

      // Destaque ao clicar sem mudar zoom
      marker.on('click', function(ev: any) {
        var mapBounds = map.getBounds();
        if (!mapBounds.contains(ev.latlng)) {
          map.panTo(ev.latlng);
        }
        marker.setStyle({ fillColor: '#ffff00', color: '#ffff00', weight: 4, radius: 10 });
        setTimeout(function() { marker.setStyle({ fillColor: '#3b82f6', color: '#fff', weight: 2, radius: 6 }); }, 1500);
      });
    });

    // Ajustar zoom suave
    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 }); }
      catch (e) { /* bounds invalido */ }
    }

    return function() {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [importDone, importResult]);

  // --- Contadores ---
  var selectedLayers = layers.filter(function(l) { return l.importAs !== 'ignore'; });
  var totalEntities = 0;
  selectedLayers.forEach(function(l) { totalEntities += l.count; });

  // ============================================================================
  // RENDER
  // ============================================================================

  return React.createElement('div', {
    style: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }
  },

    // HEADER
    React.createElement('div', {
      style: { fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }
    },
      'Importar DXF ',
      React.createElement('span', {
        style: { backgroundColor: '#22c55e', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }
      }, 'NOVO')
    ),

    React.createElement('p', { style: { color: '#94a3b8', fontSize: '13px', marginBottom: '16px' } },
      'Escolha como importar cada camada do arquivo DXF'
    ),

    // DROP ZONE (somente antes de ter layers)
    !importDone && layers.length === 0 ? React.createElement('div', {
      onDrop: function(ev: any) { ev.preventDefault(); setIsDragging(false); var f = Array.from(ev.dataTransfer.files) as File[]; if (f.length > 0) handleFile(f[0]); },
      onDragOver: function(ev: any) { ev.preventDefault(); setIsDragging(true); },
      onDragLeave: function() { setIsDragging(false); },
      onClick: function() { if (fileInputRef.current) fileInputRef.current.click(); },
      style: {
        border: '2px dashed ' + (isDragging ? '#3b82f6' : '#475569'),
        borderRadius: '8px', padding: '30px', textAlign: 'center' as any, cursor: 'pointer',
        backgroundColor: isDragging ? 'rgba(59,130,246,0.1)' : 'transparent'
      }
    },
      React.createElement('div', { style: { fontSize: '32px', marginBottom: '8px' } }, '\uD83D\uDCC4'),
      React.createElement('p', { style: { color: '#64748b', fontSize: '14px' } }, 'Arraste um arquivo .dxf aqui'),
      React.createElement('p', { style: { color: '#475569', fontSize: '12px' } }, 'ou clique para selecionar'),
      fileName ? React.createElement('p', { style: { color: '#3b82f6', marginTop: '8px', fontSize: '13px' } }, '\u2713 ' + fileName) : null,
      React.createElement('input', { ref: fileInputRef, type: 'file', accept: '.dxf', onChange: function(ev: any) { if (ev.target.files && ev.target.files[0]) handleFile(ev.target.files[0]); }, style: { display: 'none' } })
    ) : null,

    // LOADING / ERROR
    isLoading ? React.createElement('p', { style: { marginTop: '16px', color: '#3b82f6', textAlign: 'center' as any } }, 'Analisando arquivo DXF...') : null,
    error ? React.createElement('p', { style: { marginTop: '16px', color: '#ef4444', textAlign: 'center' as any, fontSize: '13px' } }, error) : null,

    // TABELA DE LAYERS
    layers.length > 0 && !importDone ? React.createElement('div', null,
      // Info do arquivo
      React.createElement('div', { style: { marginBottom: '12px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px' } },
        React.createElement('p', { style: { color: '#e2e8f0', fontSize: '13px', margin: 0 } },
          'Arquivo: ' + fileName + ' | Entidades: ' + entities.length + ' | Camadas: ' + layers.length
        )
      ),

      // Tabela
      React.createElement('div', { style: { backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' as any, fontSize: '13px' } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { backgroundColor: '#1e293b' } },
              React.createElement('th', { style: { padding: '10px', textAlign: 'left' as any, color: '#94a3b8' } }, 'Camada'),
              React.createElement('th', { style: { padding: '10px', textAlign: 'center' as any, color: '#94a3b8', width: '60px' } }, 'Qtd'),
              React.createElement('th', { style: { padding: '10px', textAlign: 'center' as any, color: '#94a3b8', width: '100px' } }, 'Tipos DXF'),
              React.createElement('th', { style: { padding: '10px', textAlign: 'center' as any, color: '#94a3b8', width: '140px' } }, 'Importar Como')
            )
          ),
          React.createElement('tbody', null,
            layers.map(function(layer, idx) {
              return React.createElement('tr', { key: layer.name, style: { borderTop: '1px solid #334155' } },
                React.createElement('td', { style: { padding: '8px 10px', color: '#e2e8f0', fontWeight: 600 } }, layer.name),
                React.createElement('td', { style: { padding: '8px 10px', textAlign: 'center' as any, color: '#3b82f6', fontWeight: 600 } }, layer.count),
                React.createElement('td', { style: { padding: '8px 10px', textAlign: 'center' as any, color: '#94a3b8', fontSize: '11px' } }, layer.types.join(', ')),
                React.createElement('td', { style: { padding: '8px 10px', textAlign: 'center' as any } },
                  React.createElement('select', {
                    value: layer.importAs,
                    onChange: function(ev: any) { setLayerAs(layer.name, ev.target.value); },
                    style: {
                      padding: '5px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                      border: '1px solid #475569',
                      backgroundColor: layer.importAs === 'ignore' ? '#1e293b' : layer.importAs === 'point' ? '#1e3a5f' : '#1a3d2e',
                      color: layer.importAs === 'ignore' ? '#64748b' : layer.importAs === 'point' ? '#3b82f6' : '#22c55e'
                    }
                  },
                    React.createElement('option', { value: 'point' }, 'Ponto'),
                    React.createElement('option', { value: 'edge' }, 'Trecho'),
                    React.createElement('option', { value: 'ignore' }, 'Ignorar')
                  )
                )
              );
            })
          )
        )
      ),

      // Resumo
      React.createElement('div', { style: { marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'center' } },
        React.createElement('div', { style: { backgroundColor: '#0f172a', padding: '10px 18px', borderRadius: '8px', textAlign: 'center' as any } },
          React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' } },
            layers.filter(function(l) { return l.importAs === 'point'; }).reduce(function(s, l) { return s + l.count; }, 0)
          ),
          React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Pontos')
        ),
        React.createElement('div', { style: { backgroundColor: '#0f172a', padding: '10px 18px', borderRadius: '8px', textAlign: 'center' as any } },
          React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#22c55e' } },
            layers.filter(function(l) { return l.importAs === 'edge'; }).reduce(function(s, l) { return s + l.count; }, 0)
          ),
          React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Trechos')
        ),
        React.createElement('div', { style: { backgroundColor: '#0f172a', padding: '10px 18px', borderRadius: '8px', textAlign: 'center' as any } },
          React.createElement('div', { style: { fontSize: '18px', fontWeight: 'bold', color: '#64748b' } },
            layers.filter(function(l) { return l.importAs === 'ignore'; }).reduce(function(s, l) { return s + l.count; }, 0)
          ),
          React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Ignorar')
        )
      ),

      // Botao Confirmar
      React.createElement('button', {
        onClick: doImport,
        disabled: totalEntities === 0 || isImporting,
        style: {
          width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
          fontWeight: 600, marginTop: '16px', fontSize: '14px',
          cursor: totalEntities > 0 && !isImporting ? 'pointer' : 'not-allowed',
          backgroundColor: totalEntities > 0 && !isImporting ? '#22c55e' : '#475569',
          color: totalEntities > 0 && !isImporting ? '#fff' : '#94a3b8'
        }
      },
        isImporting ? 'Processando Geometrias...'
          : totalEntities > 0 ? 'Confirmar Importacao (' + totalEntities + ' entidades)'
          : 'Selecione ao menos uma camada'
      ),

      // Loading bar
      isImporting ? React.createElement('div', { style: { marginTop: '10px' } },
        React.createElement('div', { style: { height: '4px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden' } },
          React.createElement('div', { style: { height: '100%', width: '100%', backgroundColor: '#3b82f6', animation: 'dxfpulse 1s infinite' } })
        ),
        React.createElement('p', { style: { color: '#94a3b8', fontSize: '12px', textAlign: 'center' as any, marginTop: '6px' } },
          'Convertendo ' + totalEntities + ' entidades...'
        ),
        React.createElement('style', null, '@keyframes dxfpulse { 0%,100% { opacity:0.3; } 50% { opacity:1; } }')
      ) : null,

      // Cancelar
      React.createElement('button', {
        onClick: function() { setLayers([]); setEntities([]); setFileName(null); },
        style: { width: '100%', padding: '10px', borderRadius: '8px', marginTop: '8px', border: '1px solid #475569', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }
      }, 'Escolher outro arquivo')

    ) : null,

    // SUCESSO + MAPA
    importDone && importResult ? React.createElement('div', null,
      React.createElement('div', {
        style: { padding: '20px', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center' as any }
      },
        React.createElement('div', { style: { fontSize: '40px', marginBottom: '8px' } }, '\u2714'),
        React.createElement('p', { style: { color: '#22c55e', fontWeight: 700, fontSize: '18px', marginBottom: '8px' } }, 'Importacao Concluida!'),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '12px' } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' } }, importResult.nodes.length),
            React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Pontos')
          ),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#22c55e' } }, importResult.edges.length),
            React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Trechos')
          ),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' } }, importResult.layers.length),
            React.createElement('div', { style: { fontSize: '11px', color: '#94a3b8' } }, 'Camadas')
          )
        ),
        React.createElement('p', { style: { color: '#94a3b8', fontSize: '13px' } }, 'Dados salvos. Veja o mapa abaixo.')
      ),

      // MAPA LEAFLET
      React.createElement('div', { style: { marginTop: '16px' } },
        React.createElement('div', { style: { fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' } }, 'Mapa Interativo'),
        React.createElement('div', { style: { display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '12px' } },
          React.createElement('span', { style: { color: '#22c55e' } }, '\u25CF Trechos'),
          React.createElement('span', { style: { color: '#3b82f6' } }, '\u25CF Pontos'),
          React.createElement('span', { style: { color: '#ffff00' } }, '\u25CF Destaque (clique)')
        ),
        React.createElement('div', {
          ref: mapRef,
          style: { height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }
        })
      ),

      // Importar outro
      React.createElement('button', {
        onClick: function() { setImportDone(false); setLayers([]); setEntities([]); setFileName(null); setImportResult(null); },
        style: { width: '100%', padding: '10px', borderRadius: '8px', marginTop: '12px', border: '1px solid #475569', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }
      }, 'Importar outro arquivo')

    ) : null
  );
};

export default TopografiaImportNovo;
