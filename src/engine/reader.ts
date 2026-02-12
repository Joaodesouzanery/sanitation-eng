/**
 * Topography Reader Module
 *
 * This module provides functions for reading topographic data from
 * CSV and Excel files in the browser environment.
 */

export interface PontoTopografico {
  id: string;
  x: number;
  y: number;
  cota: number;
}

export interface TopographyData {
  pontos: PontoTopografico[];
  metadata: {
    source: string;
    totalPoints: number;
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minCota: number;
      maxCota: number;
    };
    importedAt: string;
  };
}

/**
 * Check if a string looks like a header column name (non-numeric text)
 */
function isHeaderColumn(value: string): boolean {
  const cleaned = value.replace(',', '.').trim();
  // If it's a pure number, it's not a header
  if (!isNaN(parseFloat(cleaned)) && isFinite(Number(cleaned))) {
    return false;
  }
  // Check for common header names
  const headerNames = ['id', 'ponto', 'nome', 'x', 'y', 'z', 'cota', 'este', 'norte',
                       'easting', 'northing', 'elevacao', 'elevation', 'coord', 'point',
                       'lat', 'lon', 'lng', 'latitude', 'longitude', 'alt', 'altitude'];
  return headerNames.some(h => cleaned.toLowerCase().includes(h)) ||
         /^[a-zA-Z_]/.test(cleaned); // Starts with letter or underscore
}

/**
 * Detect if the first line of CSV is a header or data
 */
function hasHeader(firstLine: string, delimiter: string): boolean {
  const values = firstLine.split(delimiter).map(v => v.trim());
  // If most columns look like header names, it's a header
  const headerCount = values.filter(v => isHeaderColumn(v)).length;
  return headerCount >= values.length / 2;
}

/**
 * Parse CSV content into topographic points.
 *
 * Supports files with or without headers.
 * Expected columns: id, x, y, cota (or just x, y, cota without id)
 *
 * File formats supported:
 * - With header: id,x,y,cota or ponto,este,norte,z etc.
 * - Without header (3 columns): x,y,cota - IDs generated as P1, P2, etc.
 * - Without header (4 columns): id,x,y,cota
 * - Delimiters: comma (,), semicolon (;), tab, or space
 *
 * @param content - CSV file content as string
 * @param delimiter - Column delimiter (default: ',')
 * @returns Array of PontoTopografico objects
 */
export function parseCSV(content: string, delimiter = ','): PontoTopografico[] {
  const lines = content.trim().split('\n').filter(line => line.trim());
  if (lines.length < 1) {
    throw new Error('CSV file is empty');
  }

  // Detect delimiter if not working
  let effectiveDelimiter = delimiter;
  const firstLine = lines[0];

  // Try to detect delimiter
  if (firstLine.split(delimiter).length < 3) {
    // Try other delimiters
    const delimiters = [';', '\t', ',', ' '];
    for (const d of delimiters) {
      const parts = firstLine.split(d).filter(p => p.trim());
      if (parts.length >= 3) {
        effectiveDelimiter = d;
        break;
      }
    }
  }

  // Check if first line is a header
  const fileHasHeader = hasHeader(firstLine, effectiveDelimiter);

  let idIndex = -1;
  let xIndex = -1;
  let yIndex = -1;
  let cotaIndex = -1;
  let dataStartLine = 0;

  if (fileHasHeader) {
    // Parse header
    const header = firstLine.toLowerCase().split(effectiveDelimiter).map(h => h.trim());
    idIndex = header.findIndex(h => h === 'id' || h === 'ponto' || h === 'nome' || h === 'point');
    xIndex = header.findIndex(h => h === 'x' || h === 'este' || h === 'easting' || h === 'e' || h === 'lon' || h === 'longitude');
    yIndex = header.findIndex(h => h === 'y' || h === 'norte' || h === 'northing' || h === 'n' || h === 'lat' || h === 'latitude');
    cotaIndex = header.findIndex(h => h === 'cota' || h === 'z' || h === 'elevacao' || h === 'elevation' || h === 'alt' || h === 'altitude' || h === 'h');

    // If we can't find proper columns, assume positional
    if (xIndex === -1 || yIndex === -1 || cotaIndex === -1) {
      const numCols = header.length;
      if (numCols >= 4) {
        // Assume: id, x, y, cota
        idIndex = 0;
        xIndex = 1;
        yIndex = 2;
        cotaIndex = 3;
      } else if (numCols >= 3) {
        // Assume: x, y, cota
        idIndex = -1;
        xIndex = 0;
        yIndex = 1;
        cotaIndex = 2;
      } else {
        throw new Error(
          `Arquivo precisa ter pelo menos 3 colunas (x, y, cota). Encontrado: ${numCols} colunas`
        );
      }
    }
    dataStartLine = 1;
  } else {
    // No header - assume columns by position
    const numCols = firstLine.split(effectiveDelimiter).filter(v => v.trim()).length;
    if (numCols >= 4) {
      // Assume: id, x, y, cota
      idIndex = 0;
      xIndex = 1;
      yIndex = 2;
      cotaIndex = 3;
    } else if (numCols >= 3) {
      // Assume: x, y, cota (most common for topography files)
      idIndex = -1;
      xIndex = 0;
      yIndex = 1;
      cotaIndex = 2;
    } else {
      throw new Error(
        `Arquivo precisa ter pelo menos 3 colunas (x, y, cota). Encontrado: ${numCols} colunas. ` +
        `Primeira linha: "${firstLine.substring(0, 100)}"`
      );
    }
    dataStartLine = 0;
  }

  const pontos: PontoTopografico[] = [];
  let autoId = 1;

  for (let i = dataStartLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip comment lines
    if (line.startsWith('#') || line.startsWith('//')) continue;

    const values = line.split(effectiveDelimiter).map(v => v.trim()).filter(v => v);

    if (values.length < 3) {
      console.warn(`Pulando linha ${i + 1} com dados insuficientes: ${line}`);
      continue;
    }

    // Get ID or generate one
    let id: string;
    if (idIndex >= 0 && values[idIndex]) {
      id = values[idIndex];
    } else {
      id = `P${autoId}`;
      autoId++;
    }

    // Parse coordinates - handle both comma and dot as decimal separator
    const parseCoord = (val: string): number => {
      if (!val) return NaN;
      // Replace comma with dot for decimal
      return parseFloat(val.replace(',', '.'));
    };

    const x = parseCoord(values[xIndex]);
    const y = parseCoord(values[yIndex]);
    const cota = parseCoord(values[cotaIndex]);

    if (isNaN(x) || isNaN(y) || isNaN(cota)) {
      console.warn(`Pulando linha ${i + 1} com valores inválidos: ${line}`);
      continue;
    }

    pontos.push({ id, x, y, cota });
  }

  if (pontos.length === 0) {
    throw new Error(
      'Nenhum ponto válido encontrado no arquivo. ' +
      'Verifique se o arquivo contém dados no formato: x, y, cota (com ou sem cabeçalho)'
    );
  }

  console.log(`Importados ${pontos.length} pontos do arquivo`);
  return pontos;
}

