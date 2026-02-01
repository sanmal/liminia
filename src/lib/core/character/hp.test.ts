import { describe, it, expect } from 'vitest';
import {
  getHpStage,
  isDead,
  calculateHpRecovery,
  damageHp,
  healHp,
  applyHpRecovery,
  calculateMaxHp,
  initializeHp,
} from './hp';
import {
  createCharacterStateStorage,
  setHp,
  setMaxHp,
  getHp,
  getMaxHp,
} from './storage';
import { HP_STAGE, REST_STATE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);

describe('getHpStage', () => {
  it('should return DEAD for hp=0', () => {
    expect(getHpStage(0, 100)).toBe(HP_STAGE.DEAD);
  });

  it('should return DEAD for maxHp=0', () => {
    expect(getHpStage(50, 0)).toBe(HP_STAGE.DEAD);
  });

  it('should return HEALTHY for full HP', () => {
    expect(getHpStage(100, 100)).toBe(HP_STAGE.HEALTHY);
  });

  it('should return LIGHT_INJURY for 75-99%', () => {
    expect(getHpStage(75, 100)).toBe(HP_STAGE.LIGHT_INJURY);
    expect(getHpStage(99, 100)).toBe(HP_STAGE.LIGHT_INJURY);
  });

  it('should return INJURED for 50-74%', () => {
    expect(getHpStage(50, 100)).toBe(HP_STAGE.INJURED);
    expect(getHpStage(74, 100)).toBe(HP_STAGE.INJURED);
  });

  it('should return SERIOUS for 25-49%', () => {
    expect(getHpStage(25, 100)).toBe(HP_STAGE.SERIOUS);
    expect(getHpStage(49, 100)).toBe(HP_STAGE.SERIOUS);
  });

  it('should return CRITICAL for 1-24%', () => {
    expect(getHpStage(1, 100)).toBe(HP_STAGE.CRITICAL);
    expect(getHpStage(24, 100)).toBe(HP_STAGE.CRITICAL);
  });
});

