/**
 * Project CRS - Sistema de Referência de Coordenadas do Projeto
 *
 * REGRA ABSOLUTA: CRS é obrigatório - nada entra sem CRS definido
 */

import { LayerRegistry, CRSDefinition } from './LayerRegistry';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProjectSettings {
  crs: CRSDefinition;               // OBRIGATÓRIO - projeto não funciona sem
  defaultUnit: 'meters' | 'feet';
  tolerance: number;                 // Para snap (default: 0.01m)
  numericFormat: 'brazilian' | 'american' | 'auto';
  autoCreateNodes: boolean;          // Criar nós automaticamente em endpoints
  autoCalculateLength: boolean;      // Calcular comprimento automaticamente
  autoCalculateSlope: boolean;       // Calcular declividade automaticamente
}

export interface UTMZone {
  zone: number;
  hemisphere: 'N' | 'S';
  epsgCode: string;
  name: string;
}

// ============================================================================
// CRS PRESETS - Sistemas de Referência Comuns no Brasil
// ============================================================================

export const CRS_PRESETS: Record<string, CRSDefinition> = {
  // SIRGAS 2000 / UTM zones (Brasil)
  'EPSG:31981': {
    code: 'EPSG:31981',
    name: 'SIRGAS 2000 / UTM zone 21S',
    unit: 'meters',
    utmZone: 21,
    hemisphere: 'S'
  },
  'EPSG:31982': {
    code: 'EPSG:31982',
    name: 'SIRGAS 2000 / UTM zone 22S',
    unit: 'meters',
    utmZone: 22,
    hemisphere: 'S'
  },
  'EPSG:31983': {
    code: 'EPSG:31983',
    name: 'SIRGAS 2000 / UTM zone 23S',
    unit: 'meters',
    utmZone: 23,
    hemisphere: 'S'
  },
  'EPSG:31984': {
    code: 'EPSG:31984',
    name: 'SIRGAS 2000 / UTM zone 24S',
    unit: 'meters',
    utmZone: 24,
    hemisphere: 'S'
  },
  'EPSG:31985': {
    code: 'EPSG:31985',
    name: 'SIRGAS 2000 / UTM zone 25S',
    unit: 'meters',
    utmZone: 25,
    hemisphere: 'S'
  },
  // SIRGAS 2000 Geográfico
  'EPSG:4674': {
    code: 'EPSG:4674',
    name: 'SIRGAS 2000 (Geográfico)',
    unit: 'meters'
  },
  // WGS84
  'EPSG:4326': {
    code: 'EPSG:4326',
    name: 'WGS 84 (Geográfico)',
    unit: 'meters'
  },
  // SAD69 (legado)
  'EPSG:29183': {
    code: 'EPSG:29183',
    name: 'SAD69 / UTM zone 23S',
    unit: 'meters',
    utmZone: 23,
    hemisphere: 'S'
  }
};

// ============================================================================
// UTM ZONES - Faixas UTM do Brasil
// ============================================================================

export const BRAZIL_UTM_ZONES: UTMZone[] = [
  { zone: 18, hemisphere: 'S', epsgCode: 'EPSG:31978', name: 'UTM 18S (Acre)' },
  { zone: 19, hemisphere: 'S', epsgCode: 'EPSG:31979', name: 'UTM 19S (Amazonas Oeste)' },
  { zone: 20, hemisphere: 'S', epsgCode: 'EPSG:31980', name: 'UTM 20S (Amazonas)' },
  { zone: 21, hemisphere: 'S', epsgCode: 'EPSG:31981', name: 'UTM 21S (MT/MS/PR/SC/RS)' },
  { zone: 22, hemisphere: 'S', epsgCode: 'EPSG:31982', name: 'UTM 22S (GO/MG/SP/PR/SC/RS)' },
  { zone: 23, hemisphere: 'S', epsgCode: 'EPSG:31983', name: 'UTM 23S (BA/MG/ES/RJ/SP)' },
  { zone: 24, hemisphere: 'S', epsgCode: 'EPSG:31984', name: 'UTM 24S (BA/SE/AL/PE/PB/RN)' },
  { zone: 25, hemisphere: 'S', epsgCode: 'EPSG:31985', name: 'UTM 25S (CE/PI/MA/PA)' }
];

// ============================================================================
// PROJECT CRS CLASS
// ============================================================================

class ProjectCRSImpl {
  private _settings: ProjectSettings | null = null;
  private listeners: Set<(settings: ProjectSettings | null) => void> = new Set();

  get settings(): ProjectSettings | null {
    return this._settings;
  }

  get crs(): CRSDefinition | null {
    return this._settings?.crs || null;
  }

