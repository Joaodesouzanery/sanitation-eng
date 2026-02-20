/**
 * useImportEngine - Hook para importação de arquivos
 */

import { useState, useCallback } from 'react';
import {
  ImportEngine,
  RawImportData,
  AttributeMapping,
  ImportOptions,
  ImportResult,
  MappingTemplate
} from '../core/import/ImportEngine';
import { SpatialCore } from '../core/spatial/SpatialCore';
import { NetworkModel } from '../core/network/NetworkModel';
import { ImportValidator, ValidationReport } from '../core/validation/ImportValidator';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportState {
  isImporting: boolean;
  progress: number;
  currentStep: string;
  error: string | null;
  result: ImportResult | null;
  validationReport: ValidationReport | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useImportEngine() {
  const [state, setState] = useState<ImportState>({
    isImporting: false,
    progress: 0,
    currentStep: '',
    error: null,
    result: null,
    validationReport: null
  });

  // --------------------------------------------------------------------------
  // File Detection
  // --------------------------------------------------------------------------

  const detectFile = useCallback(async (file: File): Promise<RawImportData | null> => {
    setState(prev => ({
      ...prev,
      isImporting: true,
      progress: 10,
      currentStep: 'Analisando arquivo...',
      error: null
    }));

    try {
      const fileData = await ImportEngine.detectFile(file);

      setState(prev => ({
        ...prev,
        progress: 30,
        currentStep: 'Arquivo analisado'
      }));

      return fileData;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isImporting: false,
        error: `Erro ao analisar arquivo: ${error.message}`
      }));
      return null;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Import Execution
  // --------------------------------------------------------------------------

  const executeImport = useCallback(async (
    fileData: RawImportData,
    mapping: AttributeMapping,
    options: ImportOptions
  ): Promise<ImportResult | null> => {
    setState(prev => ({
      ...prev,
      isImporting: true,
      progress: 40,
      currentStep: 'Convertendo dados...',
      error: null
    }));

    try {
      // Convert to internal model
      const result = ImportEngine.convertToInternalModel(fileData, mapping, options);

      setState(prev => ({
        ...prev,
        progress: 70,
        currentStep: 'Validando dados...'
      }));

      // Load into NetworkModel
      if (result.success) {
        NetworkModel.loadFromInternalModel(result.model.nodes, result.model.edges);

        setState(prev => ({
          ...prev,
          progress: 85,
          currentStep: 'Registrando camadas...'
        }));

        // Register layers in SpatialCore
        const discipline = options.modelType.replace('_network', '') as any;

        if (result.model.nodes.length > 0 || result.model.edges.length > 0) {
          // Network layer will be created from NetworkModel data
        }

        // Register drawing layers
        result.model.drawingLayers.forEach(dl => {
          SpatialCore.importLayer(
            dl.name,
            'drawing',
            'generic',
            dl.features,
            fileData.fileName,
            fileData.fileType
          );
        });
      }

      setState(prev => ({
        ...prev,
        progress: 95,
        currentStep: 'Executando validação...'
      }));

      // Validate import
      const validationReport = ImportValidator.validate();

      setState(prev => ({
        ...prev,
        isImporting: false,
        progress: 100,
        currentStep: 'Concluído',
        result,
        validationReport
      }));

      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isImporting: false,
        error: `Erro na importação: ${error.message}`
      }));
      return null;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Quick Import (single step)
  // --------------------------------------------------------------------------

  const quickImport = useCallback(async (
    file: File,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportResult | null> => {
    // Detect file
    const fileData = await detectFile(file);
    if (!fileData) return null;

    // Build default mapping
    const mapping: AttributeMapping = {};

    // Auto-detect coordinate columns for CSV
    if (fileData.fileType === 'CSV') {
      const attrs = fileData.metadata.entityTypes[0]?.sampleAttributes || [];
      const xCol = attrs.find(a => /^x$/i.test(a) || /coord.*x/i.test(a));
      const yCol = attrs.find(a => /^y$/i.test(a) || /coord.*y/i.test(a));
      const zCol = attrs.find(a => /^z$/i.test(a) || /elev/i.test(a) || /cota/i.test(a));

      if (xCol) mapping.x = xCol;
      if (yCol) mapping.y = yCol;
      if (zCol) mapping.z = zCol;
    }

    // Build entity type mapping
    const entityTypeMapping: Record<string, 'edge' | 'node' | 'drawing' | 'ignore'> = {};
    fileData.metadata.entityTypes.forEach(et => {
      entityTypeMapping[et.type] = et.suggestedImportAs;
    });

    // Default options
    const fullOptions: ImportOptions = {
      modelType: 'water_network',
      importMode: 'geometric',
      targetCRS: 'EPSG:31983',
      numericFormat: fileData.metadata.numericFormat === 'unknown' ? 'auto' : fileData.metadata.numericFormat,
      tolerance: 0.01,
      entityTypeMapping,
      ...options
    };

    return executeImport(fileData, mapping, fullOptions);
  }, [detectFile, executeImport]);

  // --------------------------------------------------------------------------
  // Template Management
  // --------------------------------------------------------------------------

  const saveTemplate = useCallback((
    name: string,
    fileType: string,
    mapping: AttributeMapping
  ): void => {
    ImportEngine.saveTemplate({
      id: `template_${Date.now()}`,
      name,
      fileType,
      mapping,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }, []);

  const loadTemplate = useCallback((templateId: string): MappingTemplate | undefined => {
    return ImportEngine.getTemplate(templateId);
  }, []);

  const getTemplates = useCallback((fileType?: string): MappingTemplate[] => {
    if (fileType) {
      return ImportEngine.getTemplatesByFileType(fileType);
    }
    // Return all templates
    return [];
  }, []);

  const deleteTemplate = useCallback((templateId: string): void => {
    ImportEngine.deleteTemplate(templateId);
  }, []);

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  const reset = useCallback(() => {
    setState({
      isImporting: false,
      progress: 0,
      currentStep: '',
      error: null,
      result: null,
      validationReport: null
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    ...state,

    // Actions
    detectFile,
    executeImport,
    quickImport,

    // Templates
    saveTemplate,
    loadTemplate,
    getTemplates,
    deleteTemplate,

    // Utils
    reset,
    clearError
  };
}

export default useImportEngine;
