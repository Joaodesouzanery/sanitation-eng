/**
 * IFC Reader - Leitor de arquivos IFC com Georreferência
 *
 * Suporta leitura de elementos BIM e transformação para coordenadas reais.
 */

import { Feature, LineString, Point } from 'geojson';
import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IFCSite {
  hasGeoReference: boolean;
  refLatitude?: number;
  refLongitude?: number;
  refElevation?: number;
  trueNorth?: number;
}

export interface IFCElement {
  id: string;
  globalId: string;
  type: string;
  name: string;
  description?: string;
  geometry: any;
  properties: Record<string, any>;
  relationships: string[];
}

export interface IFCTransformation {
  basePoint: { x: number; y: number; z: number };
  rotation: number;      // Graus
  scaleFactor: number;
}

export interface IFCImportResult {
  site: IFCSite;
  elements: IFCElement[];
  transformation?: IFCTransformation;
}

// ============================================================================
// IFC READER CLASS
// ============================================================================

class IFCReaderImpl {

  // --------------------------------------------------------------------------
  // Main Reading
  // --------------------------------------------------------------------------

  async read(file: File): Promise<RawImportData> {
    const arrayBuffer = await file.arrayBuffer();

    // Parse IFC content
    const content = await this.parseIFC(arrayBuffer);

    // Extract entities
    const entities = this.extractEntities(content);

    // Analyze metadata
    const metadata = this.analyzeMetadata(content, entities);

    return {
      fileType: 'IFC',
      fileName: file.name,
      fileSize: file.size,
      rawContent: content,
      entities,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // IFC Parsing
  // --------------------------------------------------------------------------

  private async parseIFC(buffer: ArrayBuffer): Promise<IFCImportResult> {
    // Converter para string (IFC é texto STEP)
    const decoder = new TextDecoder('utf-8');
    const content = decoder.decode(buffer);

    // Extrair site/georreferência
    const site = this.extractSite(content);

    // Extrair elementos
    const elements = this.extractIFCElements(content);

    return { site, elements };
  }

  private extractSite(content: string): IFCSite {
    const site: IFCSite = { hasGeoReference: false };

    // Procurar IfcSite
    const siteMatch = content.match(/IFCSITE\((.*?)\);/i);
    if (siteMatch) {
      const siteData = siteMatch[1];

      // Extrair RefLatitude
      const latMatch = siteData.match(/\((\d+),(\d+),(\d+)(?:,(\d+))?\)/);
      if (latMatch) {
        site.refLatitude = this.dmsToDecimal(
          parseInt(latMatch[1]),
          parseInt(latMatch[2]),
          parseInt(latMatch[3]),
          parseInt(latMatch[4] || '0')
        );
        site.hasGeoReference = true;
      }

      // Extrair RefLongitude
      const lonMatch = siteData.match(/\),\((-?\d+),(\d+),(\d+)(?:,(\d+))?\)/);
      if (lonMatch) {
        site.refLongitude = this.dmsToDecimal(
          parseInt(lonMatch[1]),
          parseInt(lonMatch[2]),
          parseInt(lonMatch[3]),
          parseInt(lonMatch[4] || '0')
        );
      }

      // Extrair RefElevation
      const elevMatch = siteData.match(/,(\d+\.?\d*),/);
      if (elevMatch) {
        site.refElevation = parseFloat(elevMatch[1]);
      }
    }

    // Procurar IfcMapConversion (IFC4)
    const mapConvMatch = content.match(/IFCMAPCONVERSION\((.*?)\);/i);
    if (mapConvMatch) {
      site.hasGeoReference = true;
      // Extrair parâmetros de conversão
    }

    return site;
  }

  private dmsToDecimal(degrees: number, minutes: number, seconds: number, fraction: number = 0): number {
    const sign = degrees < 0 ? -1 : 1;
    return sign * (Math.abs(degrees) + minutes / 60 + (seconds + fraction / 1000000) / 3600);
  }

  private extractIFCElements(content: string): IFCElement[] {
    const elements: IFCElement[] = [];

    // Padrões para elementos de interesse em saneamento
    const patterns = [
      /IFCPIPESEGMENT\(([^)]+)\)/gi,
      /IFCPIPEFITTING\(([^)]+)\)/gi,
      /IFCFLOWSEGMENT\(([^)]+)\)/gi,
      /IFCFLOWFITTING\(([^)]+)\)/gi,
      /IFCPUMP\(([^)]+)\)/gi,
      /IFCVALVE\(([^)]+)\)/gi,
      /IFCTANK\(([^)]+)\)/gi,
      /IFCFLOWCONTROLLER\(([^)]+)\)/gi
    ];

    let idCounter = 0;

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const elementData = match[1];
        const element = this.parseIFCElement(match[0], elementData, idCounter++);
        if (element) {
          elements.push(element);
        }
      }
    });

    return elements;
  }

  private parseIFCElement(fullMatch: string, data: string, index: number): IFCElement | null {
    const parts = data.split(',').map(p => p.trim());

    // Extrair tipo do match
    const typeMatch = fullMatch.match(/IFC(\w+)\(/i);
    const type = typeMatch ? typeMatch[1] : 'UNKNOWN';

    // Extrair GlobalId (primeiro parâmetro)
    const globalId = parts[0]?.replace(/'/g, '') || `element_${index}`;

    // Extrair Name (geralmente o terceiro parâmetro após referências)
    let name = '';
    for (const part of parts) {
      if (part.startsWith("'") && part.endsWith("'")) {
        name = part.replace(/'/g, '');
        break;
      }
    }

    return {
      id: `ifc_${index}`,
      globalId,
      type,
      name: name || `${type}_${index}`,
      geometry: null,  // Geometria será extraída separadamente
      properties: {},
      relationships: []
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractEntities(content: IFCImportResult): RawEntity[] {
    return content.elements.map(element => ({
      id: element.id,
      type: `Ifc${element.type}`,
      geometry: element.geometry,
      attributes: {
        globalId: element.globalId,
        name: element.name,
        description: element.description,
        ...element.properties
      }
    }));
  }

  // --------------------------------------------------------------------------
  // Metadata Analysis
  // --------------------------------------------------------------------------

  private analyzeMetadata(content: IFCImportResult, entities: RawEntity[]): ImportMetadata {
    const entityTypes = this.groupEntityTypes(entities);

    return {
      detectedCRS: content.site.hasGeoReference ? 'WGS84' : null,
      detectedUnit: 'meters',  // IFC geralmente usa metros
      hasZ: true,
      geometryType: 'mixed',
      entityTypes,
      numericFormat: 'american',  // IFC usa formato americano
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
      suggestedImportAs: this.suggestImportType(type),
      hasZ: true,
      sampleAttributes: this.getSampleAttributes(items)
    }));
  }

  private suggestImportType(type: string): 'edge' | 'node' | 'drawing' | 'ignore' {
    const edgeTypes = ['PIPESEGMENT', 'FLOWSEGMENT', 'CONDUIT'];
    const nodeTypes = ['PUMP', 'VALVE', 'TANK', 'PIPEFITTING', 'FLOWFITTING'];

    const upperType = type.toUpperCase();

    if (edgeTypes.some(t => upperType.includes(t))) return 'edge';
    if (nodeTypes.some(t => upperType.includes(t))) return 'node';

    return 'ignore';
  }

  private getSampleAttributes(items: RawEntity[]): string[] {
    const attrs = new Set<string>();
    items.slice(0, 5).forEach(item => {
      Object.keys(item.attributes).forEach(key => attrs.add(key));
    });
    return Array.from(attrs);
  }

  // --------------------------------------------------------------------------
  // Transformation
  // --------------------------------------------------------------------------

  createTransformationDialog(): IFCTransformation {
    // Valores padrão - em produção, isso seria um modal
    return {
      basePoint: { x: 0, y: 0, z: 0 },
      rotation: 0,
      scaleFactor: 1
    };
  }

  applyTransformation(
    elements: IFCElement[],
    transformation: IFCTransformation
  ): IFCElement[] {
    const { basePoint, rotation, scaleFactor } = transformation;
    const rotRad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    return elements.map(element => {
      if (!element.geometry?.coordinates) return element;

      const transformCoord = (coord: number[]): number[] => {
        // Escalar
        let x = coord[0] * scaleFactor;
        let y = coord[1] * scaleFactor;
        let z = (coord[2] || 0) * scaleFactor;

        // Rotacionar
        const rotX = x * cos - y * sin;
        const rotY = x * sin + y * cos;

        // Transladar
        return [
          rotX + basePoint.x,
          rotY + basePoint.y,
          z + basePoint.z
        ];
      };

      // Aplicar transformação à geometria
      const newGeometry = { ...element.geometry };

      if (Array.isArray(newGeometry.coordinates[0])) {
        newGeometry.coordinates = newGeometry.coordinates.map(transformCoord);
      } else {
        newGeometry.coordinates = transformCoord(newGeometry.coordinates);
      }

      return { ...element, geometry: newGeometry };
    });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  requiresTransformation(site: IFCSite): boolean {
    return !site.hasGeoReference;
  }

  getGeoReferenceInfo(site: IFCSite): string {
    if (!site.hasGeoReference) {
      return 'IFC sem georreferência. Transformação manual necessária.';
    }

    return `Georreferenciado: Lat ${site.refLatitude?.toFixed(6)}, Lon ${site.refLongitude?.toFixed(6)}, Elev ${site.refElevation}m`;
  }
}

// Singleton instance
export const IFCReader = new IFCReaderImpl();
