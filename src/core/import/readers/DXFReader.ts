/**
 * DXF Reader - Leitor de arquivos DXF (AutoCAD)
 */

import { LineString, Point } from 'geojson';
import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';

// ============================================================================
// INTERFACES
// ============================================================================

export interface DXFHeader {
  version: string;
  units: number;
  insunits: number;
}

export interface DXFLayer {
  name: string;
  color: number;
  lineType: string;
  frozen: boolean;
  locked: boolean;
}

export interface DXFEntity {
  type: string;
  layer: string;
  handle: string;
  color?: number;
  lineType?: string;
  data: Record<string, any>;
}

// ============================================================================
// DXF READER CLASS
// ============================================================================

class DXFReaderImpl {

  // --------------------------------------------------------------------------
  // Main Reading
  // --------------------------------------------------------------------------

  async read(file: File): Promise<RawImportData> {
    const content = await file.text();

    // Parse DXF content
    const dxfData = this.parseDXF(content);

    // Extract entities
    const entities = this.extractEntities(dxfData);

    // Analyze metadata
    const metadata = this.analyzeMetadata(dxfData, entities);

    return {
      fileType: 'DXF',
      fileName: file.name,
      fileSize: file.size,
      rawContent: dxfData,
      entities,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // DXF Parsing
  // --------------------------------------------------------------------------

  private parseDXF(content: string): { header: DXFHeader; layers: DXFLayer[]; entities: DXFEntity[] } {
    // Normalize line endings and split
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const pairs: Array<{ code: number; value: string }> = [];

    // Converter para pares código/valor - skip blank lines to maintain alignment
    let i = 0;
    while (i < lines.length) {
      // Skip blank lines to find code
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      if (i >= lines.length) break;

      const codeLine = lines[i].trim();
      const code = parseInt(codeLine, 10);
      i++;

      // Skip blank lines to find value
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      if (i >= lines.length) break;

      const value = lines[i].trim();
      i++;

      if (!isNaN(code)) {
        pairs.push({ code, value });
      }
    }

    // Extrair seções
    const header = this.parseHeader(pairs);
    const layers = this.parseLayers(pairs);
    const entities = this.parseEntities(pairs);

    return { header, layers, entities };
  }

  private parseHeader(pairs: Array<{ code: number; value: string }>): DXFHeader {
    const header: DXFHeader = {
      version: 'AC1015',
      units: 0,
      insunits: 0
    };

    let inHeader = false;

    for (let i = 0; i < pairs.length; i++) {
      const { code, value } = pairs[i];

      if (code === 2 && value === 'HEADER') {
        inHeader = true;
        continue;
      }

      if (code === 0 && value === 'ENDSEC') {
        inHeader = false;
        continue;
      }

      if (inHeader) {
        if (code === 9 && value === '$ACADVER') {
          const nextPair = pairs[i + 1];
          if (nextPair?.code === 1) {
            header.version = nextPair.value;
          }
        }
        if (code === 9 && value === '$INSUNITS') {
          const nextPair = pairs[i + 1];
          if (nextPair?.code === 70) {
            header.insunits = parseInt(nextPair.value);
          }
        }
        if (code === 9 && value === '$LUNITS') {
          const nextPair = pairs[i + 1];
          if (nextPair?.code === 70) {
            header.units = parseInt(nextPair.value);
          }
        }
      }
    }

    return header;
  }

  private parseLayers(pairs: Array<{ code: number; value: string }>): DXFLayer[] {
    const layers: DXFLayer[] = [];
    let inLayers = false;
    let currentLayer: Partial<DXFLayer> = {};

    for (let i = 0; i < pairs.length; i++) {
      const { code, value } = pairs[i];

      if (code === 2 && value === 'LAYER') {
        inLayers = true;
        continue;
      }

      if (code === 0 && value === 'ENDSEC') {
        if (currentLayer.name) {
          layers.push(currentLayer as DXFLayer);
        }
        inLayers = false;
        continue;
      }

      if (inLayers) {
        if (code === 0 && value === 'LAYER') {
          if (currentLayer.name) {
            layers.push(currentLayer as DXFLayer);
          }
          currentLayer = { frozen: false, locked: false };
        }
        if (code === 2) currentLayer.name = value;
        if (code === 62) currentLayer.color = parseInt(value);
        if (code === 6) currentLayer.lineType = value;
        if (code === 70) {
          const flags = parseInt(value);
          currentLayer.frozen = (flags & 1) !== 0;
          currentLayer.locked = (flags & 4) !== 0;
        }
      }
    }

    return layers;
  }

  private parseEntities(pairs: Array<{ code: number; value: string }>): DXFEntity[] {
    const entities: DXFEntity[] = [];
    let inEntities = false;
    let currentEntity: Partial<DXFEntity> = {};
    let entityData: Record<string, any> = {};
    let coordBuffer: { x?: number; y?: number; z?: number }[] = [];
    let currentCoord: { x?: number; y?: number; z?: number } = {};

    // Entidades válidas para processamento
    const validEntityTypes = [
      'LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC',
      'INSERT', 'TEXT', 'MTEXT', 'SPLINE', 'ELLIPSE', 'HATCH',
      'DIMENSION', 'LEADER', '3DFACE', 'SOLID', 'TRACE'
    ];

    for (let i = 0; i < pairs.length; i++) {
      const { code, value } = pairs[i];

      // Detectar seção ENTITIES (pode ser por code 0 SECTION + code 2 ENTITIES, ou direto)
      if (code === 0 && value === 'SECTION') {
        // Verificar se próximo par é ENTITIES
        const nextPair = pairs[i + 1];
        if (nextPair && nextPair.code === 2 && nextPair.value === 'ENTITIES') {
          inEntities = true;
          i++; // Pular o próximo par
          continue;
        }
      }

      // Também aceitar detecção direta
      if (code === 2 && value === 'ENTITIES' && !inEntities) {
        inEntities = true;
        continue;
      }

      // Fim da seção
      if (code === 0 && value === 'ENDSEC' && inEntities) {
        if (currentEntity.type && validEntityTypes.includes(currentEntity.type)) {
          if (Object.keys(currentCoord).length > 0) {
            coordBuffer.push({ ...currentCoord });
          }
          currentEntity.data = { ...entityData, coordinates: [...coordBuffer] };
          entities.push(currentEntity as DXFEntity);
        }
        inEntities = false;
        continue;
      }

      // EOF também termina
      if (code === 0 && value === 'EOF') {
        if (currentEntity.type && validEntityTypes.includes(currentEntity.type)) {
          if (Object.keys(currentCoord).length > 0) {
            coordBuffer.push({ ...currentCoord });
          }
          currentEntity.data = { ...entityData, coordinates: [...coordBuffer] };
          entities.push(currentEntity as DXFEntity);
        }
        break;
      }

      if (inEntities) {
        // Nova entidade detectada
        if (code === 0 && validEntityTypes.includes(value)) {
          // Salvar entidade anterior se existir
          if (currentEntity.type && validEntityTypes.includes(currentEntity.type)) {
            if (Object.keys(currentCoord).length > 0) {
              coordBuffer.push({ ...currentCoord });
            }
            currentEntity.data = { ...entityData, coordinates: [...coordBuffer] };
            entities.push(currentEntity as DXFEntity);
          }

          // Nova entidade
          currentEntity = { type: value, data: {}, layer: '0', handle: '' };
          entityData = {};
          coordBuffer = [];
          currentCoord = {};
        }
        // Também processar se code === 0 mas não é entidade válida (ex: VERTEX, SEQEND)
        else if (code === 0) {
          // Não é uma entidade principal, pode ser sub-entidade como VERTEX
          if (value === 'VERTEX' && currentEntity.type === 'POLYLINE') {
            // Salvar coordenada atual se existir
            if (Object.keys(currentCoord).length > 0) {
              coordBuffer.push({ ...currentCoord });
              currentCoord = {};
            }
          } else if (value === 'SEQEND') {
            // Fim de sequência de vértices
            if (Object.keys(currentCoord).length > 0) {
              coordBuffer.push({ ...currentCoord });
              currentCoord = {};
            }
          }
        }

        // Atributos comuns
        if (code === 5) currentEntity.handle = value;
        if (code === 8) currentEntity.layer = value;
        if (code === 62) currentEntity.color = parseInt(value);
        if (code === 6) currentEntity.lineType = value;

        // Coordenadas principais (X)
        if (code === 10) {
          // Para LWPOLYLINE, cada 10 inicia um novo vértice
          if (currentEntity.type === 'LWPOLYLINE' && currentCoord.x !== undefined) {
            coordBuffer.push({ ...currentCoord });
            currentCoord = {};
          }
          currentCoord.x = parseFloat(value);
        }
        if (code === 20) currentCoord.y = parseFloat(value);
        if (code === 30) currentCoord.z = parseFloat(value);

        // Coordenadas secundárias (LINE end point, etc)
        if (code === 11) entityData.x2 = parseFloat(value);
        if (code === 21) entityData.y2 = parseFloat(value);
        if (code === 31) entityData.z2 = parseFloat(value);

        // Outros atributos importantes
        if (code === 40) entityData.radius = parseFloat(value);
        if (code === 41) entityData.majorRadius = parseFloat(value);
        if (code === 42) entityData.bulge = parseFloat(value);
        if (code === 50) entityData.startAngle = parseFloat(value);
        if (code === 51) entityData.endAngle = parseFloat(value);
        if (code === 70) entityData.flags = parseInt(value);
        if (code === 90) entityData.numVertices = parseInt(value);
      }
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractEntities(dxfData: { header: DXFHeader; layers: DXFLayer[]; entities: DXFEntity[] }): RawEntity[] {
    return dxfData.entities.map((entity, index) => {
      const geometry = this.convertGeometry(entity);

      return {
        id: entity.handle || `dxf_${index}`,
        type: entity.type,
        geometry,
        attributes: {
          layer: entity.layer,
          color: entity.color,
          lineType: entity.lineType,
          ...entity.data
        },
        layer: entity.layer
      };
    });
  }

  private convertGeometry(entity: DXFEntity): any {
    const coords = entity.data.coordinates || [];

    switch (entity.type) {
      case 'POINT':
      case 'INSERT':
        // POINT e INSERT são tratados como pontos
        if (coords.length > 0) {
          return {
            type: 'Point',
            coordinates: [coords[0].x || 0, coords[0].y || 0, coords[0].z || 0]
          };
        }
        break;

      case 'LINE':
        const lineCoords: number[][] = [];
        if (coords.length > 0) {
          lineCoords.push([coords[0].x || 0, coords[0].y || 0, coords[0].z || 0]);
        }
        if (entity.data.x2 !== undefined) {
          lineCoords.push([entity.data.x2, entity.data.y2 || 0, entity.data.z2 || 0]);
        }
        if (lineCoords.length >= 2) {
          return { type: 'LineString', coordinates: lineCoords };
        }
        break;

      case 'LWPOLYLINE':
      case 'POLYLINE':
      case 'SPLINE':
        // Polylines e splines
        if (coords.length >= 2) {
          const polyCoords = coords.map((c: any) => [c.x || 0, c.y || 0, c.z || 0]);
          return { type: 'LineString', coordinates: polyCoords };
        } else if (coords.length === 1) {
          // Se só tem 1 ponto, tratar como Point
          return {
            type: 'Point',
            coordinates: [coords[0].x || 0, coords[0].y || 0, coords[0].z || 0]
          };
        }
        break;

      case 'CIRCLE':
        // Converter círculo para polígono aproximado
        if (coords.length > 0 && entity.data.radius) {
          const center = coords[0];
          const radius = entity.data.radius;
          const segments = 32;
          const circleCoords: number[][] = [];

          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            circleCoords.push([
              (center.x || 0) + radius * Math.cos(angle),
              (center.y || 0) + radius * Math.sin(angle),
              center.z || 0
            ]);
          }

          return { type: 'Polygon', coordinates: [circleCoords] };
        }
        break;

      case 'ELLIPSE':
        // Converter elipse para polígono aproximado
        if (coords.length > 0) {
          const center = coords[0];
          const majorRadius = entity.data.majorRadius || entity.data.radius || 1;
          const minorRatio = entity.data.minorRadius || 0.5;
          const segments = 32;
          const ellipseCoords: number[][] = [];

          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            ellipseCoords.push([
              (center.x || 0) + majorRadius * Math.cos(angle),
              (center.y || 0) + majorRadius * minorRatio * Math.sin(angle),
              center.z || 0
            ]);
          }

          return { type: 'Polygon', coordinates: [ellipseCoords] };
        }
        break;

      case 'ARC':
        // Converter arco para polyline
        if (coords.length > 0 && entity.data.radius) {
          const center = coords[0];
          const radius = entity.data.radius;
          const startAngle = (entity.data.startAngle || 0) * Math.PI / 180;
          const endAngle = (entity.data.endAngle || 360) * Math.PI / 180;
          const segments = 16;
          const arcCoords: number[][] = [];

          for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (i / segments) * (endAngle - startAngle);
            arcCoords.push([
              (center.x || 0) + radius * Math.cos(angle),
              (center.y || 0) + radius * Math.sin(angle),
              center.z || 0
            ]);
          }

          return { type: 'LineString', coordinates: arcCoords };
        }
        break;

      case '3DFACE':
      case 'SOLID':
      case 'TRACE':
        // Tratar como polígono se tiver coordenadas suficientes
        if (coords.length >= 3) {
          const faceCoords = coords.map((c: any) => [c.x || 0, c.y || 0, c.z || 0]);
          // Fechar o polígono
          faceCoords.push(faceCoords[0]);
          return { type: 'Polygon', coordinates: [faceCoords] };
        }
        break;

      case 'HATCH':
        // Hatch pode ser tratado como polígono
        if (coords.length >= 3) {
          const hatchCoords = coords.map((c: any) => [c.x || 0, c.y || 0, c.z || 0]);
          hatchCoords.push(hatchCoords[0]);
          return { type: 'Polygon', coordinates: [hatchCoords] };
        }
        break;
    }

    // Fallback: se tem coordenadas, tentar criar geometria
    if (coords.length > 0) {
      if (coords.length === 1) {
        return {
          type: 'Point',
          coordinates: [coords[0].x || 0, coords[0].y || 0, coords[0].z || 0]
        };
      } else if (coords.length >= 2) {
        const fallbackCoords = coords.map((c: any) => [c.x || 0, c.y || 0, c.z || 0]);
        return { type: 'LineString', coordinates: fallbackCoords };
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Metadata Analysis
  // --------------------------------------------------------------------------

  private analyzeMetadata(
    dxfData: { header: DXFHeader; layers: DXFLayer[]; entities: DXFEntity[] },
    entities: RawEntity[]
  ): ImportMetadata {
    const entityTypes = this.groupEntityTypes(entities);

    // Detectar unidade baseado no header
    let unit: string | null = null;
    switch (dxfData.header.insunits) {
      case 1: unit = 'inches'; break;
      case 2: unit = 'feet'; break;
      case 4: unit = 'millimeters'; break;
      case 5: unit = 'centimeters'; break;
      case 6: unit = 'meters'; break;
    }

    // Calcular bounding box
    const boundingBox = this.calculateBoundingBox(entities);

    return {
      detectedCRS: null,  // DXF não tem CRS
      detectedUnit: unit,
      hasZ: entities.some(e => {
        if (!e.geometry?.coordinates) return false;
        const coords = e.geometry.coordinates;
        if (Array.isArray(coords[0])) {
          return coords.some((c: number[]) => c[2] !== undefined && c[2] !== 0);
        }
        return coords[2] !== undefined && coords[2] !== 0;
      }),
      geometryType: this.detectGeometryType(entities),
      entityTypes,
      numericFormat: 'american',  // DXF usa formato americano
      totalEntities: entities.length,
      boundingBox
    };
  }

  private groupEntityTypes(entities: RawEntity[]): ImportMetadata['entityTypes'] {
    const groups = new Map<string, RawEntity[]>();

    entities.forEach(e => {
      if (!groups.has(e.type)) {
        groups.set(e.type, []);
      }
      groups.get(e.type)!.push(e);
    });

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      count: items.length,
      suggestedImportAs: this.suggestImportType(type),
      hasZ: items.some(e => {
        if (!e.geometry?.coordinates) return false;
        const coords = e.geometry.coordinates;
        return Array.isArray(coords[0])
          ? coords.some((c: number[]) => c[2] !== 0)
          : coords[2] !== 0;
      }),
      sampleAttributes: this.getSampleAttributes(items)
    }));
  }

  private suggestImportType(type: string): 'edge' | 'node' | 'drawing' | 'ignore' {
    const edgeTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'ARC'];
    const nodeTypes = ['POINT', 'INSERT'];
    const drawingTypes = ['TEXT', 'MTEXT', 'DIMENSION', 'HATCH', 'LEADER'];

    if (edgeTypes.includes(type)) return 'edge';
    if (nodeTypes.includes(type)) return 'node';
    if (drawingTypes.includes(type)) return 'drawing';

    return 'ignore';
  }

