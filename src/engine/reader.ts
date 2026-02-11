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
 * Parse CSV content into topographic points.
 *
 * Expected columns: id, x, y, cota
 *
 * @param content - CSV file content as string
 * @param delimiter - Column delimiter (default: ',')
 * @returns Array of PontoTopografico objects
 */
export function parseCSV(content: string, delimiter = ','): PontoTopografico[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row');
  }

  const header = lines[0].toLowerCase().split(delimiter).map(h => h.trim());
  const idIndex = header.findIndex(h => h === 'id' || h === 'ponto' || h === 'nome');
  const xIndex = header.findIndex(h => h === 'x' || h === 'este' || h === 'easting');
  const yIndex = header.findIndex(h => h === 'y' || h === 'norte' || h === 'northing');
  const cotaIndex = header.findIndex(h => h === 'cota' || h === 'z' || h === 'elevacao' || h === 'elevation');

  if (idIndex === -1 || xIndex === -1 || yIndex === -1 || cotaIndex === -1) {
    throw new Error(
      'CSV must contain columns: id (or ponto/nome), x (or este), y (or norte), cota (or z/elevacao)'
    );
  }

  const pontos: PontoTopografico[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map(v => v.trim());

    const id = values[idIndex];
    const x = parseFloat(values[xIndex].replace(',', '.'));
    const y = parseFloat(values[yIndex].replace(',', '.'));
    const cota = parseFloat(values[cotaIndex].replace(',', '.'));

    if (!id || isNaN(x) || isNaN(y) || isNaN(cota)) {
      console.warn(`Skipping invalid row ${i + 1}: ${line}`);
      continue;
    }

    pontos.push({ id, x, y, cota });
  }

  if (pontos.length === 0) {
    throw new Error('No valid points found in CSV');
  }

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
    // Try comma first, then semicolon
    try {
      pontos = parseCSV(content, ',');
    } catch {
      pontos = parseCSV(content, ';');
    }
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
