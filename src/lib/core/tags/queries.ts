import type { TagStorage } from '$lib/types/tags';
import type { EntityStorage } from '$lib/types/entity';
import type { EntityId } from '$lib/types/brand';
import { entityId } from '$lib/types/brand';

/**
 * Get alive entities with matching direction tag.
 */
export function getEntitiesByDirection(
  tags: TagStorage,
  entities: EntityStorage,
  direction: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.direction[i] === direction) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * Get alive entities with matching worldMark tag.
 * Checks both primary and secondary worldMark.
 */
export function getEntitiesByWorldMark(
  tags: TagStorage,
  entities: EntityStorage,
  mark: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (
      entities.alive[i] === 1 &&
      (tags.worldMark[i] === mark || tags.worldMark2[i] === mark)
    ) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * Get alive entities with matching motivation tag.
 */
export function getEntitiesByMotivation(
  tags: TagStorage,
  entities: EntityStorage,
  motivation: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.motivation[i] === motivation) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * Get alive entities with matching axis tag.
 * Checks both primary and secondary axis.
 */
export function getEntitiesByAxis(
  tags: TagStorage,
  entities: EntityStorage,
  axis: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (
      entities.alive[i] === 1 &&
      (tags.axis[i] === axis || tags.axis2[i] === axis)
    ) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * Get alive entities with matching situation tag.
 */
export function getEntitiesBySituation(
  tags: TagStorage,
  entities: EntityStorage,
  situation: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.situation[i] === situation) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * Calculate tag matching score between two entities.
 *
 * Used as static Consideration in IAUS.
 * Each tag category match/mismatch is scored and summed.
 *
 * Score range: -500 to +500 (normalized to 0-1 by IAUS)
 *
 * Scoring:
 *   - Direction match: +100
 *   - Axis match (primary-primary or primary-secondary): +150
 *   - Axis secondary-only match: +75
 *   - Motivation match: +150
 *   - WorldMark match (primary-primary or primary-secondary): +100
 *   - WorldMark secondary-only match: +50
 *   - Situation match: +0 (dynamic tag, not included in static score)
 *   - Baseline (all mismatched): -500
 *
 * @returns Score (-500 to +500)
 */
export function calculateTagMatchScore(
  s: TagStorage,
  id1: EntityId,
  id2: EntityId
): number {
  let score = -500; // Baseline: all mismatched

  // Direction match: +100
  const dir1 = s.direction[id1]!;
  const dir2 = s.direction[id2]!;
  if (dir1 !== 0 && dir1 === dir2) {
    score += 100;
  }

  // Axis match: +150 (check cross-match with secondary)
  const ax1 = s.axis[id1]!;
  const ax1s = s.axis2[id1]!;
  const ax2 = s.axis[id2]!;
  const ax2s = s.axis2[id2]!;
  if (ax1 !== 0 && (ax1 === ax2 || ax1 === ax2s)) {
    score += 150;
  } else if (ax1s !== 0 && (ax1s === ax2 || ax1s === ax2s)) {
    score += 75; // Secondary-only match: half points
  }

  // Motivation match: +150
  const mot1 = s.motivation[id1]!;
  const mot2 = s.motivation[id2]!;
  if (mot1 !== 0 && mot1 === mot2) {
    score += 150;
  }

  // WorldMark match: +100 (check cross-match with secondary)
  const wm1 = s.worldMark[id1]!;
  const wm1s = s.worldMark2[id1]!;
  const wm2 = s.worldMark[id2]!;
  const wm2s = s.worldMark2[id2]!;
  if (wm1 !== 0 && (wm1 === wm2 || wm1 === wm2s)) {
    score += 100;
  } else if (wm1s !== 0 && (wm1s === wm2 || wm1s === wm2s)) {
    score += 50; // Secondary-only match: half points
  }

  return score;
}
