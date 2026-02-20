/**
 * UTM Validator - Validação de Coordenadas UTM
 *
 * Valida se as coordenadas estão dentro das faixas esperadas
 * e detecta possíveis erros de interpretação de separador decimal.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UTMValidationResult {
  valid: boolean;
  x: {
    value: number;
    valid: boolean;
    message?: string;
  };
  y: {
    value: number;
    valid: boolean;
    message?: string;
  };
  z?: {
    value: number;
    valid: boolean;
    message?: string;
  };
  warnings: string[];
  suggestions: string[];
  possibleNumericFormatError: boolean;
}

export interface UTMBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  zone: number;
  hemisphere: 'N' | 'S';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Faixas válidas para coordenadas UTM
const UTM_BOUNDS = {
  // Coordenada X (Easting)
  x: {
    min: 100000,
    max: 900000,
    typical_min: 160000,  // Valores mais comuns no Brasil
    typical_max: 840000
  },
  // Coordenada Y (Northing) - Hemisfério Sul
  y_south: {
    min: 1000000,
    max: 10000000,
    typical_min: 7000000,  // Sul do Brasil
    typical_max: 9900000   // Norte do Brasil
  },
  // Coordenada Y (Northing) - Hemisfério Norte
  y_north: {
    min: 0,
    max: 9400000
  },
  // Elevação (Z)
  z: {
    min: -500,    // Abaixo do nível do mar
    max: 3000,    // Picos mais altos do Brasil
    typical_min: 0,
    typical_max: 1500
  }
};

// Zonas UTM do Brasil
const BRAZIL_UTM_ZONES = {
  18: { minLon: -78, maxLon: -72 },
  19: { minLon: -72, maxLon: -66 },
  20: { minLon: -66, maxLon: -60 },
  21: { minLon: -60, maxLon: -54 },
  22: { minLon: -54, maxLon: -48 },
  23: { minLon: -48, maxLon: -42 },
  24: { minLon: -42, maxLon: -36 },
  25: { minLon: -36, maxLon: -30 }
};

// ============================================================================
// UTM VALIDATOR CLASS
// ============================================================================

class UTMValidatorImpl {

  // --------------------------------------------------------------------------
  // Main Validation
  // --------------------------------------------------------------------------

  validateCoordinates(
    x: number,
    y: number,
    z?: number,
    hemisphere: 'N' | 'S' = 'S'
  ): UTMValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let possibleNumericFormatError = false;

    // Validar X
    const xResult = this.validateX(x);
    if (!xResult.valid) {
      warnings.push(xResult.message!);
    }

    // Validar Y
    const yResult = this.validateY(y, hemisphere);
    if (!yResult.valid) {
      warnings.push(yResult.message!);
    }

    // Validar Z (se fornecido)
    let zResult: UTMValidationResult['z'];
    if (z !== undefined) {
      zResult = this.validateZ(z);
      if (!zResult.valid) {
        warnings.push(zResult.message!);
      }
    }

    // Detectar possível erro de formato numérico
    const numericError = this.detectNumericFormatError(x, y);
    if (numericError.detected) {
      possibleNumericFormatError = true;
      warnings.push(numericError.message);
      suggestions.push(...numericError.suggestions);
    }

    // Verificar se coordenadas estão em faixas típicas
    const typicalWarnings = this.checkTypicalRanges(x, y, z);
    warnings.push(...typicalWarnings);

    return {
      valid: xResult.valid && yResult.valid && (!zResult || zResult.valid) && !possibleNumericFormatError,
      x: xResult,
      y: yResult,
      z: zResult,
      warnings,
      suggestions,
      possibleNumericFormatError
    };
  }

  // --------------------------------------------------------------------------
  // Individual Validations
  // --------------------------------------------------------------------------

  validateX(x: number): { value: number; valid: boolean; message?: string } {
    if (isNaN(x) || !isFinite(x)) {
      return { value: x, valid: false, message: 'Coordenada X inválida (NaN ou Infinito)' };
    }

    if (x < UTM_BOUNDS.x.min || x > UTM_BOUNDS.x.max) {
      return {
        value: x,
        valid: false,
        message: `Coordenada X (${x.toFixed(3)}) fora da faixa UTM válida (${UTM_BOUNDS.x.min}-${UTM_BOUNDS.x.max})`
      };
    }

    return { value: x, valid: true };
  }

  validateY(y: number, hemisphere: 'N' | 'S' = 'S'): { value: number; valid: boolean; message?: string } {
    if (isNaN(y) || !isFinite(y)) {
      return { value: y, valid: false, message: 'Coordenada Y inválida (NaN ou Infinito)' };
    }

    const bounds = hemisphere === 'S' ? UTM_BOUNDS.y_south : UTM_BOUNDS.y_north;

    if (y < bounds.min || y > bounds.max) {
      return {
        value: y,
        valid: false,
        message: `Coordenada Y (${y.toFixed(3)}) fora da faixa UTM válida para hemisfério ${hemisphere} (${bounds.min}-${bounds.max})`
      };
    }

    return { value: y, valid: true };
  }

  validateZ(z: number): { value: number; valid: boolean; message?: string } {
    if (isNaN(z) || !isFinite(z)) {
      return { value: z, valid: false, message: 'Elevação Z inválida (NaN ou Infinito)' };
    }

    if (z < UTM_BOUNDS.z.min || z > UTM_BOUNDS.z.max) {
      return {
        value: z,
        valid: false,
        message: `Elevação (${z.toFixed(3)}) fora da faixa esperada (${UTM_BOUNDS.z.min}-${UTM_BOUNDS.z.max}m)`
      };
    }

    return { value: z, valid: true };
  }

  // --------------------------------------------------------------------------
  // Numeric Format Error Detection
  // --------------------------------------------------------------------------

  detectNumericFormatError(x: number, y: number): {
    detected: boolean;
    message: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    // Se X está muito pequeno, pode ser erro de interpretação
    // Ex: 362,285 interpretado como 362.285 ao invés de 362285
    if (x > 0 && x < 1000) {
      return {
        detected: true,
        message: `⚠️ Coordenada X (${x}) muito pequena para UTM. Possível erro de separador decimal.`,
        suggestions: [
          'Verifique se o formato numérico está correto (brasileiro ou americano)',
          `Se o valor original era "362.285,523", o correto seria X = 362285.523`,
          'Selecione o formato numérico correto no wizard de importação'
        ]
      };
    }

    // Se Y está muito pequeno
    if (y > 0 && y < 100000) {
      return {
        detected: true,
        message: `⚠️ Coordenada Y (${y}) muito pequena para UTM. Possível erro de separador decimal.`,
        suggestions: [
          'Verifique se o formato numérico está correto (brasileiro ou americano)',
          'Coordenadas Y no Brasil geralmente estão entre 7.000.000 e 9.900.000',
          'Selecione o formato numérico correto no wizard de importação'
        ]
      };
    }

    // Se X está muito grande (pode ter incluído casas decimais como inteiros)
    if (x > UTM_BOUNDS.x.max * 1000) {
      return {
        detected: true,
        message: `⚠️ Coordenada X (${x}) muito grande. Possível erro de interpretação de decimais.`,
        suggestions: [
          'O valor pode estar com casas decimais interpretadas como inteiros',
          'Verifique o formato numérico do arquivo fonte'
        ]
      };
    }

    return { detected: false, message: '', suggestions: [] };
  }

  // --------------------------------------------------------------------------
  // Typical Ranges Check
  // --------------------------------------------------------------------------

  checkTypicalRanges(x: number, y: number, z?: number): string[] {
    const warnings: string[] = [];

    // X fora da faixa típica mas válido
    if (x < UTM_BOUNDS.x.typical_min || x > UTM_BOUNDS.x.typical_max) {
      if (x >= UTM_BOUNDS.x.min && x <= UTM_BOUNDS.x.max) {
        warnings.push(
          `Coordenada X (${x.toFixed(3)}) está na borda da zona UTM. Verifique se a zona está correta.`
        );
      }
    }

    // Y fora da faixa típica do Brasil
    if (y < UTM_BOUNDS.y_south.typical_min) {
      warnings.push(
        `Coordenada Y (${y.toFixed(3)}) indica localização mais ao sul do que o comum no Brasil.`
      );
    }

    // Z fora da faixa típica
    if (z !== undefined && (z < UTM_BOUNDS.z.typical_min || z > UTM_BOUNDS.z.typical_max)) {
      if (z >= UTM_BOUNDS.z.min && z <= UTM_BOUNDS.z.max) {
        warnings.push(
          `Elevação (${z.toFixed(3)}m) está fora da faixa típica. Verifique a referência altimétrica.`
        );
      }
    }

    return warnings;
  }

  // --------------------------------------------------------------------------
  // Batch Validation
  // --------------------------------------------------------------------------

  validateCoordinateArray(
    coordinates: Array<{ x: number; y: number; z?: number }>,
    hemisphere: 'N' | 'S' = 'S'
  ): {
    valid: boolean;
    totalCount: number;
    validCount: number;
    invalidCount: number;
    invalidCoordinates: Array<{ index: number; x: number; y: number; z?: number; errors: string[] }>;
    boundingBox: { minX: number; maxX: number; minY: number; maxY: number };
    possibleNumericFormatErrors: number;
  } {
    let validCount = 0;
    let possibleNumericFormatErrors = 0;
    const invalidCoordinates: Array<{ index: number; x: number; y: number; z?: number; errors: string[] }> = [];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    coordinates.forEach((coord, index) => {
      const result = this.validateCoordinates(coord.x, coord.y, coord.z, hemisphere);

      if (result.valid) {
        validCount++;
        minX = Math.min(minX, coord.x);
        maxX = Math.max(maxX, coord.x);
        minY = Math.min(minY, coord.y);
        maxY = Math.max(maxY, coord.y);
      } else {
        invalidCoordinates.push({
          index,
          x: coord.x,
          y: coord.y,
          z: coord.z,
          errors: result.warnings
        });
      }

      if (result.possibleNumericFormatError) {
        possibleNumericFormatErrors++;
      }
    });

    return {
      valid: invalidCoordinates.length === 0,
      totalCount: coordinates.length,
      validCount,
      invalidCount: invalidCoordinates.length,
      invalidCoordinates,
      boundingBox: {
        minX: minX === Infinity ? 0 : minX,
        maxX: maxX === -Infinity ? 0 : maxX,
        minY: minY === Infinity ? 0 : minY,
        maxY: maxY === -Infinity ? 0 : maxY
      },
      possibleNumericFormatErrors
    };
  }

  // --------------------------------------------------------------------------
  // UTM Zone Detection
  // --------------------------------------------------------------------------

  detectUTMZone(x: number, y: number, hemisphere: 'N' | 'S' = 'S'): {
    zone: number | null;
    confidence: number;
    message: string;
  } {
    // Com apenas coordenadas UTM, não podemos determinar a zona com certeza
    // Mas podemos verificar se os valores são consistentes

    if (!this.validateX(x).valid || !this.validateY(y, hemisphere).valid) {
      return {
        zone: null,
        confidence: 0,
        message: 'Coordenadas inválidas para detecção de zona UTM'
      };
    }

    // Para o Brasil, zonas mais comuns
    const commonZones = [21, 22, 23, 24, 25];

    return {
      zone: null,
      confidence: 0,
      message: 'Não é possível determinar a zona UTM apenas com coordenadas. Informe a zona manualmente.'
    };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  getUTMBounds(): typeof UTM_BOUNDS {
    return UTM_BOUNDS;
  }

  getBrazilUTMZones(): typeof BRAZIL_UTM_ZONES {
    return BRAZIL_UTM_ZONES;
  }

  isInBrazil(y: number): boolean {
    // Aproximadamente entre latitudes -34° e +5° (Y entre 6.200.000 e 10.000.000)
    return y >= 6200000 && y <= 10000000;
  }
}

// Singleton instance
export const UTMValidator = new UTMValidatorImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function validateUTMCoordinates(
  x: number,
  y: number,
  z?: number
): UTMValidationResult {
  return UTMValidator.validateCoordinates(x, y, z);
}

export function isValidUTM(x: number, y: number): boolean {
  const result = UTMValidator.validateCoordinates(x, y);
  return result.valid;
}
