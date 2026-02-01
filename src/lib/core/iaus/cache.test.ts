import { describe, it, expect } from 'vitest';
import {
  createDecisionCacheStorage,
  createActionLockStorage,
  getCurrentDecision,
  getCurrentScore,
  getLastEvaluatedTick,
  setDecisionResult,
  isLocked,
  getRemainingTicks,
  getCurrentAction,
  setLock,
  clearLock,
} from './cache';
import { entityId } from '$lib/types/brand';
import { MAX_ENTITIES } from '$lib/types/constants';

const id0 = entityId(0);
const id1 = entityId(1);
const id2 = entityId(2);

describe('createDecisionCacheStorage', () => {
  it('should create storage with default capacity (MAX_ENTITIES)', () => {
    const cache = createDecisionCacheStorage();
    expect(cache.capacity).toBe(MAX_ENTITIES);
    expect(cache.currentDecision.length).toBe(MAX_ENTITIES);
    expect(cache.currentScore.length).toBe(MAX_ENTITIES);
    expect(cache.lastEvaluatedTick.length).toBe(MAX_ENTITIES);
  });

  it('should create storage with custom capacity', () => {
    const cache = createDecisionCacheStorage(128);
    expect(cache.capacity).toBe(128);
    expect(cache.currentDecision.length).toBe(128);
  });

  it('should use correct TypedArray types', () => {
    const cache = createDecisionCacheStorage(8);
    expect(cache.currentDecision).toBeInstanceOf(Uint16Array);
    expect(cache.currentScore).toBeInstanceOf(Float32Array);
    expect(cache.lastEvaluatedTick).toBeInstanceOf(Uint32Array);
  });

  it('should initialize all values to 0', () => {
    const cache = createDecisionCacheStorage(8);
    expect(cache.currentDecision[0]).toBe(0);
    expect(cache.currentScore[0]).toBe(0);
    expect(cache.lastEvaluatedTick[0]).toBe(0);
  });
});

describe('createActionLockStorage', () => {
  it('should create storage with default capacity (MAX_ENTITIES)', () => {
    const lock = createActionLockStorage();
    expect(lock.capacity).toBe(MAX_ENTITIES);
    expect(lock.remainingTicks.length).toBe(MAX_ENTITIES);
    expect(lock.currentAction.length).toBe(MAX_ENTITIES);
  });

  it('should create storage with custom capacity', () => {
    const lock = createActionLockStorage(64);
    expect(lock.capacity).toBe(64);
    expect(lock.remainingTicks.length).toBe(64);
  });

  it('should use correct TypedArray types', () => {
    const lock = createActionLockStorage(8);
    expect(lock.remainingTicks).toBeInstanceOf(Uint8Array);
    expect(lock.currentAction).toBeInstanceOf(Uint8Array);
  });

  it('should initialize all values to 0', () => {
    const lock = createActionLockStorage(8);
    expect(lock.remainingTicks[0]).toBe(0);
    expect(lock.currentAction[0]).toBe(0);
  });
});

describe('Decision Cache accessors', () => {
  it('should set and get decision result', () => {
    const cache = createDecisionCacheStorage(8);
    setDecisionResult(cache, id0, 5, 0.75, 1000);

    expect(getCurrentDecision(cache, id0)).toBe(5);
    expect(getCurrentScore(cache, id0)).toBeCloseTo(0.75, 5);
    expect(getLastEvaluatedTick(cache, id0)).toBe(1000);
  });

  it('should set values independently for different entities', () => {
    const cache = createDecisionCacheStorage(8);
    setDecisionResult(cache, id0, 1, 0.5, 100);
    setDecisionResult(cache, id1, 2, 0.8, 200);

    expect(getCurrentDecision(cache, id0)).toBe(1);
    expect(getCurrentDecision(cache, id1)).toBe(2);
    expect(getCurrentScore(cache, id0)).toBeCloseTo(0.5, 5);
    expect(getCurrentScore(cache, id1)).toBeCloseTo(0.8, 5);
  });

  it('should overwrite previous decision result', () => {
    const cache = createDecisionCacheStorage(8);
    setDecisionResult(cache, id0, 1, 0.5, 100);
    setDecisionResult(cache, id0, 3, 0.9, 200);

    expect(getCurrentDecision(cache, id0)).toBe(3);
    expect(getCurrentScore(cache, id0)).toBeCloseTo(0.9, 5);
    expect(getLastEvaluatedTick(cache, id0)).toBe(200);
  });
});

describe('Action Lock accessors', () => {
  it('should return isLocked=false and remainingTicks=0 initially', () => {
    const lock = createActionLockStorage(8);
    expect(isLocked(lock, id0)).toBe(false);
    expect(getRemainingTicks(lock, id0)).toBe(0);
    expect(getCurrentAction(lock, id0)).toBe(0);
  });

  it('should set lock and return isLocked=true', () => {
    const lock = createActionLockStorage(8);
    setLock(lock, id0, 10, 5);

    expect(isLocked(lock, id0)).toBe(true);
    expect(getRemainingTicks(lock, id0)).toBe(10);
    expect(getCurrentAction(lock, id0)).toBe(5);
  });

  it('should clamp ticks > 255 to 255', () => {
    const lock = createActionLockStorage(8);
    setLock(lock, id0, 300, 1);

    expect(getRemainingTicks(lock, id0)).toBe(255);
  });

  it('should clear lock', () => {
    const lock = createActionLockStorage(8);
    setLock(lock, id0, 50, 3);
    clearLock(lock, id0);

    expect(isLocked(lock, id0)).toBe(false);
    expect(getRemainingTicks(lock, id0)).toBe(0);
    expect(getCurrentAction(lock, id0)).toBe(0);
  });

  it('should set values independently for different entities', () => {
    const lock = createActionLockStorage(8);
    setLock(lock, id0, 10, 1);
    setLock(lock, id1, 20, 2);

    expect(getRemainingTicks(lock, id0)).toBe(10);
    expect(getRemainingTicks(lock, id1)).toBe(20);
    expect(getCurrentAction(lock, id0)).toBe(1);
    expect(getCurrentAction(lock, id1)).toBe(2);
  });
});
