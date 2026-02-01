import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage } from './storage';
import { createEntity, destroyEntity } from './lifecycle';
import { isValidHandle, resolveHandle, getHandle } from './validation';
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';
import type { EntityId } from '$lib/types/brand';
import { entityId } from '$lib/types/brand';

describe('isValidHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return true for valid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(isValidHandle(storage, handle)).toBe(true);
  });

  it('should return false for dead entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(isValidHandle(storage, handle)).toBe(false);
  });

  it('should return false after recycling (wrong generation)', () => {
    const oldHandle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, oldHandle.id);
    createEntity(storage, { category: CATEGORY.PC }); // Recycles ID 0

    // Old handle has generation 0, new entity has generation 1
    expect(isValidHandle(storage, oldHandle)).toBe(false);
  });

  it('should return true for recycled entity with correct generation', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    const h2 = createEntity(storage, { category: CATEGORY.PC });

    expect(isValidHandle(storage, h2)).toBe(true);
  });

  it('should return false for out of range ID', () => {
    expect(isValidHandle(storage, { id: -1 as EntityId, generation: 0 })).toBe(false);
    expect(isValidHandle(storage, { id: 9999 as EntityId, generation: 0 })).toBe(false);
  });

  it('should return false for forged handle with wrong generation', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    // Forge a handle with wrong generation
    expect(isValidHandle(storage, { id: entityId(0), generation: 999 })).toBe(false);
  });
});

describe('resolveHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return ID for valid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(resolveHandle(storage, handle)).toBe(handle.id);
  });

  it('should return null for invalid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(resolveHandle(storage, handle)).toBeNull();
  });

  it('should return null for stale handle after recycle', () => {
    const oldHandle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, oldHandle.id);
    createEntity(storage, { category: CATEGORY.PC });

    expect(resolveHandle(storage, oldHandle)).toBeNull();
  });
});

describe('getHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return handle for alive entity', () => {
    const created = createEntity(storage, { category: CATEGORY.NPC });
    const handle = getHandle(storage, created.id);

    expect(handle).not.toBeNull();
    expect(handle!.id).toBe(created.id);
    expect(handle!.generation).toBe(created.generation);
  });

  it('should return null for dead entity', () => {
    const h = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h.id);
    expect(getHandle(storage, h.id)).toBeNull();
  });

  it('should return null for out of range ID', () => {
    expect(getHandle(storage, -1)).toBeNull();
    expect(getHandle(storage, 9999)).toBeNull();
  });

  it('should return correct generation for recycled entity', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    const h2 = createEntity(storage, { category: CATEGORY.PC });

    const handle = getHandle(storage, h2.id);
    expect(handle).not.toBeNull();
    expect(handle!.generation).toBe(1); // Recycled once
  });
});
