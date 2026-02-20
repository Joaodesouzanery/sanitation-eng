/**
 * CSV Reader - Leitor de arquivos CSV/TXT com coordenadas
 *
 * LEITURA INTEGRAL: Este reader foi otimizado para extrair TODOS os atributos
 * disponíveis em arquivos CSV/TXT, incluindo:
 * - Campos de coordenadas (X, Y, Z)
 * - Campos de conectividade (startNode, endNode, de, para)
 * - Campos de rede (diâmetro, material, comprimento, declividade)
 * - Campos personalizados
 */

import { RawEntity, RawImportData, ImportMetadata, EntityTypeInfo } from '../ImportEngine';
import { NumericParser } from '../NumericParser';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CSVParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  skipRows?: number;
  trimValues?: boolean;
}

export interface CSVColumn {
  name: string;
  index: number;
  sampleValues: string[];
  dataType: 'string' | 'number' | 'coordinate' | 'id' | 'node_reference' | 'unknown';
  suggestedMapping?: string; // Campo do sistema sugerido
}

// ============================================================================
// CSV READER CLASS
// ============================================================================

class CSVReaderImpl {

  async read(file: File, options?: CSVParseOptions): Promise<RawImportData> {
    const content = await file.text();

    const parsedData = this.parseCSV(content, options);
    const entities = this.extractEntities(parsedData);
    const metadata = this.analyzeMetadata(parsedData, entities);

    return {
      fileType: 'CSV',
      fileName: file.name,
      fileSize: file.size,
      rawContent: parsedData,
      entities,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // CSV Parsing
  // --------------------------------------------------------------------------

  parseCSV(content: string, options?: CSVParseOptions): {
    headers: string[];
    rows: string[][];
    columns: CSVColumn[];
  } {
    const opts: CSVParseOptions = {
      delimiter: this.detectDelimiter(content),
      hasHeader: true,
      trimValues: true,
      skipRows: 0,
      ...options
    };

    const lines = content.split(/\r?\n/).filter(l => l.trim());

    // Pular linhas iniciais se necessário
    const dataLines = lines.slice(opts.skipRows || 0);

    if (dataLines.length === 0) {
      return { headers: [], rows: [], columns: [] };
    }

    // Extrair headers
    let headers: string[];
    let dataStart: number;

    if (opts.hasHeader) {
      headers = this.parseLine(dataLines[0], opts.delimiter!);
      dataStart = 1;
    } else {
      const firstRow = this.parseLine(dataLines[0], opts.delimiter!);
      headers = firstRow.map((_, i) => `Column_${i + 1}`);
      dataStart = 0;
    }

    // Limpar headers
    headers = headers.map(h => opts.trimValues ? h.trim() : h);

    // Extrair rows
    const rows: string[][] = [];
    for (let i = dataStart; i < dataLines.length; i++) {
      const values = this.parseLine(dataLines[i], opts.delimiter!);
      if (values.length > 0) {
        rows.push(opts.trimValues ? values.map(v => v.trim()) : values);
      }
    }

    // Analisar colunas
    const columns = this.analyzeColumns(headers, rows);

    return { headers, rows, columns };
  }

  private detectDelimiter(content: string): string {
    const firstLine = content.split(/\r?\n/)[0];

    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(d => ({
      delimiter: d,
      count: (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length
    }));

    const best = counts.reduce((a, b) => a.count > b.count ? a : b);
    return best.count > 0 ? best.delimiter : ',';
  }

  private parseLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private analyzeColumns(headers: string[], rows: string[][]): CSVColumn[] {
    return headers.map((name, index) => {
      // Coletar TODAS as amostras, não apenas as primeiras 10
      const sampleValues = rows.slice(0, Math.min(100, rows.length))
        .map(row => row[index] || '')
        .filter(v => v.trim() !== '');
      const dataType = this.detectDataType(sampleValues, name);
      const suggestedMapping = this.suggestMapping(name);

      return { name, index, sampleValues, dataType, suggestedMapping };
    });
  }

  private detectDataType(values: string[], columnName: string): CSVColumn['dataType'] {
    if (values.length === 0) return 'unknown';

    const nameLower = columnName.toLowerCase();

    // Verificar se é referência de nó (startNode, endNode, de, para, no_inicio, no_fim)
    const nodeRefPatterns = [
      /^(no|node|n[oó])[_\s]?(inicio|ini|start|montante|m)$/i,
      /^(no|node|n[oó])[_\s]?(fim|end|final|jusante|j)$/i,
      /^(de|from|origem|start[_\s]?node)$/i,
      /^(para|to|destino|end[_\s]?node)$/i,
      /^(pv|poço|poco|mh)[_\s]?(mont|jus|ini|fim|1|2)$/i,
      /^id[_\s]?(inicio|fim|start|end)$/i
    ];

    for (const pattern of nodeRefPatterns) {
      if (pattern.test(nameLower)) {
        return 'node_reference';
      }
    }

    // Verificar se é ID
    const idPatterns = [/^id$/i, /^codigo$/i, /^code$/i, /^identificador$/i, /^nome$/i, /^name$/i, /^trecho$/i];
    for (const pattern of idPatterns) {
      if (pattern.test(nameLower)) {
        return 'id';
      }
    }

    let numericCount = 0;
    let coordinateCount = 0;

    for (const value of values) {
      const parsed = NumericParser.parseAuto(value);

      if (!isNaN(parsed.value)) {
        numericCount++;

        // Verificar se parece coordenada UTM (valores grandes)
        if (parsed.value > 100000 && parsed.value < 10000000) {
          coordinateCount++;
        }
      }
    }

    if (coordinateCount > values.length * 0.8) return 'coordinate';
    if (numericCount > values.length * 0.8) return 'number';
    return 'string';
  }

  /**
   * Sugere mapeamento automático baseado no nome da coluna
   */
  private suggestMapping(columnName: string): string | undefined {
    const nameLower = columnName.toLowerCase().trim();

    // Mapeamentos de coordenadas
    const xPatterns = [/^x$/i, /^coord[_\s]?x$/i, /^easting$/i, /^e$/i, /^longitude$/i, /^lon$/i, /^x[_\s]?utm$/i];
    const yPatterns = [/^y$/i, /^coord[_\s]?y$/i, /^northing$/i, /^n$/i, /^latitude$/i, /^lat$/i, /^y[_\s]?utm$/i];
    const zPatterns = [/^z$/i, /^coord[_\s]?z$/i, /^elevation$/i, /^elev$/i, /^altitude$/i, /^alt$/i, /^cota$/i, /^z[_\s]?utm$/i];

    for (const p of xPatterns) if (p.test(nameLower)) return 'x';
    for (const p of yPatterns) if (p.test(nameLower)) return 'y';
    for (const p of zPatterns) if (p.test(nameLower)) return 'z';

    // Mapeamentos de conectividade (TRECHOS)
    const startNodePatterns = [
      /^(no|node|n[oó])[_\s]?(inicio|ini|start|montante|m)$/i,
      /^(de|from|origem|start[_\s]?node)$/i,
      /^(pv|poço|poco|mh)[_\s]?(mont|ini|1)$/i,
      /^id[_\s]?(inicio|start)$/i,
      /^montante$/i, /^m$/i
    ];
    const endNodePatterns = [
      /^(no|node|n[oó])[_\s]?(fim|end|final|jusante|j)$/i,
      /^(para|to|destino|end[_\s]?node)$/i,
      /^(pv|poço|poco|mh)[_\s]?(jus|fim|2)$/i,
      /^id[_\s]?(fim|end)$/i,
      /^jusante$/i, /^j$/i
    ];

    for (const p of startNodePatterns) if (p.test(nameLower)) return 'startNode';
    for (const p of endNodePatterns) if (p.test(nameLower)) return 'endNode';

    // Mapeamentos de rede
    const diameterPatterns = [/^(diametro|diameter|dn|diam|d)$/i, /^di[aâ]metro$/i];
    const materialPatterns = [/^(material|mat|tipo[_\s]?mat)$/i];
    const lengthPatterns = [/^(comprimento|length|comp|ext|extensao|l)$/i];
    const slopePatterns = [/^(declividade|slope|decliv|inclinacao|i)$/i];
    const depthPatterns = [/^(profundidade|depth|prof|h)$/i];
    const groundElevPatterns = [/^(cota[_\s]?(terreno|terr|sup)?)$/i, /^(ground[_\s]?elev)$/i, /^ct$/i];
    const invertElevPatterns = [/^(cota[_\s]?(fundo|inv|inf|soleira))$/i, /^(invert[_\s]?elev)$/i, /^cf$/i];
    const idPatterns = [/^(id|codigo|code|nome|name|trecho|identificador)$/i];

    for (const p of diameterPatterns) if (p.test(nameLower)) return 'diameter';
    for (const p of materialPatterns) if (p.test(nameLower)) return 'material';
    for (const p of lengthPatterns) if (p.test(nameLower)) return 'length';
    for (const p of slopePatterns) if (p.test(nameLower)) return 'slope';
    for (const p of depthPatterns) if (p.test(nameLower)) return 'depth';
    for (const p of groundElevPatterns) if (p.test(nameLower)) return 'groundElevation';
    for (const p of invertElevPatterns) if (p.test(nameLower)) return 'invertElevation';
    for (const p of idPatterns) if (p.test(nameLower)) return 'id';

    // Coordenadas de início e fim (para trechos com geometria)
    if (/^x[_\s]?(inicio|ini|start|mont|1)$/i.test(nameLower)) return 'xStart';
    if (/^y[_\s]?(inicio|ini|start|mont|1)$/i.test(nameLower)) return 'yStart';
    if (/^z[_\s]?(inicio|ini|start|mont|1)$/i.test(nameLower)) return 'zStart';
    if (/^x[_\s]?(fim|end|jus|2)$/i.test(nameLower)) return 'xEnd';
    if (/^y[_\s]?(fim|end|jus|2)$/i.test(nameLower)) return 'yEnd';
    if (/^z[_\s]?(fim|end|jus|2)$/i.test(nameLower)) return 'zEnd';

    return undefined;
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  private extractEntities(parsedData: { headers: string[]; rows: string[][]; columns: CSVColumn[] }): RawEntity[] {
    return parsedData.rows.map((row, index) => {
      const attributes: Record<string, any> = {};

      parsedData.headers.forEach((header, i) => {
        attributes[header] = row[i] || '';
      });

      return {
        id: `row_${index}`,
        type: 'CSV_ROW',
        geometry: null,
        attributes
      };
    });
  }

  // --------------------------------------------------------------------------
  // Metadata Analysis
  // --------------------------------------------------------------------------

  private analyzeMetadata(
    parsedData: { headers: string[]; rows: string[][]; columns: CSVColumn[] },
    entities: RawEntity[]
  ): ImportMetadata {
    // Detectar formato numérico
    const numericColumns = parsedData.columns.filter(c =>
      c.dataType === 'number' || c.dataType === 'coordinate'
    );

    const allNumericValues = numericColumns.flatMap(c => c.sampleValues);
    const formatDetection = NumericParser.detectFormat(allNumericValues);

    // Detectar colunas de coordenadas
    const xColumn = this.findCoordinateColumn(parsedData.columns, 'x');
    const yColumn = this.findCoordinateColumn(parsedData.columns, 'y');
    const zColumn = this.findCoordinateColumn(parsedData.columns, 'z');

    // Detectar colunas de conectividade (TRECHOS)
    const startNodeColumn = parsedData.columns.find(c => c.suggestedMapping === 'startNode');
    const endNodeColumn = parsedData.columns.find(c => c.suggestedMapping === 'endNode');
    const hasTrechoData = startNodeColumn && endNodeColumn;

    // Detectar coordenadas de início/fim (para trechos com geometria embutida)
    const xStartColumn = parsedData.columns.find(c => c.suggestedMapping === 'xStart');
    const yStartColumn = parsedData.columns.find(c => c.suggestedMapping === 'yStart');
    const xEndColumn = parsedData.columns.find(c => c.suggestedMapping === 'xEnd');
    const yEndColumn = parsedData.columns.find(c => c.suggestedMapping === 'yEnd');
    const hasGeometricTrechoData = xStartColumn && yStartColumn && xEndColumn && yEndColumn;

    // Determinar tipo de geometria e tipo de importação sugerido
    let geometryType: 'point' | 'line' | 'polygon' | 'mixed' = 'mixed';
    let suggestedImportAs: 'edge' | 'node' | 'drawing' | 'ignore' = 'ignore';

    if (hasTrechoData || hasGeometricTrechoData) {
      geometryType = 'line';
      suggestedImportAs = 'edge';
    } else if (xColumn && yColumn) {
      geometryType = 'point';
      suggestedImportAs = 'node';
    }

    // Criar lista de tipos de entidade com base na análise
    const entityTypes: EntityTypeInfo[] = [];

    if (hasTrechoData) {
      entityTypes.push({
        type: 'TRECHO_TABULAR',
        count: entities.length,
        suggestedImportAs: 'edge',
        hasZ: zColumn !== null,
        sampleAttributes: parsedData.headers
      });
    }

    if (hasGeometricTrechoData) {
      entityTypes.push({
        type: 'TRECHO_GEOMETRICO',
        count: entities.length,
        suggestedImportAs: 'edge',
        hasZ: zColumn !== null,
        sampleAttributes: parsedData.headers
      });
    }

    if (xColumn && yColumn && !hasTrechoData && !hasGeometricTrechoData) {
      entityTypes.push({
        type: 'PONTO',
        count: entities.length,
        suggestedImportAs: 'node',
        hasZ: zColumn !== null,
        sampleAttributes: parsedData.headers
      });
    }

    // Sempre adicionar CSV_ROW como fallback
    if (entityTypes.length === 0) {
      entityTypes.push({
        type: 'CSV_ROW',
        count: entities.length,
        suggestedImportAs: suggestedImportAs,
        hasZ: zColumn !== null,
        sampleAttributes: parsedData.headers
      });
    }

    return {
      detectedCRS: null,
      detectedUnit: null,
      hasZ: zColumn !== null,
      geometryType: geometryType,
      entityTypes,
      numericFormat: formatDetection.format,
      totalEntities: entities.length
    };
  }

  private findCoordinateColumn(columns: CSVColumn[], axis: 'x' | 'y' | 'z'): CSVColumn | null {
    const patterns: Record<string, RegExp[]> = {
      x: [/^x$/i, /^coord[_\s]?x$/i, /^easting$/i, /^e$/i, /^longitude$/i, /^lon$/i],
      y: [/^y$/i, /^coord[_\s]?y$/i, /^northing$/i, /^n$/i, /^latitude$/i, /^lat$/i],
      z: [/^z$/i, /^coord[_\s]?z$/i, /^elevation$/i, /^elev$/i, /^altitude$/i, /^alt$/i, /^cota$/i]
    };

    for (const column of columns) {
      for (const pattern of patterns[axis]) {
        if (pattern.test(column.name)) {
          return column;
        }
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  getColumnNames(parsedData: { headers: string[] }): string[] {
    return parsedData.headers;
  }

  getCoordinateColumns(columns: CSVColumn[]): {
    x: CSVColumn | null;
    y: CSVColumn | null;
    z: CSVColumn | null;
  } {
    return {
      x: this.findCoordinateColumn(columns, 'x'),
      y: this.findCoordinateColumn(columns, 'y'),
      z: this.findCoordinateColumn(columns, 'z')
    };
  }

  previewData(parsedData: { headers: string[]; rows: string[][] }, maxRows: number = 10): {
    headers: string[];
    rows: string[][];
  } {
    return {
      headers: parsedData.headers,
      rows: parsedData.rows.slice(0, maxRows)
    };
  }
}

export const CSVReader = new CSVReaderImpl();