  private getSampleAttributes(items: RawEntity[]): string[] {
    const attrs = new Set<string>();
    items.slice(0, 5).forEach(item => {
      Object.keys(item.attributes).forEach(key => {
        if (key !== 'coordinates') attrs.add(key);
      });
    });
    return Array.from(attrs);
  }

  private detectGeometryType(entities: RawEntity[]): 'point' | 'line' | 'polygon' | 'mixed' {
    const types = new Set<string>();

    entities.forEach(e => {
      if (e.geometry?.type) {
        types.add(e.geometry.type);
      }
    });

    if (types.size === 0) return 'mixed';
    if (types.size === 1) {
      const type = [...types][0];
      if (type === 'Point') return 'point';
      if (type === 'LineString') return 'line';
      if (type === 'Polygon') return 'polygon';
    }

    return 'mixed';
  }

  private calculateBoundingBox(entities: RawEntity[]): ImportMetadata['boundingBox'] {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    entities.forEach(e => {
      if (!e.geometry?.coordinates) return;

      const processCoord = (coord: number[]) => {
        minX = Math.min(minX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxX = Math.max(maxX, coord[0]);
        maxY = Math.max(maxY, coord[1]);
      };

      const coords = e.geometry.coordinates;
      if (typeof coords[0] === 'number') {
        processCoord(coords as number[]);
      } else if (Array.isArray(coords[0])) {
        (coords as number[][]).forEach(processCoord);
      }
    });

    if (minX === Infinity) return undefined;
    return { minX, minY, maxX, maxY };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  getLayerNames(dxfData: { layers: DXFLayer[] }): string[] {
    return dxfData.layers.map(l => l.name);
  }

  filterByLayer(entities: RawEntity[], layerName: string): RawEntity[] {
    return entities.filter(e => e.layer === layerName);
  }
}

// Singleton instance
export const DXFReader = new DXFReaderImpl();
