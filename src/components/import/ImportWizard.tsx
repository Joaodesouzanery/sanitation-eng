/**
 * Import Wizard - Wizard de Importação em 4 Etapas
 *
 * Etapa 1: Detecção de Arquivo
 * Etapa 2: Sistema de Referência (CRS)
 * Etapa 3: Tipo de Modelo
 * Etapa 4: Mapeamento de Atributos
 */

import React, { useState, useCallback } from 'react';
import {
  ImportEngine,
  RawImportData,
  AttributeMapping,
  ImportOptions,
  ImportResult
} from '../../core/import/ImportEngine';
import { ProjectCRS } from '../../core/spatial/ProjectCRS';
import { SpatialCore } from '../../core/spatial/SpatialCore';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportWizardState {
  currentStep: 1 | 2 | 3 | 4;
  file: File | null;
  fileData: RawImportData | null;
  crsSelection: CRSSelection | null;
  modelTypeSelection: ModelTypeSelection | null;
  attributeMapping: AttributeMapping | null;
  importing: boolean;
  error: string | null;
  result: ImportResult | null;
}

export interface CRSSelection {
  sourceCRS: string | null;
  targetCRS: string;
  transformationRequired: boolean;
  numericFormat: {
    detected: 'brazilian' | 'american' | 'unknown';
    userSelection: 'brazilian' | 'american' | 'auto';
  };
}

export interface ModelTypeSelection {
  modelType: 'water_network' | 'sewer_network' | 'drainage_network' |
             'pumping_network' | 'topography' | 'bim' | 'gis_generic';
  importMode: 'geometric' | 'tabular';
}

export interface EntityTypeMapping {
  [entityType: string]: 'edge' | 'node' | 'drawing' | 'ignore';
}

// ============================================================================
// IMPORT WIZARD COMPONENT
// ============================================================================

