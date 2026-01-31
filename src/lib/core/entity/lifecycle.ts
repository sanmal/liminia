import type { EntityStorage, EntityHandle, CreateEntityOptions } from '$lib/types';
import { CATEGORY } from '$lib/types';

/**
 * Create a new entity in storage.
 * @param storage - The EntityStorage instance
 * @param options - Category and optional hierarchy data
 * @returns EntityHandle with id and generation
 * @throws Error when storage capacity is exceeded
 */
export function createEntity(
  storage: EntityStorage,
  options: CreateEntityOptions
): EntityHandle {
  let id: number;
  let isRecycled = false;

  // Try to reuse an ID from freeList first
  if (storage.freeList.length > 0) {
    id = storage.freeList.pop()!;
    isRecycled = true;
  } else {
    // Check capacity before using new ID
    if (storage.nextId >= storage.capacity) {
      throw new Error(
        `EntityStorage capacity exceeded: ${storage.capacity}`
      );
    }
    id = storage.nextId;
    storage.nextId++;
  }

  // Set entity attributes
  storage.categories[id] = options.category;
  storage.hierarchyData[id] = options.hierarchyData ?? 0;
  storage.alive[id] = 1;

  // Increment generation only on recycle
  if (isRecycled) {
    storage.generations[id]++;
  }

  return {
    id,
    generation: storage.generations[id],
  };
}

/**
 * Destroy an entity and make its ID available for recycling.
 * @param storage - The EntityStorage instance
 * @param id - The entity ID to destroy
 * @returns true if destroyed, false if already dead or invalid
 */
export function destroyEntity(storage: EntityStorage, id: number): boolean {
  // Bounds check
  if (id < 0 || id >= storage.nextId) {
    return false;
  }

  // Already dead
  if (!storage.alive[id]) {
    return false;
  }

  // Mark as dead
  storage.alive[id] = 0;
  storage.categories[id] = CATEGORY.NONE;

  // Add to free list for recycling
  storage.freeList.push(id);

  return true;
}

/**
 * Check if an entity is alive.
 * @param storage - The EntityStorage instance
 * @param id - The entity ID to check
 * @returns true if alive, false otherwise
 */
export function isAlive(storage: EntityStorage, id: number): boolean {
  if (id < 0 || id >= storage.nextId) {
    return false;
  }
  return storage.alive[id] === 1;
}

/**
 * Get the count of currently active (alive) entities.
 * @param storage - The EntityStorage instance
 * @returns Number of alive entities
 */
export function getActiveCount(storage: EntityStorage): number {
  let count = 0;
  for (let i = 0; i < storage.nextId; i++) {
    if (storage.alive[i]) {
      count++;
    }
  }
  return count;
}
