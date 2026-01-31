import type { EntityStorage, EntityHandle } from '$lib/types/entity';

// =============================================================================
// Handle Validation
// =============================================================================

/**
 * Validate if an EntityHandle is still valid.
 * Checks:
 * - ID is within allocated range
 * - Entity is alive
 * - Generation matches (not recycled)
 *
 * @param storage - The EntityStorage instance
 * @param handle - The EntityHandle to validate
 * @returns true if the handle is valid
 */
export function isValidHandle(
  storage: EntityStorage,
  handle: EntityHandle
): boolean {
  const { id, generation } = handle;

  // Range check
  if (id < 0 || id >= storage.nextId) {
    return false;
  }

  // Alive check
  if (!storage.alive[id]) {
    return false;
  }

  // Generation check
  if (storage.generations[id] !== generation) {
    return false;
  }

  return true;
}

// =============================================================================
// Handle Resolution
// =============================================================================

/**
 * Safely resolve an EntityHandle to its ID.
 * Returns null if the handle is no longer valid.
 *
 * @param storage - The EntityStorage instance
 * @param handle - The EntityHandle to resolve
 * @returns The entity ID or null if invalid
 */
export function resolveHandle(
  storage: EntityStorage,
  handle: EntityHandle
): number | null {
  if (!isValidHandle(storage, handle)) {
    return null;
  }
  return handle.id;
}

// =============================================================================
// Handle Creation
// =============================================================================

/**
 * Create an EntityHandle from an entity ID.
 * Returns null if the ID is invalid or the entity is dead.
 *
 * @param storage - The EntityStorage instance
 * @param id - The entity ID
 * @returns EntityHandle or null if invalid/dead
 */
export function getHandle(
  storage: EntityStorage,
  id: number
): EntityHandle | null {
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
    generation: storage.generations[id],
  };
}
