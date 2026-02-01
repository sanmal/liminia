import type { CurveType, CurveParams } from '$lib/types/iaus';
import { CURVE_TYPE } from '$lib/types/iaus';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clamp value to 0-1 range.
 * Handles NaN by returning 0 (safe fallback).
 */
export function clamp01(v: number): number {
  if (!(v >= 0)) return 0; // NaN and negative → 0
  return v > 1 ? 1 : v;
}

/**
 * Normalize a value from [min, max] range to [0, 1].
 * Returns 0 if min === max (division by zero protection).
 * Clamps result to [0, 1].
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// =============================================================================
// Response Curve Functions
// All functions: input 0-1 → output 0-1 (clamped)
// =============================================================================

/**
 * Linear curve: y = m * x + b
 */
export function linear(x: number, m: number, b: number): number {
  return clamp01(m * x + b);
}

/**
 * Polynomial curve: y = (m * (x - c))^k + b
 */
export function polynomial(x: number, m: number, c: number, k: number, b: number): number {
  return clamp01(Math.pow(m * (x - c), k) + b);
}

/**
 * Logistic (S-curve): y = k / (1 + e^(-m * (x - c))) + b
 */
export function logistic(x: number, m: number, c: number, k: number, b: number): number {
  return clamp01(k / (1 + Math.exp(-m * (x - c))) + b);
}

/**
 * Logit curve (inverse of logistic).
 * Maps input to roughly (-∞, +∞), then normalizes to (0, 1).
 * Uses epsilon to avoid log(0) and log(negative).
 */
export function logit(x: number, epsilon: number = 1e-6): number {
  const xSafe = Math.max(epsilon, Math.min(1 - epsilon, x));
  const raw = Math.log(xSafe / (1 - xSafe));
  return clamp01((raw + 5) / 10);
}

/**
 * Parabolic curve: y = 4 * x * (1 - x)
 * Peak at x = 0.5 (returns 1.0)
 */
export function parabolic(x: number): number {
  return clamp01(4 * x * (1 - x));
}

// =============================================================================
// Unified Curve Dispatcher
// =============================================================================

/**
 * Evaluate a curve based on type and parameters.
 * Returns 0 for unknown curve types.
 */
export function evaluateCurve(
  x: number,
  curveType: CurveType,
  params: CurveParams
): number {
  switch (curveType) {
    case CURVE_TYPE.LINEAR:
      return linear(x, params.m, params.b);
    case CURVE_TYPE.POLYNOMIAL:
      return polynomial(x, params.m, params.c, params.k, params.b);
    case CURVE_TYPE.LOGISTIC:
      return logistic(x, params.m, params.c, params.k, params.b);
    case CURVE_TYPE.LOGIT:
      return logit(x);
    case CURVE_TYPE.PARABOLIC:
      return parabolic(x);
    default:
      return 0;
  }
}

// =============================================================================
// Look-Up Table (LUT)
// =============================================================================

/**
 * Generate a look-up table for a curve.
 * Pre-computes curve values for fast lookup.
 *
 * @param curveType - Type of curve
 * @param params - Curve parameters
 * @param resolution - Number of entries (default: 256)
 */
export function generateLUT(
  curveType: CurveType,
  params: CurveParams,
  resolution: number = 256
): Float32Array {
  const lut = new Float32Array(resolution);
  for (let i = 0; i < resolution; i++) {
    lut[i] = evaluateCurve(i / (resolution - 1), curveType, params);
  }
  return lut;
}

/**
 * Look up a value from a pre-generated LUT.
 * Clamps index to valid range.
 *
 * @param lut - Pre-generated look-up table
 * @param x - Input value (0-1)
 */
export function lookupLUT(lut: Float32Array, x: number): number {
  const idx = Math.round(x * (lut.length - 1));
  return lut[Math.max(0, Math.min(idx, lut.length - 1))]!;
}
