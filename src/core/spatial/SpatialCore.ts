/**
 * Spatial Core - Núcleo Espacial Principal
 * Ponto de entrada unificado para todas as operações espaciais
 */

import { LayerRegistry, SpatialLayer, CRSDefinition, createLayer, generateLayerId } from './LayerRegistry';
import { ProjectCRS, ProjectSettings, CRS_PRESETS } from './ProjectCRS';
import { Feature, Point, LineString, Polygon } from 'geojson';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { LayerRegistry, SpatialLayer, CRSDefinition, createLayer, generateLayerId } from './LayerRegistry';
export { ProjectCRS, ProjectSettings, CRS_PRESETS } from './ProjectCRS';

// ============================================================================
// SPATIAL CORE CLASS
// ============================================================================

class SpatialCoreImpl {

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  initialize(settings: ProjectSettings): void {
    ProjectCRS.configure(settings);
  }

  isInitialized(): boolean {
    return ProjectCRS.isConfigured();
  }

  requireInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('SpatialCore não inicializado. Configure o CRS do projeto primeiro.');
    }
  }

  // --------------------------------------------------------------------------
  // Layer Operations
  // --------------------------------------------------------------------------

  createNetworkLayer(
    name: string,
    discipline: SpatialLayer['discipline'],
    geometryType: SpatialLayer['geometryType']
  ): SpatialLayer {
    this.requireInitialized();

    const layer = createLayer(generateLayerId(), name, {
      type: 'network',
      discipline,
      geometryType,
      srid: parseInt(ProjectCRS.crs!.code.split(':')[1]),
      source: 'created'
    });

    LayerRegistry.registerLayer(layer);
    return layer;
  }

  createDrawingLayer(name: string, geometryType: SpatialLayer['geometryType']): SpatialLayer {
    this.requireInitialized();

    const layer = createLayer(generateLayerId(), name, {
      type: 'drawing',
      discipline: 'generic',
      geometryType,
      srid: parseInt(ProjectCRS.crs!.code.split(':')[1]),
      source: 'created',
      editable: true
    });

    LayerRegistry.registerLayer(layer);
    return layer;
  }

  importLayer(
    name: string,
    type: SpatialLayer['type'],
    discipline: SpatialLayer['discipline'],
    features: Feature[],
    sourceFile: string,
    sourceFormat: string
  ): SpatialLayer {
    this.requireInitialized();

    const geometryType = this.detectGeometryType(features);

    const layer = createLayer(generateLayerId(), name, {
      type,
      discipline,
      geometryType,
      srid: parseInt(ProjectCRS.crs!.code.split(':')[1]),
      features,
      source: 'imported',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'import',
        sourceFile,
        sourceFormat,
        featureCount: features.length,
        attributes: this.extractAttributes(features)
      }
    });

    LayerRegistry.registerLayer(layer);
    return layer;
  }

  // --------------------------------------------------------------------------
  // Feature Operations
  // --------------------------------------------------------------------------

  addFeature(layerId: string, feature: Feature): void {
    this.requireInitialized();
    LayerRegistry.addFeatureToLayer(layerId, feature);
  }

  removeFeature(layerId: string, featureId: string): void {
    LayerRegistry.removeFeatureFromLayer(layerId, featureId);
  }

  updateFeature(layerId: string, featureId: string, updates: Partial<Feature>): void {
    const layer = LayerRegistry.getLayer(layerId);
    if (layer) {
      const featureIndex = layer.features.findIndex(f => f.id === featureId);
      if (featureIndex >= 0) {
        layer.features[featureIndex] = {
          ...layer.features[featureIndex],
          ...updates
        };
        LayerRegistry.updateLayer(layerId, { features: layer.features });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Query Operations
  // --------------------------------------------------------------------------

  getLayersForSimulation(discipline: string | string[]): SpatialLayer[] {
    // REGRA: Drawing layers NÃO entram na simulação
    return LayerRegistry.getLayersByDiscipline(discipline).filter(
      layer => layer.type !== 'drawing'
    );
  }

  getLayersForEPANET(): SpatialLayer[] {
    return this.getLayersForSimulation('water');
  }

  getLayersForSWMM(): SpatialLayer[] {
    return this.getLayersForSimulation(['sewer', 'drainage']);
  }

  getAllNetworkLayers(): SpatialLayer[] {
    return LayerRegistry.getNetworkLayers();
  }

  getAllDrawingLayers(): SpatialLayer[] {
    return LayerRegistry.getDrawingLayers();
  }

  // --------------------------------------------------------------------------
  // Geometry Utilities
  // --------------------------------------------------------------------------

  private detectGeometryType(features: Feature[]): SpatialLayer['geometryType'] {
    if (features.length === 0) return 'point';

    const types = new Set(features.map(f => f.geometry.type));

    if (types.has('MultiPoint') || types.has('MultiLineString') || types.has('MultiPolygon')) {
      return 'multi';
    }
    if (types.has('Point')) return 'point';
    if (types.has('LineString')) return 'line';
    if (types.has('Polygon')) return 'polygon';

    return 'multi';
  }

  private extractAttributes(features: Feature[]): string[] {
    const attributes = new Set<string>();
    features.forEach(f => {
      if (f.properties) {
        Object.keys(f.properties).forEach(key => attributes.add(key));
      }
    });
    return Array.from(attributes);
  }

  calculateBoundingBox(features: Feature[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null {
    if (features.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const processCoords = (coords: number[]) => {
      minX = Math.min(minX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxX = Math.max(maxX, coords[0]);
      maxY = Math.max(maxY, coords[1]);
    };

    const processGeometry = (geometry: any) => {
      switch (geometry.type) {
        case 'Point':
          processCoords(geometry.coordinates);
          break;
        case 'LineString':
          geometry.coordinates.forEach(processCoords);
          break;
        case 'Polygon':
          geometry.coordinates.forEach((ring: number[][]) => ring.forEach(processCoords));
          break;
        case 'MultiPoint':
          geometry.coordinates.forEach(processCoords);
          break;
        case 'MultiLineString':
          geometry.coordinates.forEach((line: number[][]) => line.forEach(processCoords));
          break;
        case 'MultiPolygon':
          geometry.coordinates.forEach((poly: number[][][]) =>
            poly.forEach((ring: number[][]) => ring.forEach(processCoords))
          );
          break;
      }
    };

    features.forEach(f => processGeometry(f.geometry));

    return { minX, minY, maxX, maxY };
  }

  // --------------------------------------------------------------------------
  // Project Management
  // --------------------------------------------------------------------------

  exportProject(): object {
    return {
      version: '1.0',
      crs: ProjectCRS.crs,
      settings: ProjectCRS.settings,
      layers: LayerRegistry.exportToGeoJSON(),
      statistics: LayerRegistry.getStatistics(),
      exportedAt: new Date().toISOString()
    };
  }

  clearProject(): void {
    LayerRegistry.clear();
    ProjectCRS.reset();
  }

  getProjectStatistics(): object {
    return {
      ...LayerRegistry.getStatistics(),
      crs: ProjectCRS.crs,
      initialized: this.isInitialized()
    };
  }
}

// Singleton instance
export const SpatialCore = new SpatialCoreImpl();
