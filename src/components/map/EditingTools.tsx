/**
 * Editing Tools - Ferramentas de Edição Espacial Estilo QGIS
 *
 * Implementa ferramentas de edição com comportamento similar ao QGIS:
 * - Seleção (simples, múltipla, por retângulo)
 * - Movimentação de nós e vértices
 * - Inserção e exclusão de vértices
 * - Snap configurável
 */

import React, { useState, useCallback, useEffect } from 'react';
import { NetworkModel, NetworkNode, NetworkEdge } from '../../core/network/NetworkModel';
import { TopologyRules, TopologyBehavior } from '../../core/network/TopologyRules';

// ============================================================================
// TYPES
// ============================================================================

export type EditingTool =
  | 'select'
  | 'selectMultiple'
  | 'selectRectangle'
  | 'moveNode'
  | 'moveVertex'
  | 'insertVertex'
  | 'deleteVertex'
  | 'delete'
  | 'pan'
  | 'none';

export interface SnapSettings {
  enabled: boolean;
  tolerance: number;      // Em metros
  snapToNode: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
}

export interface Selection {
  nodes: string[];
  edges: string[];
}

export interface EditingState {
  activeTool: EditingTool;
  selection: Selection;
  snapSettings: SnapSettings;
  isDragging: boolean;
  dragStartPosition: { x: number; y: number } | null;
  hoveredElement: { type: 'node' | 'edge' | 'vertex'; id: string; vertexIndex?: number } | null;
}

export interface EditingToolsProps {
  onSelectionChange?: (selection: Selection) => void;
  onNodeMove?: (nodeId: string, newPosition: { x: number; y: number; z?: number }) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onVertexInsert?: (edgeId: string, position: number[], afterIndex: number) => void;
  onVertexDelete?: (edgeId: string, vertexIndex: number) => void;
}

// ============================================================================
// EDITING TOOLS COMPONENT
// ============================================================================