  isConfigured(): boolean {
    return this._settings !== null && this._settings.crs !== null;
  }

  configure(settings: ProjectSettings): void {
    this._settings = settings;

    // Sincronizar com LayerRegistry
    LayerRegistry.setProjectCRS(settings.crs);

    this.notifyListeners();
  }

  updateSettings(updates: Partial<ProjectSettings>): void {
    if (this._settings) {
      this._settings = { ...this._settings, ...updates };

      if (updates.crs) {
        LayerRegistry.setProjectCRS(updates.crs);
      }

      this.notifyListeners();
    }
  }

  setCRS(crs: CRSDefinition): void {
    if (this._settings) {
      this._settings.crs = crs;
      LayerRegistry.setProjectCRS(crs);
      this.notifyListeners();
    } else {
      // Criar configurações padrão com o CRS fornecido
      this.configure({
        crs,
        defaultUnit: 'meters',
        tolerance: 0.01,
        numericFormat: 'auto',
        autoCreateNodes: true,
        autoCalculateLength: true,
        autoCalculateSlope: true
      });
    }
  }

  // --------------------------------------------------------------------------
  // Listeners
  // --------------------------------------------------------------------------

  subscribe(listener: (settings: ProjectSettings | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this._settings));
  }

  // --------------------------------------------------------------------------
  // CRS Detection & Validation
  // --------------------------------------------------------------------------

  detectCRSFromString(crsString: string): CRSDefinition | null {
    // Tentar encontrar nos presets
    const upperCrs = crsString.toUpperCase();

    for (const [code, crs] of Object.entries(CRS_PRESETS)) {
      if (code.toUpperCase() === upperCrs || crs.name.toUpperCase().includes(upperCrs)) {
        return crs;
      }
    }

    // Tentar extrair EPSG code
    const epsgMatch = crsString.match(/EPSG[:\s]*(\d+)/i);
    if (epsgMatch) {
      const code = `EPSG:${epsgMatch[1]}`;
      return CRS_PRESETS[code] || {
        code,
        name: `EPSG ${epsgMatch[1]}`,
        unit: 'meters'
      };
    }

    return null;
  }

  getUTMZoneFromCoordinates(longitude: number, latitude: number): UTMZone | null {
    // Calcular zona UTM a partir de coordenadas geográficas
    const zone = Math.floor((longitude + 180) / 6) + 1;
    const hemisphere = latitude >= 0 ? 'N' : 'S';

    // Encontrar zona correspondente
    return BRAZIL_UTM_ZONES.find(
      z => z.zone === zone && z.hemisphere === hemisphere
    ) || null;
  }

  validateCRSCompatibility(sourceCRS: string, targetCRS: string): {
    compatible: boolean;
    transformationRequired: boolean;
    warning?: string;
  } {
    if (sourceCRS === targetCRS) {
      return { compatible: true, transformationRequired: false };
    }

    // Verificar se são do mesmo datum (SIRGAS 2000)
    const bothSirgas = sourceCRS.includes('3198') && targetCRS.includes('3198');

    if (bothSirgas) {
      return {
        compatible: true,
        transformationRequired: true,
        warning: 'Transformação entre zonas UTM necessária'
      };
    }

    // SAD69 para SIRGAS requer transformação especial
    const sad69ToSirgas = sourceCRS.includes('291') && targetCRS.includes('3198');
    if (sad69ToSirgas) {
      return {
        compatible: true,
        transformationRequired: true,
        warning: 'Transformação SAD69 → SIRGAS 2000 requer parâmetros de transformação'
      };
    }

    return {
      compatible: true,
      transformationRequired: true,
      warning: 'Transformação de coordenadas necessária'
    };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  getDefaultSettings(): ProjectSettings {
    return {
      crs: CRS_PRESETS['EPSG:31983'], // Default: SIRGAS 2000 / UTM zone 23S
      defaultUnit: 'meters',
      tolerance: 0.01,
      numericFormat: 'auto',
      autoCreateNodes: true,
      autoCalculateLength: true,
      autoCalculateSlope: true
    };
  }

  getAllPresets(): CRSDefinition[] {
    return Object.values(CRS_PRESETS);
  }

  getBrazilUTMZones(): UTMZone[] {
    return BRAZIL_UTM_ZONES;
  }

  reset(): void {
    this._settings = null;
    this.notifyListeners();
  }
}

// Singleton instance
export const ProjectCRS = new ProjectCRSImpl();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatCRSDisplay(crs: CRSDefinition): string {
  return `${crs.code} - ${crs.name}`;
}

export function getCRSByCode(code: string): CRSDefinition | undefined {
  return CRS_PRESETS[code];
}
