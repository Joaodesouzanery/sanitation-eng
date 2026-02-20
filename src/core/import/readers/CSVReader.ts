/**
 * CSV Reader - Leitor de arquivos CSV/TXT com coordenadas
 */

import { RawEntity, RawImportData, ImportMetadata } from '../ImportEngine';
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
  dataType: 'string' | 'number' | 'coordinate' | 'unknown';
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
      const sampleValues = rows.slice(0, 10).map(row => row[index] || '').filter(v => v);
      const dataType = this.detectDataType(sampleValues);

      return { name, index, sampleValues, dataType };
    });
  }

  private detectDataType(values: string[]): CSVColumn['dataType'] {
    if (values.length === 0) return 'unknown';

    let numericCount = 0;
    let coordinateCount = 0;

    for (const value of values) {
      const parsed = NumericParser.parseAuto(value);

      if (!isNaN(parsed.value)) {
        numericCount++;

        // Verificar se parece coordenada
        if (parsed.value > 100000 && parsed.value < 10000000) {
          coordinateCount++;
        }
      }
    }

    if (coordinateCount > values.length * 0.8) return 'coordinate';
    if (numericCount > values.length * 0.8) return 'number';
    return 'string';
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

    return {
      detectedCRS: null,
      detectedUnit: null,
      hasZ: zColumn !== null,
      geometryType: xColumn && yColumn ? 'point' : 'mixed',
      entityTypes: [{
        type: 'CSV_ROW',
        count: entities.length,
        suggestedImportAs: xColumn && yColumn ? 'node' : 'ignore',
        hasZ: zColumn !== null,
        sampleAttributes: parsedData.headers
      }],
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
