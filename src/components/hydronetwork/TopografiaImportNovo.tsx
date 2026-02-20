import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// Formato de saida: igual ao PontoTopografico do engine/reader.ts
// Para que a pagina possa chamar processData() identico ao "Carregar Demo"
// ============================================================================

export interface PontoExportado {
  id: string;
  x: number;
  y: number;
  cota: number;
}

// ============================================================================
// Tipos internos do parser
// ============================================================================

interface DXFEntity {
  type: string;
  layer: string;
  handle: string;
  closed: boolean;
  coordinates: Array<{ x: number; y: number; z: number }>;
  x2?: number;
  y2?: number;
  z2?: number;
}

interface LayerInfo {
  name: string;
  entities: DXFEntity[];
  types: Set<string>;
  selected: boolean;
}

// ============================================================================
// PARSER DXF - leitura robusta com skip de linhas em branco
// ============================================================================

function parseDXF(content: string): DXFEntity[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs: Array<{ code: number; value: string }> = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    const code = parseInt(lines[i].trim(), 10);
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    const value = lines[i].trim();
    i++;
    if (!isNaN(code)) pairs.push({ code, value });
  }

  const entities: DXFEntity[] = [];
  let inEntities = false;
  let cur: Partial<DXFEntity> | null = null;
  let cc = { x: 0, y: 0, z: 0 };
  let hasC = false;
  const validTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'INSERT', 'SPLINE'];

  function finalize() {
    if (cur && cur.type && validTypes.includes(cur.type)) {
      if (hasC) {
        cur.coordinates = cur.coordinates || [];
        cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z });
      }
      if ((cur.coordinates && cur.coordinates.length > 0) || cur.x2 !== undefined) {
        entities.push(cur as DXFEntity);
      }
    }
  }

  for (let p = 0; p < pairs.length; p++) {
    const cd = pairs[p].code;
    const vl = pairs[p].value;

    if (cd === 0 && vl === 'SECTION') {
      const nx = pairs[p + 1];
      if (nx && nx.code === 2 && nx.value === 'ENTITIES') { inEntities = true; p++; continue; }
    }
    if (cd === 2 && vl === 'ENTITIES' && !inEntities) { inEntities = true; continue; }
    if ((cd === 0 && vl === 'ENDSEC' && inEntities) || (cd === 0 && vl === 'EOF')) {
      finalize(); if (vl === 'EOF') break; inEntities = false; continue;
    }
    if (!inEntities) continue;

    if (cd === 0 && validTypes.includes(vl)) {
      finalize();
      cur = { type: vl, layer: '0', handle: '', closed: false, coordinates: [] };
      cc = { x: 0, y: 0, z: 0 }; hasC = false;
      continue;
    }
    if (cd === 0 && vl === 'VERTEX' && cur && cur.type === 'POLYLINE') {
      if (hasC) { cur.coordinates!.push({ x: cc.x, y: cc.y, z: cc.z }); cc = { x: 0, y: 0, z: 0 }; hasC = false; }
      continue;
    }
    if (cd === 0 && vl === 'SEQEND') {
      if (hasC && cur) { cur.coordinates!.push({ x: cc.x, y: cc.y, z: cc.z }); cc = { x: 0, y: 0, z: 0 }; hasC = false; }
      continue;
    }
    if (cd === 0) continue;
    if (!cur) continue;

    if (cd === 5) cur.handle = vl;
    if (cd === 8) cur.layer = vl;
    if (cd === 70) cur.closed = (parseInt(vl) & 1) === 1;
    if (cd === 10) {
      if (cur.type === 'LWPOLYLINE' && hasC) {
        cur.coordinates!.push({ x: cc.x, y: cc.y, z: cc.z });
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

  return entities;
}

// ============================================================================
// Agrupar entidades por layer
// ============================================================================

function groupByLayer(entities: DXFEntity[]): Map<string, LayerInfo> {
  const map = new Map<string, LayerInfo>();
  for (const e of entities) {
    const name = e.layer || '0';
    if (!map.has(name)) {
      map.set(name, { name, entities: [], types: new Set(), selected: true });
    }
    const layer = map.get(name)!;
    layer.entities.push(e);
    layer.types.add(e.type);
  }
  return map;
}

// ============================================================================
// Extrair PONTOS UNICOS das entidades selecionadas
// Produz PontoExportado[] no mesmo formato que createSampleTopography()
// ============================================================================

function extractPoints(entities: DXFEntity[]): PontoExportado[] {
  const seen = new Map<string, PontoExportado>();
  let counter = 1;

  function addPoint(x: number, y: number, z: number) {
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.set(key, { id: `P${counter}`, x, y, cota: z });
      counter++;
    }
  }

  for (const e of entities) {
    // Pontos de cada coordenada da entidade
    for (const c of e.coordinates) {
      addPoint(c.x, c.y, c.z);
    }
    // Segundo ponto de LINE (x2/y2)
    if (e.type === 'LINE' && e.x2 !== undefined) {
      addPoint(e.x2, e.y2 || 0, e.z2 || 0);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Separar trechos e pontos para a tabela
// ============================================================================

function categorizeLayers(layers: Map<string, LayerInfo>): {
  trechos: DXFEntity[];
  pontos: DXFEntity[];
} {
  const trechoTypes = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ARC']);
  const pontoTypes = new Set(['POINT', 'INSERT', 'CIRCLE']);
  const trechos: DXFEntity[] = [];
  const pontos: DXFEntity[] = [];

  for (const [, layer] of layers) {
    if (!layer.selected) continue;
    for (const e of layer.entities) {
      if (trechoTypes.has(e.type)) trechos.push(e);
      else if (pontoTypes.has(e.type)) pontos.push(e);
    }
  }
  return { trechos, pontos };
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const TopografiaImportNovo: React.FC<{
  onImportComplete?: (pontos: PontoExportado[]) => void;
}> = ({ onImportComplete }) => {
  const [allEntities, setAllEntities] = useState<DXFEntity[]>([]);
  const [layers, setLayers] = useState<Map<string, LayerInfo>>(new Map());
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layerFilter, setLayerFilter] = useState('all');
  const [isDone, setIsDone] = useState(false);
  const [resultCount, setResultCount] = useState({ pontos: 0, trechos: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Upload e parse ---
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.dxf') && !ext.endsWith('.ifc')) {
      setError('Use arquivos .dxf ou .ifc');
      return;
    }
    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    setAllEntities([]);
    setLayers(new Map());
    setIsDone(false);

    try {
      const text = await file.text();
      const entities = parseDXF(text);
      if (entities.length === 0) {
        setError('Nenhuma entidade geometrica encontrada no arquivo.');
      } else {
        setAllEntities(entities);
        setLayers(groupByLayer(entities));
      }
    } catch (err: any) {
      setError('Erro ao ler arquivo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Toggle layer ---
  const toggleLayer = (name: string) => {
    setLayers(prev => {
      const next = new Map(prev);
      const layer = next.get(name);
      if (layer) {
        next.set(name, { ...layer, selected: !layer.selected });
      }
      return next;
    });
  };

  const selectAll = () => {
    setLayers(prev => {
      const next = new Map(prev);
      for (const [name, layer] of next) {
        next.set(name, { ...layer, selected: true });
      }
      return next;
    });
  };

  const clearAll = () => {
    setLayers(prev => {
      const next = new Map(prev);
      for (const [name, layer] of next) {
        next.set(name, { ...layer, selected: false });
      }
      return next;
    });
  };

  // --- Dados filtrados ---
  const { trechos, pontos } = categorizeLayers(layers);
  const selectedCount = trechos.length + pontos.length;
  const layerNames = Array.from(layers.keys()).sort();

  // --- CONFIRMAR IMPORTACAO ---
  // Extrai PontoExportado[] e chama onImportComplete
  // O pai vai chamar processData() como faz no "Carregar Demo"
  const doImport = () => {
    if (selectedCount === 0) return;

    try {
      const selectedEntities: DXFEntity[] = [];
      for (const [, layer] of layers) {
        if (layer.selected) {
          selectedEntities.push(...layer.entities);
        }
      }

      const exportedPontos = extractPoints(selectedEntities);

      if (exportedPontos.length < 2) {
        setError('Minimo 2 pontos necessarios. Selecione mais camadas.');
        return;
      }

      console.log('[DXF Import] Exportando', exportedPontos.length, 'pontos para processData()');

      // Salvar no localStorage
      try {
        localStorage.setItem('dxfImportedPontos', JSON.stringify(exportedPontos));
        localStorage.setItem('dxfImportTimestamp', new Date().toISOString());
      } catch (_) { /* ok */ }

      // Callback para o pai - identico a como loadSampleData chama processData
      if (onImportComplete && typeof onImportComplete === 'function') {
        onImportComplete(exportedPontos);
      }

      // Evento global
      try {
        window.dispatchEvent(new CustomEvent('dxfDataImported', { detail: exportedPontos }));
      } catch (_) { /* ok */ }

      setResultCount({ pontos: exportedPontos.length, trechos: trechos.length });
      setIsDone(true);
    } catch (err: any) {
      setError('Erro: ' + err.message);
    }
  };

  // ============================================================================
  // ESTILOS
  // ============================================================================

  const s = {
    container: { backgroundColor: '#0f172a', borderRadius: '12px', padding: '24px', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } as React.CSSProperties,
    filterBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' as any } as React.CSSProperties,
    select: { padding: '8px 12px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: '13px' } as React.CSSProperties,
    btnPrimary: { padding: '8px 16px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 } as React.CSSProperties,
    btnOutline: { padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #475569', cursor: 'pointer', fontSize: '13px' } as React.CSSProperties,
    btnConfirm: { padding: '14px 32px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' as any, fontSize: '13px' } as React.CSSProperties,
    th: { padding: '10px 12px', textAlign: 'left' as any, color: '#94a3b8', borderBottom: '1px solid #334155', fontWeight: 600 } as React.CSSProperties,
    td: { padding: '8px 12px', borderBottom: '1px solid #1e293b' } as React.CSSProperties,
    checkbox: { width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' } as React.CSSProperties,
    section: { marginBottom: '20px' } as React.CSSProperties,
    sectionTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
    tableContainer: { backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'auto', maxHeight: '250px', border: '1px solid #334155' } as React.CSSProperties,
    dropZone: { border: '2px dashed #475569', borderRadius: '8px', padding: '40px', textAlign: 'center' as any, cursor: 'pointer' } as React.CSSProperties,
    statusBar: { padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' } as React.CSSProperties,
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap' as any, gap: '12px' } as React.CSSProperties,
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // --- Estado: importacao concluida ---
  if (isDone) {
    return (
      <div style={s.container}>
        <div style={{ ...s.statusBar, backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span style={{ fontSize: '20px' }}>{'\u2714'}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#22c55e' }}>
              {`Importacao concluida! ${resultCount.pontos} pontos extraidos de ${resultCount.trechos} trechos.`}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Dados enviados ao Resumo da Rede e Mapa Interativo.
            </div>
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => { setIsDone(false); setAllEntities([]); setLayers(new Map()); setFileName(null); }}
            style={s.btnOutline}
          >
            {'\u2190'} Novo Arquivo
          </button>
        </div>
      </div>
    );
  }

  // --- Estado: drop zone (antes de carregar arquivo) ---
  if (allEntities.length === 0) {
    return (
      <div style={s.container}>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(ev) => { ev.preventDefault(); const f = Array.from(ev.dataTransfer.files); if (f[0]) handleFile(f[0]); }}
          onDragOver={(ev) => ev.preventDefault()}
          style={s.dropZone}
        >
          {isLoading ? (
            <p style={{ color: '#3b82f6' }}>Analisando arquivo...</p>
          ) : (
            <>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>{'\uD83D\uDCC1'}</div>
              <p style={{ color: '#94a3b8', marginBottom: '8px' }}>Arraste arquivos aqui ou clique para selecionar</p>
              <p style={{ color: '#64748b', fontSize: '12px' }}>IFC, DXF</p>
              {fileName && <p style={{ color: '#3b82f6', marginTop: '8px' }}>{'\u2713 ' + fileName}</p>}
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.ifc"
            onChange={(ev) => { if (ev.target.files?.[0]) handleFile(ev.target.files[0]); }}
            style={{ display: 'none' }}
          />
        </div>
        {error && <p style={{ marginTop: '12px', color: '#ef4444', textAlign: 'center', fontSize: '13px' }}>{error}</p>}
      </div>
    );
  }

  // --- Estado principal: tabelas de entidades ---
  // Filtrar por layer se necessario
  const filteredTrechos = layerFilter === 'all' ? trechos : trechos.filter(e => e.layer === layerFilter);
  const filteredPontos = layerFilter === 'all' ? pontos : pontos.filter(e => e.layer === layerFilter);

  return (
    <div style={s.container}>
      {/* Barra de filtro por layer */}
      <div style={s.filterBar}>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Filtrar por Layer:</span>
        <select
          value={layerFilter}
          onChange={(ev) => setLayerFilter(ev.target.value)}
          style={s.select}
        >
          <option value="all">{`Todos (${layerNames.length} layers)`}</option>
          {layerNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button onClick={selectAll} style={s.btnPrimary}>
          {'\u2713'} Selecionar Todos
        </button>
        <button onClick={clearAll} style={s.btnOutline}>
          X Limpar Selecao
        </button>
      </div>

      {/* Tabela de Trechos/Polilinhas */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <span style={{ color: '#f59e0b' }}>{'\u25B3'}</span>
          {` Trechos/Polilinhas (${filteredTrechos.length})`}
        </div>
        <div style={s.tableContainer}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: '40px' }}>{'\u2713'}</th>
                <th style={s.th}>Handle</th>
                <th style={s.th}>Tipo</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Vertices</th>
                <th style={s.th}>Layer</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Fechado</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrechos.map((e, i) => {
                const layerInfo = layers.get(e.layer);
                const checked = layerInfo?.selected ?? true;
                return (
                  <tr key={e.handle || i} style={{ backgroundColor: checked ? 'transparent' : 'rgba(100,116,139,0.1)' }}>
                    <td style={s.td}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLayer(e.layer)}
                        style={s.checkbox}
                      />
                    </td>
                    <td style={{ ...s.td, color: '#3b82f6', fontFamily: 'monospace' }}>{e.handle || '-'}</td>
                    <td style={s.td}>{e.type}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{e.coordinates.length}</td>
                    <td style={{ ...s.td, color: '#94a3b8' }}>{e.layer}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{e.closed ? '\u2713' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de Pontos */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <span style={{ color: '#ef4444' }}>{'\uD83D\uDCCD'}</span>
          {` Pontos (${filteredPontos.length})`}
        </div>
        <div style={s.tableContainer}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: '40px' }}>{'\u2713'}</th>
                <th style={s.th}>Handle</th>
                <th style={{ ...s.th, textAlign: 'right' }}>X</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Y</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Z</th>
                <th style={s.th}>Layer</th>
              </tr>
            </thead>
            <tbody>
              {filteredPontos.map((e, i) => {
                const layerInfo = layers.get(e.layer);
                const checked = layerInfo?.selected ?? true;
                const c = e.coordinates[0] || { x: 0, y: 0, z: 0 };
                return (
                  <tr key={e.handle || i} style={{ backgroundColor: checked ? 'transparent' : 'rgba(100,116,139,0.1)' }}>
                    <td style={s.td}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLayer(e.layer)}
                        style={s.checkbox}
                      />
                    </td>
                    <td style={{ ...s.td, color: '#3b82f6', fontFamily: 'monospace' }}>{e.handle || '-'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{c.x.toFixed(3)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{c.y.toFixed(3)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{c.z.toFixed(3)}</td>
                    <td style={{ ...s.td, color: '#94a3b8' }}>{e.layer}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status bar */}
      {selectedCount > 0 ? (
        <div style={{ ...s.statusBar, backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span style={{ fontSize: '18px', color: '#22c55e' }}>{'\u2705'}</span>
          <div>
            <div style={{ fontWeight: 600, color: '#22c55e' }}>Pronto para Importar</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedCount} entidades selecionadas</div>
          </div>
        </div>
      ) : (
        <div style={{ ...s.statusBar, backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <span style={{ fontSize: '18px' }}>{'\u26A0'}</span>
          <div style={{ color: '#eab308' }}>Selecione ao menos uma camada para importar</div>
        </div>
      )}

      {error && <p style={{ marginTop: '8px', color: '#ef4444', fontSize: '13px' }}>{error}</p>}

      {/* Footer com botoes */}
      <div style={s.footer}>
        <button
          onClick={() => { setAllEntities([]); setLayers(new Map()); setFileName(null); setError(null); }}
          style={{ ...s.btnOutline, color: '#ef4444', borderColor: '#ef4444' }}
        >
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => { setAllEntities([]); setLayers(new Map()); setFileName(null); }}
            style={s.btnOutline}
          >
            {'\u2190'} Novo Arquivo
          </button>

          <button
            onClick={doImport}
            disabled={selectedCount === 0}
            style={{
              ...s.btnConfirm,
              backgroundColor: selectedCount > 0 ? '#22c55e' : '#475569',
              color: selectedCount > 0 ? '#fff' : '#94a3b8',
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <span>{'\u2705'}</span>
            {`Confirmar Importacao (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopografiaImportNovo;
