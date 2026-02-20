/**
 * Geometry Processor - Processamento de Geometria Linear
 *
 * Responsável por:
 * - Processar geometrias lineares e criar nodes/edges
 * - Gerar nós automaticamente nos endpoints
 * - Aplicar tolerância de snap
 * - Calcular comprimentos e declividades
 */

import { Feature, LineString, Point } from 'geojson';
import { NetworkNode, NetworkEdge, generateNodeId, generateEdgeId } from '../network/NetworkModel';

// ============================================================================
// TYPES
// ============================================================================

export interface ProcessingOptions {
  tolerance: number;           // Tolerância para snap de nós (metros)
  autoCreateNodes: boolean;    // Criar nós automaticamente nos endpoints
  calculateLength: boolean;    // Calcular comprimento automaticamente
  calculateSlope: boolean;     // Calcular declividade automaticamente
  preserveZ: boolean;          // Preservar coordenadas Z
  discipline: 'water' | 'sewer' | 'drainage' | 'pumping' | 'generic';
}

export interface ProcessingResult {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  statistics: ProcessingStatistics;
  warnings: ProcessingWarning[];
}

export interface ProcessingStatistics {
  inputFeatures: number;
  outputNodes: number;
  outputEdges: number;
  generatedNodes: number;      // Nós criados automaticamente
  reusedNodes: number;         // Nós existentes reutilizados (snap)
  totalLength: number;
  averageLength: number;
  minLength: number;
  maxLength: number;
}

export interface ProcessingWarning {
  code: string;
  message: string;
  featureId?: string;
}

// ============================================================================
// GEOMETRY PROCESSOR CLASS
// ============================================================================

class GeometryProcessorImpl {
  private defaultOptions: ProcessingOptions = {
    tolerance: 0.01,
    autoCreateNodes: true,
    calculateLength: true,
    calculateSlope: true,
    preserveZ: true,
    discipline: 'generic'
  };

  // --------------------------------------------------------------------------
  // Main Processing
  // --------------------------------------------------------------------------

