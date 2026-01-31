import type { EntityStorage } from '$lib/types';
import { MAX_ENTITIES } from '$lib/types';

/**
 * Create a new EntityStorage instance.
 * @param capacity - Maximum number of entities (default: MAX_ENTITIES = 2000)
 */
export function createEntityStorage(capacity: number = MAX_ENTITIES): EntityStorage {
  return {
    categories: new Uint8Array(capacity),
    hierarchyData: new Uint32Array(capacity),
    alive: new Uint8Array(capacity),
    generations: new Uint16Array(capacity),
    freeList: [],
    nextId: 0,
    capacity,
  };
}

/**
 * Clear all entities from storage.
 * Resets all TypedArrays and internal state.
 * Useful for tests or game reset.
 */
export function clearStorage(storage: EntityStorage): void {
  storage.categories.fill(0);
  storage.hierarchyData.fill(0);
  storage.alive.fill(0);
  storage.generations.fill(0);
  storage.freeList.length = 0;
  storage.nextId = 0;
}

/**
 * Global EntityStorage instance.
 * Shared across the application.
 */
export const globalStorage: EntityStorage = createEntityStorage();
