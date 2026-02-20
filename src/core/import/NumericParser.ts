/**
 * Numeric Parser - Detecção e Conversão de Formato Numérico
 *
 * REGRA: Formato numérico detectado - nunca assumir padrão
 *
 * Brasileiro: 1.234.567,89 (ponto = milhar, vírgula = decimal)
 * Americano:  1,234,567.89 (vírgula = milhar, ponto = decimal)
 */

// ============================================================================
// TYPES
// ============================================================================

export type NumericFormat = 'brazilian' | 'american' | 'unknown';

export interface NumericParseResult {
  value: number;
  format: NumericFormat;
  originalString: string;
  confidence: number;  // 0-1
}

export interface FormatDetectionResult {
  format: NumericFormat;
  confidence: number;
  samples: {
    value: string;
    parsedAs: NumericFormat;
  }[];
}

// ============================================================================
// PATTERNS
// ============================================================================

const PATTERNS = {
  // Brasileiro: 1.234.567,89 ou 1234567,89
  brazilian: {
    full: /^-?\d{1,3}(\.\d{3})*,\d+$/,           // 1.234.567,89
    simple: /^-?\d+,\d+$/,                        // 1234567,89
    integerWithThousands: /^-?\d{1,3}(\.\d{3})+$/ // 1.234.567
  },
  // Americano: 1,234,567.89 ou 1234567.89
  american: {
    full: /^-?\d{1,3}(,\d{3})*\.\d+$/,           // 1,234,567.89
    simple: /^-?\d+\.\d+$/,                       // 1234567.89
    integerWithThousands: /^-?\d{1,3}(,\d{3})+$/ // 1,234,567
  }
};

// ============================================================================
// NUMERIC PARSER CLASS
// ============================================================================

class NumericParserImpl {

  // --------------------------------------------------------------------------
  // Format Detection
  // --------------------------------------------------------------------------

  detectFormat(samples: string[]): FormatDetectionResult {
    const validSamples = samples
      .filter(s => s && typeof s === 'string')
      .map(s => s.trim())
      .filter(s => /[\d.,]/.test(s));

    if (validSamples.length === 0) {
      return { format: 'unknown', confidence: 0, samples: [] };
    }

    let brazilianScore = 0;
    let americanScore = 0;
    const sampleResults: { value: string; parsedAs: NumericFormat }[] = [];

    for (const sample of validSamples) {
      const detected = this.detectSingleFormat(sample);
      sampleResults.push({ value: sample, parsedAs: detected.format });

      if (detected.format === 'brazilian') {
        brazilianScore += detected.confidence;
      } else if (detected.format === 'american') {
        americanScore += detected.confidence;
      }
    }

    const totalScore = brazilianScore + americanScore;

    if (totalScore === 0) {
      return { format: 'unknown', confidence: 0, samples: sampleResults };
    }

    if (brazilianScore > americanScore) {
      return {
        format: 'brazilian',
        confidence: brazilianScore / totalScore,
        samples: sampleResults
      };
    } else if (americanScore > brazilianScore) {
      return {
        format: 'american',
        confidence: americanScore / totalScore,
        samples: sampleResults
      };
    }

    return { format: 'unknown', confidence: 0.5, samples: sampleResults };
  }

  detectSingleFormat(value: string): { format: NumericFormat; confidence: number } {
    const trimmed = value.trim();

    // Verificar padrão brasileiro completo: 1.234.567,89
    if (PATTERNS.brazilian.full.test(trimmed)) {
      return { format: 'brazilian', confidence: 1.0 };
    }

    // Verificar padrão americano completo: 1,234,567.89
    if (PATTERNS.american.full.test(trimmed)) {
      return { format: 'american', confidence: 1.0 };
    }

    // Verificar inteiro com milhares brasileiro: 1.234.567
    if (PATTERNS.brazilian.integerWithThousands.test(trimmed)) {
      return { format: 'brazilian', confidence: 0.9 };
    }

    // Verificar inteiro com milhares americano: 1,234,567
    if (PATTERNS.american.integerWithThousands.test(trimmed)) {
      return { format: 'american', confidence: 0.9 };
    }

    // Padrão simples com vírgula: pode ser brasileiro (decimal) ou americano (milhares)
    if (PATTERNS.brazilian.simple.test(trimmed)) {
      // Se tem mais de 3 dígitos após a vírgula, provavelmente é brasileiro
      const afterComma = trimmed.split(',')[1];
      if (afterComma && afterComma.length !== 3) {
        return { format: 'brazilian', confidence: 0.8 };
      }
      // Se tem exatamente 3 dígitos, pode ser qualquer um
      return { format: 'brazilian', confidence: 0.5 };
    }

    // Padrão simples com ponto: pode ser americano (decimal) ou brasileiro (milhares)
    if (PATTERNS.american.simple.test(trimmed)) {
      // Se tem mais de 3 dígitos após o ponto, provavelmente é americano
      const afterDot = trimmed.split('.')[1];
      if (afterDot && afterDot.length !== 3) {
        return { format: 'american', confidence: 0.8 };
      }
      // Se tem exatamente 3 dígitos, pode ser qualquer um
      return { format: 'american', confidence: 0.5 };
    }

    return { format: 'unknown', confidence: 0 };
  }

