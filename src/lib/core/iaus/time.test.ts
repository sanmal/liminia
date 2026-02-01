import { describe, it, expect } from 'vitest';
import {
  advanceLockCounters,
  calculateDuration,
  seededRandom,
  calculateGameHour,
  realSecondsToTicks,
  ticksToGameMinutes,
} from './time';
import { createActionLockStorage, setLock, getRemainingTicks } from './cache';
import { entityId } from '$lib/types/brand';

describe('seededRandom', () => {
  it('should return same result for same seed (deterministic)', () => {
    const r1 = seededRandom(12345);
    const r2 = seededRandom(12345);
    expect(r1).toBe(r2);
  });

  it('should return different results for different seeds', () => {
    const r1 = seededRandom(12345);
    const r2 = seededRandom(54321);
    expect(r1).not.toBe(r2);
  });

  it('should return value in range [0, 1)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = seededRandom(seed);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('should handle seed=0 without error (converts to 1)', () => {
    expect(() => seededRandom(0)).not.toThrow();
    const r = seededRandom(0);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });

  it('should produce different values for varied seeds', () => {
    // Check that different seed values produce varied results
    const values = new Set<number>();
    for (let seed = 1000; seed <= 1100; seed++) {
      values.add(seededRandom(seed));
    }
    // Should have many unique values (at least 90 out of 100)
    expect(values.size).toBeGreaterThanOrEqual(90);
  });
});

describe('calculateDuration', () => {
  it('should return baseTicks when variance=0', () => {
    expect(calculateDuration(100, 0)).toBe(100);
    expect(calculateDuration(50, 0)).toBe(50);
  });

  it('should return 1 when baseTicks=1', () => {
    expect(calculateDuration(1, 0.5)).toBe(1);
  });

  it('should be deterministic with same seed', () => {
    const d1 = calculateDuration(100, 0.2, 12345);
    const d2 = calculateDuration(100, 0.2, 12345);
    expect(d1).toBe(d2);
  });

  it('should clamp result to 1-255 range', () => {
    // Very high baseTicks
    expect(calculateDuration(300, 0)).toBe(255);

    // With variance that could push below 1
    const result = calculateDuration(2, 0.5, 99999);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(255);
  });

  it('should produce values in expected range (baseTicks=200, variance=0.5)', () => {
    // variance=0.5 → ±50% → range 100-300, clamped to 100-255
    for (let seed = 1; seed <= 50; seed++) {
      const d = calculateDuration(200, 0.5, seed);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(255);
    }
  });

  it('should produce values in expected range (baseTicks=10, variance=0.2)', () => {
    // variance=0.2 → ±20% → range 8-12
    for (let seed = 1; seed <= 50; seed++) {
      const d = calculateDuration(10, 0.2, seed);
      expect(d).toBeGreaterThanOrEqual(8);
      expect(d).toBeLessThanOrEqual(12);
    }
  });

  it('should handle zero baseTicks', () => {
    expect(calculateDuration(0, 0.5)).toBe(1); // Clamped to 1
  });
});

