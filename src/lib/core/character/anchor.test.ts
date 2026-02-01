import { describe, it, expect } from 'vitest';
import {
  getAnchorLevel,
  getEntityAnchorLevel,
  bondsToNextAnchorLevel,
  calculateReturnDays,
  getInheritedElements,
} from './anchor';
import { createCharacterStateStorage, setDejavuBondsTotal } from './storage';
import { ANCHOR_LEVEL } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);

describe('getAnchorLevel', () => {
  it('should return LEVEL_0 for 0-499', () => {
    expect(getAnchorLevel(0)).toBe(ANCHOR_LEVEL.LEVEL_0);
    expect(getAnchorLevel(499)).toBe(ANCHOR_LEVEL.LEVEL_0);
  });

  it('should return LEVEL_1 for 500-1499', () => {
    expect(getAnchorLevel(500)).toBe(ANCHOR_LEVEL.LEVEL_1);
    expect(getAnchorLevel(1499)).toBe(ANCHOR_LEVEL.LEVEL_1);
  });

  it('should return LEVEL_2 for 1500-3499', () => {
    expect(getAnchorLevel(1500)).toBe(ANCHOR_LEVEL.LEVEL_2);
    expect(getAnchorLevel(3499)).toBe(ANCHOR_LEVEL.LEVEL_2);
  });

  it('should return LEVEL_3 for 3500-6999', () => {
    expect(getAnchorLevel(3500)).toBe(ANCHOR_LEVEL.LEVEL_3);
    expect(getAnchorLevel(6999)).toBe(ANCHOR_LEVEL.LEVEL_3);
  });

  it('should return LEVEL_4 for 7000+', () => {
    expect(getAnchorLevel(7000)).toBe(ANCHOR_LEVEL.LEVEL_4);
    expect(getAnchorLevel(99999)).toBe(ANCHOR_LEVEL.LEVEL_4);
  });
});

describe('getEntityAnchorLevel', () => {
  it('should read from storage and return level', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBondsTotal(s, id0, 2000);
    expect(getEntityAnchorLevel(s, id0)).toBe(ANCHOR_LEVEL.LEVEL_2);
  });
});

describe('bondsToNextAnchorLevel', () => {
  it('should return remaining bonds to next threshold', () => {
    expect(bondsToNextAnchorLevel(300)).toBe(200); // 500 - 300
    expect(bondsToNextAnchorLevel(1000)).toBe(500); // 1500 - 1000
  });

  it('should return 0 for max level', () => {
    expect(bondsToNextAnchorLevel(10000)).toBe(0);
  });

  it('should handle exact threshold values', () => {
    expect(bondsToNextAnchorLevel(500)).toBe(1000); // 1500 - 500
    expect(bondsToNextAnchorLevel(1500)).toBe(2000); // 3500 - 1500
  });
});

describe('calculateReturnDays', () => {
  it('should return -1 for Level 0 (permanent death)', () => {
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_0)).toBe(-1);
  });

  it('should return 3 for Level 4', () => {
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_4)).toBe(3);
  });

  it('should decrease with level', () => {
    const l1 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_1);
    const l2 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_2);
    const l3 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_3);
    expect(l1).toBeGreaterThan(l2);
    expect(l2).toBeGreaterThan(l3);
  });

  it('should return expected days for each level', () => {
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_1)).toBe(6);
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_2)).toBe(5);
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_3)).toBe(4);
  });
});

describe('getInheritedElements', () => {
  it('should return empty for Level 0', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_0)).toEqual([]);
  });

  it('should return occupation for Level 1', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_1)).toEqual(['occupation']);
  });

  it('should return occupation and faith for Level 2', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_2)).toEqual([
      'occupation',
      'faith',
    ]);
  });

  it('should return occupation, faith, topSkills for Level 3', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_3)).toEqual([
      'occupation',
      'faith',
      'topSkills',
    ]);
  });

  it('should include all elements for Level 4', () => {
    const elements = getInheritedElements(ANCHOR_LEVEL.LEVEL_4);
    expect(elements).toContain('occupation');
    expect(elements).toContain('faith');
    expect(elements).toContain('topSkills');
    expect(elements).toContain('skillLevels');
  });
});
