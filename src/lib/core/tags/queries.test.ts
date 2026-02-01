import { describe, it, expect, beforeEach } from 'vitest';
import { createTagStorage } from './storage';
import { createEntityStorage } from '../entity/storage';
import { createEntity, destroyEntity } from '../entity/lifecycle';
import {
  setDirection,
  setAxis,
  setAxis2,
  setMotivation,
  setWorldMark,
  setWorldMark2,
  setSituation,
} from './accessors';
import {
  getEntitiesByDirection,
  getEntitiesByWorldMark,
  getEntitiesByMotivation,
  getEntitiesByAxis,
  getEntitiesBySituation,
  calculateTagMatchScore,
} from './queries';
import { entityId } from '$lib/types/brand';
import { CATEGORY } from '$lib/types/constants';
import {
  DIRECTION_TAG,
  AXIS_TAG,
  MOTIVATION_TAG,
  SITUATION_TAG,
} from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import type { TagStorage } from '$lib/types/tags';
import type { EntityStorage } from '$lib/types/entity';

describe('getEntitiesByDirection', () => {
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should return entities with matching direction', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    const h3 = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h1.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h2.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h3.id, DIRECTION_TAG.PASSIVE);

    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.ACTIVE);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(h1.id);
    expect(result).toContainEqual(h2.id);
  });

  it('should exclude dead entities', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h1.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h2.id, DIRECTION_TAG.ACTIVE);
    destroyEntity(entities, h1.id);

    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.ACTIVE);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(h2.id);
  });

  it('should return empty array when no match', () => {
    createEntity(entities, { category: CATEGORY.NPC });
    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.SOCIAL);
    expect(result).toHaveLength(0);
  });
});

describe('getEntitiesByWorldMark', () => {
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should match primary worldMark', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BONE);
    expect(result).toHaveLength(1);
  });

  it('should match secondary worldMark', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    setWorldMark2(tags, h1.id, WORLD_MARK.BLOOD);
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BLOOD);
    expect(result).toHaveLength(1);
  });

  it('should not double-count entity matching both primary and secondary', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    setWorldMark2(tags, h1.id, WORLD_MARK.BONE); // same mark on both
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BONE);
    expect(result).toHaveLength(1); // still 1, not 2
  });
});

describe('getEntitiesByMotivation', () => {
  it('should return entities with matching motivation', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    setMotivation(tags, h1.id, MOTIVATION_TAG.KNOWLEDGE);
    setMotivation(tags, h2.id, MOTIVATION_TAG.WEALTH);

    const result = getEntitiesByMotivation(
      tags,
      entities,
      MOTIVATION_TAG.KNOWLEDGE
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(h1.id);
  });
});

describe('getEntitiesByAxis', () => {
  it('should match primary axis', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setAxis(tags, h1.id, AXIS_TAG.ORDER);
    const result = getEntitiesByAxis(tags, entities, AXIS_TAG.ORDER);
    expect(result).toHaveLength(1);
  });

  it('should match secondary axis', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setAxis(tags, h1.id, AXIS_TAG.ORDER);
    setAxis2(tags, h1.id, AXIS_TAG.STABLE);
    const result = getEntitiesByAxis(tags, entities, AXIS_TAG.STABLE);
    expect(result).toHaveLength(1);
  });
});

describe('getEntitiesBySituation', () => {
  it('should return entities with matching situation', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setSituation(tags, h1.id, SITUATION_TAG.DANGER);
    const result = getEntitiesBySituation(tags, entities, SITUATION_TAG.DANGER);
    expect(result).toHaveLength(1);
  });
});

describe('calculateTagMatchScore', () => {
  let s: TagStorage;

  beforeEach(() => {
    s = createTagStorage(10);
  });

  it('should return -500 for two untagged entities', () => {
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500);
  });

  it('should add 100 for direction match', () => {
    setDirection(s, entityId(0), DIRECTION_TAG.ACTIVE);
    setDirection(s, entityId(1), DIRECTION_TAG.ACTIVE);
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 100);
  });

  it('should not score NONE matches (0 === 0)', () => {
    // Both entities have all tags = NONE (0)
    // The !== 0 guard should prevent scoring NONE === NONE as a match
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500);
  });

  it('should add 150 for primary axis match', () => {
    setAxis(s, entityId(0), AXIS_TAG.ORDER);
    setAxis(s, entityId(1), AXIS_TAG.ORDER);
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 150);
  });

  it('should add 75 for secondary-only axis match', () => {
    setAxis(s, entityId(0), AXIS_TAG.ORDER);
    setAxis2(s, entityId(0), AXIS_TAG.STABLE);
    setAxis(s, entityId(1), AXIS_TAG.BOLD);
    setAxis2(s, entityId(1), AXIS_TAG.STABLE);
    // Primary mismatch (ORDER vs BOLD), secondary match (STABLE vs STABLE)
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 75);
  });

  it('should score full match correctly', () => {
    const id0 = entityId(0);
    const id1 = entityId(1);
    // Set identical primary tags
    setDirection(s, id0, DIRECTION_TAG.ACTIVE);
    setDirection(s, id1, DIRECTION_TAG.ACTIVE);
    setAxis(s, id0, AXIS_TAG.BOLD);
    setAxis(s, id1, AXIS_TAG.BOLD);
    setMotivation(s, id0, MOTIVATION_TAG.MASTERY);
    setMotivation(s, id1, MOTIVATION_TAG.MASTERY);
    setWorldMark(s, id0, WORLD_MARK.BLOOD);
    setWorldMark(s, id1, WORLD_MARK.BLOOD);

    // -500 + 100 + 150 + 150 + 100 = 0
    expect(calculateTagMatchScore(s, id0, id1)).toBe(0);
  });

  it('should handle cross-match (primary1 vs secondary2)', () => {
    const id0 = entityId(0);
    const id1 = entityId(1);
    setAxis(s, id0, AXIS_TAG.ORDER);
    setAxis(s, id1, AXIS_TAG.BOLD);
    setAxis2(s, id1, AXIS_TAG.ORDER); // secondary matches id0's primary
    // Primary axis: id0.ORDER vs id1.BOLD → mismatch
    // But id0.ORDER === id1.axis2.ORDER → primary-to-secondary match = 150
    expect(calculateTagMatchScore(s, id0, id1)).toBe(-500 + 150);
  });
});
