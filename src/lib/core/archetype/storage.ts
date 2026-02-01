import type {
  ArchetypeStorage,
  ArchetypeDefinition,
  ArchetypeInfo,
} from '$lib/types/archetype';
import type { ArchetypeId } from '$lib/types/brand';
import type { DirectionTagType, AxisTagType } from '$lib/types/tags';
import type { WorldMarkType } from '$lib/types/marks';
import { archetypeId } from '$lib/types/brand';
import { MAX_ARCHETYPES } from '$lib/types/constants';

/**
 * Create a new ArchetypeStorage.
 * @param capacity - Maximum number of archetypes (default: MAX_ARCHETYPES = 64)
 */
export function createArchetypeStorage(
  capacity: number = MAX_ARCHETYPES
): ArchetypeStorage {
  return {
    names: [],
    directions: new Uint8Array(capacity),
    primaryAxis: new Uint8Array(capacity),
    secondaryAxis: new Uint8Array(capacity),
    motivations: new Uint8Array(capacity),
    worldMarks: new Uint8Array(capacity),
    nextId: 0,
    capacity,
  };
}

/**
 * Clear all archetype data from storage.
 */
export function clearArchetypeStorage(storage: ArchetypeStorage): void {
  storage.names.length = 0;
  storage.directions.fill(0);
  storage.primaryAxis.fill(0);
  storage.secondaryAxis.fill(0);
  storage.motivations.fill(0);
  storage.worldMarks.fill(0);
  storage.nextId = 0;
}

/**
 * Register an archetype and return its ArchetypeId.
 * @throws Error - When storage is full
 */
export function registerArchetype(
  storage: ArchetypeStorage,
  def: ArchetypeDefinition
): ArchetypeId {
  if (storage.nextId >= storage.capacity) {
    throw new Error('Archetype storage full');
  }

  const id = storage.nextId;
  storage.names[id] = def.name;
  storage.directions[id] = def.direction;
  storage.primaryAxis[id] = def.primaryAxis;
  storage.secondaryAxis[id] = def.secondaryAxis;
  storage.motivations[id] = def.motivation;
  storage.worldMarks[id] = def.worldMark;
  storage.nextId++;

  return archetypeId(id);
}

/**
 * Get archetype information by ID.
 * @returns ArchetypeInfo or null if ID is out of range or unregistered
 */
export function getArchetypeInfo(
  storage: ArchetypeStorage,
  id: ArchetypeId
): ArchetypeInfo | null {
  if (id < 0 || id >= storage.nextId) {
    return null;
  }

  return {
    id,
    name: storage.names[id] ?? '',
    direction: storage.directions[id]! as DirectionTagType,
    primaryAxis: storage.primaryAxis[id]! as AxisTagType,
    secondaryAxis: storage.secondaryAxis[id]! as AxisTagType,
    motivation: storage.motivations[id]!,
    worldMark: storage.worldMarks[id]! as WorldMarkType,
  };
}

/**
 * Find archetype by name.
 * @returns ArchetypeId or null if not found
 */
export function getArchetypeByName(
  storage: ArchetypeStorage,
  name: string
): ArchetypeId | null {
  const index = storage.names.indexOf(name);
  if (index === -1 || index >= storage.nextId) {
    return null;
  }
  return archetypeId(index);
}

/**
 * Get the count of registered archetypes.
 */
export function getArchetypeCount(storage: ArchetypeStorage): number {
  return storage.nextId;
}

/** Global ArchetypeStorage instance */
export const globalArchetypeStorage: ArchetypeStorage = createArchetypeStorage();
