import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import type { DejavuStageType } from '$lib/types/character';
import { DEJAVU_STAGE } from '$lib/types/character';
import { getDejavuBonds, setDejavuBonds, getHp } from './storage';

// ─── Constants ────────────────────────────────────────

/** Maximum dejavuBonds value (fixed). */
export const DEJAVU_BONDS_MAX = 100;

/** DejavuBonds base recovery rate: 10 points/hour (outside chaos only). */
export const BONDS_RECOVERY_RATE = 10;

/** Chaos passive damage base rate: 5 points/hour. */
export const CHAOS_PASSIVE_DAMAGE_BASE = 5;

// ─── DejavuBonds Stage ────────────────────────────────

/**
 * Determine dejavuBonds stage from current value.
 *
 * Master Index display stages:
 *   FULL(100), ENRICHED(90-99), GOOD(80-89), STABLE(70-79),
 *   MAINTAINED(60-69), HALVED(50-59), UNSTABLE(40-49),
 *   THIN(30-39), DANGER(20-29), VANISHING(1-19), ISOLATED(0)
 *
 * @param bonds - Current dejavuBonds value (0-100)
 * @returns DejavuStageType
 */
export function getDejavuStage(bonds: number): DejavuStageType {
  if (bonds >= 100) return DEJAVU_STAGE.FULL;
  if (bonds >= 90) return DEJAVU_STAGE.ENRICHED;
  if (bonds >= 80) return DEJAVU_STAGE.GOOD;
  if (bonds >= 70) return DEJAVU_STAGE.STABLE;
  if (bonds >= 60) return DEJAVU_STAGE.MAINTAINED;
  if (bonds >= 50) return DEJAVU_STAGE.HALVED;
  if (bonds >= 40) return DEJAVU_STAGE.UNSTABLE;
  if (bonds >= 30) return DEJAVU_STAGE.THIN;
  if (bonds >= 20) return DEJAVU_STAGE.DANGER;
  if (bonds >= 1) return DEJAVU_STAGE.VANISHING;
  return DEJAVU_STAGE.ISOLATED;
}

/**
 * Get entity dejavuBonds stage from storage.
 */
export function getEntityDejavuStage(s: CharacterStateStorage, id: EntityId): DejavuStageType {
  return getDejavuStage(getDejavuBonds(s, id));
}

/**
 * Check if dejavuBonds should be displayed in UI.
 * Hidden when FULL (100), visible otherwise.
 */
export function isDejavuBondsVisible(bonds: number): boolean {
  return bonds < 100;
}

// ─── DejavuBonds Recovery ─────────────────────────────

/**
 * Calculate dejavuBonds recovery amount (pure function).
 *
 * Master Index: 10 points/hour (outside chaos only).
 * No recovery in chaos areas.
 *
 * @param currentBonds - Current dejavuBonds value
 * @param inChaosArea - Whether entity is in chaos area
 * @param elapsedHours - Elapsed hours
 * @returns Recovery amount (integer, 0+)
 */
export function calculateBondsRecovery(
  currentBonds: number,
  inChaosArea: boolean,
  elapsedHours: number
): number {
  if (inChaosArea || currentBonds >= DEJAVU_BONDS_MAX || elapsedHours <= 0) {
    return 0;
  }

  const recovery = Math.floor(BONDS_RECOVERY_RATE * elapsedHours);
  return Math.min(recovery, DEJAVU_BONDS_MAX - currentBonds);
}

/**
 * Apply dejavuBonds recovery.
 *
 * @returns Actual recovery amount
 */
export function applyBondsRecovery(
  s: CharacterStateStorage,
  id: EntityId,
  inChaosArea: boolean,
  elapsedHours: number
): number {
  const current = getDejavuBonds(s, id);
  const recovery = calculateBondsRecovery(current, inChaosArea, elapsedHours);

  if (recovery > 0) {
    setDejavuBonds(s, id, current + recovery);
  }

  return recovery;
}

// ─── Chaos Passive Damage ─────────────────────────────

