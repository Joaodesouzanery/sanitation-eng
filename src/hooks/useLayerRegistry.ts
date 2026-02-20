/**
 * useLayerRegistry - Hook para gerenciamento de camadas espaciais
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LayerRegistry,
  SpatialLayer,
  CRSDefinition,
  createLayer,
  generateLayerId
} from '../core/spatial/LayerRegistry';
import { ProjectCRS, ProjectSettings } from '../core/spatial/ProjectCRS';

// ============================================================================
// HOOK
// ============================================================================

export function useLayerRegistry() {
  const [layers, setLayers] = useState<SpatialLayer[]>([]);
  const [projectCRS, setProjectCRS] = useState<CRSDefinition | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Subscribe to layer changes
  useEffect(() => {
    const unsubscribeLayers = LayerRegistry.subscribe((newLayers) => {
      setLayers(newLayers);
    });

    const unsubscribeCRS = ProjectCRS.subscribe((settings) => {
      setProjectCRS(settings?.crs || null);
      setIsInitialized(settings !== null);
    });

    // Initial state
    setLayers(LayerRegistry.getAllLayers());
    setProjectCRS(ProjectCRS.crs);
    setIsInitialized(ProjectCRS.isConfigured());

    return () => {
      unsubscribeLayers();
      unsubscribeCRS();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Layer Operations
  // --------------------------------------------------------------------------

  const addLayer = useCallback((
    name: string,
    type: SpatialLayer['type'],
    discipline: SpatialLayer['discipline'],
    geometryType: SpatialLayer['geometryType']
  ): SpatialLayer => {
    const layer = createLayer(generateLayerId(), name, {
      type,
      discipline,
      geometryType,
      srid: projectCRS ? parseInt(projectCRS.code.split(':')[1]) : 31983
    });

    LayerRegistry.registerLayer(layer);
    return layer;
  }, [projectCRS]);

  const removeLayer = useCallback((layerId: string): boolean => {
    return LayerRegistry.removeLayer(layerId);
  }, []);

  const updateLayer = useCallback((layerId: string, updates: Partial<SpatialLayer>): void => {
    LayerRegistry.updateLayer(layerId, updates);
  }, []);

  const getLayer = useCallback((layerId: string): SpatialLayer | undefined => {
    return LayerRegistry.getLayer(layerId);
  }, []);

  const getLayersByDiscipline = useCallback((discipline: string | string[]): SpatialLayer[] => {
    return LayerRegistry.getLayersByDiscipline(discipline);
  }, []);

  const getLayersByType = useCallback((type: SpatialLayer['type']): SpatialLayer[] => {
    return LayerRegistry.getLayersByType(type);
  }, []);

  // --------------------------------------------------------------------------
  // Layer Visibility
  // --------------------------------------------------------------------------

  const toggleLayerVisibility = useCallback((layerId: string): void => {
    const layer = LayerRegistry.getLayer(layerId);
    if (layer) {
      LayerRegistry.updateLayer(layerId, { visible: !layer.visible });
    }
  }, []);

  const setLayerVisibility = useCallback((layerId: string, visible: boolean): void => {
    LayerRegistry.updateLayer(layerId, { visible });
  }, []);

  const showAllLayers = useCallback((): void => {
    layers.forEach(layer => {
      LayerRegistry.updateLayer(layer.id, { visible: true });
    });
  }, [layers]);

  const hideAllLayers = useCallback((): void => {
    layers.forEach(layer => {
      LayerRegistry.updateLayer(layer.id, { visible: false });
    });
  }, [layers]);

  // --------------------------------------------------------------------------
  // CRS Operations
  // --------------------------------------------------------------------------

  const initializeProject = useCallback((settings: ProjectSettings): void => {
    ProjectCRS.configure(settings);
  }, []);

  const setCRS = useCallback((crs: CRSDefinition): void => {
    ProjectCRS.setCRS(crs);
  }, []);

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  const getStatistics = useCallback(() => {
    return LayerRegistry.getStatistics();
  }, []);

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  const exportToGeoJSON = useCallback(() => {
    return LayerRegistry.exportToGeoJSON();
  }, []);

  const clearAll = useCallback(() => {
    LayerRegistry.clear();
  }, []);

  return {
    // State
    layers,
    projectCRS,
    isInitialized,

    // Layer operations
    addLayer,
    removeLayer,
    updateLayer,
    getLayer,
    getLayersByDiscipline,
    getLayersByType,

    // Visibility
    toggleLayerVisibility,
    setLayerVisibility,
    showAllLayers,
    hideAllLayers,

    // CRS
    initializeProject,
    setCRS,

    // Utils
    getStatistics,
    exportToGeoJSON,
    clearAll,

    // Computed
    visibleLayers: layers.filter(l => l.visible),
    networkLayers: layers.filter(l => l.type !== 'drawing'),
    drawingLayers: layers.filter(l => l.type === 'drawing')
  };
}

export default useLayerRegistry;