  processLinearGeometry(
    features: Feature[],
    options?: Partial<ProcessingOptions>
  ): ProcessingResult {
    const opts = { ...this.defaultOptions, ...options };
    const warnings: ProcessingWarning[] = [];

    // Filtrar apenas features lineares
    const linearFeatures = features.filter(f =>
      f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
    );

    if (linearFeatures.length !== features.length) {
      warnings.push({
        code: 'NON_LINEAR_FEATURES',
        message: `${features.length - linearFeatures.length} features não-lineares foram ignoradas`
      });
    }

    // Processar geometrias
    const nodes = new Map<string, NetworkNode>();
    const edges: NetworkEdge[] = [];
    let generatedNodes = 0;
    let reusedNodes = 0;

    for (const feature of linearFeatures) {
      const lines = this.extractLineStrings(feature);

      for (const line of lines) {
        const result = this.processLine(
          line,
          feature.id?.toString() || generateEdgeId(),
          feature.properties || {},
          nodes,
          opts
        );

        if (result) {
          edges.push(result.edge);
          generatedNodes += result.newNodesCount;
          reusedNodes += result.reusedNodesCount;
        }
      }
    }

    // Calcular estatísticas
    const lengths = edges.map(e => e.length);
    const totalLength = lengths.reduce((sum, l) => sum + l, 0);

    const statistics: ProcessingStatistics = {
      inputFeatures: features.length,
      outputNodes: nodes.size,
      outputEdges: edges.length,
      generatedNodes,
      reusedNodes,
      totalLength,
      averageLength: edges.length > 0 ? totalLength / edges.length : 0,
      minLength: lengths.length > 0 ? Math.min(...lengths) : 0,
      maxLength: lengths.length > 0 ? Math.max(...lengths) : 0
    };

    return {
      nodes: Array.from(nodes.values()),
      edges,
      statistics,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // Line Processing
  // --------------------------------------------------------------------------

  private extractLineStrings(feature: Feature): LineString[] {
    if (feature.geometry.type === 'LineString') {
      return [feature.geometry as LineString];
    }

    if (feature.geometry.type === 'MultiLineString') {
      return (feature.geometry as any).coordinates.map((coords: number[][]) => ({
        type: 'LineString',
        coordinates: coords
      }));
    }

    return [];
  }

  private processLine(
    line: LineString,
    featureId: string,
    properties: Record<string, any>,
    nodeMap: Map<string, NetworkNode>,
    options: ProcessingOptions
  ): { edge: NetworkEdge; newNodesCount: number; reusedNodesCount: number } | null {
    const coords = line.coordinates;

    if (coords.length < 2) {
      return null;
    }

    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    let newNodesCount = 0;
    let reusedNodesCount = 0;

    // Encontrar ou criar nó inicial
    let startNode = this.findNodeByCoord(nodeMap, startCoord, options.tolerance);
    if (!startNode && options.autoCreateNodes) {
      startNode = this.createNode(startCoord, options);
      nodeMap.set(startNode.id, startNode);
      newNodesCount++;
    } else if (startNode) {
      reusedNodesCount++;
    }

    // Encontrar ou criar nó final
    let endNode = this.findNodeByCoord(nodeMap, endCoord, options.tolerance);
    if (!endNode && options.autoCreateNodes) {
      endNode = this.createNode(endCoord, options);
      nodeMap.set(endNode.id, endNode);
      newNodesCount++;
    } else if (endNode) {
      reusedNodesCount++;
    }

    if (!startNode || !endNode) {
      return null;
    }

    // Calcular comprimento
    const length = options.calculateLength ? this.calculateLength(coords) : 0;

    // Calcular declividade
    let slope = 0;
    if (options.calculateSlope && length > 0) {
      const startZ = startCoord[2] || 0;
      const endZ = endCoord[2] || 0;
      slope = (startZ - endZ) / length;
    }

    // Criar edge
    const edge: NetworkEdge = {
      id: featureId,
      startNodeId: startNode.id,
      endNodeId: endNode.id,
      geometry: line,
      dn: properties.diameter || properties.dn || properties.DN || 0,
      length,
      slope,
      material: properties.material || properties.MATERIAL || '',
      type: 'pipe',
      attributes: properties
    };

    // Atualizar conexões nos nós
    startNode.connectedEdges.push(edge.id);
    endNode.connectedEdges.push(edge.id);

    return { edge, newNodesCount, reusedNodesCount };
  }

  // --------------------------------------------------------------------------
  // Node Operations
  // --------------------------------------------------------------------------

  private findNodeByCoord(
    nodeMap: Map<string, NetworkNode>,
    coord: number[],
    tolerance: number
  ): NetworkNode | null {
    for (const node of nodeMap.values()) {
      const distance = this.distance2D(node.x, node.y, coord[0], coord[1]);
      if (distance <= tolerance) {
        return node;
      }
    }
    return null;
  }

  private createNode(coord: number[], options: ProcessingOptions): NetworkNode {
    const z = options.preserveZ ? (coord[2] || 0) : 0;

    return {
      id: generateNodeId(),
      x: coord[0],
      y: coord[1],
      z,
      type: 'junction',
      groundElevation: z,
      invertElevation: z,
      depth: 0,
      connectedEdges: [],
      attributes: {}
    };
  }

  // --------------------------------------------------------------------------
  // Geometry Calculations
  // --------------------------------------------------------------------------

  calculateLength(coords: number[][]): number {
    let length = 0;

    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      const dz = (coords[i][2] || 0) - (coords[i - 1][2] || 0);

      // Comprimento 3D
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return length;
  }

  calculateLength2D(coords: number[][]): number {
    let length = 0;

    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];

      length += Math.sqrt(dx * dx + dy * dy);
    }

    return length;
  }

