import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// TIPOS EXPORTADOS - Entidades BIM extraídas do IFC
// ============================================================================

export interface IFCPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'point';
}

export interface IFCSegment {
  id: string;
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  length: number;
  type: 'segment';
  ifcType: string;
}

export interface IFCPipe {
  id: string;
  name: string;
  diameter?: number;
  length?: number;
  material?: string;
  coordinates: Array<{ x: number; y: number; z: number }>;
  type: 'pipe';
}

export interface IFCManhole {
  id: string;
  name: string;
  depth?: number;
  diameter?: number;
  position: { x: number; y: number; z: number };
  type: 'manhole';
}

export interface IFCEntity {
  id: string;
  ifcId: string;
  ifcType: string;
  name: string;
  description?: string;
  coordinates: Array<{ x: number; y: number; z: number }>;
  properties: Record<string, string | number>;
  layer: string;
}

export interface IFCImportResult {
  entities: IFCEntity[];
  pipes: IFCPipe[];
  manholes: IFCManhole[];
  segments: IFCSegment[];
  points: IFCPoint[];
  metadata: {
    fileName: string;
    totalEntities: number;
    schema: string;
    application?: string;
  };
}

// ============================================================================
// IFC PARSER - Extração de entidades BIM para saneamento
// ============================================================================

interface IFCRawEntity {
  id: string;
  type: string;
  params: string;
}

