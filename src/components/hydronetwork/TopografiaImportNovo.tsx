/**
 * TopografiaImportNovo - Componente AUTOSSUFICIENTE de importação DXF
 *
 * Parser DXF embutido. Sem dependências externas além do React.
 * Detecta LWPOLYLINE, LINE, POINT com coordenadas e layers reais.
 */

import React, { useState, useCallback, useRef } from 'react';

// ============================================================================
// TIPOS
// ============================================================================

interface DXFEntity {
  type: string;
  layer: string;
  handle: string;
  color?: number;
  coordinates: Array<{ x: number; y: number; z: number }>;
  x2?: number;
  y2?: number;
  z2?: number;
  flags?: number;
}

interface ParsedResult {
  entities: DXFEntity[];
  layers: string[];
  totalPoints: number;
  totalLines: number;
}

export interface ImportedNode {
  id: string;
  x: number;
  y: number;
  z: number;
  layer: string;
}

export interface ImportedEdge {
  id: string;
  coordinates: number[][];
  layer: string;
}

export interface ImportedData {
  nodes: ImportedNode[];
  edges: ImportedEdge[];
  layers: string[];
}

interface TopografiaImportNovoProps {
  onImportComplete?: (data: ImportedData) => void;
}

// ============================================================================
// PARSER DXF EMBUTIDO
// ============================================================================

function parseDXF(content: string): ParsedResult {
  // Normalizar quebras de linha e criar pares code/value
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs: Array<{ code: number; value: string }> = [];

  let i = 0;
  while (i < lines.length) {
    // Pular linhas em branco para achar o código
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    const code = parseInt(lines[i].trim(), 10);
    i++;
    // Pular linhas em branco para achar o valor
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    const value = lines[i].trim();
    i++;
    if (!isNaN(code)) pairs.push({ code, value });
  }

  // Extrair entidades da seção ENTITIES
  const entities: DXFEntity[] = [];
  const layerSet = new Set<string>();
  let inEntities = false;
  let currentEntity: Partial<DXFEntity> | null = null;
  let currentCoord: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  let hasCoord = false;

  const validTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'INSERT', 'SPLINE'];

  const finalizeEntity = () => {
    if (currentEntity && currentEntity.type && validTypes.includes(currentEntity.type)) {
      if (hasCoord) {
        currentEntity.coordinates = currentEntity.coordinates || [];
        currentEntity.coordinates.push({ ...currentCoord });
      }
      if ((currentEntity.coordinates && currentEntity.coordinates.length > 0) ||
          currentEntity.x2 !== undefined) {
        entities.push(currentEntity as DXFEntity);
        if (currentEntity.layer) layerSet.add(currentEntity.layer);
      }
    }
  };

  for (let p = 0; p < pairs.length; p++) {
    const { code, value } = pairs[p];

    // Detectar início da seção ENTITIES
    if (code === 0 && value === 'SECTION') {
      const next = pairs[p + 1];
      if (next && next.code === 2 && next.value === 'ENTITIES') {
        inEntities = true;
        p++; // Pular o par "2 ENTITIES"
        continue;
      }
    }
    if (code === 2 && value === 'ENTITIES' && !inEntities) {
      inEntities = true;
      continue;
    }

    // Fim da seção ou EOF
    if ((code === 0 && value === 'ENDSEC' && inEntities) || (code === 0 && value === 'EOF')) {
      finalizeEntity();
      if (value === 'EOF') break;
      inEntities = false;
      continue;
    }

    if (!inEntities) continue;

    // Nova entidade principal
    if (code === 0 && validTypes.includes(value)) {
      finalizeEntity();
      currentEntity = {
        type: value,
        layer: '0',
        handle: '',
        coordinates: []
      };
      currentCoord = { x: 0, y: 0, z: 0 };
      hasCoord = false;
      continue;
    }

    // Sub-entidades (VERTEX para POLYLINE)
    if (code === 0 && value === 'VERTEX' && currentEntity?.type === 'POLYLINE') {
      if (hasCoord) {
        currentEntity.coordinates = currentEntity.coordinates || [];
        currentEntity.coordinates.push({ ...currentCoord });
        currentCoord = { x: 0, y: 0, z: 0 };
        hasCoord = false;
      }
      continue;
    }
    if (code === 0 && value === 'SEQEND') {
      if (hasCoord && currentEntity) {
        currentEntity.coordinates = currentEntity.coordinates || [];
        currentEntity.coordinates.push({ ...currentCoord });
        currentCoord = { x: 0, y: 0, z: 0 };
        hasCoord = false;
      }
      continue;
    }

    // Ignorar entidades não válidas (TEXT, MTEXT, DIMENSION, etc)
    if (code === 0) continue;

    if (!currentEntity) continue;

    // Atributos
    if (code === 5) currentEntity.handle = value;
    if (code === 8) {
      currentEntity.layer = value;
      layerSet.add(value);
    }
    if (code === 62) currentEntity.color = parseInt(value);
    if (code === 70) currentEntity.flags = parseInt(value);

    // Coordenadas primárias (X, Y, Z)
    if (code === 10) {
      // LWPOLYLINE: cada código 10 inicia um novo vértice
      if (currentEntity.type === 'LWPOLYLINE' && hasCoord) {
        currentEntity.coordinates = currentEntity.coordinates || [];
        currentEntity.coordinates.push({ ...currentCoord });
        currentCoord = { x: 0, y: 0, z: 0 };
      }
      currentCoord.x = parseFloat(value);
      hasCoord = true;
    }
    if (code === 20) {
      currentCoord.y = parseFloat(value);
      hasCoord = true;
    }
    if (code === 30) {
      currentCoord.z = parseFloat(value);
    }

    // Coordenadas secundárias (ponto final de LINE)
    if (code === 11) currentEntity.x2 = parseFloat(value);
    if (code === 21) currentEntity.y2 = parseFloat(value);
    if (code === 31) currentEntity.z2 = parseFloat(value);
  }

  // Contar por tipo
  let totalPoints = 0;
  let totalLines = 0;
  entities.forEach(e => {
    if (e.type === 'POINT' || e.type === 'INSERT') totalPoints++;
    else totalLines++;
  });

  return {
    entities,
    layers: Array.from(layerSet).sort(),
    totalPoints,
    totalLines
  };
}