  private distance2D(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  distance3D(p1: number[], p2: number[]): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = (p2[2] || 0) - (p1[2] || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // --------------------------------------------------------------------------
  // Point Processing
  // --------------------------------------------------------------------------

  processPointGeometry(
    features: Feature[],
    options?: Partial<ProcessingOptions>
  ): { nodes: NetworkNode[]; warnings: ProcessingWarning[] } {
    const opts = { ...this.defaultOptions, ...options };
    const warnings: ProcessingWarning[] = [];
    const nodes: NetworkNode[] = [];

    // Filtrar apenas features de ponto
    const pointFeatures = features.filter(f =>
      f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint'
    );

    if (pointFeatures.length !== features.length) {
      warnings.push({
        code: 'NON_POINT_FEATURES',
        message: `${features.length - pointFeatures.length} features não-pontuais foram ignoradas`
      });
    }

    for (const feature of pointFeatures) {
      const points = this.extractPoints(feature);

      for (const point of points) {
        const coord = point.coordinates;
        const node: NetworkNode = {
          id: feature.id?.toString() || generateNodeId(),
          x: coord[0],
          y: coord[1],
          z: opts.preserveZ ? (coord[2] || 0) : 0,
          type: this.inferNodeType(feature.properties),
          groundElevation: coord[2] || feature.properties?.groundElevation || 0,
          invertElevation: coord[2] || feature.properties?.invertElevation || 0,
          depth: feature.properties?.depth || 0,
          connectedEdges: [],
          attributes: feature.properties || {}
        };

        nodes.push(node);
      }
    }

    return { nodes, warnings };
  }

  private extractPoints(feature: Feature): Point[] {
    if (feature.geometry.type === 'Point') {
      return [feature.geometry as Point];
    }

    if (feature.geometry.type === 'MultiPoint') {
      return (feature.geometry as any).coordinates.map((coord: number[]) => ({
        type: 'Point',
        coordinates: coord
      }));
    }

    return [];
  }

  private inferNodeType(properties: Record<string, any> | null): NetworkNode['type'] {
    if (!properties) return 'junction';

    const type = (properties.type || properties.TYPE || '').toLowerCase();

    if (type.includes('reservoir')) return 'reservoir';
    if (type.includes('tank')) return 'tank';
    if (type.includes('manhole') || type.includes('pv')) return 'manhole';
    if (type.includes('outfall') || type.includes('descarga')) return 'outfall';

    return 'junction';
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  simplifyLine(coords: number[][], tolerance: number): number[][] {
    // Implementação do algoritmo Douglas-Peucker
    if (coords.length <= 2) return coords;

    const result = this.douglasPeucker(coords, tolerance);
    return result;
  }

  private douglasPeucker(coords: number[][], tolerance: number): number[][] {
    if (coords.length <= 2) return coords;

    let maxDistance = 0;
    let maxIndex = 0;

    const start = coords[0];
    const end = coords[coords.length - 1];

    for (let i = 1; i < coords.length - 1; i++) {
      const distance = this.perpendicularDistance(coords[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(coords.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(coords.slice(maxIndex), tolerance);

      return left.slice(0, -1).concat(right);
    }

    return [start, end];
  }

  private perpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];

    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return this.distance2D(point[0], point[1], lineStart[0], lineStart[1]);

    const u = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (mag * mag);

    let closestX: number, closestY: number;

    if (u < 0) {
      closestX = lineStart[0];
      closestY = lineStart[1];
    } else if (u > 1) {
      closestX = lineEnd[0];
      closestY = lineEnd[1];
    } else {
      closestX = lineStart[0] + u * dx;
      closestY = lineStart[1] + u * dy;
    }

    return this.distance2D(point[0], point[1], closestX, closestY);
  }

  densifyLine(coords: number[][], maxSegmentLength: number): number[][] {
    if (coords.length < 2) return coords;

    const result: number[][] = [coords[0]];

    for (let i = 1; i < coords.length; i++) {
      const start = coords[i - 1];
      const end = coords[i];
      const segmentLength = this.distance3D(start, end);

      if (segmentLength > maxSegmentLength) {
        const numSegments = Math.ceil(segmentLength / maxSegmentLength);

        for (let j = 1; j < numSegments; j++) {
          const t = j / numSegments;
          const x = start[0] + t * (end[0] - start[0]);
          const y = start[1] + t * (end[1] - start[1]);
          const z = (start[2] || 0) + t * ((end[2] || 0) - (start[2] || 0));
          result.push([x, y, z]);
        }
      }

      result.push(end);
    }

    return result;
  }

  calculateBoundingBox(coords: number[][]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const coord of coords) {
      minX = Math.min(minX, coord[0]);
      maxX = Math.max(maxX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxY = Math.max(maxY, coord[1]);
      minZ = Math.min(minZ, coord[2] || 0);
      maxZ = Math.max(maxZ, coord[2] || 0);
    }

    return { minX, minY, maxX, maxY, minZ, maxZ };
  }
}

// Singleton instance
export const GeometryProcessor = new GeometryProcessorImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function processLines(
  features: Feature[],
  tolerance?: number
): ProcessingResult {
  return GeometryProcessor.processLinearGeometry(features, { tolerance });
}

export function processPoints(
  features: Feature[]
): { nodes: NetworkNode[]; warnings: ProcessingWarning[] } {
  return GeometryProcessor.processPointGeometry(features);
}

export function calculateLineLength(coords: number[][]): number {
  return GeometryProcessor.calculateLength(coords);
}
