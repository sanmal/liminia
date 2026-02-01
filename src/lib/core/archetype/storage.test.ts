import { describe, it, expect } from 'vitest';
import {
  createArchetypeStorage,
  clearArchetypeStorage,
  registerArchetype,
  getArchetypeInfo,
  getArchetypeByName,
  getArchetypeCount,
} from './storage';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import { archetypeId } from '$lib/types/brand';
import type { ArchetypeDefinition } from '$lib/types/archetype';

const SAMPLE_DEF: ArchetypeDefinition = {
  name: 'TestGuardian',
  direction: DIRECTION_TAG.ACTIVE,
  primaryAxis: AXIS_TAG.ORDER,
  secondaryAxis: AXIS_TAG.OTHERS,
  motivation: MOTIVATION_TAG.PROTECTION,
  worldMark: WORLD_MARK.BONE,
};

describe('createArchetypeStorage', () => {
  it('should create storage with default capacity (64)', () => {
    const s = createArchetypeStorage();
    expect(s.directions.length).toBe(64);
    expect(s.capacity).toBe(64);
    expect(s.nextId).toBe(0);
  });

  it('should create storage with custom capacity', () => {
    const s = createArchetypeStorage(16);
    expect(s.capacity).toBe(16);
  });

  it('should initialize all arrays to zero', () => {
    const s = createArchetypeStorage(8);
    for (let i = 0; i < 8; i++) {
      expect(s.directions[i]).toBe(0);
      expect(s.primaryAxis[i]).toBe(0);
      expect(s.motivations[i]).toBe(0);
    }
  });
});

describe('registerArchetype', () => {
  it('should register and return sequential ArchetypeId', () => {
    const s = createArchetypeStorage(8);
    const id0 = registerArchetype(s, SAMPLE_DEF);
    const id1 = registerArchetype(s, { ...SAMPLE_DEF, name: 'TestCommander' });
    expect(Number(id0)).toBe(0);
    expect(Number(id1)).toBe(1);
    expect(s.nextId).toBe(2);
  });

  it('should store definition attributes correctly', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    expect(s.names[0]).toBe('TestGuardian');
    expect(s.directions[0]).toBe(DIRECTION_TAG.ACTIVE);
    expect(s.primaryAxis[0]).toBe(AXIS_TAG.ORDER);
    expect(s.secondaryAxis[0]).toBe(AXIS_TAG.OTHERS);
    expect(s.motivations[0]).toBe(MOTIVATION_TAG.PROTECTION);
    expect(s.worldMarks[0]).toBe(WORLD_MARK.BONE);
  });

  it('should throw when storage is full', () => {
    const s = createArchetypeStorage(2);
    registerArchetype(s, SAMPLE_DEF);
    registerArchetype(s, { ...SAMPLE_DEF, name: 'Second' });
    expect(() =>
      registerArchetype(s, { ...SAMPLE_DEF, name: 'Third' })
    ).toThrow('Archetype storage full');
  });
});

describe('clearArchetypeStorage', () => {
  it('should reset all data', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    clearArchetypeStorage(s);
    expect(s.nextId).toBe(0);
    expect(s.names).toHaveLength(0);
    expect(s.directions[0]).toBe(0);
  });
});

describe('getArchetypeInfo', () => {
  it('should return info for registered archetype', () => {
    const s = createArchetypeStorage(8);
    const id = registerArchetype(s, SAMPLE_DEF);
    const info = getArchetypeInfo(s, id);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('TestGuardian');
    expect(info!.direction).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should return null for unregistered id', () => {
    const s = createArchetypeStorage(8);
    expect(getArchetypeInfo(s, archetypeId(5))).toBeNull();
  });
});

describe('getArchetypeByName', () => {
  it('should find archetype by name', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    const id = getArchetypeByName(s, 'TestGuardian');
    expect(id).not.toBeNull();
    expect(Number(id)).toBe(0);
  });

  it('should return null for unknown name', () => {
    const s = createArchetypeStorage(8);
    expect(getArchetypeByName(s, 'NonExistent')).toBeNull();
  });
});

describe('getArchetypeCount', () => {
  it('should return count of registered archetypes', () => {
    const s = createArchetypeStorage(8);
    expect(getArchetypeCount(s)).toBe(0);
    registerArchetype(s, SAMPLE_DEF);
    expect(getArchetypeCount(s)).toBe(1);
  });
});
