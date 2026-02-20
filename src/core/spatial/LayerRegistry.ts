/**
 * Layer Registry Global - Registro centralizado de camadas
 * Todos os módulos compartilham este registro
 *
 * REGRAS:
 * - Importou em Topografia → aparece em Água
 * - Importou IFC → aparece em todos os módulos
 * - Camadas drawing não entram na simulação
 */

import { Feature, LineString, Point, Polygon } from 'geojson';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LayerMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sourceFile?: string;
  sourceFormat?: string;
  featureCount: number;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  attributes: string[];
}

export interface SpatialLayer {
  id: string;
  name: string;
  type: 'network' | 'topography' | 'bim' | 'gis' | 'drawing';
  discipline: 'water' | 'sewer' | 'drainage' | 'pumping' | 'generic';
  geometryType: 'point' | 'line' | 'polygon' | 'multi';
  srid: number;
  features: Feature[];
  visible: boolean;
  editable: boolean;
  source: 'imported' | 'created' | 'calculated';
  metadata: LayerMetadata;
  style?: LayerStyle;
}

export interface LayerStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  fillOpacity?: number;
  pointRadius?: number;
  linePattern?: 'solid' | 'dashed' | 'dotted';
}

export interface CRSDefinition {
  code: string;           // Ex: "EPSG:31983"
  name: string;           // Ex: "SIRGAS 2000 / UTM zone 23S"
  unit: 'meters' | 'feet';
  utmZone?: number;
  hemisphere?: 'N' | 'S';
}

// ============================================================================
// LAYER REGISTRY CLASS
// ============================================================================

class LayerRegistryImpl {
  private layers: Map<string, SpatialLayer> = new Map();
  private _projectCRS: CRSDefinition | null = null;
  private listeners: Set<(layers: SpatialLayer[]) => void> = new Set();

  // --------------------------------------------------------------------------
  // CRS Management
  // --------------------------------------------------------------------------

  get projectCRS(): CRSDefinition | null {
    return this._projectCRS;
  }

  setProjectCRS(crs: CRSDefinition): void {
    this._projectCRS = crs;
    this.notifyListeners();
  }

  isProjectCRSDefined(): boolean {
    return this._projectCRS !== null;
  }

  // --------------------------------------------------------------------------
  // Layer Management
  // --------------------------------------------------------------------------

  registerLayer(layer: SpatialLayer): void {
    // REGRA: Nenhum arquivo entra no sistema sem CRS definido
    if (!this._projectCRS) {
      throw new Error('CRS do projeto deve ser definido antes de registrar camadas');
    }

    // Validar SRID da camada
    if (layer.srid !== this._projectCRS.code.split(':')[1]) {
      console.warn(`Camada ${layer.id} tem SRID diferente do projeto. Transformação necessária.`);
    }

    // Atualizar metadata
    layer.metadata.updatedAt = new Date();
    layer.metadata.featureCount = layer.features.length;

    this.layers.set(layer.id, layer);
    this.notifyListeners();
  }

  getLayer(id: string): SpatialLayer | undefined {
    return this.layers.get(id);
  }

  getLayersByDiscipline(discipline: string | string[]): SpatialLayer[] {
    const disciplines = Array.isArray(discipline) ? discipline : [discipline];
    return Array.from(this.layers.values()).filter(
      layer => disciplines.includes(layer.discipline)
    );
  }

  getLayersByType(type: SpatialLayer['type']): SpatialLayer[] {
    return Array.from(this.layers.values()).filter(
      layer => layer.type === type
    );
  }

  getAllLayers(): SpatialLayer[] {
    return Array.from(this.layers.values());
  }

  getNetworkLayers(): SpatialLayer[] {
    // Retorna apenas camadas que podem entrar na simulação
    // REGRA: Drawing layers NÃO entram
    return Array.from(this.layers.values()).filter(
      layer => layer.type !== 'drawing'
    );
  }

  getDrawingLayers(): SpatialLayer[] {
    return Array.from(this.layers.values()).filter(
      layer => layer.type === 'drawing'
    );
  }

  removeLayer(id: string): boolean {
    const result = this.layers.delete(id);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  updateLayer(id: string, updates: Partial<SpatialLayer>): void {
    const layer = this.layers.get(id);
    if (layer) {
      Object.assign(layer, updates);
      layer.metadata.updatedAt = new Date();
      layer.metadata.featureCount = layer.features.length;
      this.notifyListeners();
    }
  }

  // --------------------------------------------------------------------------
  // Feature Management
  // --------------------------------------------------------------------------

  addFeatureToLayer(layerId: string, feature: Feature): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.features.push(feature);
      layer.metadata.featureCount = layer.features.length;
      layer.metadata.updatedAt = new Date();
      this.notifyListeners();
    }
  }

  removeFeatureFromLayer(layerId: string, featureId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.features = layer.features.filter(f => f.id !== featureId);
      layer.metadata.featureCount = layer.features.length;
      layer.metadata.updatedAt = new Date();
      this.notifyListeners();
    }
  }

  // --------------------------------------------------------------------------
  // Listeners
  // --------------------------------------------------------------------------

  subscribe(listener: (layers: SpatialLayer[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const layers = this.getAllLayers();
    this.listeners.forEach(listener => listener(layers));
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  clear(): void {
    this.layers.clear();
    this.notifyListeners();
  }

  getStatistics(): {
    totalLayers: number;
    totalFeatures: number;
    byType: Record<string, number>;
    byDiscipline: Record<string, number>;
  } {
    const layers = this.getAllLayers();
    const stats = {
      totalLayers: layers.length,
      totalFeatures: layers.reduce((sum, l) => sum + l.features.length, 0),
      byType: {} as Record<string, number>,
      byDiscipline: {} as Record<string, number>
    };

    layers.forEach(layer => {
      stats.byType[layer.type] = (stats.byType[layer.type] || 0) + 1;
      stats.byDiscipline[layer.discipline] = (stats.byDiscipline[layer.discipline] || 0) + 1;
    });

    return stats;
  }

  exportToGeoJSON(): object {
    return {
      type: 'FeatureCollection',
      crs: this._projectCRS,
      features: this.getAllLayers().flatMap(layer =>
        layer.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            _layerId: layer.id,
            _layerName: layer.name,
            _discipline: layer.discipline
          }
        }))
      )
    };
  }
}

// Singleton instance
export const LayerRegistry = new LayerRegistryImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createLayer(
  id: string,
  name: string,
  options: Partial<SpatialLayer>
): SpatialLayer {
  return {
    id,
    name,
    type: options.type || 'network',
    discipline: options.discipline || 'generic',
    geometryType: options.geometryType || 'line',
    srid: options.srid || 31983,
    features: options.features || [],
    visible: options.visible ?? true,
    editable: options.editable ?? true,
    source: options.source || 'created',
    metadata: options.metadata || {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      featureCount: options.features?.length || 0,
      attributes: []
    },
    style: options.style
  };
}

export function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