describe('calculateGameHour', () => {
  it('should return 0 at tick=0', () => {
    expect(calculateGameHour(0)).toBe(0);
  });

  it('should return 1 at tick=32 (32 ticks = 1 game hour)', () => {
    expect(calculateGameHour(32)).toBe(1);
  });

  it('should return 12 at tick=384 (384 = 32 × 12)', () => {
    expect(calculateGameHour(384)).toBe(12);
  });

  it('should wrap at tick=768 (1 game day)', () => {
    expect(calculateGameHour(768)).toBe(0);
  });

  it('should return 1 at tick=800 (768 + 32)', () => {
    expect(calculateGameHour(800)).toBe(1);
  });

  it('should always return value in range 0-23', () => {
    for (let tick = 0; tick < 2000; tick += 17) {
      const hour = calculateGameHour(tick);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });

  it('should return 23 at tick=767 (last hour of day)', () => {
    expect(calculateGameHour(767)).toBe(23);
  });
});

describe('realSecondsToTicks', () => {
  it('should return 1 tick for 75 real seconds', () => {
    expect(realSecondsToTicks(75)).toBe(1);
  });

  it('should return 0 for 0 seconds', () => {
    expect(realSecondsToTicks(0)).toBe(0);
  });

  it('should return 48 ticks for 1 hour (3600 seconds)', () => {
    expect(realSecondsToTicks(3600)).toBe(48);
  });

  it('should floor partial ticks', () => {
    expect(realSecondsToTicks(74)).toBe(0);
    expect(realSecondsToTicks(76)).toBe(1);
    expect(realSecondsToTicks(149)).toBe(1);
    expect(realSecondsToTicks(150)).toBe(2);
  });
});

describe('ticksToGameMinutes', () => {
  it('should return 1.875 for 1 tick', () => {
    expect(ticksToGameMinutes(1)).toBeCloseTo(1.875, 5);
  });

  it('should return 60 for 32 ticks (1 game hour)', () => {
    expect(ticksToGameMinutes(32)).toBeCloseTo(60, 5);
  });

  it('should return 0 for 0 ticks', () => {
    expect(ticksToGameMinutes(0)).toBe(0);
  });

  it('should return 1440 for 768 ticks (1 game day)', () => {
    expect(ticksToGameMinutes(768)).toBeCloseTo(1440, 5);
  });
});

describe('advanceLockCounters', () => {
  it('should return empty array for empty activeEntityIds', () => {
    const lock = createActionLockStorage(8);
    const unlocked = advanceLockCounters(lock, []);
    expect(unlocked).toEqual([]);
  });

  it('should return all IDs when all have remaining=0', () => {
    const lock = createActionLockStorage(8);
    // All entities start with remaining=0
    const unlocked = advanceLockCounters(lock, [0, 1, 2]);
    expect(unlocked).toEqual([0, 1, 2]);
  });

  it('should add to unlocked when remaining becomes 0', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    setLock(lock, id0, 1, 5); // Will become 0 after advance

    const unlocked = advanceLockCounters(lock, [0]);
    expect(unlocked).toEqual([0]);
    expect(getRemainingTicks(lock, id0)).toBe(0);
  });

  it('should decrement but not unlock when remaining > 1', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    setLock(lock, id0, 5, 3);

    const unlocked = advanceLockCounters(lock, [0]);
    expect(unlocked).toEqual([]); // Not unlocked yet
    expect(getRemainingTicks(lock, id0)).toBe(4);
  });

  it('should handle mixed locked and unlocked entities', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    const id1 = entityId(1);
    const id2 = entityId(2);

    setLock(lock, id0, 5, 1); // Locked, won't unlock
    setLock(lock, id1, 1, 2); // Will unlock this tick
    // id2 is already unlocked (remaining=0)

    const unlocked = advanceLockCounters(lock, [0, 1, 2]);
    expect(unlocked).toContain(1);
    expect(unlocked).toContain(2);
    expect(unlocked).not.toContain(0);
    expect(unlocked.length).toBe(2);
  });

  it('should not touch entities not in activeEntityIds', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    const id1 = entityId(1);

    setLock(lock, id0, 5, 1);
    setLock(lock, id1, 3, 2);

    // Only process id0
    advanceLockCounters(lock, [0]);

    expect(getRemainingTicks(lock, id0)).toBe(4); // Decremented
    expect(getRemainingTicks(lock, entityId(1))).toBe(3); // Unchanged
  });

  it('should unlock after correct number of consecutive calls', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    setLock(lock, id0, 3, 1);

    let unlocked = advanceLockCounters(lock, [0]);
    expect(unlocked).toEqual([]);
    expect(getRemainingTicks(lock, id0)).toBe(2);

    unlocked = advanceLockCounters(lock, [0]);
    expect(unlocked).toEqual([]);
    expect(getRemainingTicks(lock, id0)).toBe(1);

    unlocked = advanceLockCounters(lock, [0]);
    expect(unlocked).toEqual([0]); // Now unlocked
    expect(getRemainingTicks(lock, id0)).toBe(0);
  });

  it('should keep returning unlocked ID after unlock', () => {
    const lock = createActionLockStorage(8);
    const id0 = entityId(0);
    // Already unlocked (remaining=0)

    const unlocked1 = advanceLockCounters(lock, [0]);
    const unlocked2 = advanceLockCounters(lock, [0]);

    expect(unlocked1).toEqual([0]);
    expect(unlocked2).toEqual([0]);
  });
});
