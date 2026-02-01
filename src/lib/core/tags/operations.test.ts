import { describe, it, expect } from 'vitest';
import { createTagStorage } from './storage';
import { setEntityTags, clearEntityTags, copyEntityTags } from './operations';
import {
  getDirection,
  setDirection,
  getAxis,
  getAxis2,
  getMotivation,
  getWorldMark,
  getWorldMark2,
  getSituation,
} from './accessors';
import { entityId } from '$lib/types/brand';
import {
  DIRECTION_TAG,
  AXIS_TAG,
  MOTIVATION_TAG,
  SITUATION_TAG,
} from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';

describe('setEntityTags', () => {
  it('should set all specified tags at once', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.BOLD,
      motivation: MOTIVATION_TAG.MASTERY,
      worldMark: WORLD_MARK.BLOOD,
    });
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE);
    expect(getAxis(s, id)).toBe(AXIS_TAG.BOLD);
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.MASTERY);
    expect(getWorldMark(s, id)).toBe(WORLD_MARK.BLOOD);
  });

  it('should only update specified fields (partial update)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.ORDER,
    });
    setEntityTags(s, id, { axis: AXIS_TAG.CHAOS });
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE); // unchanged
    expect(getAxis(s, id)).toBe(AXIS_TAG.CHAOS); // updated
  });

  it('should handle empty options (no-op)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.SOCIAL);
    setEntityTags(s, id, {});
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.SOCIAL);
  });

  it('should set secondary tags', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      axis: AXIS_TAG.ORDER,
      axis2: AXIS_TAG.STABLE,
      worldMark: WORLD_MARK.BONE,
      worldMark2: WORLD_MARK.BLOOD,
    });
    expect(getAxis2(s, id)).toBe(AXIS_TAG.STABLE);
    expect(getWorldMark2(s, id)).toBe(WORLD_MARK.BLOOD);
  });
});

describe('clearEntityTags', () => {
  it('should reset all tags to NONE for specified entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.BOLD,
      motivation: MOTIVATION_TAG.POWER,
      worldMark: WORLD_MARK.BLOOD,
      situation: SITUATION_TAG.DANGER,
    });
    clearEntityTags(s, id);
    expect(getDirection(s, id)).toBe(0);
    expect(getAxis(s, id)).toBe(0);
    expect(getMotivation(s, id)).toBe(0);
    expect(getWorldMark(s, id)).toBe(0);
    expect(getSituation(s, id)).toBe(0);
  });

  it('should not affect other entities', () => {
    const s = createTagStorage(10);
    const id0 = entityId(0);
    const id1 = entityId(1);
    setDirection(s, id0, DIRECTION_TAG.ACTIVE);
    setDirection(s, id1, DIRECTION_TAG.PASSIVE);
    clearEntityTags(s, id0);
    expect(getDirection(s, id0)).toBe(0);
    expect(getDirection(s, id1)).toBe(DIRECTION_TAG.PASSIVE); // unchanged
  });
});

describe('copyEntityTags', () => {
  it('should copy all tags from source to destination', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setEntityTags(s, src, {
      direction: DIRECTION_TAG.SOCIAL,
      axis: AXIS_TAG.EXTRA,
      axis2: AXIS_TAG.OTHERS,
      motivation: MOTIVATION_TAG.BELONGING,
      worldMark: WORLD_MARK.BREATH,
      worldMark2: WORLD_MARK.TEAR,
      situation: SITUATION_TAG.CROWD,
    });
    copyEntityTags(s, src, dst);
    expect(getDirection(s, dst)).toBe(DIRECTION_TAG.SOCIAL);
    expect(getAxis(s, dst)).toBe(AXIS_TAG.EXTRA);
    expect(getAxis2(s, dst)).toBe(AXIS_TAG.OTHERS);
    expect(getMotivation(s, dst)).toBe(MOTIVATION_TAG.BELONGING);
    expect(getWorldMark(s, dst)).toBe(WORLD_MARK.BREATH);
    expect(getWorldMark2(s, dst)).toBe(WORLD_MARK.TEAR);
    expect(getSituation(s, dst)).toBe(SITUATION_TAG.CROWD);
  });

  it('should not modify source', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setDirection(s, src, DIRECTION_TAG.ACTIVE);
    copyEntityTags(s, src, dst);
    expect(getDirection(s, src)).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should overwrite destination tags', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setDirection(s, src, DIRECTION_TAG.ACTIVE);
    setDirection(s, dst, DIRECTION_TAG.PASSIVE);
    copyEntityTags(s, src, dst);
    expect(getDirection(s, dst)).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should handle copy to same entity (self-copy)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.SOCIAL);
    copyEntityTags(s, id, id);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.SOCIAL);
  });
});
