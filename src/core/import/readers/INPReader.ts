/**
 * INP Reader - Leitor de arquivos EPANET INP
 *
 * REGRA CRÍTICA: Não alterar parâmetros hidráulicos!
 * Apenas converter para modelo interno preservando todos os dados originais.
 */

import { LineString, Point } from 'geojson';
import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';
import { NetworkNode, NetworkEdge } from '../../network/NetworkModel';

// ============================================================================
// INTERFACES
// ============================================================================

export interface INPFile {
  title: string;
  junctions: INPJunction[];
  reservoirs: INPReservoir[];
  tanks: INPTank[];
  pipes: INPPipe[];
  pumps: INPPump[];
  valves: INPValve[];
  coordinates: INPCoordinate[];
  vertices: INPVertex[];
  options: Record<string, string>;
  patterns: INPPattern[];
  curves: INPCurve[];
}

export interface INPJunction {
  id: string;
  elevation: number;
  demand?: number;
  pattern?: string;
}

export interface INPReservoir {
  id: string;
  head: number;
  pattern?: string;
}

export interface INPTank {
  id: string;
  elevation: number;
  initLevel: number;
  minLevel: number;
  maxLevel: number;
  diameter: number;
  minVol?: number;
  volCurve?: string;
}

export interface INPPipe {
  id: string;
  node1: string;
  node2: string;
  length: number;
  diameter: number;
  roughness: number;
  minorLoss?: number;
  status?: string;
}

export interface INPPump {
  id: string;
  node1: string;
  node2: string;
  parameters: string;
}

export interface INPValve {
  id: string;
  node1: string;
  node2: string;
  diameter: number;
  type: string;
  setting: number;
  minorLoss?: number;
}

export interface INPCoordinate {
  nodeId: string;
  x: number;
  y: number;
}

export interface INPVertex {
  linkId: string;
  x: number;
  y: number;
}

export interface INPPattern {
  id: string;
  multipliers: number[];
}

export interface INPCurve {
  id: string;
  type: 'PUMP' | 'EFFICIENCY' | 'VOLUME' | 'HEADLOSS';
  points: Array<{ x: number; y: number }>;
}

// ============================================================================
// INP READER CLASS
// ============================================================================

class INPReaderImpl {

  // --------------------------------------------------------------------------
  // Main Reading
  // --------------------------------------------------------------------------

  async read(file: File): Promise<RawImportData> {
    const content = await file.text();

    // Parse INP content
    const inpData = this.parseINP(content);

    // Extract entities
    const entities = this.extractEntities(inpData);

    // Analyze metadata
    const metadata = this.analyzeMetadata(inpData, entities);

    return {
      fileType: 'INP',
      fileName: file.name,
      fileSize: file.size,
      rawContent: inpData,
      entities,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // INP Parsing
  // --------------------------------------------------------------------------

  parseINP(content: string): INPFile {
    const sections = this.extractSections(content);

    return {
      title: this.parseTitle(sections['TITLE']),
      junctions: this.parseJunctions(sections['JUNCTIONS']),
      reservoirs: this.parseReservoirs(sections['RESERVOIRS']),
      tanks: this.parseTanks(sections['TANKS']),
      pipes: this.parsePipes(sections['PIPES']),
      pumps: this.parsePumps(sections['PUMPS']),
      valves: this.parseValves(sections['VALVES']),
      coordinates: this.parseCoordinates(sections['COORDINATES']),
      vertices: this.parseVertices(sections['VERTICES']),
      options: this.parseOptions(sections['OPTIONS']),
      patterns: this.parsePatterns(sections['PATTERNS']),
      curves: this.parseCurves(sections['CURVES'])
    };
  }

  private extractSections(content: string): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    let currentSection = '';

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Ignorar linhas vazias e comentários
      if (!trimmed || trimmed.startsWith(';')) continue;

      // Detectar seção
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1).toUpperCase();
        sections[currentSection] = [];
        continue;
      }

