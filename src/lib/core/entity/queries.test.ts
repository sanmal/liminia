import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage } from './storage';
import { createEntity, destroyEntity } from './lifecycle';
import {
  getEntitiesByCategory,
  getEntitiesInRange,
  getAllCharacters,
  getAllHostiles,
  getAllLocations,
  getAllPCs,
  getAllNPCs,
  getEntityInfo,
  isCharacter,
  isHostile,
  isLocation,
  isFaction,
  isPC,
  isNPC,
} from './queries';
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';

describe('getEntitiesByCategory', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
  });

  it('should return matching alive entities', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.PC });
    createEntity(storage, { category: CATEGORY.NPC });

    const npcs = getEntitiesByCategory(storage, CATEGORY.NPC);
    expect(npcs).toEqual([0, 2]);
  });

  it('should return empty array when no matches', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    const pcs = getEntitiesByCategory(storage, CATEGORY.PC);
    expect(pcs).toEqual([]);
  });

  it('should exclude destroyed entities', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);

    const npcs = getEntitiesByCategory(storage, CATEGORY.NPC);
    expect(npcs).toEqual([1]);
  });

  it('should return empty array for empty storage', () => {
    expect(getEntitiesByCategory(storage, CATEGORY.NPC)).toEqual([]);
  });
});

describe('getEntitiesInRange', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
  });

  it('should return entities within category range', () => {
    createEntity(storage, { category: CATEGORY.PC }); // 1
    createEntity(storage, { category: CATEGORY.NPC }); // 2
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST }); // 3
    createEntity(storage, { category: CATEGORY.LOCATION_CITY }); // 10

    // Characters range: 1-9
    const chars = getEntitiesInRange(storage, 1, 9);
    expect(chars).toEqual([0, 1, 2]);
  });
});

describe('convenience query functions', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
    createEntity(storage, { category: CATEGORY.PC }); // id: 0
    createEntity(storage, { category: CATEGORY.NPC }); // id: 1
    createEntity(storage, { category: CATEGORY.NPC }); // id: 2
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST }); // id: 3
    createEntity(storage, { category: CATEGORY.HOSTILE_CHAOS }); // id: 4
    createEntity(storage, { category: CATEGORY.LOCATION_CITY }); // id: 5
    createEntity(storage, { category: CATEGORY.LOCATION_URBAN }); // id: 6
    createEntity(storage, { category: CATEGORY.FACTION_GUILD }); // id: 7
  });

  it('getAllCharacters should return PCs, NPCs, and hostiles', () => {
    expect(getAllCharacters(storage)).toEqual([0, 1, 2, 3, 4]);
  });

  it('getAllHostiles should return only hostile entities', () => {
    expect(getAllHostiles(storage)).toEqual([3, 4]);
  });

  it('getAllLocations should return only locations', () => {
    expect(getAllLocations(storage)).toEqual([5, 6]);
  });

  it('getAllPCs should return only PCs', () => {
    expect(getAllPCs(storage)).toEqual([0]);
  });

  it('getAllNPCs should return only NPCs', () => {
    expect(getAllNPCs(storage)).toEqual([1, 2]);
  });
});

describe('getEntityInfo', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return entity info for alive entity', () => {
    createEntity(storage, {
      category: CATEGORY.LOCATION_BUILDING,
      hierarchyData: 0x00500000,
    });

    const info = getEntityInfo(storage, 0);
    expect(info).not.toBeNull();
    expect(info!.category).toBe(CATEGORY.LOCATION_BUILDING);
    expect(info!.hierarchyData).toBe(0x00500000);
    expect(info!.generation).toBe(0);
  });

  it('should return null for dead entity', () => {
    const h = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h.id);
    expect(getEntityInfo(storage, h.id)).toBeNull();
  });

  it('should return null for out of range ID', () => {
    expect(getEntityInfo(storage, -1)).toBeNull();
    expect(getEntityInfo(storage, 999)).toBeNull();
  });
});

describe('category predicates', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
    createEntity(storage, { category: CATEGORY.PC }); // 0
    createEntity(storage, { category: CATEGORY.NPC }); // 1
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST }); // 2
    createEntity(storage, { category: CATEGORY.LOCATION_CITY }); // 3
    createEntity(storage, { category: CATEGORY.FACTION_GUILD }); // 4
  });

  it('isPC should identify only PCs', () => {
    expect(isPC(storage, 0)).toBe(true);
    expect(isPC(storage, 1)).toBe(false);
  });

  it('isNPC should identify only NPCs', () => {
    expect(isNPC(storage, 1)).toBe(true);
    expect(isNPC(storage, 0)).toBe(false);
  });

  it('isCharacter should include PC, NPC, and hostiles', () => {
    expect(isCharacter(storage, 0)).toBe(true); // PC
    expect(isCharacter(storage, 1)).toBe(true); // NPC
    expect(isCharacter(storage, 2)).toBe(true); // HOSTILE
    expect(isCharacter(storage, 3)).toBe(false); // LOCATION
  });

  it('isHostile should identify only hostiles', () => {
    expect(isHostile(storage, 2)).toBe(true);
    expect(isHostile(storage, 0)).toBe(false);
    expect(isHostile(storage, 1)).toBe(false);
  });

  it('isLocation should identify only locations', () => {
    expect(isLocation(storage, 3)).toBe(true);
    expect(isLocation(storage, 0)).toBe(false);
  });

  it('isFaction should identify only factions', () => {
    expect(isFaction(storage, 4)).toBe(true);
    expect(isFaction(storage, 0)).toBe(false);
  });

  it('predicates should return false for dead entities', () => {
    destroyEntity(storage, 0);
    expect(isPC(storage, 0)).toBe(false);
    expect(isCharacter(storage, 0)).toBe(false);
  });

  it('predicates should return false for out of range IDs', () => {
    expect(isPC(storage, -1)).toBe(false);
    expect(isNPC(storage, 9999)).toBe(false);
  });
});
