/**
 * Topology Rules - Regras de Topologia (Comportamento QGIS)
 *
 * Implementa regras automáticas para manutenção da topologia da rede.
 */

import { NetworkModel, NetworkNode, NetworkEdge } from './NetworkModel';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TopologyAction {
  action: 'ask' | 'auto' | 'cancel';
  options?: string[];
  message?: string;
}

export interface DeleteNodeOptions {
  deleteConnectedEdges: boolean;
  reconnectAutomatically: boolean;
}

export interface MoveNodeResult {
  success: boolean;
  updatedEdges: string[];
  recalculatedLengths: number[];
}

export interface TopologyValidation {
  isValid: boolean;
  errors: TopologyError[];
  warnings: TopologyWarning[];
}

export interface TopologyError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'error' | 'critical';
}

export interface TopologyWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  suggestion?: string;
}

// ============================================================================
// TOPOLOGY BEHAVIOR
// ============================================================================

export const TopologyBehavior = {
  // Ao excluir nó
  onNodeDelete(nodeId: string): TopologyAction {
    const node = NetworkModel.getNode(nodeId);
    if (!node) {
      return { action: 'cancel', message: 'Nó não encontrado' };
    }

    const connectedEdges = NetworkModel.getConnectedEdges(nodeId);

    if (connectedEdges.length === 0) {
      return { action: 'auto' };  // Pode excluir diretamente
    }

    return {
      action: 'ask',
      options: ['deleteConnectedEdges', 'reconnectAutomatically', 'cancel'],
      message: `Este nó está conectado a ${connectedEdges.length} trecho(s). O que deseja fazer?`
    };
  },

  // Ao mover nó - sempre atualizar trechos conectados
  onNodeMove(nodeId: string, newX: number, newY: number, newZ?: number): TopologyAction {
    return {
      action: 'auto',
      message: 'Atualizando trechos conectados automaticamente'
    };
  },

  // Ao mover vértice de trecho - recalcular comprimento
  onEdgeVertexMove(edgeId: string): TopologyAction {
    return {
      action: 'auto',
      message: 'Recalculando comprimento automaticamente'
    };
  },

  // Ao importar trecho sem nós - criar nós nos endpoints
  onEdgeWithoutNodes(startCoord: number[], endCoord: number[]): TopologyAction {
    return {
      action: 'auto',
      message: 'Criando nós automaticamente nos endpoints'
    };
  }
};

// ============================================================================
// TOPOLOGY RULES CLASS
// ============================================================================

class TopologyRulesImpl {
  private snapTolerance: number = 0.01;  // metros

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setSnapTolerance(tolerance: number): void {
    this.snapTolerance = tolerance;
  }

  getSnapTolerance(): number {
    return this.snapTolerance;
  }

  // --------------------------------------------------------------------------
  // Node Operations
  // --------------------------------------------------------------------------

  deleteNode(nodeId: string, options: DeleteNodeOptions): { success: boolean; deletedEdges: string[] } {
    const behavior = TopologyBehavior.onNodeDelete(nodeId);

    if (behavior.action === 'cancel') {
      return { success: false, deletedEdges: [] };
    }

    const connectedEdges = NetworkModel.getConnectedEdges(nodeId);
    const deletedEdges: string[] = [];

    if (options.deleteConnectedEdges) {
      // Excluir todos os trechos conectados
      connectedEdges.forEach(edge => {
        NetworkModel.removeEdge(edge.id);
        deletedEdges.push(edge.id);
      });
    } else if (options.reconnectAutomatically && connectedEdges.length === 2) {
      // Reconectar os dois trechos em um só
      const edge1 = connectedEdges[0];
      const edge2 = connectedEdges[1];

      // Determinar os nós externos
      const externalNode1 = edge1.startNodeId === nodeId ? edge1.endNodeId : edge1.startNodeId;
      const externalNode2 = edge2.startNodeId === nodeId ? edge2.endNodeId : edge2.startNodeId;

      // Criar novo trecho conectando os nós externos
      const newCoords = this.mergeEdgeGeometries(edge1, edge2, nodeId);

      const newEdge: NetworkEdge = {
        id: `merged_${edge1.id}_${edge2.id}`,
        startNodeId: externalNode1,
        endNodeId: externalNode2,
        geometry: { type: 'LineString', coordinates: newCoords },
        dn: edge1.dn,  // Usa o diâmetro do primeiro trecho
        length: 0,
        slope: 0,
        material: edge1.material,
        type: edge1.type,
        attributes: { ...edge1.attributes, ...edge2.attributes }
      };

      // Remover trechos antigos
      NetworkModel.removeEdge(edge1.id);
      NetworkModel.removeEdge(edge2.id);
      deletedEdges.push(edge1.id, edge2.id);

      // Adicionar novo trecho
      NetworkModel.addEdge(newEdge);
    }

    // Remover o nó
    NetworkModel.removeNode(nodeId);

    return { success: true, deletedEdges };
  }