/**
 * Parse Excel workbook data into topographic points.
 *
 * This function expects the XLSX library to parse the file first.
 * Expected columns: id, x, y, cota
 *
 * @param data - Array of row objects from XLSX
 * @returns Array of PontoTopografico objects
 */
export function parseExcelData(data: Array<Record<string, unknown>>): PontoTopografico[] {
  if (!data || data.length === 0) {
    throw new Error('Excel data is empty');
  }

  const pontos: PontoTopografico[] = [];

  for (const row of data) {
    // Try to find the columns with flexible naming
    const id = (row['id'] || row['ID'] || row['ponto'] || row['Ponto'] || row['nome'] || row['Nome']) as string;
    const x = parseFloat(String(row['x'] || row['X'] || row['este'] || row['Este'] || row['easting'] || 0).replace(',', '.'));
    const y = parseFloat(String(row['y'] || row['Y'] || row['norte'] || row['Norte'] || row['northing'] || 0).replace(',', '.'));
    const cota = parseFloat(String(row['cota'] || row['Cota'] || row['z'] || row['Z'] || row['elevacao'] || row['Elevacao'] || 0).replace(',', '.'));

    if (!id || isNaN(x) || isNaN(y) || isNaN(cota)) {
      continue;
    }

    pontos.push({ id: String(id), x, y, cota });
  }

  if (pontos.length === 0) {
    throw new Error('No valid points found in Excel data');
  }

  return pontos;
}

/**
 * Read topography file (CSV or Excel) from a File object.
 *
 * @param file - File object from input element
 * @param xlsxLib - XLSX library instance (for Excel files)
 * @returns Promise resolving to TopographyData
 */
export async function readTopographyFile(
  file: File,
  xlsxLib?: {
    read: (data: ArrayBuffer, options: { type: string }) => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    utils: {
      sheet_to_json: (sheet: unknown) => Array<Record<string, unknown>>;
    };
  }
): Promise<TopographyData> {
  const fileName = file.name.toLowerCase();
  let pontos: PontoTopografico[];

  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    const content = await file.text();
    // The parseCSV function now auto-detects delimiters
    pontos = parseCSV(content);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    if (!xlsxLib) {
      throw new Error('XLSX library is required for Excel files');
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsxLib.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsxLib.utils.sheet_to_json(firstSheet) as Array<Record<string, unknown>>;
    pontos = parseExcelData(data);
  } else {
    throw new Error(`Unsupported file format: ${fileName}. Use CSV, TXT, or XLSX.`);
  }

  // Calculate bounds
  const xs = pontos.map(p => p.x);
  const ys = pontos.map(p => p.y);
  const cotas = pontos.map(p => p.cota);

  return {
    pontos,
    metadata: {
      source: file.name,
      totalPoints: pontos.length,
      bounds: {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        minCota: Math.min(...cotas),
        maxCota: Math.max(...cotas)
      },
      importedAt: new Date().toISOString()
    }
  };
}

/**
 * Create sample topography data for testing.
 *
 * @param numPoints - Number of points to generate
 * @returns Array of sample PontoTopografico objects
 */
export function createSampleTopography(numPoints = 10): PontoTopografico[] {
  const pontos: PontoTopografico[] = [];
  let x = 0;
  let cota = 100;

  for (let i = 1; i <= numPoints; i++) {
    pontos.push({
      id: `P${i}`,
      x,
      y: 0,
      cota
    });

    x += 50 + Math.random() * 50; // 50-100m between points
    cota -= 0.3 + Math.random() * 0.4; // 0.3-0.7m drop
  }

  return pontos;
}

/**
 * Export topography data to CSV format.
 *
 * @param pontos - Array of PontoTopografico objects
 * @param delimiter - Column delimiter (default: ';')
 * @returns CSV content as string
 */
export function exportToCSV(pontos: PontoTopografico[], delimiter = ';'): string {
  const header = ['id', 'x', 'y', 'cota'].join(delimiter);
  const rows = pontos.map(p =>
    [p.id, p.x.toFixed(3), p.y.toFixed(3), p.cota.toFixed(3)].join(delimiter)
  );

  return [header, ...rows].join('\n');
}
