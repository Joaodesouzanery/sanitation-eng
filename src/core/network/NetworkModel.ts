/**
 * Network Model - Modelo de Dados da Rede (Topologia Real)
 *
 * Este modelo representa a estrutura topológica real da rede,
 * com nós e trechos conectados espacialmente.
 */

import { Feature, LineString, Point } from 'geojson';

// ============================================================================
// NODE INTERFACES
// ============================================================================

export interface NetworkNode {
  id: string;
  x: number;
  y: number;
  z: number;                        // Cota REAL, não apenas campo

  type: 'junction' | 'reservoir' | 'tank' | 'manhole' | 'outfall';

  groundElevation: number;          // Cota terreno
  invertElevation: number;          // Cota fundo/tubo
  depth: number;                    // Profundidade

  connectedEdges: string[];         // IDs dos trechos conectados

  // Atributos específicos por tipo
  demand?: number;                  // Para junction (água)
  pattern?: string;                 // Padrão de demanda
  head?: number;                    // Para reservoir
  initialLevel?: number;            // Para tank
  minLevel?: number;                // Para tank
  maxLevel?: number;                // Para tank
  rimElevation?: number;            // Para manhole (esgoto)

  attributes: Record<string, any>;  // Atributos customizados
}

export interface NodeStyle {
  color: string;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
  label?: string;
}

// ============================================================================
// EDGE INTERFACES
// ============================================================================

export interface NetworkEdge {
  id: string;
  startNodeId: string;
  endNodeId: string;

  geometry: LineString;             // Vértices intermediários

  dn: number;                       // Diâmetro nominal (mm)
  length: number;                   // Calculado automaticamente (m)
  slope: number;                    // Declividade (m/m ou %)

  material: string;                 // Material do tubo
  type: 'pipe' | 'pump' | 'valve' | 'conduit';

  // Atributos hidráulicos
  roughness?: number;               // Coeficiente de rugosidade
  minorloss?: number;               // Perda de carga localizada
  status?: 'OPEN' | 'CLOSED' | 'CV';

  // Para bombas
  pumpCurve?: string;
  speed?: number;

  // Para válvulas
  valveType?: 'PRV' | 'PSV' | 'PBV' | 'FCV' | 'TCV' | 'GPV';
  setting?: number;

  attributes: Record<string, any>;  // Atributos customizados
}

export interface EdgeStyle {
  color: string;
  width: number;
  pattern: 'solid' | 'dashed' | 'dotted';
  label?: string;
}

// ============================================================================
// DRAWING LAYER (NÃO ENTRA NA SIMULAÇÃO)
// ============================================================================

export interface DrawingLayer {
  id: string;
  name: string;
  features: Feature[];
  // NÃO entra no EPANET
  // NÃO entra no SWMM
  // Apenas visual
}

// ============================================================================
// NETWORK MODEL CLASS
// ============================================================================

class NetworkModelImpl {
  private nodes: Map<string, NetworkNode> = new Map();
  private edges: Map<string, NetworkEdge> = new Map();
  private listeners: Set<() => void> = new Set();

  // --------------------------------------------------------------------------
  // Node Operations
  // --------------------------------------------------------------------------

  addNode(node: NetworkNode): void {
    this.nodes.set(node.id, node);
    this.notifyListeners();
  }