  // --------------------------------------------------------------------------
  // Parsing
  // --------------------------------------------------------------------------

  parse(value: string, format: NumericFormat): NumericParseResult {
    const trimmed = value.trim();

    let parsedValue: number;
    let confidence = 1.0;

    switch (format) {
      case 'brazilian':
        parsedValue = this.parseBrazilian(trimmed);
        break;
      case 'american':
        parsedValue = this.parseAmerican(trimmed);
        break;
      default:
        // Tentar detectar automaticamente
        const detected = this.detectSingleFormat(trimmed);
        if (detected.format === 'brazilian') {
          parsedValue = this.parseBrazilian(trimmed);
        } else if (detected.format === 'american') {
          parsedValue = this.parseAmerican(trimmed);
        } else {
          // Tentar parse padrão JavaScript
          parsedValue = parseFloat(trimmed.replace(/[^\d.-]/g, ''));
        }
        confidence = detected.confidence;
        format = detected.format;
    }

    return {
      value: parsedValue,
      format,
      originalString: value,
      confidence
    };
  }

  parseBrazilian(value: string): number {
    // "362.285,523" → 362285.523
    // "1.234.567,89" → 1234567.89
    const normalized = value
      .replace(/\./g, '')      // Remove pontos (separador de milhares)
      .replace(',', '.');       // Substitui vírgula por ponto (decimal)
    return parseFloat(normalized);
  }

  parseAmerican(value: string): number {
    // "362,285.523" → 362285.523
    // "1,234,567.89" → 1234567.89
    const normalized = value.replace(/,/g, '');  // Remove vírgulas (separador de milhares)
    return parseFloat(normalized);
  }

  parseAuto(value: string): NumericParseResult {
    return this.parse(value, 'unknown');
  }

  // --------------------------------------------------------------------------
  // Batch Processing
  // --------------------------------------------------------------------------

  parseArray(values: string[], format?: NumericFormat): NumericParseResult[] {
    // Se formato não especificado, detectar primeiro
    const detectedFormat = format || this.detectFormat(values).format;

    return values.map(v => this.parse(v, detectedFormat));
  }

  parseCoordinates(
    x: string,
    y: string,
    z?: string,
    format?: NumericFormat
  ): { x: number; y: number; z: number; format: NumericFormat } {
    // Detectar formato a partir das coordenadas
    const samples = [x, y];
    if (z) samples.push(z);

    const detectedFormat = format || this.detectFormat(samples).format;

    return {
      x: this.parse(x, detectedFormat).value,
      y: this.parse(y, detectedFormat).value,
      z: z ? this.parse(z, detectedFormat).value : 0,
      format: detectedFormat
    };
  }

  // --------------------------------------------------------------------------
  // Formatting (Output)
  // --------------------------------------------------------------------------

  formatBrazilian(value: number, decimals: number = 2): string {
    const parts = value.toFixed(decimals).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimals > 0 ? `${integerPart},${parts[1]}` : integerPart;
  }

  formatAmerican(value: number, decimals: number = 2): string {
    const parts = value.toFixed(decimals).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimals > 0 ? `${integerPart}.${parts[1]}` : integerPart;
  }

  format(value: number, format: NumericFormat, decimals: number = 2): string {
    switch (format) {
      case 'brazilian':
        return this.formatBrazilian(value, decimals);
      case 'american':
        return this.formatAmerican(value, decimals);
      default:
        return value.toFixed(decimals);
    }
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  isValidNumber(value: string): boolean {
    const result = this.parseAuto(value);
    return !isNaN(result.value) && isFinite(result.value);
  }

  isValidCoordinate(value: string, type: 'x' | 'y' | 'z'): boolean {
    const result = this.parseAuto(value);
    if (isNaN(result.value) || !isFinite(result.value)) return false;

    // Validações específicas por tipo
    switch (type) {
      case 'x':
        // UTM X deve estar entre 100000 e 900000
        return result.value >= 100000 && result.value <= 900000;
      case 'y':
        // UTM Y deve estar entre 0 e 10000000
        return result.value >= 0 && result.value <= 10000000;
      case 'z':
        // Elevação pode ser negativa (abaixo do nível do mar)
        return result.value >= -500 && result.value <= 10000;
      default:
        return true;
    }
  }
}

// Singleton instance
export const NumericParser = new NumericParserImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function detectNumericFormat(samples: string[]): NumericFormat {
  return NumericParser.detectFormat(samples).format;
}

export function parseNumber(value: string, format?: NumericFormat): number {
  return NumericParser.parse(value, format || 'unknown').value;
}

export function formatNumber(value: number, format: NumericFormat, decimals?: number): string {
  return NumericParser.format(value, format, decimals);
}