describe('calculateHpRecovery', () => {
  it('should return 0 for full HP', () => {
    expect(
      calculateHpRecovery({
        currentHp: 100,
        maxHp: 100,
        mitigationBonus: 0,
        restState: REST_STATE.ACTIVE,
        environmentPenalty: 0,
        elapsedHours: 1,
      })
    ).toBe(0);
  });

  it('should return 0 for dead character', () => {
    expect(
      calculateHpRecovery({
        currentHp: 0,
        maxHp: 100,
        mitigationBonus: 0,
        restState: REST_STATE.ACTIVE,
        environmentPenalty: 0,
        elapsedHours: 1,
      })
    ).toBe(0);
  });

  it('should calculate base recovery (2%/hour)', () => {
    // Light injury, no bonuses, 1 hour
    const recovery = calculateHpRecovery({
      currentHp: 80,
      maxHp: 100,
      mitigationBonus: 0,
      restState: REST_STATE.ACTIVE,
      environmentPenalty: 0,
      elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.0 × 1.0 × 100 × 1 = 2
    expect(recovery).toBe(2);
  });

  it('should apply rest bonus', () => {
    const recovery = calculateHpRecovery({
      currentHp: 80,
      maxHp: 100,
      mitigationBonus: 0,
      restState: REST_STATE.FULL_REST,
      environmentPenalty: 0,
      elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.5 × 1.0 × 100 × 1 = 3
    expect(recovery).toBe(3);
  });

  it('should apply environment penalty', () => {
    const recovery = calculateHpRecovery({
      currentHp: 80,
      maxHp: 100,
      mitigationBonus: 0,
      restState: REST_STATE.ACTIVE,
      environmentPenalty: 0.5,
      elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.0 × 0.5 × 100 × 1 = 1
    expect(recovery).toBe(1);
  });

  it('should reduce recovery for serious injury', () => {
    const recovery = calculateHpRecovery({
      currentHp: 30,
      maxHp: 100,
      mitigationBonus: 0,
      restState: REST_STATE.ACTIVE,
      environmentPenalty: 0,
      elapsedHours: 1,
    });
    // Serious: baseMultiplier=0.5
    // 0.02 × 0.5 × 1.0 × 1.0 × 100 × 1 = 1
    expect(recovery).toBe(1);
  });

  it('should apply mitigation to reduce injury penalty', () => {
    const recovery = calculateHpRecovery({
      currentHp: 30,
      maxHp: 100,
      mitigationBonus: 1.0,
      restState: REST_STATE.ACTIVE,
      environmentPenalty: 0,
      elapsedHours: 1,
    });
    // Serious: baseMultiplier=0.5, mitigation=1.0
    // mitigated = 0.5 + (1.0-0.5)*1.0 = 1.0
    // 0.02 × 1.0 × 1.0 × 1.0 × 100 × 1 = 2
    expect(recovery).toBe(2);
  });

  it('should not exceed remaining HP to max', () => {
    const recovery = calculateHpRecovery({
      currentHp: 99,
      maxHp: 100,
      mitigationBonus: 0,
      restState: REST_STATE.FULL_REST,
      environmentPenalty: 0,
      elapsedHours: 10,
    });
    expect(recovery).toBe(1); // Only 1 HP remaining to max
  });
});

describe('damageHp', () => {
  it('should reduce HP and return result', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    const result = damageHp(s, id0, 20);
    expect(result.newHp).toBe(30);
    expect(result.actualDamage).toBe(20);
    expect(result.isDead).toBe(false);
  });

  it('should detect death', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 10);
    const result = damageHp(s, id0, 15);
    expect(result.newHp).toBe(0);
    expect(result.actualDamage).toBe(10);
    expect(result.isDead).toBe(true);
  });

  it('should handle zero damage', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    const result = damageHp(s, id0, 0);
    expect(result.actualDamage).toBe(0);
    expect(result.newHp).toBe(50);
  });
});

describe('healHp', () => {
  it('should increase HP up to maxHp', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    const newHp = healHp(s, id0, 30);
    expect(newHp).toBe(80);
    expect(getHp(s, id0)).toBe(80);
  });

  it('should not exceed maxHp', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 90);
    setMaxHp(s, id0, 100);
    const newHp = healHp(s, id0, 50);
    expect(newHp).toBe(100);
  });
});

describe('calculateMaxHp', () => {
  it('should calculate with Bone/Blood coefficient (2.0)', () => {
    // STR=10, CON=20, Bone mark
    expect(calculateMaxHp(10, 20, true)).toBe(50); // 10 + floor(20*2.0) = 50
  });

  it('should calculate with standard coefficient (1.5)', () => {
    // STR=10, CON=20, Other mark
    expect(calculateMaxHp(10, 20, false)).toBe(40); // 10 + floor(20*1.5) = 40
  });
});

describe('initializeHp', () => {
  it('should set both maxHp and hp to calculated value', () => {
    const s = createCharacterStateStorage(8);
    initializeHp(s, id0, 10, 20, false);
    expect(getMaxHp(s, id0)).toBe(40);
    expect(getHp(s, id0)).toBe(40);
  });
});

describe('isDead', () => {
  it('should return true when HP is 0', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 0);
    expect(isDead(s, id0)).toBe(true);
  });

  it('should return false when HP is positive', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 1);
    expect(isDead(s, id0)).toBe(false);
  });
});

describe('applyHpRecovery', () => {
  it('should apply recovery to storage', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 80);
    setMaxHp(s, id0, 100);
    const recovery = applyHpRecovery(s, id0, {
      mitigationBonus: 0,
      restState: REST_STATE.ACTIVE,
      environmentPenalty: 0,
      elapsedHours: 1,
    });
    expect(recovery).toBe(2);
    expect(getHp(s, id0)).toBe(82);
  });
});
