/**
 * Import Engine - Motor de Importação Principal
 *
 * Fluxo obrigatório:
 * Arquivo → ImportEngine → Modelo Interno (nodes/edges) → EPANET PRO
 *
 * O EPANET PRO NÃO PODE:
 * - Fazer parsing de arquivo externo
 * - Fazer interpretação de DXF
 * - Fazer leitura de IFC
 */

import { Feature, LineString, Point } from 'geojson';
import { NetworkNode, NetworkEdge, DrawingLayer } from '../network/NetworkModel';
import { SHPReader } from './readers/SHPReader';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RawImportData {
  fileType: 'IFC' | 'DWG' | 'DXF' | 'SHP' | 'GeoJSON' | 'CSV' | 'TXT' | 'INP' | 'SWMM';
  fileName: string;
  fileSize: number;
  rawContent: any;
  entities: RawEntity[];
  metadata: ImportMetadata;
}

export interface RawEntity {
  id: string;
  type: string;           // Ex: "LWPOLYLINE", "POINT", "INSERT", "IfcPipe"
  geometry: any;
  attributes: Record<string, any>;
  layer?: string;
}

export interface ImportMetadata {
  detectedCRS: string | null;
  detectedUnit: string | null;
  hasZ: boolean;
  geometryType: 'point' | 'line' | 'polygon' | 'mixed';
  entityTypes: EntityTypeInfo[];
  numericFormat: 'brazilian' | 'american' | 'unknown';
  totalEntities: number;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface EntityTypeInfo {
  type: string;
  count: number;
  suggestedImportAs: 'edge' | 'node' | 'drawing' | 'ignore';
  hasZ: boolean;
  sampleAttributes: string[];
}

export interface AttributeMapping {
  // Campos básicos
  id?: string;
  x?: string;
  y?: string;
  z?: string;

  // Campos de conectividade (apenas modo tabular)
  startNode?: string;
  endNode?: string;

  // Campos de rede
  diameter?: string;
  material?: string;
  length?: string;
  slope?: string;
  groundElevation?: string;
  invertElevation?: string;
  depth?: string;

  // Campos adicionais personalizados
  customFields?: Record<string, string>;

  // Template salvo
  templateName?: string;
}

export interface MappingTemplate {
  id: string;
  name: string;
  fileType: string;
  mapping: AttributeMapping;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalModel {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  drawingLayers: DrawingLayer[];
}

export interface ImportOptions {
  modelType: 'water_network' | 'sewer_network' | 'drainage_network' |
             'pumping_network' | 'topography' | 'bim' | 'gis_generic';
  importMode: 'geometric' | 'tabular';
  targetCRS: string;
  sourceCRS?: string;
  numericFormat: 'brazilian' | 'american' | 'auto';
  tolerance: number;  // Para snap de nós
  entityTypeMapping: Record<string, 'edge' | 'node' | 'drawing' | 'ignore'>;
}

export interface ImportResult {
  success: boolean;
  model: InternalModel;
  warnings: ImportWarning[];
  errors: ImportError[];
  statistics: ImportStatistics;
}

export interface ImportWarning {
  code: string;
  message: string;
  entityId?: string;
  suggestion?: string;
}

export interface ImportError {
  code: string;
  message: string;
  entityId?: string;
  fatal: boolean;
}

export interface ImportStatistics {
  totalEntities: number;
  importedNodes: number;
  importedEdges: number;
  importedDrawings: number;
  ignoredEntities: number;
  generatedNodes: number;  // Nós criados automaticamente em endpoints
  processingTime: number;
}

// ============================================================================
// IMPORT ENGINE CLASS
// ============================================================================

class ImportEngineImpl {
  private templates: Map<string, MappingTemplate> = new Map();

  // --------------------------------------------------------------------------
  // File Detection (Step 1)
  // --------------------------------------------------------------------------

  async detectFile(file: File): Promise<RawImportData> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const fileType = this.getFileType(extension);

    // Ler conteúdo baseado no tipo
    const rawContent = await this.readFileContent(file, fileType);

    // Extrair entidades
    const entities = await this.extractEntities(rawContent, fileType);

    // Detectar metadata
    const metadata = this.analyzeMetadata(entities, rawContent, fileType);

