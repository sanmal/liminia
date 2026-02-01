import type { TagStorage } from '$lib/types/tags';
import type { EntityId } from '$lib/types/brand';

/** Options for bulk tag setting */
export interface TagOptions {
  direction?: number;
  axis?: number;
  axis2?: number;
  motivation?: number;
  worldMark?: number;
  worldMark2?: number;
  situation?: number;
}

/**
 * Set multiple tags for an entity at once.
 * Only specified fields are updated; unspecified fields remain unchanged.
 */
export function setEntityTags(
  s: TagStorage,
  id: EntityId,
  tags: TagOptions
): void {
  if (tags.direction !== undefined) s.direction[id] = tags.direction;
  if (tags.axis !== undefined) s.axis[id] = tags.axis;
  if (tags.axis2 !== undefined) s.axis2[id] = tags.axis2;
  if (tags.motivation !== undefined) s.motivation[id] = tags.motivation;
  if (tags.worldMark !== undefined) s.worldMark[id] = tags.worldMark;
  if (tags.worldMark2 !== undefined) s.worldMark2[id] = tags.worldMark2;
  if (tags.situation !== undefined) s.situation[id] = tags.situation;
}

/**
 * Reset all tags for an entity to NONE (0).
 */
export function clearEntityTags(s: TagStorage, id: EntityId): void {
  s.direction[id] = 0;
  s.axis[id] = 0;
  s.axis2[id] = 0;
  s.motivation[id] = 0;
  s.worldMark[id] = 0;
  s.worldMark2[id] = 0;
  s.situation[id] = 0;
}

/**
 * Copy all tags from one entity to another.
 * Use case: NPC revival inheritance, template initialization.
 */
export function copyEntityTags(
  s: TagStorage,
  fromId: EntityId,
  toId: EntityId
): void {
  s.direction[toId] = s.direction[fromId]!;
  s.axis[toId] = s.axis[fromId]!;
  s.axis2[toId] = s.axis2[fromId]!;
  s.motivation[toId] = s.motivation[fromId]!;
  s.worldMark[toId] = s.worldMark[fromId]!;
  s.worldMark2[toId] = s.worldMark2[fromId]!;
  s.situation[toId] = s.situation[fromId]!;
}
