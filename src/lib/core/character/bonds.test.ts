import { describe, it, expect } from 'vitest';
import {
  getDejavuStage,
  isDejavuBondsVisible,
  calculateBondsRecovery,
  applyBondsRecovery,
  calculateChaosPassiveDamage,
  applyChaosAttackDamage,
  applyChaosPassiveDamage,
  damageBonds,
  healBonds,
  DEJAVU_BONDS_MAX,
} from './bonds';
import {
  createCharacterStateStorage,
  setDejavuBonds,
  getDejavuBonds,
  setHp,
  getHp,
  setMaxHp,
} from './storage';
import { DEJAVU_STAGE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);

describe('getDejavuStage', () => {
  it('should return FULL for 100', () => {
    expect(getDejavuStage(100)).toBe(DEJAVU_STAGE.FULL);
  });

  it('should return ENRICHED for 90-99', () => {
    expect(getDejavuStage(90)).toBe(DEJAVU_STAGE.ENRICHED);
    expect(getDejavuStage(99)).toBe(DEJAVU_STAGE.ENRICHED);
  });

  it('should return GOOD for 80-89', () => {
    expect(getDejavuStage(80)).toBe(DEJAVU_STAGE.GOOD);
    expect(getDejavuStage(89)).toBe(DEJAVU_STAGE.GOOD);
  });

  it('should return STABLE for 70-79', () => {
    expect(getDejavuStage(70)).toBe(DEJAVU_STAGE.STABLE);
  });

  it('should return MAINTAINED for 60-69', () => {
    expect(getDejavuStage(60)).toBe(DEJAVU_STAGE.MAINTAINED);
  });

  it('should return HALVED for 50-59', () => {
    expect(getDejavuStage(50)).toBe(DEJAVU_STAGE.HALVED);
  });

  it('should return UNSTABLE for 40-49', () => {
    expect(getDejavuStage(40)).toBe(DEJAVU_STAGE.UNSTABLE);
  });

  it('should return THIN for 30-39', () => {
    expect(getDejavuStage(30)).toBe(DEJAVU_STAGE.THIN);
  });

  it('should return DANGER for 20-29', () => {
    expect(getDejavuStage(20)).toBe(DEJAVU_STAGE.DANGER);
  });

  it('should return VANISHING for 1-19', () => {
    expect(getDejavuStage(1)).toBe(DEJAVU_STAGE.VANISHING);
    expect(getDejavuStage(19)).toBe(DEJAVU_STAGE.VANISHING);
  });

  it('should return ISOLATED for 0', () => {
    expect(getDejavuStage(0)).toBe(DEJAVU_STAGE.ISOLATED);
  });
});

describe('isDejavuBondsVisible', () => {
  it('should be hidden at 100', () => {
    expect(isDejavuBondsVisible(100)).toBe(false);
  });

  it('should be visible below 100', () => {
    expect(isDejavuBondsVisible(99)).toBe(true);
    expect(isDejavuBondsVisible(0)).toBe(true);
  });
});

describe('calculateBondsRecovery', () => {
  it('should recover 10 points per hour outside chaos', () => {
    expect(calculateBondsRecovery(50, false, 1)).toBe(10);
  });

  it('should not recover in chaos area', () => {
    expect(calculateBondsRecovery(50, true, 1)).toBe(0);
  });

  it('should not exceed max bonds', () => {
    expect(calculateBondsRecovery(95, false, 1)).toBe(5); // Only up to 100
  });

  it('should return 0 when already full', () => {
    expect(calculateBondsRecovery(100, false, 1)).toBe(0);
  });

  it('should scale with elapsed hours', () => {
    expect(calculateBondsRecovery(50, false, 2)).toBe(20);
  });
});

describe('calculateChaosPassiveDamage', () => {
  it('should calculate base damage at chaos_level=0', () => {
    // 5 × (1.0 + 0.0) × 1 = 5
    expect(calculateChaosPassiveDamage(0, 1)).toBe(5);
  });

  it('should scale with chaos level', () => {
    // 5 × (1.0 + 1.0) × 1 = 10
    expect(calculateChaosPassiveDamage(1.0, 1)).toBe(10);
  });

  it('should scale with elapsed hours', () => {
    // 5 × (1.0 + 0.0) × 3 = 15
    expect(calculateChaosPassiveDamage(0, 3)).toBe(15);
  });

  it('should return 0 for negative chaos level', () => {
    expect(calculateChaosPassiveDamage(-1, 1)).toBe(0);
  });
});