export const EditingTools: React.FC<EditingToolsProps> = ({
  onSelectionChange,
  onNodeMove,
  onNodeDelete,
  onEdgeDelete,
  onVertexInsert,
  onVertexDelete
}) => {
  const [state, setState] = useState<EditingState>({
    activeTool: 'select',
    selection: { nodes: [], edges: [] },
    snapSettings: {
      enabled: true,
      tolerance: 0.01,
      snapToNode: true,
      snapToVertex: true,
      snapToEdge: false
    },
    isDragging: false,
    dragStartPosition: null,
    hoveredElement: null
  });

  // --------------------------------------------------------------------------
  // Tool Selection
  // --------------------------------------------------------------------------

  const setActiveTool = useCallback((tool: EditingTool) => {
    setState(prev => ({
      ...prev,
      activeTool: tool,
      isDragging: false,
      dragStartPosition: null
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Selection
  // --------------------------------------------------------------------------

  const selectNode = useCallback((nodeId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newNodes = addToSelection
        ? prev.selection.nodes.includes(nodeId)
          ? prev.selection.nodes.filter(id => id !== nodeId)
          : [...prev.selection.nodes, nodeId]
        : [nodeId];

      const newSelection = {
        nodes: newNodes,
        edges: addToSelection ? prev.selection.edges : []
      };

      onSelectionChange?.(newSelection);
      return { ...prev, selection: newSelection };
    });
  }, [onSelectionChange]);

  const selectEdge = useCallback((edgeId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newEdges = addToSelection
        ? prev.selection.edges.includes(edgeId)
          ? prev.selection.edges.filter(id => id !== edgeId)
          : [...prev.selection.edges, edgeId]
        : [edgeId];

      const newSelection = {
        nodes: addToSelection ? prev.selection.nodes : [],
        edges: newEdges
      };

      onSelectionChange?.(newSelection);
      return { ...prev, selection: newSelection };
    });
  }, [onSelectionChange]);

  const clearSelection = useCallback(() => {
    const newSelection = { nodes: [], edges: [] };
    setState(prev => ({ ...prev, selection: newSelection }));
    onSelectionChange?.(newSelection);
  }, [onSelectionChange]);

  const selectByRectangle = useCallback((
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ) => {
    const nodes = NetworkModel.getAllNodes();
    const edges = NetworkModel.getAllEdges();

    const selectedNodes = nodes
      .filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
      .map(n => n.id);

    const selectedEdges = edges
      .filter(e => {
        const start = NetworkModel.getNode(e.startNodeId);
        const end = NetworkModel.getNode(e.endNodeId);
        return (
          (start && start.x >= minX && start.x <= maxX && start.y >= minY && start.y <= maxY) ||
          (end && end.x >= minX && end.x <= maxX && end.y >= minY && end.y <= maxY)
        );
      })
      .map(e => e.id);

    const newSelection = { nodes: selectedNodes, edges: selectedEdges };
    setState(prev => ({ ...prev, selection: newSelection }));
    onSelectionChange?.(newSelection);
  }, [onSelectionChange]);

  // --------------------------------------------------------------------------
  // Node Operations
  // --------------------------------------------------------------------------

  const moveNode = useCallback((nodeId: string, newX: number, newY: number, newZ?: number) => {
    // Aplicar snap se habilitado
    let finalX = newX;
    let finalY = newY;
    let finalZ = newZ;

    if (state.snapSettings.enabled) {
      const snapResult = TopologyRules.findSnapTarget(newX, newY, nodeId);

      if (snapResult.type) {
        finalX = snapResult.snappedPosition[0];
        finalY = snapResult.snappedPosition[1];
        finalZ = snapResult.snappedPosition[2];
      }
    }

    // Executar movimento (atualiza trechos conectados automaticamente)
    TopologyRules.moveNode(nodeId, finalX, finalY, finalZ);
    onNodeMove?.(nodeId, { x: finalX, y: finalY, z: finalZ });
  }, [state.snapSettings, onNodeMove]);

  const deleteNode = useCallback((nodeId: string) => {
    const behavior = TopologyBehavior.onNodeDelete(nodeId);

    if (behavior.action === 'ask' && behavior.options) {
      // Em produção, mostraria um diálogo
      const choice = window.confirm(
        `${behavior.message}\n\nExcluir trechos conectados? (OK = Sim, Cancelar = Não)`
      );

      TopologyRules.deleteNode(nodeId, {
        deleteConnectedEdges: choice,
        reconnectAutomatically: !choice
      });
    } else {
      TopologyRules.deleteNode(nodeId, {
        deleteConnectedEdges: true,
        reconnectAutomatically: false
      });
    }

    // Limpar seleção
    clearSelection();
    onNodeDelete?.(nodeId);
  }, [clearSelection, onNodeDelete]);

  // --------------------------------------------------------------------------
  // Edge/Vertex Operations
  // --------------------------------------------------------------------------

  const deleteEdge = useCallback((edgeId: string) => {
    NetworkModel.removeEdge(edgeId);
    clearSelection();
    onEdgeDelete?.(edgeId);
  }, [clearSelection, onEdgeDelete]);

  const insertVertex = useCallback((edgeId: string, position: number[], afterIndex: number) => {
    TopologyRules.insertVertex(edgeId, position, afterIndex);
    onVertexInsert?.(edgeId, position, afterIndex);
  }, [onVertexInsert]);

  const deleteVertex = useCallback((edgeId: string, vertexIndex: number) => {
    const success = TopologyRules.deleteVertex(edgeId, vertexIndex);
    if (success) {
      onVertexDelete?.(edgeId, vertexIndex);
    } else {
      alert('Não é possível excluir os vértices inicial ou final. Exclua o nó correspondente.');
    }
  }, [onVertexDelete]);

  // --------------------------------------------------------------------------
  // Snap Settings
  // --------------------------------------------------------------------------

  const updateSnapSettings = useCallback((updates: Partial<SnapSettings>) => {
    setState(prev => ({
      ...prev,
      snapSettings: { ...prev.snapSettings, ...updates }
    }));

    if (updates.tolerance !== undefined) {
      TopologyRules.setSnapTolerance(updates.tolerance);
    }
  }, []);

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection.nodes.length > 0) {
          state.selection.nodes.forEach(nodeId => deleteNode(nodeId));
        }
        if (state.selection.edges.length > 0) {
          state.selection.edges.forEach(edgeId => deleteEdge(edgeId));
        }
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection();
        setActiveTool('select');
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); break;
          case 'm': setActiveTool('moveNode'); break;
          case 'i': setActiveTool('insertVertex'); break;
          case 'd': setActiveTool('delete'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selection, deleteNode, deleteEdge, clearSelection, setActiveTool]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="editing-tools">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="tool-group">
          <span className="group-label">Seleção</span>
          <ToolButton
            icon="🔘"
            label="Selecionar"
            shortcut="V"
            active={state.activeTool === 'select'}
            onClick={() => setActiveTool('select')}
          />
          <ToolButton
            icon="⬜"
            label="Selecionar Retângulo"
            active={state.activeTool === 'selectRectangle'}
            onClick={() => setActiveTool('selectRectangle')}
          />
        </div>

        <div className="tool-group">
          <span className="group-label">Edição</span>
          <ToolButton
            icon="✥"
            label="Mover Nó"
            shortcut="M"
            active={state.activeTool === 'moveNode'}
            onClick={() => setActiveTool('moveNode')}
          />
          <ToolButton
            icon="◇"
            label="Mover Vértice"
            active={state.activeTool === 'moveVertex'}
            onClick={() => setActiveTool('moveVertex')}
          />
          <ToolButton
            icon="➕"
            label="Inserir Vértice"
            shortcut="I"
            active={state.activeTool === 'insertVertex'}
            onClick={() => setActiveTool('insertVertex')}
          />
          <ToolButton
            icon="➖"
            label="Excluir Vértice"
            active={state.activeTool === 'deleteVertex'}
            onClick={() => setActiveTool('deleteVertex')}
          />
        </div>

        <div className="tool-group">
          <span className="group-label">Exclusão</span>
          <ToolButton
            icon="🗑️"
            label="Excluir"
            shortcut="D"
            active={state.activeTool === 'delete'}
            onClick={() => setActiveTool('delete')}
          />
        </div>
      </div>

      {/* Snap Settings */}
      <div className="snap-settings">
        <label className="snap-toggle">
          <input
            type="checkbox"
            checked={state.snapSettings.enabled}
            onChange={(e) => updateSnapSettings({ enabled: e.target.checked })}
          />
          <span>🧲 Snap</span>
        </label>

        {state.snapSettings.enabled && (
          <div className="snap-options">
            <div className="snap-tolerance">
              <label>Tolerância:</label>
              <input
                type="number"
                value={state.snapSettings.tolerance}
                step="0.01"
                min="0.001"
                max="1"
                onChange={(e) => updateSnapSettings({ tolerance: parseFloat(e.target.value) })}
              />
              <span>m</span>
            </div>

            <div className="snap-targets">
              <label>
                <input
                  type="checkbox"
                  checked={state.snapSettings.snapToNode}
                  onChange={(e) => updateSnapSettings({ snapToNode: e.target.checked })}
                />
                Nós
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={state.snapSettings.snapToVertex}
                  onChange={(e) => updateSnapSettings({ snapToVertex: e.target.checked })}
                />
                Vértices
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={state.snapSettings.snapToEdge}
                  onChange={(e) => updateSnapSettings({ snapToEdge: e.target.checked })}
                />
                Trechos
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Selection Info */}
      {(state.selection.nodes.length > 0 || state.selection.edges.length > 0) && (
        <div className="selection-info">
          <span>Selecionado:</span>
          {state.selection.nodes.length > 0 && (
            <span className="count">{state.selection.nodes.length} nó(s)</span>
          )}
          {state.selection.edges.length > 0 && (
            <span className="count">{state.selection.edges.length} trecho(s)</span>
          )}
          <button onClick={clearSelection} className="btn-clear">
            ✕ Limpar
          </button>
        </div>
      )}

      {/* Active Tool Hint */}
      <div className="tool-hint">
        {state.activeTool === 'select' && 'Clique para selecionar. Ctrl+clique para adicionar à seleção.'}
        {state.activeTool === 'selectRectangle' && 'Arraste para selecionar elementos por retângulo.'}
        {state.activeTool === 'moveNode' && 'Arraste um nó para movê-lo. Trechos conectados serão atualizados.'}
        {state.activeTool === 'moveVertex' && 'Arraste um vértice intermediário para movê-lo.'}
        {state.activeTool === 'insertVertex' && 'Clique em um trecho para inserir um novo vértice.'}
        {state.activeTool === 'deleteVertex' && 'Clique em um vértice intermediário para excluí-lo.'}
        {state.activeTool === 'delete' && 'Clique em um elemento para excluí-lo. Delete = excluir seleção.'}
      </div>
    </div>
  );
};