  moveNode(nodeId: string, newX: number, newY: number, newZ?: number): MoveNodeResult {
    const node = NetworkModel.getNode(nodeId);
    if (!node) {
      return { success: false, updatedEdges: [], recalculatedLengths: [] };
    }

    const connectedEdges = NetworkModel.getConnectedEdges(nodeId);
    const updatedEdges: string[] = [];
    const recalculatedLengths: number[] = [];

    // Usar o método do NetworkModel que já atualiza tudo
    NetworkModel.moveNode(nodeId, newX, newY, newZ);

    // Coletar informações dos trechos atualizados
    connectedEdges.forEach(edge => {
      const updatedEdge = NetworkModel.getEdge(edge.id);
      if (updatedEdge) {
        updatedEdges.push(edge.id);
        recalculatedLengths.push(updatedEdge.length);
      }
    });

    return { success: true, updatedEdges, recalculatedLengths };
  }

  private mergeEdgeGeometries(edge1: NetworkEdge, edge2: NetworkEdge, commonNodeId: string): number[][] {
    const coords1 = edge1.geometry.coordinates;
    const coords2 = edge2.geometry.coordinates;

    // Determinar ordem correta para concatenar
    let orderedCoords1: number[][];
    let orderedCoords2: number[][];

    if (edge1.endNodeId === commonNodeId) {
      orderedCoords1 = coords1;
    } else {
      orderedCoords1 = [...coords1].reverse();
    }

    if (edge2.startNodeId === commonNodeId) {
      orderedCoords2 = coords2.slice(1);  // Remove o ponto comum
    } else {
      orderedCoords2 = [...coords2].reverse().slice(1);
    }

    return [...orderedCoords1, ...orderedCoords2];
  }

  // --------------------------------------------------------------------------
  // Edge Operations
  // --------------------------------------------------------------------------

  updateEdgeVertex(edgeId: string, vertexIndex: number, newX: number, newY: number, newZ?: number): boolean {
    const edge = NetworkModel.getEdge(edgeId);
    if (!edge) return false;

    const coords = edge.geometry.coordinates;
    if (vertexIndex < 0 || vertexIndex >= coords.length) return false;

    // Se for o primeiro ou último vértice, também precisamos atualizar o nó
    if (vertexIndex === 0) {
      const startNode = NetworkModel.getNode(edge.startNodeId);
      if (startNode) {
        NetworkModel.moveNode(edge.startNodeId, newX, newY, newZ);
      }
    } else if (vertexIndex === coords.length - 1) {
      const endNode = NetworkModel.getNode(edge.endNodeId);
      if (endNode) {
        NetworkModel.moveNode(edge.endNodeId, newX, newY, newZ);
      }
    } else {
      // Vértice intermediário
      coords[vertexIndex] = [newX, newY, newZ ?? coords[vertexIndex][2] ?? 0];

      // Recalcular comprimento
      NetworkModel.updateEdge(edgeId, {
        geometry: { type: 'LineString', coordinates: coords }
      });
    }

    return true;
  }

