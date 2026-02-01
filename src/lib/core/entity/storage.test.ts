import { describe, it, expect } from 'vitest';
import { createEntityStorage, clearStorage } from './storage';
import { MAX_ENTITIES } from '$lib/types';

describe('createEntityStorage', () => {
  it('should create storage with default capacity', () => {
    const storage = createEntityStorage();
    expect(storage.capacity).toBe(MAX_ENTITIES);
    expect(storage.nextId).toBe(0);
    expect(storage.freeList).toEqual([]);
  });

  it('should create storage with custom capacity', () => {
    const storage = createEntityStorage(100);
    expect(storage.capacity).toBe(100);
    expect(storage.categories.length).toBe(100);
    expect(storage.hierarchyData.length).toBe(100);
    expect(storage.alive.length).toBe(100);
    expect(storage.generations.length).toBe(100);
  });

  it('should initialize all TypedArrays with zeros', () => {
    const storage = createEntityStorage(10);
    for (let i = 0; i < 10; i++) {
      expect(storage.categories[i]).toBe(0);
      expect(storage.hierarchyData[i]).toBe(0);
      expect(storage.alive[i]).toBe(0);
      expect(storage.generations[i]).toBe(0);
    }
  });
});

describe('clearStorage', () => {
  it('should reset all state to initial values', () => {
    const storage = createEntityStorage(10);
    // Manually dirty the storage
    storage.categories[0] = 1;
    storage.alive[0] = 1;
    storage.nextId = 5;
    storage.freeList.push(3);

    clearStorage(storage);

    expect(storage.nextId).toBe(0);
    expect(storage.freeList).toEqual([]);
    expect(storage.categories[0]).toBe(0);
    expect(storage.alive[0]).toBe(0);
  });

  it('should preserve capacity after clear', () => {
    const storage = createEntityStorage(50);
    clearStorage(storage);
    expect(storage.capacity).toBe(50);
    expect(storage.categories.length).toBe(50);
  });
});
