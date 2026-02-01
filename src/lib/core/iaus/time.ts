import type { ActionLockStorage } from '$lib/types/iaus';
import { TIME_CONFIG } from '$lib/types/iaus';

// =============================================================================
// Lock Counter Management
// =============================================================================

/**
 * Advance lock counters for all active entities.
 * Decrements remainingTicks and returns IDs that became unlocked.
 *
 * Behavior:
 * - remaining > 0: decrement, if becomes 0 → add to unlocked
 * - remaining === 0: already unlocked (needs evaluation) → add to unlocked
 * - IDs not in activeEntityIds are not touched
 *
 * @param lock - Action lock storage (modified in-place)
 * @param activeEntityIds - List of active entity IDs to process
 * @returns Array of entity IDs that are now unlocked
 */
export function advanceLockCounters(
  lock: ActionLockStorage,
  activeEntityIds: readonly number[]
): number[] {
  const unlocked: number[] = [];

  for (let i = 0; i < activeEntityIds.length; i++) {
    const id = activeEntityIds[i]!;
    const remaining = lock.remainingTicks[id]!;
    if (remaining > 0) {
      lock.remainingTicks[id] = remaining - 1;
      if (remaining === 1) {
        // This tick unlocks the entity
        unlocked.push(id);
      }
    } else {
      // Already unlocked (needs evaluation)
      unlocked.push(id);
    }
  }

  return unlocked;
}

// =============================================================================
// Duration Calculation
// =============================================================================

/**
 * Calculate action duration with variance.
 *
 * @param baseTicks - Base duration in ticks
 * @param variance - Variance factor (0.0-0.5, e.g., 0.2 = ±20%)
 * @param seed - Optional seed for deterministic random (for catchup replay)
 * @returns Duration clamped to 1-255
 */
export function calculateDuration(
  baseTicks: number,
  variance: number,
  seed?: number
): number {
  // No variance or baseTicks too small
  if (variance <= 0 || baseTicks <= 1) {
    return Math.max(1, Math.min(255, baseTicks));
  }

  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  const offset = Math.floor((random - 0.5) * 2 * baseTicks * variance);
  return Math.max(1, Math.min(255, baseTicks + offset));
}

/**
 * Seeded random number generator (xorshift32).
 * Used for deterministic replay during catchup.
 *
 * @param seed - Integer seed (non-zero recommended)
 * @returns Random number in range [0, 1)
 */
export function seededRandom(seed: number): number {
  let x = seed | 0; // Force integer
  if (x === 0) x = 1; // xorshift returns 0 for seed=0, so avoid it
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

// =============================================================================
// Game Time Calculations
// =============================================================================

/**
 * Calculate game hour from current tick.
 *
 * Each tick = 1.875 game minutes
 * 1 game hour = 32 ticks
 * 1 game day = 768 ticks
 *
 * @param currentTick - Current game tick
 * @returns Game hour (0-23)
 */
export function calculateGameHour(currentTick: number): number {
  const gameMinutes = currentTick * TIME_CONFIG.TICK_GAME_MINUTES;
  return Math.floor((gameMinutes % 1440) / 60); // 1440 = 24h in minutes
}

/**
 * Convert real seconds to game ticks.
 *
 * Uses TIME_CONFIG ratio: 2 real : 3 game
 * 1 tick = 75 real seconds
 *
 * @param realSeconds - Real-world seconds
 * @returns Number of game ticks
 */
export function realSecondsToTicks(realSeconds: number): number {
  return Math.floor(realSeconds / TIME_CONFIG.REAL_SECONDS_PER_TICK);
}

/**
 * Convert game ticks to game minutes.
 *
 * Each tick = 1.875 game minutes
 *
 * @param ticks - Number of game ticks
 * @returns Game minutes
 */
export function ticksToGameMinutes(ticks: number): number {
  return ticks * TIME_CONFIG.TICK_GAME_MINUTES;
}
