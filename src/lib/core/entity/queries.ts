import type { EntityStorage, EntityQueryResult } from '$lib/types/entity';
import type { CategoryType } from '$lib/types/constants';
import { CATEGORY, CATEGORY_RANGE } from '$lib/types/constants';

// =============================================================================
// Category Query Functions
// =============================================================================

/**
 * Get all alive entity IDs matching a specific category.
 * @param storage - The EntityStorage instance
 * @param category - The category to filter by
 * @returns Array of entity IDs
 */
export function getEntitiesByCategory(
  storage: EntityStorage,
  category: CategoryType
): number[] {
  const results: number[] = [];
  const { alive, categories, nextId } = storage;

  for (let id = 0; id < nextId; id++) {
    if (alive[id] && categories[id] === category) {
      results.push(id);
    }
  }

  return results;
}

/**
 * Get all alive entity IDs within a category range (inclusive).
 * @param storage - The EntityStorage instance
 * @param minCategory - Minimum category value (inclusive)
 * @param maxCategory - Maximum category value (inclusive)
 * @returns Array of entity IDs
 */
export function getEntitiesInRange(
  storage: EntityStorage,
  minCategory: number,
  maxCategory: number
): number[] {
  const results: number[] = [];
  const { alive, categories, nextId } = storage;

  for (let id = 0; id < nextId; id++) {
    if (alive[id]) {
      const cat = categories[id];
      if (cat >= minCategory && cat <= maxCategory) {
        results.push(id);
      }
    }
  }

  return results;
}

// =============================================================================
// Convenience Query Functions
// =============================================================================

/**
 * Get all character entity IDs (PC, NPC, and hostiles).
 */
export function getAllCharacters(storage: EntityStorage): number[] {
  return getEntitiesInRange(
    storage,
    CATEGORY_RANGE.CHARACTER.min,
    CATEGORY_RANGE.CHARACTER.max
  );
}

/**
 * Get all hostile entity IDs.
 */
export function getAllHostiles(storage: EntityStorage): number[] {
  return getEntitiesInRange(
    storage,
    CATEGORY_RANGE.HOSTILE.min,
    CATEGORY_RANGE.HOSTILE.max
  );
}

/**
 * Get all location entity IDs.
 */
export function getAllLocations(storage: EntityStorage): number[] {
  return getEntitiesInRange(
    storage,
    CATEGORY_RANGE.LOCATION.min,
    CATEGORY_RANGE.LOCATION.max
  );
}

/**
 * Get all PC (player character) entity IDs.
 */
export function getAllPCs(storage: EntityStorage): number[] {
  return getEntitiesByCategory(storage, CATEGORY.PC);
}

/**
 * Get all NPC entity IDs.
 */
export function getAllNPCs(storage: EntityStorage): number[] {
  return getEntitiesByCategory(storage, CATEGORY.NPC);
}

// =============================================================================
// Entity Info Query
// =============================================================================

/**
 * Get detailed information about an entity.
 * @param storage - The EntityStorage instance
 * @param id - The entity ID to query
 * @returns EntityQueryResult or null if the entity is invalid or dead
 */
export function getEntityInfo(
  storage: EntityStorage,
  id: number
): EntityQueryResult | null {
  // Range check
  if (id < 0 || id >= storage.nextId) {
    return null;
  }

  // Alive check
  if (!storage.alive[id]) {
    return null;
  }

  return {
    id,
    category: storage.categories[id] as CategoryType,
    hierarchyData: storage.hierarchyData[id],
    generation: storage.generations[id],
  };
}

// =============================================================================
// Category Type Predicates
// =============================================================================

/**
 * Check if an entity is any type of character (PC, NPC, or hostile).
 */
export function isCharacter(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  const cat = storage.categories[id];
  return cat >= CATEGORY_RANGE.CHARACTER.min && cat <= CATEGORY_RANGE.CHARACTER.max;
}

/**
 * Check if an entity is a hostile.
 */
export function isHostile(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  const cat = storage.categories[id];
  return cat >= CATEGORY_RANGE.HOSTILE.min && cat <= CATEGORY_RANGE.HOSTILE.max;
}

/**
 * Check if an entity is a location.
 */
export function isLocation(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  const cat = storage.categories[id];
  return cat >= CATEGORY_RANGE.LOCATION.min && cat <= CATEGORY_RANGE.LOCATION.max;
}

/**
 * Check if an entity is a faction.
 */
export function isFaction(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  const cat = storage.categories[id];
  return cat >= CATEGORY_RANGE.FACTION.min && cat <= CATEGORY_RANGE.FACTION.max;
}

/**
 * Check if an entity is a PC (player character).
 */
export function isPC(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  return storage.categories[id] === CATEGORY.PC;
}

/**
 * Check if an entity is an NPC.
 */
export function isNPC(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId || !storage.alive[id]) {
    return false;
  }
  return storage.categories[id] === CATEGORY.NPC;
}
