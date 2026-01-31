import type { CategoryType } from './constants';

// =============================================================================
// Entity Storage (Separated Strategy Core)
// =============================================================================

export interface EntityStorage {
  /** Flat category values (0-255) */
  categories: Uint8Array;

  /** Category-specific hierarchy data */
  hierarchyData: Uint32Array;

  /** Lifecycle flag: 0=dead, 1=alive */
  alive: Uint8Array;

  /** Generation counter for recycling validation */
  generations: Uint16Array;

  /** Available IDs for recycling */
  freeList: number[];

  /** Next ID to assign when freeList is empty */
  nextId: number;

  /** Maximum entities this storage can hold */
  capacity: number;
}

// =============================================================================
// Entity Handle (for external references)
// =============================================================================

/**
 * Entity Handle combines ID with generation for safe references.
 * When an entity is recycled, the generation increments,
 * invalidating old handles.
 */
export interface EntityHandle {
  readonly id: number;
  readonly generation: number;
}

// =============================================================================
// Entity Creation Options
// =============================================================================

export interface CreateEntityOptions {
  category: CategoryType;
  hierarchyData?: number;
}

// =============================================================================
// Entity Query Types
// =============================================================================

export interface EntityQueryResult {
  id: number;
  category: CategoryType;
  hierarchyData: number;
  generation: number;
}

// =============================================================================
// Type Guards
// =============================================================================

export type EntityId = number & { readonly __brand: 'EntityId' };

/**
 * Branded type for compile-time safety.
 * Usage: const id = 42 as EntityId;
 */
export function asEntityId(n: number): EntityId {
  return n as EntityId;
}