function parseIFCFile(content: string, fileName: string): IFCImportResult {
  const lines = content.split('\n');
  const entities: IFCRawEntity[] = [];
  const pointsMap = new Map<string, { x: number; y: number; z: number }>();
  const polylineMap = new Map<string, string[]>();
  const result: IFCImportResult = {
    entities: [],
    pipes: [],
    manholes: [],
    segments: [],
    points: [],
    metadata: {
      fileName,
      totalEntities: 0,
      schema: 'IFC2X3'
    }
  };

  // Detectar schema IFC
  for (const line of lines) {
    if (line.includes('FILE_SCHEMA')) {
      const schemaMatch = /IFC\d+\w*/i.exec(line);
      if (schemaMatch) {
        result.metadata.schema = schemaMatch[0].toUpperCase();
      }
    }
    if (line.includes('FILE_NAME')) {
      const appMatch = /'([^']+)'/g;
      const matches = [...line.matchAll(appMatch)];
      if (matches.length >= 5) {
        result.metadata.application = matches[4]?.[1] || '';
      }
    }
  }

  // Parse entidades
  let multiLine = '';
  for (const line of lines) {
    const trimmed = line.trim();

    // Acumular linhas multi-linha
    if (trimmed.startsWith('#') || multiLine) {
      multiLine += trimmed;
      if (!trimmed.endsWith(';')) continue;

      // Linha completa
      const entityMatch = /^#(\d+)\s*=\s*(\w+)\s*\((.+)\);?$/s.exec(multiLine);
      if (entityMatch) {
        entities.push({
          id: entityMatch[1],
          type: entityMatch[2].toUpperCase(),
          params: entityMatch[3]
        });
      }
      multiLine = '';
    }
  }

  // Primeira passada: extrair pontos cartesianos
  for (const entity of entities) {
    if (entity.type === 'IFCCARTESIANPOINT') {
      const coords = entity.params.match(/\(([-\d.E+]+)\s*,\s*([-\d.E+]+)(?:\s*,\s*([-\d.E+]+))?\)/);
      if (coords) {
        pointsMap.set(entity.id, {
          x: parseFloat(coords[1]),
          y: parseFloat(coords[2]),
          z: coords[3] ? parseFloat(coords[3]) : 0
        });
      }
    }
  }

  // Segunda passada: extrair polylines
  for (const entity of entities) {
    if (entity.type === 'IFCPOLYLINE') {
      const pointRefs = entity.params.match(/#\d+/g);
      if (pointRefs) {
        polylineMap.set(entity.id, pointRefs.map(r => r.replace('#', '')));
      }
    }
  }

  // Terceira passada: extrair entidades de saneamento
  let pipeCount = 0;
  let manholeCount = 0;
  let segmentCount = 0;

  for (const entity of entities) {
    // Tubulações
    if (/^IFC(PIPE|FLOW|DUCT)SEGMENT$/i.test(entity.type)) {
      pipeCount++;
      const nameMatch = /'([^']+)'/g.exec(entity.params);
      const name = nameMatch ? nameMatch[1] : `Tubo_${pipeCount}`;

      // Buscar representação geométrica
      const repRef = entity.params.match(/#(\d+)/g);
      const coords: Array<{ x: number; y: number; z: number }> = [];

      if (repRef) {
        for (const ref of repRef) {
          const refId = ref.replace('#', '');
          const pt = pointsMap.get(refId);
          if (pt) coords.push(pt);

          const poly = polylineMap.get(refId);
          if (poly) {
            for (const ptRef of poly) {
              const polyPt = pointsMap.get(ptRef);
              if (polyPt) coords.push(polyPt);
            }
          }
        }
      }

      result.pipes.push({
        id: `PIPE_${pipeCount}`,
        name,
        coordinates: coords,
        type: 'pipe'
      });

      result.entities.push({
        id: `IFC_${entity.id}`,
        ifcId: entity.id,
        ifcType: entity.type,
        name,
        coordinates: coords,
        properties: {},
        layer: 'Tubulações'
      });
    }

    // Poços de visita / Caixas
    if (/^IFC(DISTRIBUTION|FLOW)?(CHAMBER|MANHOLE|JUNCTION|ACCESSORY)/i.test(entity.type)) {
      manholeCount++;
      const nameMatch = /'([^']+)'/g.exec(entity.params);
      const name = nameMatch ? nameMatch[1] : `PV_${manholeCount}`;

      // Buscar posição
      const posRef = entity.params.match(/#(\d+)/);
      let position = { x: 0, y: 0, z: 0 };

      if (posRef) {
        const pt = pointsMap.get(posRef[1]);
        if (pt) position = pt;
      }

      result.manholes.push({
        id: `MH_${manholeCount}`,
        name,
        position,
        type: 'manhole'
      });

      result.entities.push({
        id: `IFC_${entity.id}`,
        ifcId: entity.id,
        ifcType: entity.type,
        name,
        coordinates: [position],
        properties: {},
        layer: 'Poços de Visita'
      });
    }

    // Polylines como segmentos
    if (entity.type === 'IFCPOLYLINE') {
      const pointRefs = polylineMap.get(entity.id);
      if (pointRefs && pointRefs.length >= 2) {
        const coords: Array<{ x: number; y: number; z: number }> = [];
        for (const ref of pointRefs) {
          const pt = pointsMap.get(ref);
          if (pt) coords.push(pt);
        }

        if (coords.length >= 2) {
          for (let i = 0; i < coords.length - 1; i++) {
            segmentCount++;
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const length = Math.sqrt(
              Math.pow(p2.x - p1.x, 2) +
              Math.pow(p2.y - p1.y, 2) +
              Math.pow(p2.z - p1.z, 2)
            );

            result.segments.push({
              id: `SEG_${segmentCount}`,
              startPoint: p1,
              endPoint: p2,
              length,
              type: 'segment',
              ifcType: 'IFCPOLYLINE'
            });
          }
        }
      }
    }
  }

  // Extrair pontos únicos
  let pointCount = 0;
  const seenPoints = new Set<string>();

  for (const [id, coord] of pointsMap) {
    const key = `${coord.x.toFixed(2)},${coord.y.toFixed(2)},${coord.z.toFixed(2)}`;
    if (!seenPoints.has(key)) {
      seenPoints.add(key);
      pointCount++;
      result.points.push({
        id: `PT_${pointCount}`,
        x: coord.x,
        y: coord.y,
        z: coord.z,
        type: 'point'
      });
    }
  }

  result.metadata.totalEntities = entities.length;

  return result;
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    padding: '24px',
    maxWidth: '800px'
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  } as React.CSSProperties,

  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: 0
  } as React.CSSProperties,

  badge: {
    backgroundColor: '#e8f4f8',
    color: '#0077b6',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  } as React.CSSProperties,

  dropZone: {
    border: '2px dashed #d0d5dd',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#fafafa'
  } as React.CSSProperties,

  dropZoneActive: {
    borderColor: '#0077b6',
    backgroundColor: '#e8f4f8'
  } as React.CSSProperties,

  dropIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  } as React.CSSProperties,

  dropText: {
    fontSize: '16px',
    color: '#344054',
    marginBottom: '8px'
  } as React.CSSProperties,

  dropHint: {
    fontSize: '13px',
    color: '#667085'
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginTop: '20px'
  } as React.CSSProperties,

  statCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center' as const
  } as React.CSSProperties,

  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#0077b6'
  } as React.CSSProperties,

  statLabel: {
    fontSize: '12px',
    color: '#667085',
    marginTop: '4px'
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '20px',
    fontSize: '13px'
  } as React.CSSProperties,

  th: {
    backgroundColor: '#f8fafc',
    padding: '12px',
    textAlign: 'left' as const,
    fontWeight: '600',
    color: '#344054',
    borderBottom: '1px solid #e5e7eb'
  } as React.CSSProperties,

  td: {
    padding: '12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#475467'
  } as React.CSSProperties,

  entityBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  } as React.CSSProperties,

  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s ease'
  } as React.CSSProperties,

  primaryButton: {
    backgroundColor: '#0077b6',
    color: '#ffffff'
  } as React.CSSProperties,

  secondaryButton: {
    backgroundColor: '#f0f0f0',
    color: '#344054'
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    justifyContent: 'flex-end'
  } as React.CSSProperties,

  metaInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '16px',
    fontSize: '13px',
    color: '#0369a1'
  } as React.CSSProperties,

  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '16px',
    color: '#b91c1c',
    fontSize: '13px'
  } as React.CSSProperties,

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '12px',
    color: '#667085'
  } as React.CSSProperties
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export interface IFCImportProps {
  onImportComplete?: (result: IFCImportResult) => void;
  onCancel?: () => void;
}