    return {
      fileType,
      fileName: file.name,
      fileSize: file.size,
      rawContent,
      entities,
      metadata
    };
  }

  async detectFiles(files: File[]): Promise<RawImportData> {
    // Encontrar arquivo principal (não auxiliar de shapefile)
    const mainFile = files.find(f =>
      !f.name.match(/\.(shx|dbf|prj)$/i)
    ) || files[0];

    const extension = mainFile.name.split('.').pop()?.toLowerCase();

    // Para SHP, usar SHPReader diretamente com todos os arquivos
    if (extension === 'shp') {
      return SHPReader.read(files);
    }

    // Para outros tipos, usar detectFile existente
    return this.detectFile(mainFile);
  }

  private getFileType(extension?: string): RawImportData['fileType'] {
    const typeMap: Record<string, RawImportData['fileType']> = {
      'ifc': 'IFC',
      'dwg': 'DWG',
      'dxf': 'DXF',
      'shp': 'SHP',
      'geojson': 'GeoJSON',
      'json': 'GeoJSON',
      'csv': 'CSV',
      'txt': 'TXT',
      'inp': 'INP'
    };
    return typeMap[extension || ''] || 'TXT';
  }

  private async readFileContent(file: File, fileType: string): Promise<any> {
    // Implementação específica por tipo de arquivo
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = (e) => {
        const content = e.target?.result;

        switch (fileType) {
          case 'GeoJSON':
            resolve(JSON.parse(content as string));
            break;
          case 'CSV':
          case 'TXT':
          case 'INP':
          case 'DXF':
            resolve(content as string);
            break;
          default:
            resolve(content);
        }
      };
      reader.onerror = reject;

      if (['DWG', 'IFC', 'SHP'].includes(fileType)) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  private async extractEntities(rawContent: any, fileType: string): Promise<RawEntity[]> {
    // Delegar para readers específicos
    switch (fileType) {
      case 'GeoJSON':
        return this.extractGeoJSONEntities(rawContent);
      case 'CSV':
        return this.extractCSVEntities(rawContent);
      case 'DXF':
        return this.extractDXFEntities(rawContent);
      case 'INP':
        return this.extractINPEntities(rawContent);
      case 'SHP':
        // Para SHP, entities já vêm processadas pelo SHPReader via detectFiles()
        // Se rawContent.entities existe, retornar diretamente
        return rawContent.entities || [];
      default:
        return [];
    }
  }

  private extractGeoJSONEntities(content: any): RawEntity[] {
    if (content.type !== 'FeatureCollection') return [];

    return content.features.map((f: Feature, i: number) => ({
      id: f.id?.toString() || `feature_${i}`,
      type: f.geometry.type,
      geometry: f.geometry,
      attributes: f.properties || {},
      layer: f.properties?.layer || 'default'
    }));
  }

  private extractCSVEntities(content: string): RawEntity[] {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[,;\t]/).map(h => h.trim());
    const entities: RawEntity[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;\t]/).map(v => v.trim());
      const attributes: Record<string, any> = {};

      headers.forEach((h, j) => {
        attributes[h] = values[j];
      });

      entities.push({
        id: `row_${i}`,
        type: 'CSV_ROW',
        geometry: null,
        attributes
      });
    }

