import { describe, it, expect } from 'vitest';
import {
  createCharacterStateStorage,
  clearCharacterStateStorage,
  getHp,
  setHp,
  getMaxHp,
  setMaxHp,
  getDejavuBonds,
  setDejavuBonds,
  getDejavuBondsTotal,
  setDejavuBondsTotal,
  addDejavuBondsTotal,
  getLocationId,
  setLocationId,
  getRestState,
  setRestState,
  getArchetypeId,
  setArchetypeId,
} from './storage';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);
const id1 = entityId(1);

describe('createCharacterStateStorage', () => {
  it('should create storage with default capacity', () => {
    const s = createCharacterStateStorage();
    expect(s.hp.length).toBe(2000); // MAX_ENTITIES
    expect(s.capacity).toBe(2000);
  });

  it('should create storage with custom capacity', () => {
    const s = createCharacterStateStorage(128);
    expect(s.hp.length).toBe(128);
    expect(s.capacity).toBe(128);
  });

  it('should initialize all arrays to zero', () => {
    const s = createCharacterStateStorage(8);
    expect(s.hp[0]).toBe(0);
    expect(s.maxHp[0]).toBe(0);
    expect(s.dejavuBonds[0]).toBe(0);
    expect(s.dejavuBondsTotal[0]).toBe(0);
    expect(s.locationIds[0]).toBe(0);
    expect(s.restStates[0]).toBe(0);
    expect(s.archetypeIds[0]).toBe(0);
  });
});

describe('clearCharacterStateStorage', () => {
  it('should reset all fields to zero', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    setDejavuBonds(s, id0, 80);
    clearCharacterStateStorage(s);
    expect(getHp(s, id0)).toBe(0);
    expect(getMaxHp(s, id0)).toBe(0);
    expect(getDejavuBonds(s, id0)).toBe(0);
  });
});

describe('HP accessors', () => {
  it('should get and set HP correctly', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 150);
    expect(getHp(s, id0)).toBe(150);
    expect(getHp(s, id1)).toBe(0); // Other entity unaffected
  });

  it('should get and set maxHp correctly', () => {
    const s = createCharacterStateStorage(8);
    setMaxHp(s, id0, 200);
    expect(getMaxHp(s, id0)).toBe(200);
  });
});

describe('DejavuBonds accessors', () => {
  it('should clamp dejavuBonds to 0-100', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 150); // Over max
    expect(getDejavuBonds(s, id0)).toBe(100);

    setDejavuBonds(s, id0, -10); // Under min
    expect(getDejavuBonds(s, id0)).toBe(0);
  });

  it('should accumulate dejavuBondsTotal', () => {
    const s = createCharacterStateStorage(8);
    addDejavuBondsTotal(s, id0, 500);
    addDejavuBondsTotal(s, id0, 1000);
    expect(getDejavuBondsTotal(s, id0)).toBe(1500);
  });

  it('should not decrease dejavuBondsTotal with negative amount', () => {
    const s = createCharacterStateStorage(8);
    addDejavuBondsTotal(s, id0, 500);
    addDejavuBondsTotal(s, id0, -100);
    expect(getDejavuBondsTotal(s, id0)).toBe(500); // Does not decrease
  });
});

describe('Location and RestState accessors', () => {
  it('should get and set locationId', () => {
    const s = createCharacterStateStorage(8);
    setLocationId(s, id0, 42);
    expect(getLocationId(s, id0)).toBe(42);
  });

  it('should get and set restState', () => {
    const s = createCharacterStateStorage(8);
    setRestState(s, id0, 3); // FULL_REST
    expect(getRestState(s, id0)).toBe(3);
  });
});

describe('Archetype accessors', () => {
  it('should get and set archetypeId', () => {
    const s = createCharacterStateStorage(8);
    setArchetypeId(s, id0, 5);
    expect(getArchetypeId(s, id0)).toBe(5);
    expect(getArchetypeId(s, id1)).toBe(0); // Other entity unaffected
  });

  it('should default to 0 when unset', () => {
    const s = createCharacterStateStorage(8);
    expect(getArchetypeId(s, id0)).toBe(0);
  });

  it('should clamp archetypeId to 0-63 range', () => {
    const s = createCharacterStateStorage(8);
    setArchetypeId(s, id0, 100); // Over max
    expect(getArchetypeId(s, id0)).toBe(63);

    setArchetypeId(s, id1, -5); // Under min
    expect(getArchetypeId(s, id1)).toBe(0);
  });

  it('should reset archetypeId to 0 on clearCharacterStateStorage', () => {
    const s = createCharacterStateStorage(8);
    setArchetypeId(s, id0, 10);
    clearCharacterStateStorage(s);
    expect(getArchetypeId(s, id0)).toBe(0);
  });
});
