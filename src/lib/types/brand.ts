// =============================================================================
// Branded Type System
// Type Safety Specification v1
// =============================================================================

declare const __brand: unique symbol;

/**
 * Branded type helper.
 * Creates a nominal type from a structural base type.
 * Runtime cost: zero (erased at transpile time).
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// =============================================================================
// Entity System IDs
// =============================================================================

export type EntityId = Brand<number, 'EntityId'>;
export type ArchetypeId = Brand<number, 'ArchetypeId'>;
export type CityId = Brand<number, 'CityId'>;

// =============================================================================
// Constants
// =============================================================================

/** V8 Smi upper bound (2^30 - 1) */
const SMI_MAX = 0x3fffffff;

/** Maximum archetypes in v2 */
const ARCHETYPE_MAX = 63;

/** Maximum city ID (5-bit in hierarchy data) */
const CITY_MAX = 31;

// =============================================================================
// Constructor Functions
// =============================================================================

/**
 * Create a validated EntityId.
 * Guarantees: integer, non-negative, within Smi range.
 */
export function entityId(n: number): EntityId {
  if (!Number.isInteger(n) || n < 0 || n > SMI_MAX) {
    throw new RangeError(`Invalid EntityId: ${n}`);
  }
  return n as EntityId;
}

/**
 * Create a validated ArchetypeId.
 * Guarantees: integer, 0-63 range (64 archetypes max in v2).
 */
export function archetypeId(n: number): ArchetypeId {
  if (!Number.isInteger(n) || n < 0 || n > ARCHETYPE_MAX) {
    throw new RangeError(`Invalid ArchetypeId: ${n}`);
  }
  return n as ArchetypeId;
}

/**
 * Create a validated CityId.
 * Guarantees: integer, 0-31 range (5-bit city ID in hierarchy data).
 */
export function cityId(n: number): CityId {
  if (!Number.isInteger(n) || n < 0 || n > CITY_MAX) {
    throw new RangeError(`Invalid CityId: ${n}`);
  }
  return n as CityId;
}

// =============================================================================
// Type Guard Functions
// =============================================================================

/**
 * Type guard for EntityId validation.
 * Use at external data boundaries (IndexedDB load, import/export).
 */
export function isValidEntityId(value: unknown): value is EntityId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= SMI_MAX
  );
}

/**
 * Type guard for ArchetypeId validation.
 * Use at external data boundaries.
 */
export function isValidArchetypeId(value: unknown): value is ArchetypeId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= ARCHETYPE_MAX
  );
}

/**
 * Type guard for CityId validation.
 * Use at external data boundaries.
 */
export function isValidCityId(value: unknown): value is CityId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CITY_MAX
  );
}
