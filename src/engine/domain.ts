/**
 * Domain models for sanitation network engineering.
 *
 * This module defines the core domain entities representing network
 * segments (trechos) with their engineering properties and calculations.
 */

import {
  TipoRede,
  calculateDistance,
  calculateSlope,
  classifyNetworkType,
  validateCoordinates
} from './geometry';
import { PontoTopografico } from './reader';

// Default engineering parameters
export const DEFAULT_DIAMETRO_MM = 200;
export const DEFAULT_MATERIAL = 'PVC';

export interface Trecho {
  idInicio: string;
  idFim: string;
  comprimento: number;
  declividade: number;
  tipoRede: TipoRede;
  diametroMm: number;
  material: string;
  xInicio: number;
  yInicio: number;
  cotaInicio: number;
  xFim: number;
  yFim: number;
  cotaFim: number;
}

export interface TrechoRecord {
  id_inicio: string;
  id_fim: string;
  comprimento: number;
  declividade: number;
  tipo_rede: string;
  diametro_mm: number;
  material: string;
  x_inicio?: number;
  y_inicio?: number;
  cota_inicio?: number;
  x_fim?: number;
  y_fim?: number;
  cota_fim?: number;
}

export interface NetworkSummary {
  totalTrechos: number;
  comprimentoTotal: number;
  trechosGravidade: number;
  trechosElevatoria: number;
  declividadeMedia: number;
  declividadeMin: number;
  declividadeMax: number;
}

/**
 * Convert a Trecho to a dictionary representation.
 */
export function trechoToDict(trecho: Trecho, includeCoordinates = false): TrechoRecord {
  const base: TrechoRecord = {
    id_inicio: trecho.idInicio,
    id_fim: trecho.idFim,
    comprimento: Math.round(trecho.comprimento * 1000) / 1000,
    declividade: Math.round(trecho.declividade * 1000000) / 1000000,
    tipo_rede: trecho.tipoRede,
    diametro_mm: trecho.diametroMm,
    material: trecho.material
  };

  if (includeCoordinates) {
    base.x_inicio = Math.round(trecho.xInicio * 1000) / 1000;
    base.y_inicio = Math.round(trecho.yInicio * 1000) / 1000;
    base.cota_inicio = Math.round(trecho.cotaInicio * 1000) / 1000;
    base.x_fim = Math.round(trecho.xFim * 1000) / 1000;
    base.y_fim = Math.round(trecho.yFim * 1000) / 1000;
    base.cota_fim = Math.round(trecho.cotaFim * 1000) / 1000;
  }

  return base;
}

/**
 * Calculate elevation difference (desnivel) in meters.
 */
export function getDesnivel(trecho: Trecho): number {
  return trecho.cotaInicio - trecho.cotaFim;
}

/**
 * Check if segment operates by gravity flow.
 */
export function isGravityFlow(trecho: Trecho): boolean {
  return trecho.tipoRede === 'Esgoto por Gravidade';
}

/**
 * Factory class for creating Trecho objects from topographic data.
 */
export class TrechoFactory {
  private diametroMm: number;
  private material: string;

  constructor(diametroMm = DEFAULT_DIAMETRO_MM, material = DEFAULT_MATERIAL) {
    this.diametroMm = diametroMm;
    this.material = material;
  }

  /**
   * Create a Trecho from two consecutive topographic points.
   */
  createFromPoints(
    pontoInicio: PontoTopografico,
    pontoFim: PontoTopografico,
    diametroMm?: number,
    material?: string
  ): Trecho {
    validateCoordinates(pontoInicio.x, pontoInicio.y, pontoInicio.cota);
    validateCoordinates(pontoFim.x, pontoFim.y, pontoFim.cota);

    const comprimento = calculateDistance(
      pontoInicio.x,
      pontoInicio.y,
      pontoFim.x,
      pontoFim.y
    );

    const declividade = calculateSlope(
      pontoInicio.cota,
      pontoFim.cota,
      comprimento
    );

    const tipoRede = classifyNetworkType(declividade);

    return {
      idInicio: pontoInicio.id,
      idFim: pontoFim.id,
      comprimento,
      declividade,
      tipoRede,
      diametroMm: diametroMm ?? this.diametroMm,
      material: material ?? this.material,
      xInicio: pontoInicio.x,
      yInicio: pontoInicio.y,
      cotaInicio: pontoInicio.cota,
      xFim: pontoFim.x,
      yFim: pontoFim.y,
      cotaFim: pontoFim.cota
    };
  }
}

/**
 * Create a list of Trecho objects from consecutive topographic points.
 */
export function createTrechosFromTopography(
  pontos: PontoTopografico[],
  diametroMm = DEFAULT_DIAMETRO_MM,
  material = DEFAULT_MATERIAL
): Trecho[] {
  if (pontos.length < 2) {
    throw new Error(
      `At least 2 points are required to create segments. Got: ${pontos.length}`
    );
  }

  const factory = new TrechoFactory(diametroMm, material);
  const trechos: Trecho[] = [];

  for (let i = 0; i < pontos.length - 1; i++) {
    const trecho = factory.createFromPoints(pontos[i], pontos[i + 1]);
    trechos.push(trecho);
  }

  return trechos;
}

/**
 * Convert a list of Trecho objects to list of dictionaries.
 */
export function trechosToRecords(
  trechos: Trecho[],
  includeCoordinates = false
): TrechoRecord[] {
  return trechos.map(t => trechoToDict(t, includeCoordinates));
}

/**
 * Generate summary statistics for a network of segments.
 */
export function summarizeNetwork(trechos: Trecho[]): NetworkSummary {
  if (!trechos.length) {
    return {
      totalTrechos: 0,
      comprimentoTotal: 0,
      trechosGravidade: 0,
      trechosElevatoria: 0,
      declividadeMedia: 0,
      declividadeMin: 0,
      declividadeMax: 0
    };
  }

  const comprimentos = trechos.map(t => t.comprimento);
  const declividades = trechos.map(t => t.declividade);
  const gravidade = trechos.filter(t => isGravityFlow(t)).length;

  return {
    totalTrechos: trechos.length,
    comprimentoTotal: Math.round(comprimentos.reduce((a, b) => a + b, 0) * 1000) / 1000,
    trechosGravidade: gravidade,
    trechosElevatoria: trechos.length - gravidade,
    declividadeMedia: Math.round((declividades.reduce((a, b) => a + b, 0) / declividades.length) * 1000000) / 1000000,
    declividadeMin: Math.round(Math.min(...declividades) * 1000000) / 1000000,
    declividadeMax: Math.round(Math.max(...declividades) * 1000000) / 1000000
  };
}

/**
 * Filter trechos by network type.
 */
export function filterByNetworkType(trechos: Trecho[], tipoRede: TipoRede): Trecho[] {
  return trechos.filter(t => t.tipoRede === tipoRede);
}

/**
 * Get total length of the network.
 */
export function getTotalLength(trechos: Trecho[]): number {
  return trechos.reduce((sum, t) => sum + t.comprimento, 0);
}
