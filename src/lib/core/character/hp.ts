import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import type { HpStageType } from '$lib/types/character';
import { HP_STAGE, HP_STAGE_INFO, REST_STATE } from '$lib/types/character';
import { getHp, getMaxHp, setHp } from './storage';

// ─── Constants ────────────────────────────────────────

/** HP base recovery rate: 2% of maxHp per hour. */
export const HP_BASE_RECOVERY_RATE = 0.02;

/** Rest state bonus coefficients. */
export const REST_BONUS: Readonly<Record<number, number>> = {
  [REST_STATE.ACTIVE]: 0,
  [REST_STATE.LIGHT_REST]: 0.15,
  [REST_STATE.SLEEP]: 0.30,
  [REST_STATE.FULL_REST]: 0.50,
};

// ─── HP Stage ─────────────────────────────────────────

/**
 * Determine HP stage from current and max HP.
 *
 * Stage thresholds (Master Index v5.6):
 *   HEALTHY:      100%
 *   LIGHT_INJURY: 75-99%
 *   INJURED:      50-74%
 *   SERIOUS:      25-49%
 *   CRITICAL:     1-24%
 *   DEAD:         0%
 *
 * @returns HpStageType
 */
export function getHpStage(currentHp: number, maxHp: number): HpStageType {
  if (maxHp <= 0 || currentHp <= 0) return HP_STAGE.DEAD;
  const pct = (currentHp / maxHp) * 100;
  if (pct >= 100) return HP_STAGE.HEALTHY;
  if (pct >= 75) return HP_STAGE.LIGHT_INJURY;
  if (pct >= 50) return HP_STAGE.INJURED;
  if (pct >= 25) return HP_STAGE.SERIOUS;
  return HP_STAGE.CRITICAL;
}

/**
 * Get entity HP stage from storage.
 */
export function getEntityHpStage(s: CharacterStateStorage, id: EntityId): HpStageType {
  return getHpStage(getHp(s, id), getMaxHp(s, id));
}

/**
 * Check if entity is dead.
 */
export function isDead(s: CharacterStateStorage, id: EntityId): boolean {
  return getHp(s, id) <= 0;
}

// ─── HP Recovery ──────────────────────────────────────

/**
 * HP recovery context.
 * Receives input from external systems (medical skills, items, environment).
 */
export interface HpRecoveryContext {
  /** Current HP */
  currentHp: number;
  /** Maximum HP */
  maxHp: number;
  /** Medical skill + item mitigation bonus (0.0-1.0) */
  mitigationBonus: number;
  /** Rest state (REST_STATE value) */
  restState: number;
  /** Environment penalty (0.0-0.5) */
  environmentPenalty: number;
  /** Elapsed hours since last recovery */
  elapsedHours: number;
}

/**
 * Calculate HP recovery amount (pure function).
 *
 * Master Index formula:
 *   finalRate = baseRate × mitigatedMultiplier × restBonus × envFactor
 *   mitigatedMultiplier = baseMultiplier + (1.0 - baseMultiplier) × mitigationBonus
 *
 * @returns Recovery amount (integer, 0+). Returns 0 for HEALTHY/DEAD.
 */
export function calculateHpRecovery(ctx: HpRecoveryContext): number {
  if (ctx.maxHp <= 0 || ctx.currentHp <= 0 || ctx.currentHp >= ctx.maxHp) {
    return 0;
  }

  const stage = getHpStage(ctx.currentHp, ctx.maxHp);
  const stageInfo = HP_STAGE_INFO[stage];
  if (!stageInfo || stageInfo.recoveryCoeff <= 0) {
    return 0;
  }

  const baseMultiplier = stageInfo.recoveryCoeff;

  // Mitigation: medical skills + items reduce injury recovery penalty
  const clampedMitigation = Math.max(0, Math.min(1.0, ctx.mitigationBonus));
  const mitigatedMultiplier = baseMultiplier + (1.0 - baseMultiplier) * clampedMitigation;

  // Rest bonus
  const restBonus = 1.0 + (REST_BONUS[ctx.restState] ?? 0);

  // Environment factor
  const clampedPenalty = Math.max(0, Math.min(0.5, ctx.environmentPenalty));
  const envFactor = 1.0 - clampedPenalty;

  const finalRate = HP_BASE_RECOVERY_RATE * mitigatedMultiplier * restBonus * envFactor;
  const recovery = Math.floor(ctx.maxHp * finalRate * ctx.elapsedHours);

  return Math.min(recovery, ctx.maxHp - ctx.currentHp);
}

// ─── HP Mutation ──────────────────────────────────────

/**
 * HP damage result.
 */
export interface HpDamageResult {
  /** HP after damage */
  newHp: number;
  /** Actual damage dealt */
  actualDamage: number;
  /** Whether entity died */
  isDead: boolean;
}

/**
 * Apply damage to HP.
 * HP cannot go below 0.
 *
 * @param amount - Damage amount (positive integer)
 * @returns HpDamageResult
 */
export function damageHp(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): HpDamageResult {
  if (amount <= 0) {
    const current = getHp(s, id);
    return { newHp: current, actualDamage: 0, isDead: current <= 0 };
  }

  const current = getHp(s, id);
  const actual = Math.min(amount, current);
  const newHp = current - actual;
  setHp(s, id, newHp);

  return { newHp, actualDamage: actual, isDead: newHp <= 0 };
}

/**
 * Heal HP.
 * HP cannot exceed maxHp.
 *
 * @param amount - Heal amount (positive integer)
 * @returns HP after healing
 */
export function healHp(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return getHp(s, id);

  const current = getHp(s, id);
  const max = getMaxHp(s, id);
  const newHp = Math.min(current + amount, max);
  setHp(s, id, newHp);

  return newHp;
}

/**
 * Calculate and apply HP recovery from context.
 * Combines calculateHpRecovery + healHp.
 *
 * @returns Actual recovery amount
 */
export function applyHpRecovery(
  s: CharacterStateStorage,
  id: EntityId,
  context: Omit<HpRecoveryContext, 'currentHp' | 'maxHp'>
): number {
  const currentHp = getHp(s, id);
  const maxHp = getMaxHp(s, id);
  const recovery = calculateHpRecovery({
    currentHp,
    maxHp,
    ...context,
  });

  if (recovery > 0) {
    healHp(s, id, recovery);
  }

  return recovery;
}

/**
 * Calculate maximum HP.
 * Master Index: STR + floor(CON × coefficient)
 * Bone/Blood Mark: coefficient = 2.0, Others: 1.5
 *
 * @param str - STR value
 * @param con - CON value
 * @param isBoneOrBloodMark - Whether entity has Bone/Blood WorldMark
 */
export function calculateMaxHp(str: number, con: number, isBoneOrBloodMark: boolean): number {
  const coefficient = isBoneOrBloodMark ? 2.0 : 1.5;
  return str + Math.floor(con * coefficient);
}

/**
 * Initialize character HP based on stats and WorldMark.
 * Sets both maxHp and current hp to the calculated value.
 */
export function initializeHp(
  s: CharacterStateStorage,
  id: EntityId,
  str: number,
  con: number,
  isBoneOrBloodMark: boolean
): void {
  const max = calculateMaxHp(str, con, isBoneOrBloodMark);
  s.maxHp[id] = max;
  s.hp[id] = max; // Initialize at full HP
}
