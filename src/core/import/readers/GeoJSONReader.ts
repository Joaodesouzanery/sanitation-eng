/**
 * GeoJSON Reader - Leitor de arquivos GeoJSON
 */

import { Feature, FeatureCollection, Geometry } from 'geojson';
import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';

// ============================================================================
// GEOJSON READER CLASS
// ============================================================================

class GeoJSONReaderImpl {

  async read(file: File): Promise<RawImportData> {
    const content = await file.text();
    const geojson = JSON.parse(content);

    const entities = this.extractEntities(geojson);
    const metadata = this.analyzeMetadata(geojson, entities);

    return {
      fileType: 'GeoJSON',
      fileName: file.name,
      fileSize: file.size,
      rawContent: geojson,
      entities,
      metadata
    };
  }

  private extractEntities(geojson: any): RawEntity[] {
    const features = this.getFeatures(geojson);

    return features.map((feature, index) => ({
      id: feature.id?.toString() || `feature_${index}`,
      type: feature.geometry?.type || 'Unknown',
      geometry: feature.geometry,
      attributes: feature.properties || {},
      layer: feature.properties?.layer || 'default'
    }));
  }

  private getFeatures(geojson: any): Feature[] {
    if (geojson.type === 'FeatureCollection') {
      return geojson.features || [];
    }
    if (geojson.type === 'Feature') {
      return [geojson];
    }
    if (geojson.type && geojson.coordinates) {
      return [{
        type: 'Feature',
        geometry: geojson,
        properties: {}
      }];
    }
    return [];
  }

  private analyzeMetadata(geojson: any, entities: RawEntity[]): ImportMetadata {
    const entityTypes = this.groupEntityTypes(entities);

    let detectedCRS: string | null = null;
    if (geojson.crs?.properties?.name) {
      detectedCRS = geojson.crs.properties.name;
    }

    const hasZ = entities.some(e => {
      if (!e.geometry?.coordinates) return false;
      return this.hasZCoordinate(e.geometry.coordinates);
    });

    return {
      detectedCRS,
      detectedUnit: detectedCRS?.includes('4326') ? 'degrees' : 'meters',
      hasZ,
      geometryType: this.detectGeometryType(entities),
      entityTypes,
      numericFormat: 'american',
      totalEntities: entities.length,
      boundingBox: this.calculateBoundingBox(entities)
    };
  }

  private hasZCoordinate(coords: any): boolean {
    if (typeof coords[0] === 'number') {
      return coords.length >= 3 && coords[2] !== undefined;
    }
    if (Array.isArray(coords[0])) {
      return coords.some((c: any) => this.hasZCoordinate(c));
    }
    return false;
  }

  private groupEntityTypes(entities: RawEntity[]): ImportMetadata['entityTypes'] {
    const groups = new Map<string, RawEntity[]>();

    entities.forEach(e => {
      const type = e.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(e);
    });

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      count: items.length,
      suggestedImportAs: this.suggestImportType(type),
      hasZ: items.some(e => e.geometry?.coordinates && this.hasZCoordinate(e.geometry.coordinates)),
      sampleAttributes: this.getSampleAttributes(items)
    }));
  }

  private suggestImportType(type: string): 'edge' | 'node' | 'drawing' | 'ignore' {
    switch (type) {
      case 'Point':
      case 'MultiPoint':
        return 'node';
      case 'LineString':
      case 'MultiLineString':
        return 'edge';
      case 'Polygon':
      case 'MultiPolygon':
        return 'drawing';
      default:
        return 'ignore';
    }
  }

  private getSampleAttributes(items: RawEntity[]): string[] {
    const attrs = new Set<string>();
    items.slice(0, 5).forEach(item => {
      Object.keys(item.attributes).forEach(key => attrs.add(key));
    });
    return Array.from(attrs);
  }

  private detectGeometryType(entities: RawEntity[]): 'point' | 'line' | 'polygon' | 'mixed' {
    const types = new Set<string>();

    entities.forEach(e => {
      if (e.geometry?.type) {
        if (e.geometry.type.includes('Point')) types.add('point');
        else if (e.geometry.type.includes('Line')) types.add('line');
        else if (e.geometry.type.includes('Polygon')) types.add('polygon');
      }
    });

    if (types.size === 1) return [...types][0] as any;
    return 'mixed';
  }

  private calculateBoundingBox(entities: RawEntity[]): ImportMetadata['boundingBox'] {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const processCoord = (coord: number[]) => {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
    };

    const processCoords = (coords: any) => {
      if (typeof coords[0] === 'number') {
        processCoord(coords);
      } else if (Array.isArray(coords[0])) {
        coords.forEach((c: any) => processCoords(c));
      }
    };

    entities.forEach(e => {
      if (e.geometry?.coordinates) {
        processCoords(e.geometry.coordinates);
      }
    });

    if (minX === Infinity) return undefined;
    return { minX, minY, maxX, maxY };
  }
}

export const GeoJSONReader = new GeoJSONReaderImpl();
