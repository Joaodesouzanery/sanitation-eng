/**
 * SHP Reader - Leitor de arquivos Shapefile
 *
 * Suporta leitura de arquivos .shp, .shx, .dbf e .prj
 */

import { Feature, Geometry } from 'geojson';
import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ShapefileComponents {
  shp: ArrayBuffer | null;
  shx: ArrayBuffer | null;
  dbf: ArrayBuffer | null;
  prj: string | null;
}

export interface ShapefileHeader {
  fileCode: number;
  fileLength: number;
  version: number;
  shapeType: number;
  bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
    minM?: number;
    maxM?: number;
  };
}

// Shape types
const SHAPE_TYPES: Record<number, string> = {
  0: 'Null',
  1: 'Point',
  3: 'PolyLine',
  5: 'Polygon',
  8: 'MultiPoint',
  11: 'PointZ',
  13: 'PolyLineZ',
  15: 'PolygonZ',
  18: 'MultiPointZ',
  21: 'PointM',
  23: 'PolyLineM',
  25: 'PolygonM',
  28: 'MultiPointM',
  31: 'MultiPatch'
};

// ============================================================================
// SHP READER CLASS
// ============================================================================

class SHPReaderImpl {

  async read(files: File[]): Promise<RawImportData> {
    const components = await this.readComponents(files);

    if (!components.shp) {
      throw new Error('Arquivo .shp não encontrado');
    }

    const shapes = this.parseShp(components.shp);
    const attributes = components.dbf ? this.parseDbf(components.dbf) : [];
    const crs = components.prj ? this.parsePrj(components.prj) : null;

    const entities = this.extractEntities(shapes, attributes);
    const metadata = this.analyzeMetadata(shapes, entities, crs);

    return {
      fileType: 'SHP',
      fileName: files.find(f => f.name.endsWith('.shp'))?.name || 'shapefile',
      fileSize: files.reduce((sum, f) => sum + f.size, 0),
      rawContent: { shapes, attributes, crs },
      entities,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // File Reading
  // --------------------------------------------------------------------------

  private async readComponents(files: File[]): Promise<ShapefileComponents> {
    const components: ShapefileComponents = {
      shp: null,
      shx: null,
      dbf: null,
      prj: null
    };

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();

      switch (ext) {
        case 'shp':
          components.shp = await file.arrayBuffer();
          break;
        case 'shx':
          components.shx = await file.arrayBuffer();
          break;
        case 'dbf':
          components.dbf = await file.arrayBuffer();
          break;
        case 'prj':
          components.prj = await file.text();
          break;
      }
    }

    return components;
  }

  // --------------------------------------------------------------------------
  // SHP Parsing
  // --------------------------------------------------------------------------

  private parseShp(buffer: ArrayBuffer): { header: ShapefileHeader; records: any[] } {
    const view = new DataView(buffer);

    // Parse header (100 bytes)
    const header: ShapefileHeader = {
      fileCode: view.getInt32(0, false),  // Big endian
      fileLength: view.getInt32(24, false) * 2,
      version: view.getInt32(28, true),   // Little endian
      shapeType: view.getInt32(32, true),
      bbox: {
        minX: view.getFloat64(36, true),
        minY: view.getFloat64(44, true),
        maxX: view.getFloat64(52, true),
        maxY: view.getFloat64(60, true),
        minZ: view.getFloat64(68, true),
        maxZ: view.getFloat64(76, true),
        minM: view.getFloat64(84, true),
        maxM: view.getFloat64(92, true)
      }
    };

    // Parse records
    const records: any[] = [];
    let offset = 100;

    while (offset < buffer.byteLength - 8) {
      try {
        const recordNumber = view.getInt32(offset, false);
        const contentLength = view.getInt32(offset + 4, false) * 2;
        const shapeType = view.getInt32(offset + 8, true);

        if (contentLength <= 0 || offset + 8 + contentLength > buffer.byteLength) {
          break;
        }

        const record = this.parseRecord(view, offset + 8, shapeType, contentLength);
        if (record) {
          records.push({ recordNumber, ...record });
        }

        offset += 8 + contentLength;
      } catch (e) {
        break;
      }
    }

    return { header, records };
  }

  private parseRecord(view: DataView, offset: number, shapeType: number, length: number): any | null {
    switch (shapeType) {
      case 0: // Null
        return null;

      case 1: // Point
      case 11: // PointZ
      case 21: // PointM
        return this.parsePoint(view, offset, shapeType);

      case 3: // PolyLine
      case 13: // PolyLineZ
      case 23: // PolyLineM
        return this.parsePolyLine(view, offset, shapeType);

      case 5: // Polygon
      case 15: // PolygonZ
      case 25: // PolygonM
        return this.parsePolygon(view, offset, shapeType);

      case 8: // MultiPoint
      case 18: // MultiPointZ
      case 28: // MultiPointM
        return this.parseMultiPoint(view, offset, shapeType);

      default:
        return null;
    }
  }

  private parsePoint(view: DataView, offset: number, shapeType: number): any {
    const point: any = {
      shapeType,
      x: view.getFloat64(offset + 4, true),
      y: view.getFloat64(offset + 12, true)
    };

    if (shapeType === 11) { // PointZ
      point.z = view.getFloat64(offset + 20, true);
      point.m = view.getFloat64(offset + 28, true);
    } else if (shapeType === 21) { // PointM
      point.m = view.getFloat64(offset + 20, true);
    }

    return point;
  }

  private parsePolyLine(view: DataView, offset: number, shapeType: number): any {
    const bbox = {
      minX: view.getFloat64(offset + 4, true),
      minY: view.getFloat64(offset + 12, true),
      maxX: view.getFloat64(offset + 20, true),
      maxY: view.getFloat64(offset + 28, true)
    };

    const numParts = view.getInt32(offset + 36, true);
    const numPoints = view.getInt32(offset + 40, true);

    const parts: number[] = [];
    for (let i = 0; i < numParts; i++) {
      parts.push(view.getInt32(offset + 44 + i * 4, true));
    }

    const pointsOffset = offset + 44 + numParts * 4;
    const points: number[][] = [];

    for (let i = 0; i < numPoints; i++) {
      const x = view.getFloat64(pointsOffset + i * 16, true);
      const y = view.getFloat64(pointsOffset + i * 16 + 8, true);
      points.push([x, y]);
    }

    // Parse Z values if PolyLineZ
    if (shapeType === 13) {
      const zOffset = pointsOffset + numPoints * 16;
      for (let i = 0; i < numPoints; i++) {
        if (zOffset + 16 + i * 8 < view.byteLength) {
          points[i].push(view.getFloat64(zOffset + 16 + i * 8, true));
        }
      }
    }

    return { shapeType, bbox, parts, points };
  }

  private parsePolygon(view: DataView, offset: number, shapeType: number): any {
    // Same structure as PolyLine
    return this.parsePolyLine(view, offset, shapeType);
  }

  private parseMultiPoint(view: DataView, offset: number, shapeType: number): any {
    const bbox = {
      minX: view.getFloat64(offset + 4, true),
      minY: view.getFloat64(offset + 12, true),
      maxX: view.getFloat64(offset + 20, true),
      maxY: view.getFloat64(offset + 28, true)
    };

    const numPoints = view.getInt32(offset + 36, true);
    const points: number[][] = [];

    for (let i = 0; i < numPoints; i++) {
      const x = view.getFloat64(offset + 40 + i * 16, true);
      const y = view.getFloat64(offset + 40 + i * 16 + 8, true);
      points.push([x, y]);
    }

    return { shapeType, bbox, points };
  }

  // --------------------------------------------------------------------------
  // DBF Parsing
  // --------------------------------------------------------------------------

  private parseDbf(buffer: ArrayBuffer): Record<string, any>[] {
    const view = new DataView(buffer);
    const decoder = new TextDecoder('latin1');

    // Header
    const numRecords = view.getUint32(4, true);
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);

    // Field descriptors
    const fields: { name: string; type: string; length: number; decimal: number }[] = [];
    let offset = 32;

    while (offset < headerLength - 1) {
      const fieldName = decoder.decode(new Uint8Array(buffer, offset, 11)).replace(/\0/g, '').trim();
      if (!fieldName) break;

      fields.push({
        name: fieldName,
        type: String.fromCharCode(view.getUint8(offset + 11)),
        length: view.getUint8(offset + 16),
        decimal: view.getUint8(offset + 17)
      });

      offset += 32;
    }

    // Records
    const records: Record<string, any>[] = [];
    offset = headerLength;

    for (let i = 0; i < numRecords; i++) {
      const record: Record<string, any> = {};
      let fieldOffset = 1; // Skip deletion flag

      for (const field of fields) {
        const value = decoder.decode(
          new Uint8Array(buffer, offset + fieldOffset, field.length)
        ).trim();

        switch (field.type) {
          case 'N':
          case 'F':
            record[field.name] = value ? parseFloat(value) : null;
            break;
          case 'D':
            record[field.name] = value || null;
            break;
          case 'L':
            record[field.name] = value === 'T' || value === 'Y';
            break;
          default:
            record[field.name] = value;
        }

        fieldOffset += field.length;
      }

      records.push(record);
      offset += recordLength;
    }

    return records;
  }