describe('applyChaosAttackDamage', () => {
  it('should absorb all damage with bonds', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    setHp(s, id0, 100);
    setMaxHp(s, id0, 100);

    const result = applyChaosAttackDamage(s, id0, 30);
    expect(result.bondsAbsorbed).toBe(30);
    expect(result.hpDamage).toBe(0);
    expect(result.newBonds).toBe(20);
    expect(result.newHp).toBe(100);
    expect(result.isDead).toBe(false);
  });

  it('should overflow to HP when bonds depleted', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 20);
    setHp(s, id0, 100);
    setMaxHp(s, id0, 100);

    const result = applyChaosAttackDamage(s, id0, 50);
    expect(result.bondsAbsorbed).toBe(20);
    expect(result.hpDamage).toBe(30);
    expect(result.newBonds).toBe(0);
    expect(result.newHp).toBe(70);
    expect(result.isDead).toBe(false);
  });

  it('should cause death when overflow exceeds HP', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 10);
    setHp(s, id0, 20);

    const result = applyChaosAttackDamage(s, id0, 50);
    expect(result.bondsAbsorbed).toBe(10);
    expect(result.hpDamage).toBe(20);
    expect(result.newBonds).toBe(0);
    expect(result.newHp).toBe(0);
    expect(result.isDead).toBe(true);
  });

  it('should handle zero bonds (all damage to HP)', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 0);
    setHp(s, id0, 50);

    const result = applyChaosAttackDamage(s, id0, 20);
    expect(result.bondsAbsorbed).toBe(0);
    expect(result.hpDamage).toBe(20);
    expect(result.newHp).toBe(30);
  });

  it('should handle zero damage', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    setHp(s, id0, 100);

    const result = applyChaosAttackDamage(s, id0, 0);
    expect(result.bondsAbsorbed).toBe(0);
    expect(result.hpDamage).toBe(0);
    expect(result.newBonds).toBe(50);
    expect(result.newHp).toBe(100);
  });
});

describe('applyChaosPassiveDamage', () => {
  it('should only damage bonds (no HP penetration)', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 30);
    setHp(s, id0, 100);

    const actual = applyChaosPassiveDamage(s, id0, 0, 1);
    expect(actual).toBe(5);
    expect(getDejavuBonds(s, id0)).toBe(25);
    expect(getHp(s, id0)).toBe(100); // HP unchanged
  });

  it('should not go below 0 bonds', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 3);

    const actual = applyChaosPassiveDamage(s, id0, 0, 1);
    expect(actual).toBe(3);
    expect(getDejavuBonds(s, id0)).toBe(0);
  });
});

describe('applyBondsRecovery', () => {
  it('should apply recovery to storage', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    const recovery = applyBondsRecovery(s, id0, false, 2);
    expect(recovery).toBe(20);
    expect(getDejavuBonds(s, id0)).toBe(70);
  });

  it('should not recover in chaos area', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    const recovery = applyBondsRecovery(s, id0, true, 2);
    expect(recovery).toBe(0);
    expect(getDejavuBonds(s, id0)).toBe(50);
  });
});

describe('damageBonds and healBonds', () => {
  it('should damage bonds directly', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 80);
    expect(damageBonds(s, id0, 30)).toBe(30);
    expect(getDejavuBonds(s, id0)).toBe(50);
  });

  it('should heal bonds up to max', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 80);
    const newBonds = healBonds(s, id0, 50);
    expect(newBonds).toBe(100); // Clamped at max
  });

  it('should handle zero heal', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    const newBonds = healBonds(s, id0, 0);
    expect(newBonds).toBe(50);
  });

  it('should handle zero damage', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    expect(damageBonds(s, id0, 0)).toBe(0);
    expect(getDejavuBonds(s, id0)).toBe(50);
  });
});
