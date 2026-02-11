/**
 * Geometric calculations for sanitation network engineering.
 *
 * This module provides core geometric functions for calculating distances,
 * slopes, and classifying network segments based on engineering criteria.
 */

// Engineering constants
export const DECLIVIDADE_MIN = 0.005; // Minimum slope (0.5%) for gravity flow

// Network type literals
export type TipoRede = 'Esgoto por Gravidade' | 'Elevatoria / Booster';

/**
 * Calculate the Euclidean distance between two points in a 2D plane.
 *
 * @param x1 - X coordinate of the first point
 * @param y1 - Y coordinate of the first point
 * @param x2 - X coordinate of the second point
 * @param y2 - Y coordinate of the second point
 * @returns The Euclidean distance between the two points
 * @throws Error if distance calculation results in a non-positive value
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= 0) {
    throw new Error(
      `Distance between points (${x1}, ${y1}) and (${x2}, ${y2}) ` +
      'must be greater than zero. Points cannot be identical.'
    );
  }

  return distance;
}

/**
 * Calculate the slope (declividade) between two elevation points.
 *
 * The slope is defined as the elevation difference divided by the
 * horizontal distance. A positive slope indicates downward flow
 * from start to end point.
 *
 * @param cotaInicio - Elevation at the starting point (meters)
 * @param cotaFim - Elevation at the ending point (meters)
 * @param distance - Horizontal distance between points (meters)
 * @returns The slope as a dimensionless ratio (e.g., 0.005 = 0.5%)
 * @throws Error if distance is zero or negative
 */
export function calculateSlope(cotaInicio: number, cotaFim: number, distance: number): number {
  if (distance <= 0) {
    throw new Error(
      `Distance must be positive for slope calculation. Got: ${distance}`
    );
  }

  return (cotaInicio - cotaFim) / distance;
}

/**
 * Classify the network segment type based on slope criteria.
 *
 * According to sanitation engineering standards, segments with
 * sufficient slope can operate by gravity. Segments with insufficient
 * slope require pumping stations (elevatoria) or booster systems.
 *
 * @param slope - The calculated slope (dimensionless ratio)
 * @returns Network type classification
 */
export function classifyNetworkType(slope: number): TipoRede {
  if (slope >= DECLIVIDADE_MIN) {
    return 'Esgoto por Gravidade';
  }
  return 'Elevatoria / Booster';
}

/**
 * Validate that coordinates are finite numbers.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param cota - Elevation value
 * @throws Error if any coordinate is not a finite number
 */
export function validateCoordinates(x: number, y: number, cota: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(cota)) {
    throw new Error(
      `All coordinates must be finite numbers. Got: x=${x}, y=${y}, cota=${cota}`
    );
  }
}

/**
 * Calculate the angle between two points in degrees.
 *
 * @param x1 - X coordinate of the first point
 * @param y1 - Y coordinate of the first point
 * @param x2 - X coordinate of the second point
 * @param y2 - Y coordinate of the second point
 * @returns The angle in degrees (0-360)
 */
export function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle < 0) {
    angle += 360;
  }

  return angle;
}

/**
 * Calculate the mid-point between two coordinates.
 *
 * @param x1 - X coordinate of the first point
 * @param y1 - Y coordinate of the first point
 * @param x2 - X coordinate of the second point
 * @param y2 - Y coordinate of the second point
 * @returns Object with x and y coordinates of the midpoint
 */
export function calculateMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2
  };
}

/**
 * Convert slope to percentage.
 *
 * @param slope - The slope as a dimensionless ratio
 * @returns The slope as a percentage
 */
export function slopeToPercent(slope: number): number {
  return slope * 100;
}

/**
 * Convert percentage to slope.
 *
 * @param percent - The slope as a percentage
 * @returns The slope as a dimensionless ratio
 */
export function percentToSlope(percent: number): number {
  return percent / 100;
}