/**
 * Calculate chaos passive damage amount (pure function).
 *
 * Master Index: 5 points/hour × (1.0 + chaos_level)
 *
 * @param chaosLevel - Chaos level (0.0+)
 * @param elapsedHours - Elapsed hours
 * @returns Damage amount (integer, 0+)
 */
export function calculateChaosPassiveDamage(
  chaosLevel: number,
  elapsedHours: number
): number {
  if (elapsedHours <= 0 || chaosLevel < 0) return 0;
  return Math.floor(CHAOS_PASSIVE_DAMAGE_BASE * (1.0 + chaosLevel) * elapsedHours);
}

// ─── Chaos Attack Damage ──────────────────────────────

/**
 * Chaos attack damage result.
 */
export interface ChaosAttackResult {
  /** Damage absorbed by bonds */
  bondsAbsorbed: number;
  /** Damage that penetrated to HP (overflow when bonds = 0) */
  hpDamage: number;
  /** dejavuBonds after damage */
  newBonds: number;
  /** HP after damage */
  newHp: number;
  /** Whether HP reached 0 */
  isDead: boolean;
}

/**
 * Apply chaos attack damage.
 *
 * Master Index:
 *   Chaos Damage → dejavuBonds absorbs first → Overflow penetrates to HP
 *
 * 1. dejavuBonds absorbs damage first
 * 2. If bonds reach 0, overflow damage goes to HP
 *
 * @param amount - Chaos attack damage amount (positive integer)
 * @returns ChaosAttackResult
 */
export function applyChaosAttackDamage(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): ChaosAttackResult {
  if (amount <= 0) {
    const bonds = getDejavuBonds(s, id);
    const hp = getHp(s, id);
    return { bondsAbsorbed: 0, hpDamage: 0, newBonds: bonds, newHp: hp, isDead: hp <= 0 };
  }

  const currentBonds = getDejavuBonds(s, id);
  const currentHp = getHp(s, id);

  // Step 1: Bonds absorb
  const bondsAbsorbed = Math.min(amount, currentBonds);
  const newBonds = currentBonds - bondsAbsorbed;
  setDejavuBonds(s, id, newBonds);

  // Step 2: Overflow penetrates to HP
  const overflow = amount - bondsAbsorbed;
  let hpDamage = 0;
  let newHp = currentHp;

  if (overflow > 0) {
    hpDamage = Math.min(overflow, currentHp);
    newHp = currentHp - hpDamage;
    s.hp[id] = newHp;
  }

  return {
    bondsAbsorbed,
    hpDamage,
    newBonds,
    newHp,
    isDead: newHp <= 0,
  };
}

/**
 * Apply chaos passive damage to dejavuBonds.
 *
 * Passive damage affects bonds only (no HP penetration).
 * If bonds = 0, entity has no protection against chaos attacks,
 * but passive damage itself does not damage HP.
 *
 * Note: Separate from chaos attack damage (applyChaosAttackDamage).
 *
 * @returns Actual damage amount
 */
export function applyChaosPassiveDamage(
  s: CharacterStateStorage,
  id: EntityId,
  chaosLevel: number,
  elapsedHours: number
): number {
  const damage = calculateChaosPassiveDamage(chaosLevel, elapsedHours);
  if (damage <= 0) return 0;

  const current = getDejavuBonds(s, id);
  const actual = Math.min(damage, current);
  setDejavuBonds(s, id, current - actual);

  return actual;
}

/**
 * Damage dejavuBonds directly (for general bonds reduction).
 *
 * @returns Actual damage amount
 */
export function damageBonds(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return 0;

  const current = getDejavuBonds(s, id);
  const actual = Math.min(amount, current);
  setDejavuBonds(s, id, current - actual);

  return actual;
}

/**
 * Heal dejavuBonds directly.
 *
 * @returns Bonds value after healing
 */
export function healBonds(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return getDejavuBonds(s, id);

  const current = getDejavuBonds(s, id);
  const newBonds = Math.min(current + amount, DEJAVU_BONDS_MAX);
  setDejavuBonds(s, id, newBonds);

  return newBonds;
}