    return entities;
  }

  private extractDXFEntities(content: string): RawEntity[] {
    // Parser DXF simplificado
    const entities: RawEntity[] = [];
    const entityPattern = /\s*0\n(\w+)\n([\s\S]*?)(?=\s*0\n(?:ENDSEC|EOF|\w+)\n|$)/g;

    let match;
    let id = 0;

    while ((match = entityPattern.exec(content)) !== null) {
      const entityType = match[1];
      const entityData = match[2];

      if (['LINE', 'LWPOLYLINE', 'POLYLINE', 'POINT', 'CIRCLE', 'ARC', 'INSERT'].includes(entityType)) {
        entities.push({
          id: `dxf_${id++}`,
          type: entityType,
          geometry: this.parseDXFGeometry(entityType, entityData),
          attributes: this.parseDXFAttributes(entityData),
          layer: this.extractDXFLayer(entityData)
        });
      }
    }

    return entities;
  }

  private parseDXFGeometry(type: string, data: string): any {
    // Parser simplificado - implementação completa nos readers específicos
    const coords: number[][] = [];
    const xPattern = /\s*10\n([\d.-]+)/g;
    const yPattern = /\s*20\n([\d.-]+)/g;
    const zPattern = /\s*30\n([\d.-]+)/g;

    const xMatches = [...data.matchAll(xPattern)];
    const yMatches = [...data.matchAll(yPattern)];
    const zMatches = [...data.matchAll(zPattern)];

    for (let i = 0; i < xMatches.length; i++) {
      coords.push([
        parseFloat(xMatches[i][1]),
        parseFloat(yMatches[i]?.[1] || '0'),
        parseFloat(zMatches[i]?.[1] || '0')
      ]);
    }

    if (type === 'POINT') {
      return { type: 'Point', coordinates: coords[0] || [0, 0, 0] };
    }

    return { type: 'LineString', coordinates: coords };
  }

  private parseDXFAttributes(data: string): Record<string, any> {
    const attributes: Record<string, any> = {};

    // Extrair atributos comuns
    const handleMatch = data.match(/\s*5\n(\w+)/);
    if (handleMatch) attributes.handle = handleMatch[1];

    const colorMatch = data.match(/\s*62\n(\d+)/);
    if (colorMatch) attributes.color = parseInt(colorMatch[1]);

    return attributes;
  }

  private extractDXFLayer(data: string): string {
    const layerMatch = data.match(/\s*8\n(.+)/);
    return layerMatch ? layerMatch[1].trim() : 'default';
  }

  private extractINPEntities(content: string): RawEntity[] {
    // Parser para arquivos EPANET INP
    const entities: RawEntity[] = [];
    const sections: Record<string, string[]> = {};

    let currentSection = '';
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        sections[currentSection] = [];
      } else if (currentSection && trimmed && !trimmed.startsWith(';')) {
        sections[currentSection].push(trimmed);
      }
    }

    // Processar JUNCTIONS
    if (sections['JUNCTIONS']) {
      sections['JUNCTIONS'].forEach((line, i) => {
        const parts = line.split(/\s+/);
        entities.push({
          id: parts[0],
          type: 'JUNCTION',
          geometry: null,
          attributes: {
            elevation: parseFloat(parts[1]) || 0,
            demand: parseFloat(parts[2]) || 0,
            pattern: parts[3] || ''
          }
        });
      });
    }

    // Processar PIPES
    if (sections['PIPES']) {
      sections['PIPES'].forEach((line, i) => {
        const parts = line.split(/\s+/);
        entities.push({
          id: parts[0],
          type: 'PIPE',
          geometry: null,
          attributes: {
            node1: parts[1],
            node2: parts[2],
            length: parseFloat(parts[3]) || 0,
            diameter: parseFloat(parts[4]) || 0,
            roughness: parseFloat(parts[5]) || 0,
            minorloss: parseFloat(parts[6]) || 0,
            status: parts[7] || 'OPEN'
          }
        });
      });
    }

    // Processar COORDINATES
    if (sections['COORDINATES']) {
      sections['COORDINATES'].forEach(line => {
        const parts = line.split(/\s+/);
        const nodeId = parts[0];
        const entity = entities.find(e => e.id === nodeId);
        if (entity) {
          entity.geometry = {
            type: 'Point',
            coordinates: [parseFloat(parts[1]), parseFloat(parts[2]), entity.attributes.elevation || 0]
          };
        }
      });
    }

    return entities;
  }

  private analyzeMetadata(entities: RawEntity[], rawContent: any, fileType: string): ImportMetadata {
    const entityTypes = this.groupEntityTypes(entities);
    const hasZ = entities.some(e =>
      e.geometry?.coordinates?.[2] !== undefined ||
      (Array.isArray(e.geometry?.coordinates?.[0]) && e.geometry.coordinates[0][2] !== undefined)
    );

    const geometryTypes = new Set(entities.map(e => e.geometry?.type).filter(Boolean));
    let geometryType: ImportMetadata['geometryType'] = 'mixed';
    if (geometryTypes.size === 1) {
      const type = [...geometryTypes][0];
      if (type === 'Point') geometryType = 'point';
      else if (type === 'LineString') geometryType = 'line';
      else if (type === 'Polygon') geometryType = 'polygon';
    }

    return {
      detectedCRS: this.detectCRS(rawContent, fileType),
      detectedUnit: this.detectUnit(entities),
      hasZ,
      geometryType,
      entityTypes,
      numericFormat: this.detectNumericFormat(entities),
      totalEntities: entities.length,
      boundingBox: this.calculateBoundingBox(entities)
    };
  }

  private groupEntityTypes(entities: RawEntity[]): EntityTypeInfo[] {
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
      suggestedImportAs: this.suggestImportType(type, items),
      hasZ: items.some(e => e.geometry?.coordinates?.[2] !== undefined),
      sampleAttributes: this.getSampleAttributes(items)
    }));
  }

  private suggestImportType(type: string, items: RawEntity[]): EntityTypeInfo['suggestedImportAs'] {
    const lineTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'PIPE', 'CONDUIT', 'LineString'];
    const pointTypes = ['POINT', 'JUNCTION', 'RESERVOIR', 'TANK', 'MANHOLE', 'OUTFALL', 'Point'];
    const drawingTypes = ['TEXT', 'MTEXT', 'DIMENSION', 'HATCH', 'INSERT'];

    if (lineTypes.includes(type)) return 'edge';
    if (pointTypes.includes(type)) return 'node';
    if (drawingTypes.includes(type)) return 'drawing';
    return 'ignore';
  }

  private getSampleAttributes(items: RawEntity[]): string[] {
    const attrs = new Set<string>();
    items.slice(0, 5).forEach(item => {
      Object.keys(item.attributes).forEach(key => attrs.add(key));
    });
    return Array.from(attrs);
  }

  private detectCRS(rawContent: any, fileType: string): string | null {
    if (fileType === 'GeoJSON' && rawContent.crs) {
      return rawContent.crs.properties?.name || null;
    }
    return null;
  }

  private detectUnit(entities: RawEntity[]): string | null {
    // Analisar magnitude das coordenadas para inferir unidade
    const coords = entities
      .filter(e => e.geometry?.coordinates)
      .flatMap(e => {
        const c = e.geometry.coordinates;
        return Array.isArray(c[0]) ? c : [c];
      });

    if (coords.length === 0) return null;

    const avgX = coords.reduce((sum, c) => sum + Math.abs(c[0]), 0) / coords.length;

    if (avgX > 100000) return 'meters';  // Provavelmente UTM
    if (avgX < 180) return 'degrees';     // Provavelmente graus
    return null;
  }

  private detectNumericFormat(entities: RawEntity[]): ImportMetadata['numericFormat'] {
    // Analisar valores textuais para detectar formato
    for (const entity of entities) {
      for (const value of Object.values(entity.attributes)) {
        if (typeof value === 'string') {
          // Brasileiro: 1.234.567,89
          if (/^\d{1,3}(\.\d{3})*,\d+$/.test(value)) return 'brazilian';
          // Americano: 1,234,567.89
          if (/^\d{1,3}(,\d{3})*\.\d+$/.test(value)) return 'american';
        }
      }
    }
    return 'unknown';
  }

  private calculateBoundingBox(entities: RawEntity[]): ImportMetadata['boundingBox'] {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const processCoord = (coord: number[]) => {
      if (coord[0] < minX) minX = coord[0];
      if (coord[1] < minY) minY = coord[1];
      if (coord[0] > maxX) maxX = coord[0];
      if (coord[1] > maxY) maxY = coord[1];
    };

    entities.forEach(e => {
      if (!e.geometry?.coordinates) return;
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
  // Conversion to Internal Model (Step 4)
  // --------------------------------------------------------------------------

  convertToInternalModel(
    data: RawImportData,
    mapping: AttributeMapping,
    options: ImportOptions
  ): ImportResult {
    const startTime = Date.now();
    const warnings: ImportWarning[] = [];
    const errors: ImportError[] = [];

    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    const drawingLayers: DrawingLayer[] = [];

    let generatedNodes = 0;
    let ignoredEntities = 0;

    // Mapa para snap de nós
    const nodeMap = new Map<string, NetworkNode>();

    for (const entity of data.entities) {
      const importAs = options.entityTypeMapping[entity.type] || 'ignore';

      switch (importAs) {
        case 'node':
          const node = this.createNodeFromEntity(entity, mapping, options);
          if (node) {
            nodes.push(node);
            nodeMap.set(node.id, node);
          }
          break;

        case 'edge':
          if (options.importMode === 'geometric') {
            const result = this.createEdgeWithNodesFromEntity(
              entity, mapping, options, nodeMap
            );
            if (result) {
              edges.push(result.edge);
              result.newNodes.forEach(n => {
                nodes.push(n);
                nodeMap.set(n.id, n);
                generatedNodes++;
              });
            }
          } else {
            const edge = this.createEdgeFromEntity(entity, mapping, options);
            if (edge) edges.push(edge);
          }
          break;

        case 'drawing':
          // Adicionar a drawing layer (não entra na simulação)
          const drawingLayer = drawingLayers.find(l => l.name === (entity.layer || 'drawing'));
          if (drawingLayer) {
            drawingLayer.features.push({
              type: 'Feature',
              id: entity.id,
              geometry: entity.geometry,
              properties: entity.attributes
            });
          } else {
            drawingLayers.push({
              id: `drawing_${entity.layer || 'default'}`,
              name: entity.layer || 'drawing',
              features: [{
                type: 'Feature',
                id: entity.id,
                geometry: entity.geometry,
                properties: entity.attributes
              }]
            });
          }
          break;

        case 'ignore':
        default:
          ignoredEntities++;
          break;
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      success: errors.filter(e => e.fatal).length === 0,
      model: { nodes, edges, drawingLayers },
      warnings,
      errors,
      statistics: {
        totalEntities: data.entities.length,
        importedNodes: nodes.length,
        importedEdges: edges.length,
        importedDrawings: drawingLayers.reduce((sum, l) => sum + l.features.length, 0),
        ignoredEntities,
        generatedNodes,
        processingTime
      }
    };
  }

  private createNodeFromEntity(
    entity: RawEntity,
    mapping: AttributeMapping,
    options: ImportOptions
  ): NetworkNode | null {
    if (!entity.geometry?.coordinates) return null;

    const coords = entity.geometry.coordinates;

    return {
      id: entity.id,
      x: coords[0],
      y: coords[1],
      z: coords[2] || this.getMappedValue(entity.attributes, mapping.z, 0),
      type: this.inferNodeType(entity.type),
      groundElevation: this.getMappedValue(entity.attributes, mapping.groundElevation, coords[2] || 0),
      invertElevation: this.getMappedValue(entity.attributes, mapping.invertElevation, coords[2] || 0),
      depth: this.getMappedValue(entity.attributes, mapping.depth, 0),
      connectedEdges: [],
      attributes: entity.attributes
    };
  }

  private createEdgeFromEntity(
    entity: RawEntity,
    mapping: AttributeMapping,
    options: ImportOptions
  ): NetworkEdge | null {
    return {
      id: entity.id,
      startNodeId: this.getMappedValue(entity.attributes, mapping.startNode, ''),
      endNodeId: this.getMappedValue(entity.attributes, mapping.endNode, ''),
      geometry: entity.geometry as LineString,
      dn: this.getMappedValue(entity.attributes, mapping.diameter, 0),
      length: this.getMappedValue(entity.attributes, mapping.length, 0),
      slope: this.getMappedValue(entity.attributes, mapping.slope, 0),
      material: this.getMappedValue(entity.attributes, mapping.material, ''),
      type: 'pipe',
      attributes: entity.attributes
    };
  }

  private createEdgeWithNodesFromEntity(
    entity: RawEntity,
    mapping: AttributeMapping,
    options: ImportOptions,
    nodeMap: Map<string, NetworkNode>
  ): { edge: NetworkEdge; newNodes: NetworkNode[] } | null {
    if (!entity.geometry?.coordinates || entity.geometry.coordinates.length < 2) {
      return null;
    }

    const coords = entity.geometry.coordinates as number[][];
    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];
    const newNodes: NetworkNode[] = [];

    // Encontrar ou criar nó inicial
    let startNode = this.findNodeByCoord(nodeMap, startCoord, options.tolerance);
    if (!startNode) {
      startNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: startCoord[0],
        y: startCoord[1],
        z: startCoord[2] || 0,
        type: 'junction',
        groundElevation: startCoord[2] || 0,
        invertElevation: startCoord[2] || 0,
        depth: 0,
        connectedEdges: [],
        attributes: {}
      };
      nodeMap.set(startNode.id, startNode);
      newNodes.push(startNode);
    }

    // Encontrar ou criar nó final
    let endNode = this.findNodeByCoord(nodeMap, endCoord, options.tolerance);
    if (!endNode) {
      endNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: endCoord[0],
        y: endCoord[1],
        z: endCoord[2] || 0,
        type: 'junction',
        groundElevation: endCoord[2] || 0,
        invertElevation: endCoord[2] || 0,
        depth: 0,
        connectedEdges: [],
        attributes: {}
      };
      nodeMap.set(endNode.id, endNode);
      newNodes.push(endNode);
    }

    // Calcular comprimento
    const length = this.calculateLineLength(coords);

    // Calcular declividade
    const slope = coords.length >= 2 && startCoord[2] !== undefined && endCoord[2] !== undefined
      ? (startCoord[2] - endCoord[2]) / length
      : 0;

    const edge: NetworkEdge = {
      id: entity.id,
      startNodeId: startNode.id,
      endNodeId: endNode.id,
      geometry: entity.geometry as LineString,
      dn: this.getMappedValue(entity.attributes, mapping.diameter, 0),
      length,
      slope,
      material: this.getMappedValue(entity.attributes, mapping.material, ''),
      type: 'pipe',
      attributes: entity.attributes
    };

    // Atualizar nós com conexões
    startNode.connectedEdges.push(edge.id);
    endNode.connectedEdges.push(edge.id);

    return { edge, newNodes };
  }

  private findNodeByCoord(
    nodeMap: Map<string, NetworkNode>,
    coord: number[],
    tolerance: number
  ): NetworkNode | null {
    for (const node of nodeMap.values()) {
      const distance = Math.sqrt(
        Math.pow(node.x - coord[0], 2) +
        Math.pow(node.y - coord[1], 2)
      );
      if (distance <= tolerance) {
        return node;
      }
    }
    return null;
  }

  private calculateLineLength(coords: number[][]): number {
    let length = 0;
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      const dz = (coords[i][2] || 0) - (coords[i - 1][2] || 0);
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return length;
  }

  private getMappedValue<T>(attributes: Record<string, any>, field: string | undefined, defaultValue: T): T {
    if (!field) return defaultValue;
    const value = attributes[field];
    if (value === undefined || value === null) return defaultValue;
    return value as T;
  }

  private inferNodeType(entityType: string): NetworkNode['type'] {
    const typeMap: Record<string, NetworkNode['type']> = {
      'JUNCTION': 'junction',
      'RESERVOIR': 'reservoir',
      'TANK': 'tank',
      'MANHOLE': 'manhole',
      'OUTFALL': 'outfall'
    };
    return typeMap[entityType] || 'junction';
  }

  // --------------------------------------------------------------------------
  // Template Management
  // --------------------------------------------------------------------------

  saveTemplate(template: MappingTemplate): void {
    this.templates.set(template.id, template);
    this.persistTemplates();
  }

  getTemplate(id: string): MappingTemplate | undefined {
    return this.templates.get(id);
  }

  getTemplatesByFileType(fileType: string): MappingTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.fileType === fileType);
  }

  deleteTemplate(id: string): void {
    this.templates.delete(id);
    this.persistTemplates();
  }

  private persistTemplates(): void {
    try {
      localStorage.setItem('importTemplates', JSON.stringify(Array.from(this.templates.entries())));
    } catch (e) {
      console.warn('Não foi possível salvar templates:', e);
    }
  }

  loadTemplates(): void {
    try {
      const stored = localStorage.getItem('importTemplates');
      if (stored) {
        const entries = JSON.parse(stored);
        this.templates = new Map(entries);
      }
    } catch (e) {
      console.warn('Não foi possível carregar templates:', e);
    }
  }
}

// Singleton instance
export const ImportEngine = new ImportEngineImpl();