// ============================================================================
// CONVERTER ENTIDADES PARA NODES/EDGES
// ============================================================================

function convertToImportData(result: ParsedResult): ImportedData {
  const nodes: ImportedNode[] = [];
  const edges: ImportedEdge[] = [];

  result.entities.forEach((entity, idx) => {
    const id = entity.handle || `ent_${idx}`;
    const layer = entity.layer || '0';

    switch (entity.type) {
      case 'POINT':
      case 'INSERT':
        if (entity.coordinates.length > 0) {
          const c = entity.coordinates[0];
          nodes.push({ id, x: c.x, y: c.y, z: c.z, layer });
        }
        break;

      case 'LINE':
        if (entity.coordinates.length > 0 && entity.x2 !== undefined) {
          const c = entity.coordinates[0];
          edges.push({
            id,
            coordinates: [
              [c.x, c.y, c.z],
              [entity.x2, entity.y2 || 0, entity.z2 || 0]
            ],
            layer
          });
        }
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
      case 'SPLINE':
        if (entity.coordinates.length >= 2) {
          edges.push({
            id,
            coordinates: entity.coordinates.map(c => [c.x, c.y, c.z]),
            layer
          });
        } else if (entity.coordinates.length === 1) {
          const c = entity.coordinates[0];
          nodes.push({ id, x: c.x, y: c.y, z: c.z, layer });
        }
        break;

      case 'CIRCLE':
      case 'ARC':
        if (entity.coordinates.length > 0) {
          const c = entity.coordinates[0];
          nodes.push({ id, x: c.x, y: c.y, z: c.z, layer });
        }
        break;
    }
  });

  return { nodes, edges, layers: result.layers };
}