  getNode(id: string): NetworkNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): NetworkNode[] {
    return Array.from(this.nodes.values());
  }

  getNodesByType(type: NetworkNode['type']): NetworkNode[] {
    return this.getAllNodes().filter(n => n.type === type);
  }

  updateNode(id: string, updates: Partial<NetworkNode>): void {
    const node = this.nodes.get(id);
    if (node) {
      Object.assign(node, updates);
      this.notifyListeners();
    }
  }

  removeNode(id: string): { success: boolean; connectedEdges: string[] } {
    const node = this.nodes.get(id);
    if (!node) {
      return { success: false, connectedEdges: [] };
    }

    const connectedEdges = [...node.connectedEdges];
    this.nodes.delete(id);
    this.notifyListeners();

    return { success: true, connectedEdges };
  }

  // --------------------------------------------------------------------------
  // Edge Operations
  // --------------------------------------------------------------------------

  addEdge(edge: NetworkEdge): void {
    // Calcular comprimento automaticamente se não fornecido
    if (!edge.length || edge.length === 0) {
      edge.length = this.calculateEdgeLength(edge);
    }

    // Calcular declividade automaticamente
    const startNode = this.nodes.get(edge.startNodeId);
    const endNode = this.nodes.get(edge.endNodeId);
    if (startNode && endNode && edge.length > 0) {
      edge.slope = (startNode.z - endNode.z) / edge.length;
    }

    // Atualizar conexões nos nós
    if (startNode) {
      startNode.connectedEdges.push(edge.id);
    }
    if (endNode) {
      endNode.connectedEdges.push(edge.id);
    }

    this.edges.set(edge.id, edge);
    this.notifyListeners();
  }

  getEdge(id: string): NetworkEdge | undefined {
    return this.edges.get(id);
  }

  getAllEdges(): NetworkEdge[] {
    return Array.from(this.edges.values());
  }

  getEdgesByType(type: NetworkEdge['type']): NetworkEdge[] {
    return this.getAllEdges().filter(e => e.type === type);
  }

  getConnectedEdges(nodeId: string): NetworkEdge[] {
    return this.getAllEdges().filter(
      e => e.startNodeId === nodeId || e.endNodeId === nodeId
    );
  }

  updateEdge(id: string, updates: Partial<NetworkEdge>): void {
    const edge = this.edges.get(id);
    if (edge) {
      Object.assign(edge, updates);

      // Recalcular comprimento se geometria mudou
      if (updates.geometry) {
        edge.length = this.calculateEdgeLength(edge);
      }

      this.notifyListeners();
    }
  }

  removeEdge(id: string): boolean {
    const edge = this.edges.get(id);
    if (!edge) return false;

    // Remover das conexões dos nós
    const startNode = this.nodes.get(edge.startNodeId);
    const endNode = this.nodes.get(edge.endNodeId);

    if (startNode) {
      startNode.connectedEdges = startNode.connectedEdges.filter(e => e !== id);
    }
    if (endNode) {
      endNode.connectedEdges = endNode.connectedEdges.filter(e => e !== id);
    }

    this.edges.delete(id);
    this.notifyListeners();
    return true;
  }

  // --------------------------------------------------------------------------
  // Geometry Calculations
  // --------------------------------------------------------------------------

  calculateEdgeLength(edge: NetworkEdge): number {
    if (!edge.geometry?.coordinates || edge.geometry.coordinates.length < 2) {
      return 0;
    }

    let length = 0;
    const coords = edge.geometry.coordinates;

    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      const dz = (coords[i][2] || 0) - (coords[i - 1][2] || 0);
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return length;
  }

  calculateSlope(edge: NetworkEdge): number {
    const startNode = this.nodes.get(edge.startNodeId);
    const endNode = this.nodes.get(edge.endNodeId);

    if (!startNode || !endNode || edge.length === 0) {
      return 0;
    }

    return (startNode.z - endNode.z) / edge.length;
  }

  // --------------------------------------------------------------------------
  // Topology Operations
  // --------------------------------------------------------------------------

  moveNode(nodeId: string, newX: number, newY: number, newZ?: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Atualizar posição do nó
    node.x = newX;
    node.y = newY;
    if (newZ !== undefined) {
      node.z = newZ;
    }

    // Atualizar geometria dos trechos conectados
    for (const edgeId of node.connectedEdges) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;

      const coords = edge.geometry.coordinates;

      if (edge.startNodeId === nodeId) {
        coords[0] = [newX, newY, newZ ?? coords[0][2] ?? 0];
      }
      if (edge.endNodeId === nodeId) {
        coords[coords.length - 1] = [newX, newY, newZ ?? coords[coords.length - 1][2] ?? 0];
      }

      // Recalcular comprimento e declividade
      edge.length = this.calculateEdgeLength(edge);
      edge.slope = this.calculateSlope(edge);
    }

    this.notifyListeners();
  }

  splitEdge(edgeId: string, splitPoint: number[]): {
    newNode: NetworkNode;
    edge1: NetworkEdge;
    edge2: NetworkEdge;
  } | null {
    const edge = this.edges.get(edgeId);
    if (!edge) return null;

    // Criar novo nó no ponto de divisão
    const newNode: NetworkNode = {
      id: `node_split_${Date.now()}`,
      x: splitPoint[0],
      y: splitPoint[1],
      z: splitPoint[2] || 0,
      type: 'junction',
      groundElevation: splitPoint[2] || 0,
      invertElevation: splitPoint[2] || 0,
      depth: 0,
      connectedEdges: [],
      attributes: {}
    };

    // Dividir geometria
    const coords = edge.geometry.coordinates;
    const splitIndex = this.findNearestSegment(coords, splitPoint);

    const coords1 = coords.slice(0, splitIndex + 1).concat([splitPoint as [number, number, number]]);
    const coords2 = [splitPoint as [number, number, number]].concat(coords.slice(splitIndex + 1));

    // Criar primeiro trecho
    const edge1: NetworkEdge = {
      ...edge,
      id: `${edge.id}_1`,
      endNodeId: newNode.id,
      geometry: { type: 'LineString', coordinates: coords1 },
      length: 0,
      slope: 0
    };

    // Criar segundo trecho
    const edge2: NetworkEdge = {
      ...edge,
      id: `${edge.id}_2`,
      startNodeId: newNode.id,
      geometry: { type: 'LineString', coordinates: coords2 },
      length: 0,
      slope: 0
    };

    // Remover trecho original
    this.removeEdge(edgeId);

    // Adicionar novos elementos
    this.addNode(newNode);
    this.addEdge(edge1);
    this.addEdge(edge2);

    return { newNode, edge1, edge2 };
  }

  private findNearestSegment(coords: number[][], point: number[]): number {
    let minDist = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const dist = this.pointToSegmentDistance(
        point,
        coords[i],
        coords[i + 1]
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  private pointToSegmentDistance(point: number[], start: number[], end: number[]): number {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const l2 = dx * dx + dy * dy;

    if (l2 === 0) {
      return Math.sqrt(Math.pow(point[0] - start[0], 2) + Math.pow(point[1] - start[1], 2));
    }

    const t = Math.max(0, Math.min(1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / l2
    ));

    const projX = start[0] + t * dx;
    const projY = start[1] + t * dy;

    return Math.sqrt(Math.pow(point[0] - projX, 2) + Math.pow(point[1] - projY, 2));
  }

  // --------------------------------------------------------------------------
  // Import/Export
  // --------------------------------------------------------------------------

  loadFromInternalModel(nodes: NetworkNode[], edges: NetworkEdge[]): void {
    this.clear();

    nodes.forEach(node => {
      this.nodes.set(node.id, node);
    });

    edges.forEach(edge => {
      this.edges.set(edge.id, edge);
    });

    this.notifyListeners();
  }

  exportToInternalModel(): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.notifyListeners();
  }

  getStatistics(): {
    totalNodes: number;
    totalEdges: number;
    totalLength: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  } {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();

    const nodesByType: Record<string, number> = {};
    nodes.forEach(n => {
      nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
    });

    const edgesByType: Record<string, number> = {};
    let totalLength = 0;
    edges.forEach(e => {
      edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;
      totalLength += e.length;
    });

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalLength,
      nodesByType,
      edgesByType
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const NetworkModel = new NetworkModelImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateEdgeId(): string {
  return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createJunction(x: number, y: number, z: number): NetworkNode {
  return {
    id: generateNodeId(),
    x, y, z,
    type: 'junction',
    groundElevation: z,
    invertElevation: z,
    depth: 0,
    connectedEdges: [],
    attributes: {}
  };
}

export function createPipe(
  startNodeId: string,
  endNodeId: string,
  geometry: LineString,
  dn: number
): NetworkEdge {
  return {
    id: generateEdgeId(),
    startNodeId,
    endNodeId,
    geometry,
    dn,
    length: 0,  // Será calculado automaticamente
    slope: 0,   // Será calculado automaticamente
    material: 'PVC',
    type: 'pipe',
    attributes: {}
  };
}
