import { describe, it, expect } from 'vitest';
import { createTagStorage, clearTagStorage } from './storage';
import { MAX_ENTITIES } from '$lib/types';

describe('createTagStorage', () => {
  it('should create storage with default capacity', () => {
    const s = createTagStorage();
    expect(s.direction.length).toBe(MAX_ENTITIES);
    expect(s.capacity).toBe(MAX_ENTITIES);
  });

  it('should create storage with custom capacity', () => {
    const s = createTagStorage(100);
    expect(s.direction.length).toBe(100);
    expect(s.axis.length).toBe(100);
    expect(s.axis2.length).toBe(100);
    expect(s.motivation.length).toBe(100);
    expect(s.worldMark.length).toBe(100);
    expect(s.worldMark2.length).toBe(100);
    expect(s.situation.length).toBe(100);
    expect(s.capacity).toBe(100);
  });

  it('should initialize all arrays to zero', () => {
    const s = createTagStorage(10);
    for (let i = 0; i < 10; i++) {
      expect(s.direction[i]).toBe(0);
      expect(s.axis[i]).toBe(0);
      expect(s.axis2[i]).toBe(0);
      expect(s.motivation[i]).toBe(0);
      expect(s.worldMark[i]).toBe(0);
      expect(s.worldMark2[i]).toBe(0);
      expect(s.situation[i]).toBe(0);
    }
  });
});

describe('clearTagStorage', () => {
  it('should reset all arrays to zero', () => {
    const s = createTagStorage(10);
    // Set some values
    s.direction[0] = 1;
    s.axis[1] = 3;
    s.worldMark[2] = 5;

    clearTagStorage(s);

    expect(s.direction[0]).toBe(0);
    expect(s.axis[1]).toBe(0);
    expect(s.worldMark[2]).toBe(0);
  });

  it('should not change capacity', () => {
    const s = createTagStorage(50);
    clearTagStorage(s);
    expect(s.capacity).toBe(50);
  });
});