// ============================================================================
// COMPONENTE REACT
// ============================================================================

export const TopografiaImportNovo: React.FC<TopografiaImportNovoProps> = ({ onImportComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParsedResult | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File handling ---
  const handleFileSelect = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'dxf') {
      setError("Formato nao suportado. Use arquivos .dxf");
      return;
    }

    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    setParseResult(null);
    setImportDone(false);

    try {
      const content = await file.text();
      const result = parseDXF(content);

      if (result.entities.length === 0) {
        setError("Nenhuma entidade geometrica encontrada no DXF. Verifique se o arquivo tem ENTITIES.");
      } else {
        setParseResult(result);
        // Selecionar todas as layers por padrão
        setSelectedLayers(new Set(result.layers));
      }
    } catch (err: any) {
      setError("Erro ao ler arquivo: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileSelect(files[0]);
  }, [handleFileSelect]);

  // --- Toggle layer selection ---
  const toggleLayer = (layer: string) => {
    setSelectedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  // --- CONFIRMAR IMPORTAÇÃO ---
  const handleConfirmImport = useCallback(() => {
    if (!parseResult) return;

    setIsImporting(true);

    // Usar setTimeout para dar tempo ao loading renderizar
    setTimeout(() => {
      try {
        // Filtrar entidades pelas layers selecionadas
        const filtered: ParsedResult = {
          ...parseResult,
          entities: parseResult.entities.filter(e => selectedLayers.has(e.layer))
        };

        const data = convertToImportData(filtered);

        // Callback para o componente pai (mapa + cálculos)
        if (onImportComplete) {
          onImportComplete(data);
        }

        // Salvar no localStorage como backup
        try {
          localStorage.setItem('dxfImportData', JSON.stringify(data));
          localStorage.setItem('dxfImportTimestamp', new Date().toISOString());
        } catch (e) {
          // localStorage cheio - ok, não é crítico
        }

        setIsImporting(false);
        setImportDone(true);
      } catch (err: any) {
        setError("Erro ao importar: " + err.message);
        setIsImporting(false);
      }
    }, 100);
  }, [parseResult, selectedLayers, onImportComplete]);

  // --- Contadores ---
  const filteredEntities = parseResult?.entities.filter(e => selectedLayers.has(e.layer)) || [];
  const pointCount = filteredEntities.filter(e =>
    e.type === 'POINT' || e.type === 'INSERT' || e.type === 'CIRCLE'
  ).length;
  const lineCount = filteredEntities.filter(e =>
    e.type === 'LINE' || e.type === 'LWPOLYLINE' || e.type === 'POLYLINE' || e.type === 'SPLINE' || e.type === 'ARC'
  ).length;
  const totalSelected = filteredEntities.length;

  // --- Entity type summary ---
  const typeCounts = new Map<string, number>();
  filteredEntities.forEach(e => typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1));

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #334155',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '16px', fontWeight: 600, color: '#e2e8f0',
        marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <span>&#128194;</span> Importar DXF
        <span style={{
          backgroundColor: '#22c55e', color: '#fff',
          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
        }}>NOVO</span>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
        Importacao direta com deteccao de entidades e camadas
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed ' + (isDragging ? '#3b82f6' : '#475569'),
          borderRadius: '8px', padding: '24px', textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s ease',
          backgroundColor: isDragging ? 'rgba(59,130,246,0.1)' : 'transparent',
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#128196;</div>
        <p style={{ color: '#64748b', marginBottom: '4px', fontSize: '14px' }}>
          Arraste um arquivo .dxf aqui
        </p>
        <p style={{ color: '#475569', fontSize: '12px' }}>ou clique para selecionar</p>
        {fileName && (
          <p style={{ color: '#3b82f6', marginTop: '8px', fontSize: '13px' }}>
            &#10003; {fileName}
          </p>
        )}
        <input
          ref={fileInputRef} type="file" accept=".dxf"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <p style={{ marginTop: '16px', color: '#3b82f6', textAlign: 'center' }}>
          &#9203; Analisando arquivo DXF...
        </p>
      )}

      {/* Error */}
      {error && (
        <p style={{ marginTop: '16px', color: '#ef4444', textAlign: 'center', fontSize: '13px' }}>
          {error}
        </p>
      )}

      {/* Resultados da análise */}
      {parseResult && !importDone && (
        <>
          {/* Contadores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{pointCount}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Pontos</div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>{lineCount}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Trechos/Linhas</div>
            </div>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{totalSelected}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Selecionados</div>
            </div>
          </div>

          {/* Tipos de entidade */}
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
            <strong>Tipos:</strong>{' '}
            {Array.from(typeCounts.entries()).map(([type, count]) => `${type}(${count})`).join(', ')}
          </div>

          {/* ===== CAMADAS / LAYERS ===== */}
          <div style={{
            marginTop: '16px', padding: '12px',
            backgroundColor: '#0f172a', borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
              &#128204; Camadas Detectadas ({parseResult.layers.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {parseResult.layers.map(layer => {
                const isSelected = selectedLayers.has(layer);
                const count = parseResult.entities.filter(e => e.layer === layer).length;
                return (
                  <button
                    key={layer}
                    onClick={() => toggleLayer(layer)}
                    style={{
                      padding: '4px 10px', borderRadius: '15px', fontSize: '12px',
                      cursor: 'pointer', border: '1px solid',
                      transition: 'all 0.15s ease',
                      backgroundColor: isSelected ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.1)',
                      borderColor: isSelected ? '#22c55e' : '#475569',
                      color: isSelected ? '#22c55e' : '#64748b',
                    }}
                  >
                    {isSelected ? '\u2713' : '\u2717'} {layer} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== BOTÃO CONFIRMAR ===== */}
          <button
            onClick={handleConfirmImport}
            disabled={totalSelected === 0 || isImporting}
            style={{
              width: '100%', padding: '14px', borderRadius: '8px',
              border: 'none', fontWeight: 600, marginTop: '16px',
              fontSize: '14px', cursor: totalSelected > 0 && !isImporting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              backgroundColor: totalSelected > 0 && !isImporting ? '#22c55e' : '#475569',
              color: totalSelected > 0 && !isImporting ? '#fff' : '#94a3b8',
            }}
          >
            {isImporting
              ? '⏳ Processando Geometrias...'
              : totalSelected > 0
                ? `✓ Confirmar Importacao (${totalSelected} entidades)`
                : 'Nenhuma entidade selecionada'
            }
          </button>

          {/* Barra de progresso durante importação */}
          {isImporting && (
            <div style={{ marginTop: '8px' }}>
              <div style={{
                height: '4px', backgroundColor: '#334155', borderRadius: '2px', overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', backgroundColor: '#3b82f6', borderRadius: '2px',
                  animation: 'loading 1.5s ease-in-out infinite',
                  width: '60%',
                }} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', marginTop: '6px' }}>
                Convertendo {totalSelected} entidades para o mapa...
              </p>
              <style>{`@keyframes loading { 0% { margin-left: -60%; } 100% { margin-left: 100%; } }`}</style>
            </div>
          )}
        </>
      )}

      {/* ===== SUCESSO ===== */}
      {importDone && (
        <div style={{
          marginTop: '16px', padding: '16px',
          backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '8px',
          border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>&#10004;</div>
          <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
            Importacao Concluida!
          </p>
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>
            {pointCount} pontos e {lineCount} trechos enviados para o mapa e calculos.
          </p>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
            Navegue ate o Mapa Interativo para visualizar os dados.
          </p>
          <button
            onClick={() => {
              setImportDone(false);
              setParseResult(null);
              setFileName(null);
            }}
            style={{
              marginTop: '12px', padding: '8px 20px', borderRadius: '6px',
              border: '1px solid #475569', backgroundColor: 'transparent',
              color: '#94a3b8', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
};

export default TopografiaImportNovo;