  // --------------------------------------------------------------------------
  // PRJ Parsing
  // --------------------------------------------------------------------------

  private parsePrj(content: string): string | null {
    // Extrair EPSG code ou nome do CRS
    const epsgMatch = content.match(/EPSG[",:\s]*(\d+)/i);
    if (epsgMatch) {
      return `EPSG:${epsgMatch[1]}`;
    }

    // Tentar extrair nome do datum/projeção
    const nameMatch = content.match(/GEOGCS\["([^"]+)"/i) ||
                      content.match(/PROJCS\["([^"]+)"/i);

    if (nameMatch) {
      // Mapear nomes comuns para EPSG
      const name = nameMatch[1].toUpperCase();

      if (name.includes('SIRGAS') && name.includes('2000')) {
        if (name.includes('23')) return 'EPSG:31983';
        if (name.includes('22')) return 'EPSG:31982';
        if (name.includes('24')) return 'EPSG:31984';
      }

      if (name.includes('WGS') && name.includes('84')) {
        return 'EPSG:4326';
      }

      return nameMatch[1];
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractEntities(
    shapes: { header: ShapefileHeader; records: any[] },
    attributes: Record<string, any>[]
  ): RawEntity[] {
    return shapes.records.map((record, index) => {
      const geometry = this.recordToGeometry(record);
      const shapeTypeName = SHAPE_TYPES[record.shapeType] || 'Unknown';

      return {
        id: `shape_${record.recordNumber || index}`,
        type: shapeTypeName,
        geometry,
        attributes: attributes[index] || {}
      };
    });
  }

  private recordToGeometry(record: any): any {
    if (!record) return null;

    switch (record.shapeType) {
      case 1:
      case 11:
      case 21:
        return {
          type: 'Point',
          coordinates: record.z !== undefined
            ? [record.x, record.y, record.z]
            : [record.x, record.y]
        };

      case 3:
      case 13:
      case 23:
        if (record.parts.length === 1) {
          return { type: 'LineString', coordinates: record.points };
        }
        return {
          type: 'MultiLineString',
          coordinates: this.splitByParts(record.points, record.parts)
        };

      case 5:
      case 15:
      case 25:
        const rings = this.splitByParts(record.points, record.parts);
        if (rings.length === 1) {
          return { type: 'Polygon', coordinates: [rings[0]] };
        }
        return { type: 'MultiPolygon', coordinates: rings.map((r: any) => [r]) };

      case 8:
      case 18:
      case 28:
        return { type: 'MultiPoint', coordinates: record.points };

      default:
        return null;
    }
  }

  private splitByParts(points: number[][], parts: number[]): number[][][] {
    const result: number[][][] = [];

    for (let i = 0; i < parts.length; i++) {
      const start = parts[i];
      const end = parts[i + 1] || points.length;
      result.push(points.slice(start, end));
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Metadata Analysis
  // --------------------------------------------------------------------------

  private analyzeMetadata(
    shapes: { header: ShapefileHeader; records: any[] },
    entities: RawEntity[],
    crs: string | null
  ): ImportMetadata {
    const shapeType = shapes.header.shapeType;
    const hasZ = [11, 13, 15, 18].includes(shapeType);

    return {
      detectedCRS: crs,
      detectedUnit: crs?.includes('4326') ? 'degrees' : 'meters',
      hasZ,
      geometryType: this.shapeTypeToGeometryType(shapeType),
      entityTypes: [{
        type: SHAPE_TYPES[shapeType] || 'Unknown',
        count: entities.length,
        suggestedImportAs: this.suggestImportType(shapeType),
        hasZ,
        sampleAttributes: this.getSampleAttributes(entities)
      }],
      numericFormat: 'american',
      totalEntities: entities.length,
      boundingBox: shapes.header.bbox
    };
  }

  private shapeTypeToGeometryType(shapeType: number): 'point' | 'line' | 'polygon' | 'mixed' {
    if ([1, 11, 21, 8, 18, 28].includes(shapeType)) return 'point';
    if ([3, 13, 23].includes(shapeType)) return 'line';
    if ([5, 15, 25].includes(shapeType)) return 'polygon';
    return 'mixed';
  }

  private suggestImportType(shapeType: number): 'edge' | 'node' | 'drawing' | 'ignore' {
    if ([1, 11, 21, 8, 18, 28].includes(shapeType)) return 'node';
    if ([3, 13, 23].includes(shapeType)) return 'edge';
    if ([5, 15, 25].includes(shapeType)) return 'drawing';
    return 'ignore';
  }

  private getSampleAttributes(entities: RawEntity[]): string[] {
    const attrs = new Set<string>();
    entities.slice(0, 5).forEach(e => {
      Object.keys(e.attributes).forEach(key => attrs.add(key));
    });
    return Array.from(attrs);
  }
}

export const SHPReader = new SHPReaderImpl();
