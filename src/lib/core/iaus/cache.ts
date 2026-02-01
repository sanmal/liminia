import type { DecisionCacheStorage, ActionLockStorage } from '$lib/types/iaus';
import type { EntityId } from '$lib/types/brand';
import { MAX_ENTITIES } from '$lib/types/constants';

// =============================================================================
// Decision Cache Storage
// =============================================================================

/**
 * Create a new DecisionCacheStorage instance.
 * @param capacity - Maximum number of entities (default: MAX_ENTITIES)
 */
export function createDecisionCacheStorage(
  capacity: number = MAX_ENTITIES
): DecisionCacheStorage {
  return {
    currentDecision: new Uint16Array(capacity),
    currentScore: new Float32Array(capacity),
    lastEvaluatedTick: new Uint32Array(capacity),
    capacity,
  };
}

// =============================================================================
// Action Lock Storage
// =============================================================================

/**
 * Create a new ActionLockStorage instance.
 * @param capacity - Maximum number of entities (default: MAX_ENTITIES)
 */
export function createActionLockStorage(
  capacity: number = MAX_ENTITIES
): ActionLockStorage {
  return {
    remainingTicks: new Uint8Array(capacity),
    currentAction: new Uint8Array(capacity),
    capacity,
  };
}

// =============================================================================
// Decision Cache Accessors
// =============================================================================

/** Get current decision ID for entity. */
export function getCurrentDecision(cache: DecisionCacheStorage, id: EntityId): number {
  return cache.currentDecision[id]!;
}

/** Get current score for entity. */
export function getCurrentScore(cache: DecisionCacheStorage, id: EntityId): number {
  return cache.currentScore[id]!;
}

/** Get last evaluated tick for entity. */
export function getLastEvaluatedTick(cache: DecisionCacheStorage, id: EntityId): number {
  return cache.lastEvaluatedTick[id]!;
}

/**
 * Set decision result for entity.
 * Updates decision ID, score, and tick atomically.
 */
export function setDecisionResult(
  cache: DecisionCacheStorage,
  id: EntityId,
  decisionId: number,
  score: number,
  tick: number
): void {
  cache.currentDecision[id] = decisionId;
  cache.currentScore[id] = score;
  cache.lastEvaluatedTick[id] = tick;
}

// =============================================================================
// Action Lock Accessors
// =============================================================================

/** Check if entity is locked (has remaining ticks > 0). */
export function isLocked(lock: ActionLockStorage, id: EntityId): boolean {
  return lock.remainingTicks[id]! > 0;
}

/** Get remaining lock ticks for entity. */
export function getRemainingTicks(lock: ActionLockStorage, id: EntityId): number {
  return lock.remainingTicks[id]!;
}

/** Get current action for entity. */
export function getCurrentAction(lock: ActionLockStorage, id: EntityId): number {
  return lock.currentAction[id]!;
}

/**
 * Set lock for entity.
 * Ticks are clamped to 0-255 (Uint8 range).
 */
export function setLock(
  lock: ActionLockStorage,
  id: EntityId,
  ticks: number,
  action: number
): void {
  lock.remainingTicks[id] = Math.min(ticks, 255);
  lock.currentAction[id] = action;
}

/**
 * Clear lock for entity.
 * Sets remainingTicks and currentAction to 0.
 */
export function clearLock(lock: ActionLockStorage, id: EntityId): void {
  lock.remainingTicks[id] = 0;
  lock.currentAction[id] = 0;
}