  insertVertex(edgeId: string, position: number[], afterIndex: number): boolean {
    const edge = NetworkModel.getEdge(edgeId);
    if (!edge) return false;

    const coords = [...edge.geometry.coordinates];
    coords.splice(afterIndex + 1, 0, position as [number, number, number]);

    NetworkModel.updateEdge(edgeId, {
      geometry: { type: 'LineString', coordinates: coords }
    });

    return true;
  }

  deleteVertex(edgeId: string, vertexIndex: number): boolean {
    const edge = NetworkModel.getEdge(edgeId);
    if (!edge) return false;

    const coords = edge.geometry.coordinates;

    // Não pode excluir primeiro ou último vértice (são os nós)
    if (vertexIndex === 0 || vertexIndex === coords.length - 1) {
      return false;
    }

    // Precisa ter pelo menos 3 vértices (2 endpoints + 1)
    if (coords.length <= 2) {
      return false;
    }

    const newCoords = coords.filter((_, i) => i !== vertexIndex);

    NetworkModel.updateEdge(edgeId, {
      geometry: { type: 'LineString', coordinates: newCoords }
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // Snap Operations
  // --------------------------------------------------------------------------

  findSnapTarget(x: number, y: number, excludeNodeId?: string): {
    type: 'node' | 'vertex' | 'edge' | null;
    nodeId?: string;
    edgeId?: string;
    vertexIndex?: number;
    snappedPosition: number[];
  } {
    // Primeiro, tentar snap para nó
    for (const node of NetworkModel.getAllNodes()) {
      if (node.id === excludeNodeId) continue;

      const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      if (distance <= this.snapTolerance) {
        return {
          type: 'node',
          nodeId: node.id,
          snappedPosition: [node.x, node.y, node.z]
        };
      }
    }

    // Depois, tentar snap para vértice de trecho
    for (const edge of NetworkModel.getAllEdges()) {
      const coords = edge.geometry.coordinates;

      for (let i = 0; i < coords.length; i++) {
        const distance = Math.sqrt(
          Math.pow(coords[i][0] - x, 2) +
          Math.pow(coords[i][1] - y, 2)
        );

        if (distance <= this.snapTolerance) {
          return {
            type: 'vertex',
            edgeId: edge.id,
            vertexIndex: i,
            snappedPosition: coords[i]
          };
        }
      }
    }

    // Por fim, tentar snap para segmento de trecho
    for (const edge of NetworkModel.getAllEdges()) {
      const coords = edge.geometry.coordinates;

      for (let i = 0; i < coords.length - 1; i++) {
        const projectedPoint = this.projectPointOnSegment(
          [x, y],
          coords[i],
          coords[i + 1]
        );

        const distance = Math.sqrt(
          Math.pow(projectedPoint[0] - x, 2) +
          Math.pow(projectedPoint[1] - y, 2)
        );

        if (distance <= this.snapTolerance) {
          // Interpolar Z
          const segmentLength = Math.sqrt(
            Math.pow(coords[i + 1][0] - coords[i][0], 2) +
            Math.pow(coords[i + 1][1] - coords[i][1], 2)
          );
          const projectedLength = Math.sqrt(
            Math.pow(projectedPoint[0] - coords[i][0], 2) +
            Math.pow(projectedPoint[1] - coords[i][1], 2)
          );
          const t = segmentLength > 0 ? projectedLength / segmentLength : 0;
          const z = (coords[i][2] || 0) + t * ((coords[i + 1][2] || 0) - (coords[i][2] || 0));

          return {
            type: 'edge',
            edgeId: edge.id,
            snappedPosition: [projectedPoint[0], projectedPoint[1], z]
          };
        }
      }
    }

    return { type: null, snappedPosition: [x, y, 0] };
  }

  private projectPointOnSegment(point: number[], start: number[], end: number[]): number[] {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const l2 = dx * dx + dy * dy;

    if (l2 === 0) return start;

    const t = Math.max(0, Math.min(1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / l2
    ));

    return [start[0] + t * dx, start[1] + t * dy];
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  validateTopology(): TopologyValidation {
    const errors: TopologyError[] = [];
    const warnings: TopologyWarning[] = [];

    const nodes = NetworkModel.getAllNodes();
    const edges = NetworkModel.getAllEdges();

    // Verificar nós duplicados
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) +
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );

        if (distance < this.snapTolerance) {
          warnings.push({
            code: 'DUPLICATE_NODES',
            message: `Nós ${nodes[i].id} e ${nodes[j].id} estão muito próximos (${distance.toFixed(4)}m)`,
            nodeId: nodes[i].id,
            suggestion: 'Considere mesclar estes nós'
          });
        }
      }
    }

    // Verificar trechos desconectados
    edges.forEach(edge => {
      const startNode = NetworkModel.getNode(edge.startNodeId);
      const endNode = NetworkModel.getNode(edge.endNodeId);

      if (!startNode) {
        errors.push({
          code: 'MISSING_START_NODE',
          message: `Trecho ${edge.id} referencia nó inicial inexistente: ${edge.startNodeId}`,
          edgeId: edge.id,
          severity: 'error'
        });
      }

      if (!endNode) {
        errors.push({
          code: 'MISSING_END_NODE',
          message: `Trecho ${edge.id} referencia nó final inexistente: ${edge.endNodeId}`,
          edgeId: edge.id,
          severity: 'error'
        });
      }
    });

    // Verificar nós isolados
    nodes.forEach(node => {
      if (node.connectedEdges.length === 0) {
        warnings.push({
          code: 'ISOLATED_NODE',
          message: `Nó ${node.id} não está conectado a nenhum trecho`,
          nodeId: node.id,
          suggestion: 'Este nó pode ser excluído se não for necessário'
        });
      }
    });

    // Verificar trechos com comprimento zero
    edges.forEach(edge => {
      if (edge.length === 0 || edge.length < 0.001) {
        warnings.push({
          code: 'ZERO_LENGTH_EDGE',
          message: `Trecho ${edge.id} tem comprimento zero ou muito pequeno`,
          edgeId: edge.id,
          suggestion: 'Considere remover este trecho ou verificar a geometria'
        });
      }
    });

    // Verificar geometrias inválidas
    edges.forEach(edge => {
      if (!edge.geometry?.coordinates || edge.geometry.coordinates.length < 2) {
        errors.push({
          code: 'INVALID_GEOMETRY',
          message: `Trecho ${edge.id} tem geometria inválida`,
          edgeId: edge.id,
          severity: 'error'
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // Auto-fix Operations
  // --------------------------------------------------------------------------

  fixDuplicateNodes(tolerance?: number): number {
    const tol = tolerance ?? this.snapTolerance;
    const nodes = NetworkModel.getAllNodes();
    let fixedCount = 0;

    const toMerge: [string, string][] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) +
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );

        if (distance < tol) {
          toMerge.push([nodes[i].id, nodes[j].id]);
        }
      }
    }

    // Mesclar nós (manter o primeiro, redirecionar conexões do segundo)
    toMerge.forEach(([keepId, removeId]) => {
      const keepNode = NetworkModel.getNode(keepId);
      const removeNode = NetworkModel.getNode(removeId);

      if (!keepNode || !removeNode) return;

      // Redirecionar trechos
      const edgesToUpdate = NetworkModel.getConnectedEdges(removeId);
      edgesToUpdate.forEach(edge => {
        if (edge.startNodeId === removeId) {
          NetworkModel.updateEdge(edge.id, { startNodeId: keepId });
        }
        if (edge.endNodeId === removeId) {
          NetworkModel.updateEdge(edge.id, { endNodeId: keepId });
        }
        keepNode.connectedEdges.push(edge.id);
      });

      // Remover nó duplicado
      NetworkModel.removeNode(removeId);
      fixedCount++;
    });

    return fixedCount;
  }
}

// Singleton instance
export const TopologyRules = new TopologyRulesImpl();
