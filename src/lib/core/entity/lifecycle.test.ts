import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage, clearStorage } from './storage';
import {
  createEntity,
  destroyEntity,
  isAlive,
  getActiveCount,
} from './lifecycle';
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';

describe('createEntity', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should create entity with sequential ID starting from 0', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(handle.id).toBe(0);
    expect(handle.generation).toBe(0);
  });

  it('should assign sequential IDs', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    const h2 = createEntity(storage, { category: CATEGORY.PC });
    const h3 = createEntity(storage, { category: CATEGORY.NPC });
    expect(h1.id).toBe(0);
    expect(h2.id).toBe(1);
    expect(h3.id).toBe(2);
    expect(storage.nextId).toBe(3);
  });

  it('should set category and hierarchyData correctly', () => {
    createEntity(storage, {
      category: CATEGORY.LOCATION_URBAN,
      hierarchyData: 0x00a00000,
    });
    expect(storage.categories[0]).toBe(CATEGORY.LOCATION_URBAN);
    expect(storage.hierarchyData[0]).toBe(0x00a00000);
  });

  it('should default hierarchyData to 0', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    expect(storage.hierarchyData[0]).toBe(0);
  });

  it('should mark entity as alive', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(storage.alive[handle.id]).toBe(1);
  });

  it('should recycle IDs from freeList', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);

    // New entity should reuse ID 0
    const h3 = createEntity(storage, { category: CATEGORY.PC });
    expect(h3.id).toBe(0);
  });

  it('should increment generation on recycle', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    expect(h1.generation).toBe(0);

    destroyEntity(storage, h1.id);

    const h2 = createEntity(storage, { category: CATEGORY.PC });
    expect(h2.id).toBe(0);
    expect(h2.generation).toBe(1);
  });

  it('should increment generation on each recycle', () => {
    // Create, destroy, recreate 3 times
    for (let cycle = 0; cycle < 3; cycle++) {
      const handle = createEntity(storage, { category: CATEGORY.NPC });
      expect(handle.id).toBe(0);
      expect(handle.generation).toBe(cycle);
      destroyEntity(storage, 0);
    }
  });

  it('should throw when storage is full', () => {
    const small = createEntityStorage(3);
    createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });

    expect(() => createEntity(small, { category: CATEGORY.NPC })).toThrow();
  });

  it('should not throw when recycling at full capacity', () => {
    const small = createEntityStorage(2);
    const h1 = createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });
    destroyEntity(small, h1.id);

    // Should not throw - freeList has ID available
    expect(() =>
      createEntity(small, { category: CATEGORY.NPC })
    ).not.toThrow();
  });
});

describe('destroyEntity', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should mark entity as dead', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.alive[handle.id]).toBe(0);
  });

  it('should reset category to NONE', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.categories[handle.id]).toBe(CATEGORY.NONE);
  });

  it('should add ID to freeList', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.freeList).toContain(handle.id);
  });

  it('should return true on success', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(destroyEntity(storage, handle.id)).toBe(true);
  });

  it('should return false for already dead entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(destroyEntity(storage, handle.id)).toBe(false);
  });

  it('should return false for out of range ID', () => {
    expect(destroyEntity(storage, -1)).toBe(false);
    expect(destroyEntity(storage, 9999)).toBe(false);
  });

  it('should return false for unallocated ID', () => {
    // nextId is 0, so ID 5 was never allocated
    expect(destroyEntity(storage, 5)).toBe(false);
  });
});

describe('isAlive', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return true for alive entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(isAlive(storage, handle.id)).toBe(true);
  });

  it('should return false for destroyed entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(isAlive(storage, handle.id)).toBe(false);
  });

  it('should return false for out of range ID', () => {
    expect(isAlive(storage, -1)).toBe(false);
    expect(isAlive(storage, 9999)).toBe(false);
  });
});

describe('getActiveCount', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return 0 for empty storage', () => {
    expect(getActiveCount(storage)).toBe(0);
  });

  it('should count alive entities', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.PC });
    expect(getActiveCount(storage)).toBe(3);
  });

  it('should exclude destroyed entities', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    expect(getActiveCount(storage)).toBe(1);
  });
});
