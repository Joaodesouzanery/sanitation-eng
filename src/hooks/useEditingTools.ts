/**
 * useEditingTools - Hook para ferramentas de edição espacial
 */

import { useState, useCallback, useEffect } from 'react';
import { NetworkModel, NetworkNode, NetworkEdge } from '../core/network/NetworkModel';
import { TopologyRules, TopologyBehavior } from '../core/network/TopologyRules';

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

export interface Selection {
  nodes: string[];
  edges: string[];
}

export interface SnapSettings {
  enabled: boolean;
  tolerance: number;
  snapToNode: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
}

export interface EditingState {
  activeTool: EditingTool;
  selection: Selection;
  snapSettings: SnapSettings;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  isDragging: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEditingTools() {
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
    hoveredNodeId: null,
    hoveredEdgeId: null,
    isDragging: false
  });

  // --------------------------------------------------------------------------
  // Tool Selection
  // --------------------------------------------------------------------------

  const setActiveTool = useCallback((tool: EditingTool) => {
    setState(prev => ({ ...prev, activeTool: tool, isDragging: false }));
  }, []);

  // --------------------------------------------------------------------------
  // Selection Operations
  // --------------------------------------------------------------------------

  const selectNode = useCallback((nodeId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newNodes = addToSelection
        ? prev.selection.nodes.includes(nodeId)
          ? prev.selection.nodes.filter(id => id !== nodeId)
          : [...prev.selection.nodes, nodeId]
        : [nodeId];

      return {
        ...prev,
        selection: {
          nodes: newNodes,
          edges: addToSelection ? prev.selection.edges : []
        }
      };
    });
  }, []);

  const selectEdge = useCallback((edgeId: string, addToSelection: boolean = false) => {
    setState(prev => {
      const newEdges = addToSelection
        ? prev.selection.edges.includes(edgeId)
          ? prev.selection.edges.filter(id => id !== edgeId)
          : [...prev.selection.edges, edgeId]
        : [edgeId];

      return {
        ...prev,
        selection: {
          nodes: addToSelection ? prev.selection.nodes : [],
          edges: newEdges
        }
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selection: { nodes: [], edges: [] }
    }));
  }, []);

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

    setState(prev => ({
      ...prev,
      selection: { nodes: selectedNodes, edges: selectedEdges }
    }));
  }, []);

  const selectAll = useCallback(() => {
    const nodes = NetworkModel.getAllNodes().map(n => n.id);
    const edges = NetworkModel.getAllEdges().map(e => e.id);

    setState(prev => ({
      ...prev,
      selection: { nodes, edges }
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Node Operations
  // --------------------------------------------------------------------------

  const moveNode = useCallback((nodeId: string, newX: number, newY: number, newZ?: number) => {
    let finalX = newX;
    let finalY = newY;
    let finalZ = newZ;

    // Apply snap if enabled
    if (state.snapSettings.enabled) {
      const snapResult = TopologyRules.findSnapTarget(newX, newY, nodeId);
      if (snapResult.type) {
        finalX = snapResult.snappedPosition[0];
        finalY = snapResult.snappedPosition[1];
        finalZ = snapResult.snappedPosition[2];
      }
    }

    TopologyRules.moveNode(nodeId, finalX, finalY, finalZ);
  }, [state.snapSettings]);

  const deleteSelectedNodes = useCallback(() => {
    state.selection.nodes.forEach(nodeId => {
      const behavior = TopologyBehavior.onNodeDelete(nodeId);

      if (behavior.action === 'ask') {
        // In a real app, show a dialog
        TopologyRules.deleteNode(nodeId, {
          deleteConnectedEdges: true,
          reconnectAutomatically: false
        });
      } else {
        TopologyRules.deleteNode(nodeId, {
          deleteConnectedEdges: true,
          reconnectAutomatically: false
        });
      }
    });

    clearSelection();
  }, [state.selection.nodes, clearSelection]);

  // --------------------------------------------------------------------------
  // Edge Operations
  // --------------------------------------------------------------------------

  const deleteSelectedEdges = useCallback(() => {
    state.selection.edges.forEach(edgeId => {
      NetworkModel.removeEdge(edgeId);
    });

    clearSelection();
  }, [state.selection.edges, clearSelection]);

  const insertVertexOnEdge = useCallback((
    edgeId: string,
    position: number[],
    afterIndex: number
  ) => {
    TopologyRules.insertVertex(edgeId, position, afterIndex);
  }, []);

  const deleteVertexFromEdge = useCallback((edgeId: string, vertexIndex: number) => {
    return TopologyRules.deleteVertex(edgeId, vertexIndex);
  }, []);

  const moveEdgeVertex = useCallback((
    edgeId: string,
    vertexIndex: number,
    newX: number,
    newY: number,
    newZ?: number
  ) => {
    return TopologyRules.updateEdgeVertex(edgeId, vertexIndex, newX, newY, newZ);
  }, []);

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

  const toggleSnap = useCallback(() => {
    setState(prev => ({
      ...prev,
      snapSettings: { ...prev.snapSettings, enabled: !prev.snapSettings.enabled }
    }));
  }, []);

  // --------------------------------------------------------------------------
  // Hover State
  // --------------------------------------------------------------------------

  const setHoveredNode = useCallback((nodeId: string | null) => {
    setState(prev => ({ ...prev, hoveredNodeId: nodeId }));
  }, []);

  const setHoveredEdge = useCallback((edgeId: string | null) => {
    setState(prev => ({ ...prev, hoveredEdgeId: edgeId }));
  }, []);

  // --------------------------------------------------------------------------
  // Drag State
  // --------------------------------------------------------------------------

  const setIsDragging = useCallback((dragging: boolean) => {
    setState(prev => ({ ...prev, isDragging: dragging }));
  }, []);

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection.nodes.length > 0) {
          deleteSelectedNodes();
        }
        if (state.selection.edges.length > 0) {
          deleteSelectedEdges();
        }
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection();
        setActiveTool('select');
      }

      // Ctrl+A - select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Tool shortcuts (without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setActiveTool('select');
            break;
          case 'm':
            setActiveTool('moveNode');
            break;
          case 'i':
            setActiveTool('insertVertex');
            break;
          case 'd':
            setActiveTool('delete');
            break;
          case 's':
            toggleSnap();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.selection,
    deleteSelectedNodes,
    deleteSelectedEdges,
    clearSelection,
    setActiveTool,
    selectAll,
    toggleSnap
  ]);

  // --------------------------------------------------------------------------
  // Computed Values
  // --------------------------------------------------------------------------

  const selectedNodes = state.selection.nodes.map(id => NetworkModel.getNode(id)).filter(Boolean) as NetworkNode[];
  const selectedEdges = state.selection.edges.map(id => NetworkModel.getEdge(id)).filter(Boolean) as NetworkEdge[];
  const hasSelection = state.selection.nodes.length > 0 || state.selection.edges.length > 0;

  return {
    // State
    activeTool: state.activeTool,
    selection: state.selection,
    snapSettings: state.snapSettings,
    hoveredNodeId: state.hoveredNodeId,
    hoveredEdgeId: state.hoveredEdgeId,
    isDragging: state.isDragging,

    // Tool selection
    setActiveTool,

    // Selection
    selectNode,
    selectEdge,
    clearSelection,
    selectByRectangle,
    selectAll,

    // Node operations
    moveNode,
    deleteSelectedNodes,

    // Edge operations
    deleteSelectedEdges,
    insertVertexOnEdge,
    deleteVertexFromEdge,
    moveEdgeVertex,

    // Snap
    updateSnapSettings,
    toggleSnap,

    // Hover
    setHoveredNode,
    setHoveredEdge,

    // Drag
    setIsDragging,

    // Computed
    selectedNodes,
    selectedEdges,
    hasSelection
  };
}

export default useEditingTools;
