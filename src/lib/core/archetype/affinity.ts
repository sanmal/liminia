import type { ArchetypeStorage } from '$lib/types/archetype';
import type { TagStorage } from '$lib/types/tags';
import type { ArchetypeId, EntityId } from '$lib/types/brand';

/**
 * Compute compatibility score between two archetypes.
 *
 * Scoring:
 *   Baseline: 0
 *   Direction match: +20
 *   PrimaryAxis match: +30
 *   PrimaryAxis-SecondaryAxis cross match: +15
 *   SecondaryAxis match: +10
 *   Motivation match: +30
 *   Motivation same category: +10
 *   WorldMark match: +20
 *   Opposite Axis (ORDER↔CHAOS etc.): -20
 *
 * @returns Score (-20 to +130 range)
 */
export function computeArchetypeCompatibility(
  storage: ArchetypeStorage,
  id1: ArchetypeId,
  id2: ArchetypeId
): number {
  let score = 0;

  // Direction match
  const dir1 = storage.directions[id1]!;
  const dir2 = storage.directions[id2]!;
  if (dir1 !== 0 && dir1 === dir2) {
    score += 20;
  }

  // Primary Axis match
  const ax1 = storage.primaryAxis[id1]!;
  const ax2 = storage.primaryAxis[id2]!;
  if (ax1 !== 0 && ax1 === ax2) {
    score += 30;
  } else if (ax1 !== 0 && ax2 !== 0 && areOppositeAxes(ax1, ax2)) {
    score -= 20;
  }

  // Cross-match: primary1 vs secondary2 and vice versa
  const ax1s = storage.secondaryAxis[id1]!;
  const ax2s = storage.secondaryAxis[id2]!;
  if (ax1 !== 0 && ax1 === ax2s) {
    score += 15;
  }
  if (ax2 !== 0 && ax2 === ax1s) {
    score += 15;
  }

  // Secondary Axis match
  if (ax1s !== 0 && ax1s === ax2s) {
    score += 10;
  }

  // Motivation match
  const mot1 = storage.motivations[id1]!;
  const mot2 = storage.motivations[id2]!;
  if (mot1 !== 0 && mot1 === mot2) {
    score += 30;
  } else if (mot1 !== 0 && mot2 !== 0 && sameMotivationCategory(mot1, mot2)) {
    score += 10;
  }

  // WorldMark match
  const wm1 = storage.worldMarks[id1]!;
  const wm2 = storage.worldMarks[id2]!;
  if (wm1 !== 0 && wm1 === wm2) {
    score += 20;
  }

  return score;
}

/**
 * Compute affinity score between an entity's tag profile and an archetype.
 *
 * Used as static Consideration in IAUS.
 * Reads entity tags and compares with archetype definition.
 *
 * Scoring:
 *   Baseline: 0
 *   Direction match: +20
 *   Primary Axis match (entity.axis or axis2 vs archetype.primary): +30 / +15
 *   Secondary Axis match: +15 / +10
 *   Motivation match: +30, same category: +10
 *   WorldMark match (entity.worldMark or worldMark2 vs archetype): +20 / +10
 *   Opposite Axis penalty: -20
 *
 * @returns Score (-20 to +125 range)
 */
export function computeEntityArchetypeAffinity(
  archetypes: ArchetypeStorage,
  archId: ArchetypeId,
  tags: TagStorage,
  entId: EntityId
): number {
  let score = 0;

  // Direction
  const eDir = tags.direction[entId]!;
  const aDir = archetypes.directions[archId]!;
  if (eDir !== 0 && eDir === aDir) {
    score += 20;
  }

  // Axis
  const eAx = tags.axis[entId]!;
  const eAx2 = tags.axis2[entId]!;
  const aAx = archetypes.primaryAxis[archId]!;
  const aAx2 = archetypes.secondaryAxis[archId]!;

  // Entity primary vs Archetype primary/secondary
  if (eAx !== 0 && eAx === aAx) {
    score += 30;
  } else if (eAx !== 0 && eAx === aAx2) {
    score += 15;
  } else if (eAx2 !== 0 && eAx2 === aAx) {
    score += 15;
  } else if (eAx2 !== 0 && eAx2 === aAx2) {
    score += 10;
  }

  // Opposite axis penalty
  if (eAx !== 0 && aAx !== 0 && areOppositeAxes(eAx, aAx)) {
    score -= 20;
  }

  // Motivation
  const eMot = tags.motivation[entId]!;
  const aMot = archetypes.motivations[archId]!;
  if (eMot !== 0 && eMot === aMot) {
    score += 30;
  } else if (eMot !== 0 && aMot !== 0 && sameMotivationCategory(eMot, aMot)) {
    score += 10;
  }

  // WorldMark
  const eWm = tags.worldMark[entId]!;
  const eWm2 = tags.worldMark2[entId]!;
  const aWm = archetypes.worldMarks[archId]!;
  if (eWm !== 0 && eWm === aWm) {
    score += 20;
  } else if (eWm2 !== 0 && eWm2 === aWm) {
    score += 10;
  }

  return score;
}

// ─── Helper Functions ────────────────────────────────────

/**
 * Check if two Axis values are opposites.
 *
 * Opposite pairs:
 *   ORDER(1) ↔ CHAOS(2)
 *   INTRO(3) ↔ EXTRA(4)
 *   STABLE(5) ↔ REACTIVE(6)
 *   CAUTIOUS(7) ↔ BOLD(8)
 *   SELF(9) ↔ OTHERS(10)
 */
export function areOppositeAxes(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  // Pairs: (1,2), (3,4), (5,6), (7,8), (9,10)
  // Same pair if Math.ceil(a/2) === Math.ceil(b/2) and a !== b
  return a !== b && Math.ceil(a / 2) === Math.ceil(b / 2);
}

/**
 * Check if two Motivation values belong to the same category.
 *
 * Categories:
 *   Achievement: MASTERY(1), POWER(2), WEALTH(3)
 *   Connection:  BELONGING(4), RECOGNITION(5), LOVE(6)
 *   Growth:      KNOWLEDGE(7), CREATION(8), FREEDOM(9)
 *   Preservation: PROTECTION(10), JUSTICE(11), SURVIVAL(12)
 */
export function sameMotivationCategory(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  // Same category if Math.ceil(a/3) === Math.ceil(b/3)
  return Math.ceil(a / 3) === Math.ceil(b / 3);
}
