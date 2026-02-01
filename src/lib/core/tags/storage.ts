import type { TagStorage } from '$lib/types/tags';
import { MAX_ENTITIES } from '$lib/types/constants';

/**
 * Create a new TagStorage instance.
 * @param capacity - Maximum number of entities (default: MAX_ENTITIES)
 */
export function createTagStorage(capacity: number = MAX_ENTITIES): TagStorage {
  return {
    direction: new Uint8Array(capacity),
    axis: new Uint8Array(capacity),
    axis2: new Uint8Array(capacity),
    motivation: new Uint8Array(capacity),
    worldMark: new Uint8Array(capacity),
    worldMark2: new Uint8Array(capacity),
    situation: new Uint8Array(capacity),
    capacity,
  };
}

/**
 * Clear all tags in the storage (reset all to NONE=0).
 */
export function clearTagStorage(storage: TagStorage): void {
  storage.direction.fill(0);
  storage.axis.fill(0);
  storage.axis2.fill(0);
  storage.motivation.fill(0);
  storage.worldMark.fill(0);
  storage.worldMark2.fill(0);
  storage.situation.fill(0);
}

/** Global TagStorage instance */
export const globalTagStorage: TagStorage = createTagStorage();