export const IFCImport: React.FC<IFCImportProps> = ({
  onImportComplete,
  onCancel
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<IFCImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processar arquivo IFC
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError('Por favor, selecione um arquivo IFC (.ifc)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const content = await file.text();
      const parsed = parseIFCFile(content, file.name);

      if (parsed.metadata.totalEntities === 0) {
        setError('Arquivo IFC não contém entidades válidas');
        setIsProcessing(false);
        return;
      }

      setResult(parsed);
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handlers de drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const ifcFile = files.find(f => f.name.toLowerCase().endsWith('.ifc'));

    if (ifcFile) {
      processFile(ifcFile);
    } else {
      setError('Por favor, arraste um arquivo IFC (.ifc)');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleConfirm = useCallback(() => {
    if (result && onImportComplete) {
      // Salvar no localStorage
      const history = JSON.parse(localStorage.getItem('ifcImportHistory') || '[]');
      history.unshift({
        timestamp: new Date().toISOString(),
        fileName: result.metadata.fileName,
        pipes: result.pipes.length,
        manholes: result.manholes.length,
        segments: result.segments.length,
        points: result.points.length
      });
      localStorage.setItem('ifcImportHistory', JSON.stringify(history.slice(0, 10)));

      onImportComplete(result);
    }
  }, [result, onImportComplete]);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Renderizar badge de tipo
  const renderTypeBadge = (type: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pipe: { bg: '#dbeafe', text: '#1d4ed8' },
      manhole: { bg: '#dcfce7', text: '#16a34a' },
      segment: { bg: '#fef3c7', text: '#d97706' },
      point: { bg: '#f3e8ff', text: '#9333ea' }
    };
    const color = colors[type] || { bg: '#f0f0f0', text: '#666' };

    return (
      <span style={{ ...styles.entityBadge, backgroundColor: color.bg, color: color.text }}>
        {type === 'pipe' ? 'Tubulação' :
         type === 'manhole' ? 'Poço' :
         type === 'segment' ? 'Segmento' :
         type === 'point' ? 'Ponto' : type}
      </span>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Importar Arquivo IFC</h3>
        <span style={styles.badge}>BIM</span>
      </div>

      {/* Área de upload */}
      {!result && !isProcessing && (
        <div
          style={{
            ...styles.dropZone,
            ...(isDragging ? styles.dropZoneActive : {})
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={styles.dropIcon}>📦</div>
          <div style={styles.dropText}>
            Arraste um arquivo IFC aqui ou clique para selecionar
          </div>
          <div style={styles.dropHint}>
            Suporta IFC2x3, IFC4 (tubulações, poços de visita, eixos)
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Loading */}
      {isProcessing && (
        <div style={styles.loading}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
          Processando arquivo IFC...
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={styles.errorBox}>
          ⚠️ {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <>
          <div style={styles.metaInfo}>
            <strong>Arquivo:</strong> {result.metadata.fileName} |
            <strong> Schema:</strong> {result.metadata.schema} |
            <strong> Entidades:</strong> {result.metadata.totalEntities}
            {result.metadata.application && (
              <> | <strong>App:</strong> {result.metadata.application}</>
            )}
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.pipes.length}</div>
              <div style={styles.statLabel}>Tubulações</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.manholes.length}</div>
              <div style={styles.statLabel}>Poços de Visita</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.segments.length}</div>
              <div style={styles.statLabel}>Segmentos</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.points.length}</div>
              <div style={styles.statLabel}>Pontos</div>
            </div>
          </div>

          {/* Tabela de entidades */}
          {result.entities.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Tipo IFC</th>
                  <th style={styles.th}>Camada</th>
                  <th style={styles.th}>Coords</th>
                </tr>
              </thead>
              <tbody>
                {result.entities.slice(0, 15).map((entity) => (
                  <tr key={entity.id}>
                    <td style={styles.td}>{entity.ifcId}</td>
                    <td style={styles.td}>{entity.name}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.entityBadge,
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1'
                      }}>
                        {entity.ifcType}
                      </span>
                    </td>
                    <td style={styles.td}>{entity.layer}</td>
                    <td style={styles.td}>{entity.coordinates.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.entities.length > 15 && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#667085', fontSize: '13px' }}>
              ... e mais {result.entities.length - 15} entidades
            </div>
          )}

          {/* Pontos extraídos */}
          {result.points.length > 0 && result.points.length <= 20 && (
            <>
              <h4 style={{ marginTop: '24px', marginBottom: '12px', color: '#344054' }}>
                Pontos Extraídos
              </h4>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>X</th>
                    <th style={styles.th}>Y</th>
                    <th style={styles.th}>Z (Cota)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.points.map((pt) => (
                    <tr key={pt.id}>
                      <td style={styles.td}>{pt.id}</td>
                      <td style={styles.td}>{pt.x.toFixed(3)}</td>
                      <td style={styles.td}>{pt.y.toFixed(3)}</td>
                      <td style={styles.td}>{pt.z.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={handleReset}
            >
              Limpar
            </button>
            {onCancel && (
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleConfirm}
            >
              Confirmar Importação
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default IFCImport;