export const ImportWizard: React.FC<{
  onComplete: (result: ImportResult) => void;
  onCancel: () => void;
}> = ({ onComplete, onCancel }) => {
  const [state, setState] = useState<ImportWizardState>({
    currentStep: 1,
    file: null,
    fileData: null,
    crsSelection: null,
    modelTypeSelection: null,
    attributeMapping: null,
    importing: false,
    error: null,
    result: null
  });

  // --------------------------------------------------------------------------
  // Step Navigation
  // --------------------------------------------------------------------------

  const goToStep = (step: ImportWizardState['currentStep']) => {
    setState(prev => ({ ...prev, currentStep: step, error: null }));
  };

  const nextStep = () => {
    if (state.currentStep < 4) {
      goToStep((state.currentStep + 1) as ImportWizardState['currentStep']);
    }
  };

  const prevStep = () => {
    if (state.currentStep > 1) {
      goToStep((state.currentStep - 1) as ImportWizardState['currentStep']);
    }
  };

  // --------------------------------------------------------------------------
  // Step 1: File Detection
  // --------------------------------------------------------------------------

  const handleFileSelect = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, file, importing: true, error: null }));

    try {
      const fileData = await ImportEngine.detectFile(file);

      setState(prev => ({
        ...prev,
        fileData,
        importing: false,
        crsSelection: {
          sourceCRS: fileData.metadata.detectedCRS,
          targetCRS: ProjectCRS.crs?.code || 'EPSG:31983',
          transformationRequired: fileData.metadata.detectedCRS !== ProjectCRS.crs?.code,
          numericFormat: {
            detected: fileData.metadata.numericFormat,
            userSelection: 'auto'
          }
        }
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        importing: false,
        error: `Erro ao ler arquivo: ${error.message}`
      }));
    }
  }, []);

  // --------------------------------------------------------------------------
  // Step 4: Execute Import
  // --------------------------------------------------------------------------

  const executeImport = useCallback(async () => {
    if (!state.fileData || !state.crsSelection || !state.modelTypeSelection || !state.attributeMapping) {
      setState(prev => ({ ...prev, error: 'Dados incompletos para importação' }));
      return;
    }

    setState(prev => ({ ...prev, importing: true, error: null }));

    try {
      // Construir entity type mapping a partir dos dados
      const entityTypeMapping: EntityTypeMapping = {};
      state.fileData.metadata.entityTypes.forEach(et => {
        entityTypeMapping[et.type] = et.suggestedImportAs;
      });

      const options: ImportOptions = {
        modelType: state.modelTypeSelection.modelType,
        importMode: state.modelTypeSelection.importMode,
        targetCRS: state.crsSelection.targetCRS,
        sourceCRS: state.crsSelection.sourceCRS || undefined,
        numericFormat: state.crsSelection.numericFormat.userSelection,
        tolerance: 0.01,
        entityTypeMapping
      };

      const result = ImportEngine.convertToInternalModel(
        state.fileData,
        state.attributeMapping,
        options
      );

      if (result.success) {
        // Importar camadas para o SpatialCore
        const discipline = state.modelTypeSelection.modelType.replace('_network', '') as any;

        if (result.model.nodes.length > 0 || result.model.edges.length > 0) {
          SpatialCore.importLayer(
            state.file?.name || 'Imported Layer',
            'network',
            discipline,
            [], // Features serão construídas a partir de nodes/edges
            state.file?.name || 'unknown',
            state.fileData.fileType
          );
        }

        // Importar drawing layers separadamente
        result.model.drawingLayers.forEach(dl => {
          SpatialCore.importLayer(
            dl.name,
            'drawing',
            'generic',
            dl.features,
            state.file?.name || 'unknown',
            state.fileData!.fileType
          );
        });
      }

      setState(prev => ({ ...prev, importing: false, result }));
      onComplete(result);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        importing: false,
        error: `Erro na importação: ${error.message}`
      }));
    }
  }, [state.fileData, state.crsSelection, state.modelTypeSelection, state.attributeMapping, state.file, onComplete]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="import-wizard">
      {/* Progress Bar */}
      <div className="wizard-progress">
        {[1, 2, 3, 4].map(step => (
          <div
            key={step}
            className={`progress-step ${state.currentStep >= step ? 'active' : ''} ${state.currentStep === step ? 'current' : ''}`}
          >
            <span className="step-number">{step}</span>
            <span className="step-label">
              {step === 1 && 'Arquivo'}
              {step === 2 && 'CRS'}
              {step === 3 && 'Modelo'}
              {step === 4 && 'Atributos'}
            </span>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="wizard-error">
          <span className="error-icon">⚠️</span>
          {state.error}
        </div>
      )}

      {/* Step Content */}
      <div className="wizard-content">
        {state.currentStep === 1 && (
          <Step1FileDetection
            file={state.file}
            fileData={state.fileData}
            importing={state.importing}
            onFileSelect={handleFileSelect}
            onEntityTypeChange={(entityType, importAs) => {
              if (state.fileData) {
                const updatedTypes = state.fileData.metadata.entityTypes.map(et =>
                  et.type === entityType ? { ...et, suggestedImportAs: importAs } : et
                );
                setState(prev => ({
                  ...prev,
                  fileData: {
                    ...prev.fileData!,
                    metadata: {
                      ...prev.fileData!.metadata,
                      entityTypes: updatedTypes
                    }
                  }
                }));
              }
            }}
          />
        )}

        {state.currentStep === 2 && (
          <Step2CRS
            fileData={state.fileData}
            crsSelection={state.crsSelection}
            onChange={(crsSelection) => setState(prev => ({ ...prev, crsSelection }))}
          />
        )}

        {state.currentStep === 3 && (
          <Step3ModelType
            fileData={state.fileData}
            modelTypeSelection={state.modelTypeSelection}
            onChange={(modelTypeSelection) => setState(prev => ({ ...prev, modelTypeSelection }))}
          />
        )}

        {state.currentStep === 4 && (
          <Step4AttributeMapping
            fileData={state.fileData}
            attributeMapping={state.attributeMapping}
            onChange={(attributeMapping) => setState(prev => ({ ...prev, attributeMapping }))}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="wizard-actions">
        <button onClick={onCancel} className="btn-cancel">
          Cancelar
        </button>

        <div className="nav-buttons">
          {state.currentStep > 1 && (
            <button onClick={prevStep} className="btn-prev">
              ← Anterior
            </button>
          )}

          {state.currentStep < 4 ? (
            <button
              onClick={nextStep}
              className="btn-next"
              disabled={
                (state.currentStep === 1 && !state.fileData) ||
                (state.currentStep === 2 && !state.crsSelection?.targetCRS) ||
                (state.currentStep === 3 && !state.modelTypeSelection)
              }
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={executeImport}
              className="btn-import"
              disabled={state.importing || !state.attributeMapping}
            >
              {state.importing ? 'Importando...' : 'Importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 1: FILE DETECTION
// ============================================================================

interface Step1Props {
  file: File | null;
  fileData: RawImportData | null;
  importing: boolean;
  onFileSelect: (file: File) => void;
  onEntityTypeChange: (entityType: string, importAs: 'edge' | 'node' | 'drawing' | 'ignore') => void;
}

const Step1FileDetection: React.FC<Step1Props> = ({
  file,
  fileData,
  importing,
  onFileSelect,
  onEntityTypeChange
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <div className="step-content step1">
      <h3>Etapa 1: Detecção de Arquivo</h3>

      {/* File Drop Zone */}
      <div
        className={`file-dropzone ${file ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {importing ? (
          <div className="loading">
            <span className="spinner"></span>
            <p>Analisando arquivo...</p>
          </div>
        ) : file ? (
          <div className="file-info">
            <span className="file-icon">📄</span>
            <div className="file-details">
              <strong>{file.name}</strong>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        ) : (
          <div className="dropzone-content">
            <span className="upload-icon">📁</span>
            <p>Arraste um arquivo aqui ou clique para selecionar</p>
            <span className="formats">IFC, DWG, DXF, SHP, GeoJSON, CSV, INP</span>
            <input
              type="file"
              accept=".ifc,.dwg,.dxf,.shp,.geojson,.json,.csv,.txt,.inp"
              onChange={handleFileInput}
            />
          </div>
        )}
      </div>

      {/* Detection Results */}
      {fileData && (
        <div className="detection-results">
          <h4>Informações Detectadas</h4>

          <div className="info-grid">
            <div className="info-item">
              <label>Tipo:</label>
              <span>{fileData.fileType}</span>
            </div>
            <div className="info-item">
              <label>CRS:</label>
              <span>{fileData.metadata.detectedCRS || 'Não detectado'}</span>
            </div>
            <div className="info-item">
              <label>Geometria:</label>
              <span>{fileData.metadata.geometryType}</span>
            </div>
            <div className="info-item">
              <label>Possui Z:</label>
              <span>{fileData.metadata.hasZ ? 'Sim' : 'Não'}</span>
            </div>
            <div className="info-item">
              <label>Formato numérico:</label>
              <span>
                {fileData.metadata.numericFormat === 'brazilian' && 'Brasileiro (1.234,56)'}
                {fileData.metadata.numericFormat === 'american' && 'Americano (1,234.56)'}
                {fileData.metadata.numericFormat === 'unknown' && 'Desconhecido'}
              </span>
            </div>
            <div className="info-item">
              <label>Total:</label>
              <span>{fileData.metadata.totalEntities} entidades</span>
            </div>
          </div>

          {/* Entity Type Table */}
          <h4>Tipos de Entidade</h4>
          <table className="entity-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Z</th>
                <th>Importar como</th>
              </tr>
            </thead>
            <tbody>
              {fileData.metadata.entityTypes.map(et => (
                <tr key={et.type}>
                  <td>{et.type}</td>
                  <td>{et.count}</td>
                  <td>{et.hasZ ? '✓' : '-'}</td>
                  <td>
                    <select
                      value={et.suggestedImportAs}
                      onChange={(e) => onEntityTypeChange(et.type, e.target.value as any)}
                    >
                      <option value="edge">Trecho</option>
                      <option value="node">Nó</option>
                      <option value="drawing">Desenho</option>
                      <option value="ignore">Ignorar</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STEP 2: CRS SELECTION
// ============================================================================

interface Step2Props {
  fileData: RawImportData | null;
  crsSelection: CRSSelection | null;
  onChange: (selection: CRSSelection) => void;
}

const Step2CRS: React.FC<Step2Props> = ({ fileData, crsSelection, onChange }) => {
  const commonCRS = [
    { code: 'EPSG:31981', name: 'SIRGAS 2000 / UTM zone 21S' },
    { code: 'EPSG:31982', name: 'SIRGAS 2000 / UTM zone 22S' },
    { code: 'EPSG:31983', name: 'SIRGAS 2000 / UTM zone 23S' },
    { code: 'EPSG:31984', name: 'SIRGAS 2000 / UTM zone 24S' },
    { code: 'EPSG:31985', name: 'SIRGAS 2000 / UTM zone 25S' },
    { code: 'EPSG:4674', name: 'SIRGAS 2000 (Geográfico)' },
    { code: 'EPSG:4326', name: 'WGS 84 (Geográfico)' }
  ];

  if (!crsSelection) return null;

  return (
    <div className="step-content step2">
      <h3>Etapa 2: Sistema de Referência</h3>

      <div className="crs-form">
        {/* Source CRS */}
        <div className="form-group">
          <label>CRS do Arquivo (Origem)</label>
          {fileData?.metadata.detectedCRS ? (
            <div className="detected-crs">
              <span className="check-icon">✓</span>
              <span>{fileData.metadata.detectedCRS}</span>
            </div>
          ) : (
            <div className="warning-box">
              <span className="warning-icon">⚠️</span>
              <span>CRS não detectado. Selecione manualmente:</span>
              <select
                value={crsSelection.sourceCRS || ''}
                onChange={(e) => onChange({
                  ...crsSelection,
                  sourceCRS: e.target.value || null,
                  transformationRequired: e.target.value !== crsSelection.targetCRS
                })}
              >
                <option value="">-- Selecione --</option>
                {commonCRS.map(crs => (
                  <option key={crs.code} value={crs.code}>{crs.code} - {crs.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Target CRS */}
        <div className="form-group">
          <label>CRS do Projeto (Destino)</label>
          <select
            value={crsSelection.targetCRS}
            onChange={(e) => onChange({
              ...crsSelection,
              targetCRS: e.target.value,
              transformationRequired: e.target.value !== crsSelection.sourceCRS
            })}
          >
            {commonCRS.map(crs => (
              <option key={crs.code} value={crs.code}>{crs.code} - {crs.name}</option>
            ))}
          </select>
        </div>

        {/* Transformation Warning */}
        {crsSelection.transformationRequired && (
          <div className="info-box">
            <span className="info-icon">ℹ️</span>
            <span>Transformação de coordenadas será aplicada</span>
          </div>
        )}

        {/* Numeric Format */}
        <div className="form-group">
          <label>Formato Numérico</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="numericFormat"
                value="auto"
                checked={crsSelection.numericFormat.userSelection === 'auto'}
                onChange={() => onChange({
                  ...crsSelection,
                  numericFormat: { ...crsSelection.numericFormat, userSelection: 'auto' }
                })}
              />
              <span>Detectar automaticamente</span>
              {crsSelection.numericFormat.detected !== 'unknown' && (
                <span className="detected-hint">
                  (detectado: {crsSelection.numericFormat.detected === 'brazilian' ? 'Brasileiro' : 'Americano'})
                </span>
              )}
            </label>

            <label className="radio-option">
              <input
                type="radio"
                name="numericFormat"
                value="brazilian"
                checked={crsSelection.numericFormat.userSelection === 'brazilian'}
                onChange={() => onChange({
                  ...crsSelection,
                  numericFormat: { ...crsSelection.numericFormat, userSelection: 'brazilian' }
                })}
              />
              <span>Brasileiro (1.234.567,89)</span>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                name="numericFormat"
                value="american"
                checked={crsSelection.numericFormat.userSelection === 'american'}
                onChange={() => onChange({
                  ...crsSelection,
                  numericFormat: { ...crsSelection.numericFormat, userSelection: 'american' }
                })}
              />
              <span>Americano (1,234,567.89)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 3: MODEL TYPE
// ============================================================================

interface Step3Props {
  fileData: RawImportData | null;
  modelTypeSelection: ModelTypeSelection | null;
  onChange: (selection: ModelTypeSelection) => void;
}

const Step3ModelType: React.FC<Step3Props> = ({ fileData, modelTypeSelection, onChange }) => {
  const modelTypes = [
    { value: 'water_network', label: 'Rede de Água', icon: '💧' },
    { value: 'sewer_network', label: 'Rede de Esgoto', icon: '🚰' },
    { value: 'drainage_network', label: 'Rede de Drenagem', icon: '🌧️' },
    { value: 'pumping_network', label: 'Estação Elevatória', icon: '⚡' },
    { value: 'topography', label: 'Topografia', icon: '🗺️' },
    { value: 'bim', label: 'Modelo BIM', icon: '🏗️' },
    { value: 'gis_generic', label: 'GIS Genérico', icon: '📍' }
  ];

  const selection = modelTypeSelection || {
    modelType: 'water_network' as const,
    importMode: 'geometric' as const
  };

  return (
    <div className="step-content step3">
      <h3>Etapa 3: Tipo de Modelo</h3>

      <div className="model-type-form">
        {/* Model Type */}
        <div className="form-group">
          <label>Tipo de Rede/Modelo</label>
          <div className="model-type-grid">
            {modelTypes.map(type => (
              <button
                key={type.value}
                className={`model-type-btn ${selection.modelType === type.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...selection, modelType: type.value as any })}
              >
                <span className="icon">{type.icon}</span>
                <span className="label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Import Mode */}
        <div className="form-group">
          <label>Modo de Importação</label>
          <div className="import-mode-options">
            <label className={`mode-option ${selection.importMode === 'geometric' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="importMode"
                value="geometric"
                checked={selection.importMode === 'geometric'}
                onChange={() => onChange({ ...selection, importMode: 'geometric' })}
              />
              <div className="mode-content">
                <strong>🔷 Modo Geométrico (CAD/GIS)</strong>
                <p>Linhas → Trechos automaticamente</p>
                <p>Pontos → Nós automaticamente</p>
                <p>Conectividade por coordenadas</p>
              </div>
            </label>

            <label className={`mode-option ${selection.importMode === 'tabular' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="importMode"
                value="tabular"
                checked={selection.importMode === 'tabular'}
                onChange={() => onChange({ ...selection, importMode: 'tabular' })}
              />
              <div className="mode-content">
                <strong>📋 Modo Tabular</strong>
                <p>Usa campos Nó Início/Nó Fim</p>
                <p>Conectividade por ID</p>
                <p>Para dados estruturados</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 4: ATTRIBUTE MAPPING
// ============================================================================

interface Step4Props {
  fileData: RawImportData | null;
  attributeMapping: AttributeMapping | null;
  onChange: (mapping: AttributeMapping) => void;
}

const Step4AttributeMapping: React.FC<Step4Props> = ({ fileData, attributeMapping, onChange }) => {
  const mapping = attributeMapping || {};

  // Coletar todos os atributos disponíveis
  const availableAttributes = new Set<string>();
  fileData?.entities.forEach(e => {
    Object.keys(e.attributes).forEach(key => availableAttributes.add(key));
  });
  const attributes = Array.from(availableAttributes);

  const systemFields = [
    { key: 'id', label: 'ID', description: 'Identificador único' },
    { key: 'x', label: 'Coordenada X', description: 'Easting / Longitude' },
    { key: 'y', label: 'Coordenada Y', description: 'Northing / Latitude' },
    { key: 'z', label: 'Coordenada Z', description: 'Elevação' },
    { key: 'startNode', label: 'Nó Início', description: 'ID do nó inicial (modo tabular)' },
    { key: 'endNode', label: 'Nó Fim', description: 'ID do nó final (modo tabular)' },
    { key: 'diameter', label: 'Diâmetro', description: 'DN em mm' },
    { key: 'material', label: 'Material', description: 'Tipo de material' },
    { key: 'length', label: 'Comprimento', description: 'Em metros' },
    { key: 'slope', label: 'Declividade', description: 'Em m/m ou %' },
    { key: 'groundElevation', label: 'Cota Terreno', description: 'Elevação do terreno' },
    { key: 'invertElevation', label: 'Cota Fundo', description: 'Cota de fundo do tubo' },
    { key: 'depth', label: 'Profundidade', description: 'Profundidade em metros' }
  ];

  const updateMapping = (field: string, value: string) => {
    onChange({
      ...mapping,
      [field]: value || undefined
    });
  };

  return (
    <div className="step-content step4">
      <h3>Etapa 4: Mapeamento de Atributos</h3>

      <div className="mapping-form">
        <p className="mapping-hint">
          Associe os campos do arquivo aos campos do sistema.
          Campos não mapeados serão ignorados ou preenchidos automaticamente.
        </p>

        <table className="mapping-table">
          <thead>
            <tr>
              <th>Campo do Sistema</th>
              <th>Descrição</th>
              <th>Campo do Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {systemFields.map(field => (
              <tr key={field.key}>
                <td><strong>{field.label}</strong></td>
                <td><span className="description">{field.description}</span></td>
                <td>
                  <select
                    value={(mapping as any)[field.key] || ''}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                  >
                    <option value="">-- Não mapear --</option>
                    {attributes.map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Template Actions */}
        <div className="template-actions">
          <button className="btn-secondary" onClick={() => {
            const name = prompt('Nome do template:');
            if (name) {
              ImportEngine.saveTemplate({
                id: `template_${Date.now()}`,
                name,
                fileType: fileData?.fileType || '',
                mapping: mapping,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              alert('Template salvo!');
            }
          }}>
            💾 Salvar como Template
          </button>

          <button className="btn-secondary" onClick={() => {
            const templates = ImportEngine.getTemplatesByFileType(fileData?.fileType || '');
            if (templates.length === 0) {
              alert('Nenhum template encontrado para este tipo de arquivo.');
              return;
            }
            // Em produção, mostraria um modal para seleção
            const template = templates[0];
            onChange(template.mapping);
          }}>
            📂 Carregar Template
          </button>
        </div>

        {/* Data Preview */}
        {fileData && fileData.entities.length > 0 && (
          <div className="data-preview">
            <h4>Preview dos Dados</h4>
            <table className="preview-table">
              <thead>
                <tr>
                  {attributes.slice(0, 6).map(attr => (
                    <th key={attr}>{attr}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileData.entities.slice(0, 5).map((entity, i) => (
                  <tr key={i}>
                    {attributes.slice(0, 6).map(attr => (
                      <td key={attr}>{String(entity.attributes[attr] || '-')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportWizard;