      // Adicionar linha à seção atual
      if (currentSection) {
        sections[currentSection].push(trimmed);
      }
    }

    return sections;
  }

  private parseTitle(lines?: string[]): string {
    return lines?.join(' ') || '';
  }

  private parseJunctions(lines?: string[]): INPJunction[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        elevation: parseFloat(parts[1]) || 0,
        demand: parts[2] ? parseFloat(parts[2]) : undefined,
        pattern: parts[3]
      };
    });
  }

  private parseReservoirs(lines?: string[]): INPReservoir[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        head: parseFloat(parts[1]) || 0,
        pattern: parts[2]
      };
    });
  }

  private parseTanks(lines?: string[]): INPTank[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        elevation: parseFloat(parts[1]) || 0,
        initLevel: parseFloat(parts[2]) || 0,
        minLevel: parseFloat(parts[3]) || 0,
        maxLevel: parseFloat(parts[4]) || 0,
        diameter: parseFloat(parts[5]) || 0,
        minVol: parts[6] ? parseFloat(parts[6]) : undefined,
        volCurve: parts[7]
      };
    });
  }

  private parsePipes(lines?: string[]): INPPipe[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        node1: parts[1],
        node2: parts[2],
        length: parseFloat(parts[3]) || 0,
        diameter: parseFloat(parts[4]) || 0,
        roughness: parseFloat(parts[5]) || 0,
        minorLoss: parts[6] ? parseFloat(parts[6]) : undefined,
        status: parts[7]
      };
    });
  }

  private parsePumps(lines?: string[]): INPPump[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        node1: parts[1],
        node2: parts[2],
        parameters: parts.slice(3).join(' ')
      };
    });
  }

  private parseValves(lines?: string[]): INPValve[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        id: parts[0],
        node1: parts[1],
        node2: parts[2],
        diameter: parseFloat(parts[3]) || 0,
        type: parts[4],
        setting: parseFloat(parts[5]) || 0,
        minorLoss: parts[6] ? parseFloat(parts[6]) : undefined
      };
    });
  }

  private parseCoordinates(lines?: string[]): INPCoordinate[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        nodeId: parts[0],
        x: parseFloat(parts[1]) || 0,
        y: parseFloat(parts[2]) || 0
      };
    });
  }

  private parseVertices(lines?: string[]): INPVertex[] {
    if (!lines) return [];

    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        linkId: parts[0],
        x: parseFloat(parts[1]) || 0,
        y: parseFloat(parts[2]) || 0
      };
    });
  }

  private parseOptions(lines?: string[]): Record<string, string> {
    if (!lines) return {};

    const options: Record<string, string> = {};
    lines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        options[parts[0].toUpperCase()] = parts.slice(1).join(' ');
      }
    });
    return options;
  }

  private parsePatterns(lines?: string[]): INPPattern[] {
    if (!lines) return [];

    const patterns: Map<string, number[]> = new Map();

    lines.forEach(line => {
      const parts = line.split(/\s+/);
      const id = parts[0];
      const multipliers = parts.slice(1).map(p => parseFloat(p)).filter(n => !isNaN(n));

      if (patterns.has(id)) {
        patterns.get(id)!.push(...multipliers);
      } else {
        patterns.set(id, multipliers);
      }
    });

    return Array.from(patterns.entries()).map(([id, multipliers]) => ({
      id,
      multipliers
    }));
  }

  private parseCurves(lines?: string[]): INPCurve[] {
    if (!lines) return [];

    const curves: Map<string, { type?: string; points: Array<{ x: number; y: number }> }> = new Map();

    lines.forEach(line => {
      const parts = line.split(/\s+/);
      const id = parts[0];

      if (!curves.has(id)) {
        curves.set(id, { points: [] });
      }

      const curve = curves.get(id)!;

      // Verificar se é tipo de curva
      if (['PUMP', 'EFFICIENCY', 'VOLUME', 'HEADLOSS'].includes(parts[1]?.toUpperCase())) {
        curve.type = parts[1].toUpperCase() as INPCurve['type'];
        if (parts.length >= 4) {
          curve.points.push({ x: parseFloat(parts[2]), y: parseFloat(parts[3]) });
        }
      } else if (parts.length >= 3) {
        curve.points.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
      }
    });

    return Array.from(curves.entries()).map(([id, data]) => ({
      id,
      type: (data.type as INPCurve['type']) || 'PUMP',
      points: data.points
    }));
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractEntities(inpData: INPFile): RawEntity[] {
    const entities: RawEntity[] = [];
    const coordMap = new Map(inpData.coordinates.map(c => [c.nodeId, c]));
    const vertexMap = new Map<string, INPVertex[]>();

    // Agrupar vertices por link
    inpData.vertices.forEach(v => {
      if (!vertexMap.has(v.linkId)) {
        vertexMap.set(v.linkId, []);
      }
      vertexMap.get(v.linkId)!.push(v);
    });

    // JUNCTIONS
    inpData.junctions.forEach(junction => {
      const coord = coordMap.get(junction.id);
      entities.push({
        id: junction.id,
        type: 'JUNCTION',
        geometry: coord ? {
          type: 'Point',
          coordinates: [coord.x, coord.y, junction.elevation]
        } : null,
        attributes: {
          elevation: junction.elevation,
          demand: junction.demand,
          pattern: junction.pattern
        }
      });
    });

    // RESERVOIRS
    inpData.reservoirs.forEach(reservoir => {
      const coord = coordMap.get(reservoir.id);
      entities.push({
        id: reservoir.id,
        type: 'RESERVOIR',
        geometry: coord ? {
          type: 'Point',
          coordinates: [coord.x, coord.y, reservoir.head]
        } : null,
        attributes: {
          head: reservoir.head,
          pattern: reservoir.pattern
        }
      });
    });

    // TANKS
    inpData.tanks.forEach(tank => {
      const coord = coordMap.get(tank.id);
      entities.push({
        id: tank.id,
        type: 'TANK',
        geometry: coord ? {
          type: 'Point',
          coordinates: [coord.x, coord.y, tank.elevation]
        } : null,
        attributes: {
          elevation: tank.elevation,
          initLevel: tank.initLevel,
          minLevel: tank.minLevel,
          maxLevel: tank.maxLevel,
          diameter: tank.diameter,
          minVol: tank.minVol,
          volCurve: tank.volCurve
        }
      });
    });

    // PIPES
    inpData.pipes.forEach(pipe => {
      const startCoord = coordMap.get(pipe.node1);
      const endCoord = coordMap.get(pipe.node2);
      const vertices = vertexMap.get(pipe.id) || [];

      let geometry = null;
      if (startCoord && endCoord) {
        const startJunction = inpData.junctions.find(j => j.id === pipe.node1);
        const endJunction = inpData.junctions.find(j => j.id === pipe.node2);

        const coords: number[][] = [
          [startCoord.x, startCoord.y, startJunction?.elevation || 0]
        ];

        // Adicionar vertices intermediários
        vertices.forEach(v => {
          coords.push([v.x, v.y, 0]);
        });

        coords.push([endCoord.x, endCoord.y, endJunction?.elevation || 0]);

        geometry = { type: 'LineString', coordinates: coords };
      }

      entities.push({
        id: pipe.id,
        type: 'PIPE',
        geometry,
        attributes: {
          node1: pipe.node1,
          node2: pipe.node2,
          length: pipe.length,
          diameter: pipe.diameter,
          roughness: pipe.roughness,
          minorLoss: pipe.minorLoss,
          status: pipe.status
        }
      });
    });

    // PUMPS
    inpData.pumps.forEach(pump => {
      const startCoord = coordMap.get(pump.node1);
      const endCoord = coordMap.get(pump.node2);

      let geometry = null;
      if (startCoord && endCoord) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [startCoord.x, startCoord.y, 0],
            [endCoord.x, endCoord.y, 0]
          ]
        };
      }

      entities.push({
        id: pump.id,
        type: 'PUMP',
        geometry,
        attributes: {
          node1: pump.node1,
          node2: pump.node2,
          parameters: pump.parameters
        }
      });
    });

    // VALVES
    inpData.valves.forEach(valve => {
      const startCoord = coordMap.get(valve.node1);
      const endCoord = coordMap.get(valve.node2);

      let geometry = null;
      if (startCoord && endCoord) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [startCoord.x, startCoord.y, 0],
            [endCoord.x, endCoord.y, 0]
          ]
        };
      }

      entities.push({
        id: valve.id,
        type: 'VALVE',
        geometry,
        attributes: {
          node1: valve.node1,
          node2: valve.node2,
          diameter: valve.diameter,
          type: valve.type,
          setting: valve.setting,
          minorLoss: valve.minorLoss
        }
      });
    });

    return entities;
  }

  // --------------------------------------------------------------------------
  // Convert to Internal Model (PRESERVANDO DADOS ORIGINAIS)
  // --------------------------------------------------------------------------

  convertToInternalModel(inpData: INPFile): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];

    const coordMap = new Map(inpData.coordinates.map(c => [c.nodeId, c]));
    const vertexMap = new Map<string, INPVertex[]>();

    inpData.vertices.forEach(v => {
      if (!vertexMap.has(v.linkId)) {
        vertexMap.set(v.linkId, []);
      }
      vertexMap.get(v.linkId)!.push(v);
    });

    // JUNCTIONS → nodes
    inpData.junctions.forEach(junction => {
      const coord = coordMap.get(junction.id);
      nodes.push({
        id: junction.id,
        x: coord?.x || 0,
        y: coord?.y || 0,
        z: junction.elevation,
        type: 'junction',
        groundElevation: junction.elevation,
        invertElevation: junction.elevation,
        depth: 0,
        connectedEdges: [],
        demand: junction.demand,        // MANTER ORIGINAL
        pattern: junction.pattern,      // MANTER ORIGINAL
        attributes: { ...junction }     // MANTER TODOS OS ATRIBUTOS
      });
    });

    // RESERVOIRS → nodes
    inpData.reservoirs.forEach(reservoir => {
      const coord = coordMap.get(reservoir.id);
      nodes.push({
        id: reservoir.id,
        x: coord?.x || 0,
        y: coord?.y || 0,
        z: reservoir.head,
        type: 'reservoir',
        groundElevation: reservoir.head,
        invertElevation: reservoir.head,
        depth: 0,
        connectedEdges: [],
        head: reservoir.head,           // MANTER ORIGINAL
        attributes: { ...reservoir }
      });
    });

    // TANKS → nodes
    inpData.tanks.forEach(tank => {
      const coord = coordMap.get(tank.id);
      nodes.push({
        id: tank.id,
        x: coord?.x || 0,
        y: coord?.y || 0,
        z: tank.elevation,
        type: 'tank',
        groundElevation: tank.elevation,
        invertElevation: tank.elevation,
        depth: 0,
        connectedEdges: [],
        initialLevel: tank.initLevel,   // MANTER ORIGINAL
        minLevel: tank.minLevel,        // MANTER ORIGINAL
        maxLevel: tank.maxLevel,        // MANTER ORIGINAL
        attributes: { ...tank }
      });
    });

    // PIPES → edges
    inpData.pipes.forEach(pipe => {
      const startCoord = coordMap.get(pipe.node1);
      const endCoord = coordMap.get(pipe.node2);
      const vertices = vertexMap.get(pipe.id) || [];

      const startJunction = inpData.junctions.find(j => j.id === pipe.node1);
      const endJunction = inpData.junctions.find(j => j.id === pipe.node2);

      const coords: number[][] = [];
      if (startCoord) {
        coords.push([startCoord.x, startCoord.y, startJunction?.elevation || 0]);
      }
      vertices.forEach(v => coords.push([v.x, v.y, 0]));
      if (endCoord) {
        coords.push([endCoord.x, endCoord.y, endJunction?.elevation || 0]);
      }

      edges.push({
        id: pipe.id,
        startNodeId: pipe.node1,
        endNodeId: pipe.node2,
        geometry: { type: 'LineString', coordinates: coords },
        dn: pipe.diameter,
        length: pipe.length,               // MANTER ORIGINAL
        slope: 0,
        material: '',
        type: 'pipe',
        roughness: pipe.roughness,         // MANTER ORIGINAL
        minorloss: pipe.minorLoss,         // MANTER ORIGINAL
        status: pipe.status as any,        // MANTER ORIGINAL
        attributes: { ...pipe }
      });
    });

    // PUMPS → edges especiais
    inpData.pumps.forEach(pump => {
      const startCoord = coordMap.get(pump.node1);
      const endCoord = coordMap.get(pump.node2);

      edges.push({
        id: pump.id,
        startNodeId: pump.node1,
        endNodeId: pump.node2,
        geometry: {
          type: 'LineString',
          coordinates: [
            [startCoord?.x || 0, startCoord?.y || 0, 0],
            [endCoord?.x || 0, endCoord?.y || 0, 0]
          ]
        },
        dn: 0,
        length: 0,
        slope: 0,
        material: '',
        type: 'pump',
        attributes: { ...pump }
      });
    });

    // VALVES → edges especiais
    inpData.valves.forEach(valve => {
      const startCoord = coordMap.get(valve.node1);
      const endCoord = coordMap.get(valve.node2);

      edges.push({
        id: valve.id,
        startNodeId: valve.node1,
        endNodeId: valve.node2,
        geometry: {
          type: 'LineString',
          coordinates: [
            [startCoord?.x || 0, startCoord?.y || 0, 0],
            [endCoord?.x || 0, endCoord?.y || 0, 0]
          ]
        },
        dn: valve.diameter,
        length: 0,
        slope: 0,
        material: '',
        type: 'valve',
        valveType: valve.type as any,      // MANTER ORIGINAL
        setting: valve.setting,            // MANTER ORIGINAL
        attributes: { ...valve }
      });
    });

    // Atualizar conexões dos nós
    edges.forEach(edge => {
      const startNode = nodes.find(n => n.id === edge.startNodeId);
      const endNode = nodes.find(n => n.id === edge.endNodeId);

      if (startNode) startNode.connectedEdges.push(edge.id);
      if (endNode) endNode.connectedEdges.push(edge.id);
    });

    return { nodes, edges };
  }

  // --------------------------------------------------------------------------
  // Metadata Analysis
  // --------------------------------------------------------------------------

  private analyzeMetadata(inpData: INPFile, entities: RawEntity[]): ImportMetadata {
    const entityTypes = this.groupEntityTypes(entities);

    // Detectar unidades do arquivo
    const units = inpData.options['UNITS'] || 'LPS';

    return {
      detectedCRS: null,  // INP não tem CRS
      detectedUnit: units.includes('SI') || units === 'LPS' || units === 'LPM' ? 'meters' : 'feet',
      hasZ: true,
      geometryType: 'mixed',
      entityTypes,
      numericFormat: 'american',
      totalEntities: entities.length
    };
  }

  private groupEntityTypes(entities: RawEntity[]): ImportMetadata['entityTypes'] {
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
      suggestedImportAs: ['JUNCTION', 'RESERVOIR', 'TANK'].includes(type) ? 'node' : 'edge',
      hasZ: true,
      sampleAttributes: this.getSampleAttributes(items)
    }));
  }

  private getSampleAttributes(items: RawEntity[]): string[] {
    const attrs = new Set<string>();
    items.slice(0, 5).forEach(item => {
      Object.keys(item.attributes).forEach(key => attrs.add(key));
    });
    return Array.from(attrs);
  }
}

// Singleton instance
export const INPReader = new INPReaderImpl();
