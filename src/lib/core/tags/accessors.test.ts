import { describe, it, expect } from 'vitest';
import { createTagStorage } from './storage';
import {
  getDirection,
  setDirection,
  getAxis,
  setAxis,
  getAxis2,
  setAxis2,
  getMotivation,
  setMotivation,
  getWorldMark,
  setWorldMark,
  getWorldMark2,
  setWorldMark2,
  getSituation,
  setSituation,
} from './accessors';
import { entityId } from '$lib/types/brand';
import {
  DIRECTION_TAG,
  AXIS_TAG,
  MOTIVATION_TAG,
  SITUATION_TAG,
} from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';

describe('direction accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.NONE);
  });

  it('should set and get direction', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.ACTIVE);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE);
  });
});

describe('axis accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getAxis(s, id)).toBe(AXIS_TAG.NONE);
  });

  it('should set and get primary axis', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setAxis(s, id, AXIS_TAG.ORDER);
    expect(getAxis(s, id)).toBe(AXIS_TAG.ORDER);
  });
});

describe('axis2 accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getAxis2(s, id)).toBe(AXIS_TAG.NONE);
  });

  it('should set and get secondary axis', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setAxis2(s, id, AXIS_TAG.STABLE);
    expect(getAxis2(s, id)).toBe(AXIS_TAG.STABLE);
  });
});

describe('motivation accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.NONE);
  });

  it('should set and get motivation', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setMotivation(s, id, MOTIVATION_TAG.KNOWLEDGE);
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.KNOWLEDGE);
  });
});

describe('worldMark accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getWorldMark(s, id)).toBe(WORLD_MARK.NONE);
  });

  it('should set and get primary worldMark', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setWorldMark(s, id, WORLD_MARK.BONE);
    expect(getWorldMark(s, id)).toBe(WORLD_MARK.BONE);
  });
});

describe('worldMark2 accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getWorldMark2(s, id)).toBe(WORLD_MARK.NONE);
  });

  it('should set and get secondary worldMark', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setWorldMark2(s, id, WORLD_MARK.BLOOD);
    expect(getWorldMark2(s, id)).toBe(WORLD_MARK.BLOOD);
  });
});

describe('situation accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getSituation(s, id)).toBe(SITUATION_TAG.NONE);
  });

  it('should set and get situation', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setSituation(s, id, SITUATION_TAG.DANGER);
    expect(getSituation(s, id)).toBe(SITUATION_TAG.DANGER);
  });
});

describe('accessor independence', () => {
  it('should not affect other entities when setting tags', () => {
    const s = createTagStorage(10);
    setDirection(s, entityId(0), DIRECTION_TAG.ACTIVE);
    setDirection(s, entityId(1), DIRECTION_TAG.PASSIVE);
    expect(getDirection(s, entityId(0))).toBe(DIRECTION_TAG.ACTIVE);
    expect(getDirection(s, entityId(1))).toBe(DIRECTION_TAG.PASSIVE);
  });

  it('should not affect other tag fields when setting one', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.ACTIVE);
    expect(getAxis(s, id)).toBe(AXIS_TAG.NONE);
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.NONE);
  });

  it('should handle max Uint8 value (255)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, 255);
    expect(getDirection(s, id)).toBe(255);
  });

  it('should clamp values above 255 to Uint8 range', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, 256); // Uint8Array auto-clamps
    expect(getDirection(s, id)).toBe(0); // 256 % 256 = 0
  });
});
