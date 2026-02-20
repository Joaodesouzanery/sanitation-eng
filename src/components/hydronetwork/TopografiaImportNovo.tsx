import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// TIPOS DE EXPORTAÇÃO - compatível com PontoTopografico do engine/reader.ts
// ============================================================================

export interface PontoExportado {
  id: string;
  x: number;
  y: number;
  cota: number;
  sourceFile?: string;
  layer?: string;
}

// ============================================================================
// TIPOS INTERNOS
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
  sourceFile: string;
}

interface FileQueueItem {
  file: File;
  status: 'pending' | 'reading' | 'done' | 'error';
  entities: DXFEntity[];
  error?: string;
}

interface LayerInfo {
  name: string;
  sourceFile: string;
  entities: DXFEntity[];
  types: Set<string>;
  selected: boolean;
  importAs: 'point' | 'edge' | 'ignore';
}

// ============================================================================
// DXF READER - Parser robusto com skip de linhas em branco
// ============================================================================

function parseDXF(content: string, sourceFile: string): DXFEntity[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs: Array<{ code: number; value: string }> = [];
  let i = 0;

  // Parse code/value pairs, skipping blank lines
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
  const validTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'INSERT', 'SPLINE', '3DFACE', '3DSOLID'];

  function finalize() {
    if (cur && cur.type && validTypes.includes(cur.type)) {
      if (hasC) {
        cur.coordinates = cur.coordinates || [];
        cur.coordinates.push({ x: cc.x, y: cc.y, z: cc.z });
      }
      if ((cur.coordinates && cur.coordinates.length > 0) || cur.x2 !== undefined) {
        cur.sourceFile = sourceFile;
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
      cur = { type: vl, layer: '0', handle: '', closed: false, coordinates: [], sourceFile };
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
// IFC READER - Parser básico para extrair coordenadas de tubulações/eixos
// ============================================================================

function parseIFC(content: string, sourceFile: string): DXFEntity[] {
  const entities: DXFEntity[] = [];
  const lines = content.split('\n');

  // Regex para encontrar coordenadas em IFC
  // IFCCARTESIANPOINT((x,y,z));
  const cartesianPointRegex = /IFCCARTESIANPOINT\s*\(\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*(?:,\s*([-\d.E+]+))?\s*\)\s*\)/gi;
  // IFCPOLYLINE ou IFCINDEXEDPOLYCURVE
  const polylineRegex = /#(\d+)\s*=\s*IFCPOLYLINE\s*\(\s*\(([^)]+)\)/gi;
  // IFCPIPESEGMENT, IFCFLOWSEGMENT para tubulações
  const pipeRegex = /#(\d+)\s*=\s*IFC(PIPE|FLOW)SEGMENT/gi;

  // Mapear IDs para coordenadas
  const pointsMap = new Map<string, { x: number; y: number; z: number }>();

  // Primeira passada: extrair todos os pontos
  for (const line of lines) {
    const pointMatch = /^#(\d+)\s*=\s*IFCCARTESIANPOINT\s*\(\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*(?:,\s*([-\d.E+]+))?\s*\)\s*\)/i.exec(line);
    if (pointMatch) {
      const id = pointMatch[1];
      const x = parseFloat(pointMatch[2]);
      const y = parseFloat(pointMatch[3]);
      const z = pointMatch[4] ? parseFloat(pointMatch[4]) : 0;
      if (!isNaN(x) && !isNaN(y)) {
        pointsMap.set(id, { x, y, z });
      }
    }
  }

  // Segunda passada: extrair polylines e criar entidades
  let entityCount = 0;
  for (const line of lines) {
    // IFCPOLYLINE com lista de pontos
    const polyMatch = /^#(\d+)\s*=\s*IFCPOLYLINE\s*\(\s*\(([^)]+)\)\s*\)/i.exec(line);
    if (polyMatch) {
      const pointRefs = polyMatch[2].split(',').map(s => s.trim().replace('#', ''));
      const coords: Array<{ x: number; y: number; z: number }> = [];

      for (const ref of pointRefs) {
        const pt = pointsMap.get(ref);
        if (pt) coords.push(pt);
      }

      if (coords.length >= 2) {
        entityCount++;
        entities.push({
          type: 'IFCPOLYLINE',
          layer: 'IFC_Polylines',
          handle: `IFC_${polyMatch[1]}`,
          closed: false,
          coordinates: coords,
          sourceFile
        });
      }
    }

    // IFCPIPESEGMENT - tentar extrair representação
    if (/IFCPIPESEGMENT|IFCFLOWSEGMENT|IFCDUCTSSEGMENT/i.test(line)) {
      // Pipes geralmente referenciam uma representação geométrica
      // Por simplicidade, criamos um ponto no centroide se encontrarmos coordenadas na linha
      const coordMatches = line.matchAll(/([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)/g);
      for (const match of coordMatches) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);
        if (!isNaN(x) && !isNaN(y) && Math.abs(x) > 0.001) {
          entityCount++;
          entities.push({
            type: 'IFCPIPE',
            layer: 'IFC_Pipes',
            handle: `IFC_PIPE_${entityCount}`,
            closed: false,
            coordinates: [{ x, y, z }],
            sourceFile
          });
          break;
        }
      }
    }
  }

  // Se não encontrou estruturas específicas, extrair todos os pontos como entidades
  if (entities.length === 0 && pointsMap.size > 0) {
    let idx = 0;
    for (const [id, coord] of pointsMap) {
      idx++;
      entities.push({
        type: 'IFCPOINT',
        layer: 'IFC_Points',
        handle: `IFC_PT_${id}`,
        closed: false,
        coordinates: [coord],
        sourceFile
      });
    }
  }

  return entities;
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function groupByLayerAndFile(entities: DXFEntity[]): Map<string, LayerInfo> {
  const map = new Map<string, LayerInfo>();

  for (const e of entities) {
    const key = `${e.sourceFile}::${e.layer}`;
    if (!map.has(key)) {
      // Determinar importAs baseado no tipo
      const trechoTypes = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ARC', 'IFCPOLYLINE']);
      const defaultImportAs = trechoTypes.has(e.type) ? 'edge' : 'point';

      map.set(key, {
        name: e.layer,
        sourceFile: e.sourceFile,
        entities: [],
        types: new Set(),
        selected: true,
        importAs: defaultImportAs as 'point' | 'edge' | 'ignore'
      });
    }
    const layer = map.get(key)!;
    layer.entities.push(e);
    layer.types.add(e.type);
  }

  return map;
}

function extractPointsFromEntities(entities: DXFEntity[], layers: Map<string, LayerInfo>): PontoExportado[] {
  const seen = new Map<string, PontoExportado>();
  let counter = 1;

  function addPoint(x: number, y: number, z: number, sourceFile: string, layer: string) {
    // Usar precisão menor para agrupar pontos próximos
    const key = `${x.toFixed(2)},${y.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.set(key, {
        id: `P${counter}`,
        x,
        y,
        cota: z,
        sourceFile,
        layer
      });
      counter++;
    }
  }

  for (const e of entities) {
    const layerKey = `${e.sourceFile}::${e.layer}`;
    const layerInfo = layers.get(layerKey);

    if (!layerInfo || !layerInfo.selected || layerInfo.importAs === 'ignore') {
      continue;
    }

    // Extrair pontos de todas as coordenadas
    for (const c of e.coordinates) {
      addPoint(c.x, c.y, c.z, e.sourceFile, e.layer);
    }

    // Para LINE, também extrair o segundo ponto
    if (e.type === 'LINE' && e.x2 !== undefined) {
      addPoint(e.x2, e.y2 || 0, e.z2 || 0, e.sourceFile, e.layer);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const TopografiaImportNovo: React.FC<{
  onImportComplete?: (pontos: PontoExportado[]) => void;
}> = ({ onImportComplete }) => {
  // Estado da fila de arquivos
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [allEntities, setAllEntities] = useState<DXFEntity[]>([]);
  const [layers, setLayers] = useState<Map<string, LayerInfo>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState({ pontos: 0, arquivos: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Processar múltiplos arquivos ---
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setIsDone(false);

    // Inicializar fila
    const queue: FileQueueItem[] = files.map(file => ({
      file,
      status: 'pending' as const,
      entities: []
    }));
    setFileQueue(queue);

    const allParsedEntities: DXFEntity[] = [];

    // Processar cada arquivo sequencialmente
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const ext = item.file.name.toLowerCase();

      // Atualizar status para "reading"
      setFileQueue(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'reading' as const } : f
      ));

      try {
        const text = await item.file.text();
        let entities: DXFEntity[] = [];

        if (ext.endsWith('.dxf')) {
          entities = parseDXF(text, item.file.name);
        } else if (ext.endsWith('.ifc')) {
          entities = parseIFC(text, item.file.name);
        }

        if (entities.length === 0) {
          setFileQueue(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error' as const, error: 'Nenhuma entidade encontrada' } : f
          ));
        } else {
          allParsedEntities.push(...entities);
          setFileQueue(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'done' as const, entities } : f
          ));
        }

        // Pequeno delay para UX
        await new Promise(r => setTimeout(r, 100));

      } catch (err: any) {
        setFileQueue(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error' as const, error: err.message } : f
        ));
      }
    }

    // Merge e agrupar por layer
    setAllEntities(allParsedEntities);
    setLayers(groupByLayerAndFile(allParsedEntities));
    setIsProcessing(false);

    if (allParsedEntities.length === 0) {
      setError('Nenhuma entidade geometrica encontrada nos arquivos.');
    }
  }, []);

  // --- Handler de arquivos ---
  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.dxf') || ext.endsWith('.ifc');
    });

    if (validFiles.length === 0) {
      setError('Selecione arquivos .dxf ou .ifc');
      return;
    }

    processFiles(validFiles);
  }, [processFiles]);

  // --- Toggle layer selection ---
  const toggleLayer = (key: string) => {
    setLayers(prev => {
      const next = new Map(prev);
      const layer = next.get(key);
      if (layer) {
        next.set(key, { ...layer, selected: !layer.selected });
      }
      return next;
    });
  };

  // --- Mudar tipo de importação do layer ---
  const setLayerImportAs = (key: string, importAs: 'point' | 'edge' | 'ignore') => {
    setLayers(prev => {
      const next = new Map(prev);
      const layer = next.get(key);
      if (layer) {
        next.set(key, { ...layer, importAs });
      }
      return next;
    });
  };

  // --- Selecionar/Limpar todos ---
  const selectAll = () => {
    setLayers(prev => {
      const next = new Map(prev);
      for (const [key, layer] of next) {
        next.set(key, { ...layer, selected: true });
      }
      return next;
    });
  };

  const clearAll = () => {
    setLayers(prev => {
      const next = new Map(prev);
      for (const [key, layer] of next) {
        next.set(key, { ...layer, selected: false });
      }
      return next;
    });
  };

  // --- Contar entidades selecionadas ---
  const getSelectedCount = () => {
    let count = 0;
    for (const [, layer] of layers) {
      if (layer.selected && layer.importAs !== 'ignore') {
        count += layer.entities.length;
      }
    }
    return count;
  };

  // --- CONFIRMAR IMPORTAÇÃO ---
  const doImport = () => {
    const selectedCount = getSelectedCount();
    if (selectedCount === 0) return;

    try {
      // Extrair pontos das entidades selecionadas
      const pontos = extractPointsFromEntities(allEntities, layers);

      if (pontos.length < 2) {
        setError('Minimo 2 pontos necessarios. Selecione mais camadas.');
        return;
      }

      console.log('[Multi-Import] Exportando', pontos.length, 'pontos de', fileQueue.length, 'arquivos');

      // Persistir no localStorage (banco de dados local)
      try {
        const importData = {
          pontos,
          timestamp: new Date().toISOString(),
          sourceFiles: fileQueue.map(f => f.file.name),
          layerConfig: Array.from(layers.entries()).map(([key, layer]) => ({
            key,
            name: layer.name,
            sourceFile: layer.sourceFile,
            importAs: layer.importAs,
            selected: layer.selected,
            entityCount: layer.entities.length
          }))
        };

        localStorage.setItem('dxfImportedPontos', JSON.stringify(pontos));
        localStorage.setItem('dxfImportData', JSON.stringify(importData));
        localStorage.setItem('dxfImportTimestamp', importData.timestamp);

        // Histórico de importações
        const history = JSON.parse(localStorage.getItem('importHistory') || '[]');
        history.push({
          id: Date.now(),
          timestamp: importData.timestamp,
          files: importData.sourceFiles,
          pointCount: pontos.length,
          layerCount: layers.size
        });
        localStorage.setItem('importHistory', JSON.stringify(history.slice(-10))); // Manter últimas 10

      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }

      // Callback para o componente pai - chama processData igual "Carregar Demo"
      if (onImportComplete && typeof onImportComplete === 'function') {
        onImportComplete(pontos);
      }

      // Evento global para outros módulos
      try {
        window.dispatchEvent(new CustomEvent('dxfDataImported', { detail: pontos }));
      } catch (_) {}

      setResultCount({
        pontos: pontos.length,
        arquivos: fileQueue.filter(f => f.status === 'done').length
      });
      setIsDone(true);

    } catch (err: any) {
      setError('Erro na importacao: ' + err.message);
    }
  };

  // --- Reset ---
  const reset = () => {
    setFileQueue([]);
    setAllEntities([]);
    setLayers(new Map());
    setIsProcessing(false);
    setIsDone(false);
    setError(null);
  };

  // ============================================================================
  // ESTILOS
  // ============================================================================

  const s = {
    container: { backgroundColor: '#0f172a', borderRadius: '12px', padding: '24px', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' } as React.CSSProperties,
    filterBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' as const } as React.CSSProperties,
    btnPrimary: { padding: '8px 16px', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 } as React.CSSProperties,
    btnOutline: { padding: '8px 16px', borderRadius: '6px', backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #475569', cursor: 'pointer', fontSize: '13px' } as React.CSSProperties,
    btnConfirm: { padding: '14px 32px', borderRadius: '8px', border: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' } as React.CSSProperties,
    th: { padding: '10px 12px', textAlign: 'left' as const, color: '#94a3b8', borderBottom: '1px solid #334155', fontWeight: 600 } as React.CSSProperties,
    td: { padding: '8px 12px', borderBottom: '1px solid #1e293b' } as React.CSSProperties,
    checkbox: { width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' } as React.CSSProperties,
    select: { padding: '6px 10px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', fontSize: '12px', cursor: 'pointer' } as React.CSSProperties,
    section: { marginBottom: '20px' } as React.CSSProperties,
    sectionTitle: { fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
    tableContainer: { backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'auto', maxHeight: '300px', border: '1px solid #334155' } as React.CSSProperties,
    dropZone: { border: '2px dashed #475569', borderRadius: '8px', padding: '40px', textAlign: 'center' as const, cursor: 'pointer' } as React.CSSProperties,
    statusBar: { padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' } as React.CSSProperties,
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap' as const, gap: '12px' } as React.CSSProperties,
    fileItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: '#1e293b', borderRadius: '6px', marginBottom: '6px' } as React.CSSProperties,
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // --- Estado: importação concluída ---
  if (isDone) {
    return (
      <div style={s.container}>
        <div style={{ ...s.statusBar, backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <span style={{ fontSize: '24px' }}>{'\u2714'}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '16px' }}>
              Importação Concluída!
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {resultCount.pontos} pontos extraídos de {resultCount.arquivos} arquivo(s)
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Dados enviados ao Resumo da Rede e Mapa Interativo
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button onClick={reset} style={s.btnOutline}>
            {'\u2190'} Importar Mais Arquivos
          </button>
        </div>
      </div>
    );
  }

  // --- Estado: drop zone (nenhum arquivo ainda) ---
  if (fileQueue.length === 0) {
    return (
      <div style={s.container}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
            Importar DXF / IFC
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Suporte a múltiplos arquivos simultâneos
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(ev) => { ev.preventDefault(); handleFiles(ev.dataTransfer.files); }}
          onDragOver={(ev) => ev.preventDefault()}
          style={s.dropZone}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>{'\uD83D\uDCC1'}</div>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '15px' }}>
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p style={{ color: '#64748b', fontSize: '12px' }}>
            DXF, IFC • Múltiplos arquivos permitidos
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.ifc"
            multiple
            onChange={(ev) => { if (ev.target.files) handleFiles(ev.target.files); }}
            style={{ display: 'none' }}
          />
        </div>

        {error && <p style={{ marginTop: '12px', color: '#ef4444', textAlign: 'center', fontSize: '13px' }}>{error}</p>}
      </div>
    );
  }

  // --- Calcular estatísticas ---
  const selectedCount = getSelectedCount();
  const layerArray = Array.from(layers.entries());
  const filesDone = fileQueue.filter(f => f.status === 'done').length;
  const filesError = fileQueue.filter(f => f.status === 'error').length;

  // --- Estado principal: lista de arquivos + tabela de layers ---
  return (
    <div style={s.container}>
      {/* Lista de arquivos carregados */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <span style={{ color: '#3b82f6' }}>{'\uD83D\uDCC4'}</span>
          Arquivos ({fileQueue.length})
        </div>

        <div style={{ maxHeight: '150px', overflow: 'auto' }}>
          {fileQueue.map((item, idx) => (
            <div key={idx} style={s.fileItem}>
              {/* Status indicator */}
              {item.status === 'pending' && <span style={{ color: '#64748b' }}>{'\u23F3'}</span>}
              {item.status === 'reading' && <span style={{ color: '#3b82f6' }}>{'\u21BB'}</span>}
              {item.status === 'done' && <span style={{ color: '#22c55e' }}>{'\u2714'}</span>}
              {item.status === 'error' && <span style={{ color: '#ef4444' }}>{'\u2718'}</span>}

              {/* File info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{item.file.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {(item.file.size / 1024).toFixed(1)} KB
                  {item.status === 'done' && ` • ${item.entities.length} entidades`}
                  {item.status === 'error' && ` • ${item.error}`}
                </div>
              </div>

              {/* Status text */}
              <div style={{ fontSize: '12px', color: item.status === 'error' ? '#ef4444' : '#94a3b8' }}>
                {item.status === 'pending' && 'Aguardando...'}
                {item.status === 'reading' && 'Lendo...'}
                {item.status === 'done' && 'OK!'}
                {item.status === 'error' && 'Erro'}
              </div>
            </div>
          ))}
        </div>

        {isProcessing && (
          <div style={{ marginTop: '8px', color: '#3b82f6', fontSize: '13px' }}>
            Processando arquivos...
          </div>
        )}
      </div>

      {/* Tabela de Layers */}
      {!isProcessing && layers.size > 0 && (
        <>
          <div style={s.filterBar}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              {layers.size} camadas de {filesDone} arquivo(s)
            </span>
            <button onClick={selectAll} style={s.btnPrimary}>
              {'\u2713'} Selecionar Todos
            </button>
            <button onClick={clearAll} style={s.btnOutline}>
              X Limpar
            </button>
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>
              <span style={{ color: '#f59e0b' }}>{'\u25B3'}</span>
              Camadas por Arquivo
            </div>

            <div style={s.tableContainer}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: '40px' }}>{'\u2713'}</th>
                    <th style={s.th}>Camada</th>
                    <th style={s.th}>Arquivo</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Qtd</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Tipos</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Importar Como</th>
                  </tr>
                </thead>
                <tbody>
                  {layerArray.map(([key, layer]) => (
                    <tr key={key} style={{ backgroundColor: layer.selected ? 'transparent' : 'rgba(100,116,139,0.1)' }}>
                      <td style={s.td}>
                        <input
                          type="checkbox"
                          checked={layer.selected}
                          onChange={() => toggleLayer(key)}
                          style={s.checkbox}
                        />
                      </td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{layer.name}</td>
                      <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>
                        {layer.sourceFile.length > 20
                          ? layer.sourceFile.slice(0, 17) + '...'
                          : layer.sourceFile}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>
                        {layer.entities.length}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                        {Array.from(layer.types).join(', ')}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <select
                          value={layer.importAs}
                          onChange={(e) => setLayerImportAs(key, e.target.value as any)}
                          style={{
                            ...s.select,
                            backgroundColor: layer.importAs === 'ignore' ? '#1e293b' :
                                           layer.importAs === 'point' ? '#1e3a5f' : '#1a3d2e',
                            color: layer.importAs === 'ignore' ? '#64748b' :
                                   layer.importAs === 'point' ? '#3b82f6' : '#22c55e',
                            borderColor: layer.importAs === 'ignore' ? '#475569' :
                                        layer.importAs === 'point' ? '#3b82f6' : '#22c55e'
                          }}
                        >
                          <option value="point">Ponto</option>
                          <option value="edge">Trecho</option>
                          <option value="ignore">Ignorar</option>
                        </select>
                      </td>
                    </tr>
                  ))}
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
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {selectedCount} entidades de {layerArray.filter(([,l]) => l.selected).length} camadas
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.statusBar, backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
              <span style={{ fontSize: '18px' }}>{'\u26A0'}</span>
              <div style={{ color: '#eab308' }}>Selecione ao menos uma camada para importar</div>
            </div>
          )}

          {error && <p style={{ marginTop: '8px', color: '#ef4444', fontSize: '13px' }}>{error}</p>}

          {/* Footer */}
          <div style={s.footer}>
            <button onClick={reset} style={{ ...s.btnOutline, color: '#ef4444', borderColor: '#ef4444' }}>
              Cancelar
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={s.btnOutline}
              >
                + Adicionar Arquivos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dxf,.ifc"
                multiple
                onChange={(ev) => {
                  if (ev.target.files) {
                    const newFiles = Array.from(ev.target.files);
                    const existingFiles = fileQueue.map(f => f.file);
                    processFiles([...existingFiles, ...newFiles]);
                  }
                }}
                style={{ display: 'none' }}
              />

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
                Confirmar Importação ({selectedCount})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TopografiaImportNovo;
