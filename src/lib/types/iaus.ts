// =============================================================================
// IAUS (Infinite Axis Utility System) Type Definitions
// =============================================================================

import type { DirectionTagType, SituationTagType } from './tags';

// =============================================================================
// Response Curve Types
// =============================================================================

export const CURVE_TYPE = {
  LINEAR: 0,
  POLYNOMIAL: 1,
  LOGISTIC: 2,
  LOGIT: 3,
  PARABOLIC: 4,
} as const;

export type CurveType = (typeof CURVE_TYPE)[keyof typeof CURVE_TYPE];

export interface CurveParams {
  readonly m: number; // Slope
  readonly k: number; // Exponent
  readonly c: number; // X-Shift
  readonly b: number; // Y-Shift
}

// =============================================================================
// Curve Presets
// =============================================================================

export const CURVE_PRESET = {
  LINEAR_STANDARD: { m: 1.0, k: 1.0, c: 0.0, b: 0.0 },
  LINEAR_HALF: { m: 0.5, k: 1.0, c: 0.0, b: 0.5 },
  LINEAR_INVERSE: { m: -1.0, k: 1.0, c: 0.0, b: 1.0 },
  CRITICAL_DETECTOR: { m: -15, k: 1.0, c: 0.3, b: 0.0 },
  THRESHOLD_50: { m: 20, k: 1.0, c: 0.5, b: 0.0 },
  THRESHOLD_25: { m: 20, k: 1.0, c: 0.25, b: 0.0 },
  EARLY_WEIGHT: { m: 1.0, k: 0.5, c: 0.0, b: 0.0 },
  LATE_WEIGHT: { m: 1.0, k: 2.0, c: 0.0, b: 0.0 },
} as const satisfies Record<string, CurveParams>;

// =============================================================================
// Consideration Definition
// =============================================================================

export interface ConsiderationDef {
  readonly id: string;
  readonly name: string;
  readonly curveType: CurveType;
  readonly curveParams: CurveParams;
  readonly inputMin: number;
  readonly inputMax: number;
}

// =============================================================================
// Decision Definition
// Note: direction uses DirectionTagType from tags.ts (not IAUS-specific)
//       situationTag uses SituationTagType from tags.ts
// =============================================================================

export interface DecisionDef {
  readonly id: number;
  readonly name: string;
  readonly direction: DirectionTagType;
  readonly worldMark: number; // Primary WorldMark (0-7)
  readonly situationTag: SituationTagType;
  readonly considerationIds: readonly string[];
  readonly weight: number; // Importance factor (1.0 = standard)
  readonly baseDurationTicks: number; // Action Lock duration
  readonly durationVariance: number; // ±variance randomization (0.0-0.5)
}

// =============================================================================
// Decision Cache Storage (TypedArray)
// =============================================================================

export interface DecisionCacheStorage {
  readonly currentDecision: Uint16Array; // [entityId] → Decision ID
  readonly currentScore: Float32Array; // [entityId] → Current score
  readonly lastEvaluatedTick: Uint32Array; // [entityId] → Last evaluation tick
  readonly capacity: number;
}

// =============================================================================
// Action Lock Storage (TypedArray)
// =============================================================================

export interface ActionLockStorage {
  readonly remainingTicks: Uint8Array; // [entityId] → 0-255 (0 = unlocked)
  readonly currentAction: Uint8Array; // [entityId] → action category
  readonly capacity: number;
}

// =============================================================================
// Time System Configuration
// =============================================================================

export const TIME_CONFIG = {
  TICK_GAME_MINUTES: 1.875,
  MAX_LOCK_TICKS: 255,
  TIME_RATIO_REAL: 2,
  TIME_RATIO_GAME: 3,
  TICKS_PER_GAME_HOUR: 32, // 60 / 1.875
  TICKS_PER_GAME_DAY: 768, // 24 * 32
  REAL_SECONDS_PER_TICK: 75, // 1.875min * 60s / 1.5 ratio
} as const;

// =============================================================================
// Evaluation Context
// =============================================================================

export interface EvaluationContext {
  readonly currentTick: number;
  readonly currentSituation: SituationTagType;
  readonly gameHour: number; // 0-23
}