// ============================================================================
// TOOL BUTTON COMPONENT
// ============================================================================

interface ToolButtonProps {
  icon: string;
  label: string;
  shortcut?: string;
  active: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, shortcut, active, onClick }) => (
  <button
    className={`tool-button ${active ? 'active' : ''}`}
    onClick={onClick}
    title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
  >
    <span className="icon">{icon}</span>
    {shortcut && <span className="shortcut">{shortcut}</span>}
  </button>
);

// ============================================================================
// HOOK FOR EDITING STATE
// ============================================================================

export function useEditingTools() {
  const [activeTool, setActiveTool] = useState<EditingTool>('select');
  const [selection, setSelection] = useState<Selection>({ nodes: [], edges: [] });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapTolerance, setSnapTolerance] = useState(0.01);

  const selectNode = useCallback((nodeId: string, addToSelection: boolean = false) => {
    setSelection(prev => ({
      nodes: addToSelection
        ? prev.nodes.includes(nodeId)
          ? prev.nodes.filter(id => id !== nodeId)
          : [...prev.nodes, nodeId]
        : [nodeId],
      edges: addToSelection ? prev.edges : []
    }));
  }, []);

  const selectEdge = useCallback((edgeId: string, addToSelection: boolean = false) => {
    setSelection(prev => ({
      nodes: addToSelection ? prev.nodes : [],
      edges: addToSelection
        ? prev.edges.includes(edgeId)
          ? prev.edges.filter(id => id !== edgeId)
          : [...prev.edges, edgeId]
        : [edgeId]
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ nodes: [], edges: [] });
  }, []);

  return {
    activeTool,
    setActiveTool,
    selection,
    selectNode,
    selectEdge,
    clearSelection,
    snapEnabled,
    setSnapEnabled,
    snapTolerance,
    setSnapTolerance
  };
}

export default EditingTools;
