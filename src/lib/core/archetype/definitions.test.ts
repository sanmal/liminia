import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_DEFINITIONS,
  initializeDefaultArchetypes,
} from './definitions';
import {
  createArchetypeStorage,
  getArchetypeInfo,
  getArchetypeCount,
} from './storage';
import { ARCHETYPE } from '$lib/types/archetype';
import { archetypeId } from '$lib/types/brand';
import { DIRECTION_TAG, AXIS_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';

describe('ARCHETYPE_DEFINITIONS', () => {
  it('should contain exactly 32 definitions', () => {
    expect(ARCHETYPE_DEFINITIONS).toHaveLength(32);
  });

  it('should have unique names', () => {
    const names = ARCHETYPE_DEFINITIONS.map((d) => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(32);
  });

  it('should have valid Direction values for all definitions', () => {
    const validDirections = [
      DIRECTION_TAG.ACTIVE,
      DIRECTION_TAG.PASSIVE,
      DIRECTION_TAG.SOCIAL,
    ];
    for (const def of ARCHETYPE_DEFINITIONS) {
      expect(validDirections).toContain(def.direction);
    }
  });

  it('should have non-NONE primaryAxis for all definitions', () => {
    for (const def of ARCHETYPE_DEFINITIONS) {
      expect(def.primaryAxis).not.toBe(AXIS_TAG.NONE);
    }
  });

  it('should align index 0 with ARCHETYPE.GUARDIAN', () => {
    expect(ARCHETYPE_DEFINITIONS[ARCHETYPE.GUARDIAN]!.name).toBe('Guardian');
  });

  it('should align index 31 with ARCHETYPE.OUTCAST', () => {
    expect(ARCHETYPE_DEFINITIONS[ARCHETYPE.OUTCAST]!.name).toBe('Outcast');
  });
});

describe('initializeDefaultArchetypes', () => {
  it('should register all 32 archetypes', () => {
    const s = createArchetypeStorage();
    const count = initializeDefaultArchetypes(s);
    expect(count).toBe(32);
    expect(getArchetypeCount(s)).toBe(32);
  });

  it('should produce retrievable archetype info', () => {
    const s = createArchetypeStorage();
    initializeDefaultArchetypes(s);
    const guardian = getArchetypeInfo(s, archetypeId(ARCHETYPE.GUARDIAN));
    expect(guardian).not.toBeNull();
    expect(guardian!.name).toBe('Guardian');
    expect(guardian!.direction).toBe(DIRECTION_TAG.ACTIVE);
    expect(guardian!.worldMark).toBe(WORLD_MARK.BONE);
  });
});
