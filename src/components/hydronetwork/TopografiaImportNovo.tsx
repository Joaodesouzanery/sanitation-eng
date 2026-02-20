/**
 * TopografiaImportNovo - Simplified DXF Import Component
 *
 * Direct import of DXF files using DXFReader with real-time entity detection.
 * No wizard steps - immediate parsing and display.
 */

import React, { useState, useCallback, useRef } from 'react';
import { DXFReader } from '../../core/import/readers/DXFReader';
import { RawImportData, RawEntity } from '../../core/import/ImportEngine';

interface ImportedData {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    layer?: string;
  }>;
  edges: Array<{
    id: string;
    coordinates: number[][];
    layer?: string;
  }>;
}

interface TopografiaImportNovoProps {
  onImportComplete: (data: ImportedData) => void;
}

export const TopografiaImportNovo: React.FC<TopografiaImportNovoProps> = ({ onImportComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<RawImportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    setFileData(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'dxf') {
        // Use DXFReader for DXF files
        const data = await DXFReader.read(file);
        setFileData(data);
      } else {
        setError(`Formato '${extension}' nao suportado. Use arquivos .dxf`);
      }
    } catch (err: any) {
      setError(`Erro ao ler arquivo: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImport = useCallback(() => {
    if (!fileData || fileData.entities.length === 0) {
      setError('Nenhuma entidade para importar');
      return;
    }

    // Convert raw entities to nodes and edges
    const nodes: ImportedData['nodes'] = [];
    const edges: ImportedData['edges'] = [];

    fileData.entities.forEach((entity: RawEntity) => {
      const geom = entity.geometry;
      if (!geom) return;

      if (geom.type === 'Point') {
        nodes.push({
          id: entity.id,
          x: geom.coordinates[0],
          y: geom.coordinates[1],
          z: geom.coordinates[2] || 0,
          layer: entity.layer
        });
      } else if (geom.type === 'LineString' && geom.coordinates.length >= 2) {
        edges.push({
          id: entity.id,
          coordinates: geom.coordinates,
          layer: entity.layer
        });
      }
    });

    onImportComplete({ nodes, edges });
  }, [fileData, onImportComplete]);

  // Count entities by type
  const pointCount = fileData?.entities.filter(e => e.geometry?.type === 'Point').length || 0;
  const lineCount = fileData?.entities.filter(e => e.geometry?.type === 'LineString').length || 0;
  const totalCount = fileData?.entities.length || 0;

  const styles = {
    card: {
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #334155',
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '600' as const,
      color: '#e2e8f0',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    badge: {
      backgroundColor: '#22c55e',
      color: '#fff',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '600' as const,
    },
    dropZone: {
      border: '2px dashed #475569',
      borderRadius: '8px',
      padding: '24px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
      borderColor: isDragging ? '#3b82f6' : '#475569',
    },
    stats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      marginTop: '16px',
    },
    statCard: {
      backgroundColor: '#0f172a',
      padding: '12px',
      borderRadius: '8px',
      textAlign: 'center' as const,
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold' as const,
      color: '#3b82f6',
    },
    statLabel: {
      fontSize: '12px',
      color: '#94a3b8',
      marginTop: '4px',
    },
    button: {
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600' as const,
      marginTop: '16px',
      transition: 'all 0.2s ease',
    },
    buttonPrimary: {
      backgroundColor: '#22c55e',
      color: '#fff',
    },
    buttonDisabled: {
      backgroundColor: '#475569',
      color: '#94a3b8',
      cursor: 'not-allowed',
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>
        <span>&#128194;</span> Importar DXF
        <span style={styles.badge}>NOVO</span>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
        Importacao direta de arquivos DXF com deteccao automatica de entidades
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={styles.dropZone}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#128196;</div>
        <p style={{ color: '#64748b', marginBottom: '4px', fontSize: '14px' }}>
          Arraste um arquivo .dxf aqui
        </p>
        <p style={{ color: '#475569', fontSize: '12px' }}>
          ou clique para selecionar
        </p>
        {fileName && (
          <p style={{ color: '#3b82f6', marginTop: '8px', fontSize: '13px' }}>
            &#10003; {fileName}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </div>

      {isLoading && (
        <p style={{ marginTop: '16px', color: '#3b82f6', textAlign: 'center' }}>
          Analisando arquivo...
        </p>
      )}

      {error && (
        <p style={{ marginTop: '16px', color: '#ef4444', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {fileData && (
        <>
          <div style={styles.stats}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{pointCount}</div>
              <div style={styles.statLabel}>Pontos</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#22c55e' }}>{lineCount}</div>
              <div style={styles.statLabel}>Trechos</div>
            </div>
            <div style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#f59e0b' }}>{totalCount}</div>
              <div style={styles.statLabel}>Total</div>
            </div>
          </div>

          {/* Layers info */}
          {fileData.metadata.entityTypes && fileData.metadata.entityTypes.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
              <strong>Tipos:</strong>{' '}
              {fileData.metadata.entityTypes.map(et => `${et.type}(${et.count})`).join(', ')}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={totalCount === 0}
            style={{
              ...styles.button,
              ...(totalCount > 0 ? styles.buttonPrimary : styles.buttonDisabled),
            }}
          >
            {totalCount > 0 ? `Importar ${totalCount} Entidades` : 'Nenhuma entidade detectada'}
          </button>
        </>
      )}
    </div>
  );
};

export default TopografiaImportNovo;
