import { describe, it, expect } from 'vitest';
import {
  getConsiderationInput,
  MVP_CONSIDERATIONS,
} from './considerations';
import type { SystemRefs } from './considerations';
import type { EvaluationContext } from '$lib/types/iaus';
import { createEntityStorage } from '$lib/core/entity/storage';
import { createTagStorage } from '$lib/core/tags/storage';
import { setDirection } from '$lib/core/tags/accessors';
import { createArchetypeStorage } from '$lib/core/archetype/storage';
import {
  createCharacterStateStorage,
  setHp,
  setMaxHp,
  setDejavuBonds,
  setRestState,
} from '$lib/core/character/storage';
import { createActionLockStorage } from '$lib/core/iaus/cache';
import { DIRECTION_TAG, SITUATION_TAG } from '$lib/types/tags';
import { REST_STATE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSystems(capacity = 10): SystemRefs {
  return {
    entity: createEntityStorage(capacity),
    tags: createTagStorage(capacity),
    archetype: createArchetypeStorage(),
    character: createCharacterStateStorage(capacity),
    actionLock: createActionLockStorage(capacity),
  };
}

function createTestContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    currentTick: 0,
    currentSituation: SITUATION_TAG.PEACEFUL,
    gameHour: 12,
    ...overrides,
  };
}

// =============================================================================
// MVP_CONSIDERATIONS Tests
// =============================================================================

describe('MVP_CONSIDERATIONS', () => {
  it('should have 9 ConsiderationDef entries', () => {
    expect(MVP_CONSIDERATIONS.size).toBe(9);
  });

  it('should contain all expected consideration IDs', () => {
    const expectedIds = [
      'own_hp_ratio',
      'own_hp_critical',
      'own_bonds_ratio',
      'own_bonds_critical',
      'tag_match',
      'direction_affinity',
      'situation_match',
      'time_of_day',
      'rest_need',
    ];

    for (const id of expectedIds) {
      expect(MVP_CONSIDERATIONS.has(id)).toBe(true);
    }
  });

  it('should have all required properties in each ConsiderationDef', () => {
    for (const [id, def] of MVP_CONSIDERATIONS) {
      expect(def.id).toBe(id);
      expect(typeof def.name).toBe('string');
      expect(typeof def.curveType).toBe('number');
      expect(def.curveParams).toBeDefined();
      expect(typeof def.curveParams.m).toBe('number');
      expect(typeof def.curveParams.k).toBe('number');
      expect(typeof def.curveParams.c).toBe('number');
      expect(typeof def.curveParams.b).toBe('number');
      expect(typeof def.inputMin).toBe('number');
      expect(typeof def.inputMax).toBe('number');
    }
  });

  it('should have valid input ranges', () => {
    for (const [, def] of MVP_CONSIDERATIONS) {
      expect(def.inputMax).toBeGreaterThanOrEqual(def.inputMin);
    }
  });
});

// =============================================================================
// getConsiderationInput Tests
// =============================================================================

describe('getConsiderationInput', () => {
  describe('own_hp_ratio', () => {
    it('should return 0.5 when HP=100, maxHp=200', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(sys.character, id, 100);
      setMaxHp(sys.character, id, 200);

      expect(getConsiderationInput('own_hp_ratio', id, ctx, sys)).toBe(0.5);
    });

    it('should return 1.0 when HP=maxHp (full health)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(sys.character, id, 200);
      setMaxHp(sys.character, id, 200);

      expect(getConsiderationInput('own_hp_ratio', id, ctx, sys)).toBe(1.0);
    });

    it('should return 0.0 when HP=0 (dead)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(sys.character, id, 0);
      setMaxHp(sys.character, id, 200);

      expect(getConsiderationInput('own_hp_ratio', id, ctx, sys)).toBe(0.0);
    });

    it('should return 1.0 when maxHp=0 (uninitialized, safe fallback)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();
      // maxHp defaults to 0 from createCharacterStateStorage

      expect(getConsiderationInput('own_hp_ratio', id, ctx, sys)).toBe(1.0);
    });
  });

  describe('own_hp_critical', () => {
    it('should return same input as own_hp_ratio (curves differ)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(sys.character, id, 50);
      setMaxHp(sys.character, id, 200);

      const hpRatioValue = getConsiderationInput('own_hp_ratio', id, ctx, sys);
      const hpCriticalValue = getConsiderationInput('own_hp_critical', id, ctx, sys);

      expect(hpCriticalValue).toBe(hpRatioValue);
      expect(hpCriticalValue).toBe(0.25);
    });
  });

  describe('own_bonds_ratio', () => {
    it('should return 1.0 when bonds=100', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDejavuBonds(sys.character, id, 100);

      expect(getConsiderationInput('own_bonds_ratio', id, ctx, sys)).toBe(1.0);
    });

    it('should return 0.5 when bonds=50', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDejavuBonds(sys.character, id, 50);

      expect(getConsiderationInput('own_bonds_ratio', id, ctx, sys)).toBe(0.5);
    });

    it('should return 0.0 when bonds=0', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDejavuBonds(sys.character, id, 0);

      expect(getConsiderationInput('own_bonds_ratio', id, ctx, sys)).toBe(0.0);
    });
  });

  describe('own_bonds_critical', () => {
    it('should return same input as own_bonds_ratio', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDejavuBonds(sys.character, id, 30);

      const bondsRatioValue = getConsiderationInput('own_bonds_ratio', id, ctx, sys);
      const bondsCriticalValue = getConsiderationInput('own_bonds_critical', id, ctx, sys);

      expect(bondsCriticalValue).toBe(bondsRatioValue);
      expect(bondsCriticalValue).toBe(0.3);
    });
  });

  describe('tag_match', () => {
    it('should always return 0 (placeholder for evaluator)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      expect(getConsiderationInput('tag_match', id, ctx, sys)).toBe(0);
    });
  });

  describe('direction_affinity', () => {
    it('should return 1 when direction=ACTIVE', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDirection(sys.tags, id, DIRECTION_TAG.ACTIVE);

      expect(getConsiderationInput('direction_affinity', id, ctx, sys)).toBe(1);
    });

    it('should return 2 when direction=PASSIVE', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDirection(sys.tags, id, DIRECTION_TAG.PASSIVE);

      expect(getConsiderationInput('direction_affinity', id, ctx, sys)).toBe(2);
    });

    it('should return 3 when direction=SOCIAL', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDirection(sys.tags, id, DIRECTION_TAG.SOCIAL);

      expect(getConsiderationInput('direction_affinity', id, ctx, sys)).toBe(3);
    });

    it('should return 0 when direction=NONE', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setDirection(sys.tags, id, DIRECTION_TAG.NONE);

      expect(getConsiderationInput('direction_affinity', id, ctx, sys)).toBe(0);
    });
  });

  describe('situation_match', () => {
    it('should return PEACEFUL(2) when context.currentSituation=PEACEFUL', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.PEACEFUL });

      expect(getConsiderationInput('situation_match', id, ctx, sys)).toBe(2);
    });

    it('should return DANGER(1) when context.currentSituation=DANGER', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.DANGER });

      expect(getConsiderationInput('situation_match', id, ctx, sys)).toBe(1);
    });

    it('should return CHAOS_HIGH(3) when context.currentSituation=CHAOS_HIGH', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.CHAOS_HIGH });

      expect(getConsiderationInput('situation_match', id, ctx, sys)).toBe(3);
    });
  });

  describe('time_of_day', () => {
    it('should return 0 when gameHour=0', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ gameHour: 0 });

      expect(getConsiderationInput('time_of_day', id, ctx, sys)).toBe(0);
    });

    it('should return 12 when gameHour=12', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ gameHour: 12 });

      expect(getConsiderationInput('time_of_day', id, ctx, sys)).toBe(12);
    });

    it('should return 23 when gameHour=23', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ gameHour: 23 });

      expect(getConsiderationInput('time_of_day', id, ctx, sys)).toBe(23);
    });
  });

  describe('rest_need', () => {
    it('should return 255 when restState=ACTIVE (maximum need)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setRestState(sys.character, id, REST_STATE.ACTIVE);

      expect(getConsiderationInput('rest_need', id, ctx, sys)).toBe(255);
    });

    it('should return 170 when restState=LIGHT_REST', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setRestState(sys.character, id, REST_STATE.LIGHT_REST);

      expect(getConsiderationInput('rest_need', id, ctx, sys)).toBe(170);
    });

    it('should return 85 when restState=SLEEP', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setRestState(sys.character, id, REST_STATE.SLEEP);

      expect(getConsiderationInput('rest_need', id, ctx, sys)).toBe(85);
    });

    it('should return 0 when restState=FULL_REST (no need)', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setRestState(sys.character, id, REST_STATE.FULL_REST);

      expect(getConsiderationInput('rest_need', id, ctx, sys)).toBe(0);
    });
  });

  describe('unknown consideration', () => {
    it('should return 0 for non-existent consideration ID', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      expect(getConsiderationInput('non_existent_id', id, ctx, sys)).toBe(0);
    });

    it('should return 0 for empty string ID', () => {
      const sys = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      expect(getConsiderationInput('', id, ctx, sys)).toBe(0);
    });
  });
});

// =============================================================================
// SystemRefs Integration Test
// =============================================================================

describe('SystemRefs integration', () => {
  it('should correctly retrieve all consideration inputs for a fully configured entity', () => {
    const sys = createTestSystems();
    const id = entityId(1);
    const ctx = createTestContext({
      currentTick: 100,
      currentSituation: SITUATION_TAG.DANGER,
      gameHour: 6,
    });

    // Configure character state
    setHp(sys.character, id, 75);
    setMaxHp(sys.character, id, 100);
    setDejavuBonds(sys.character, id, 80);
    setRestState(sys.character, id, REST_STATE.LIGHT_REST);

    // Configure tags
    setDirection(sys.tags, id, DIRECTION_TAG.ACTIVE);

    // Verify all inputs
    expect(getConsiderationInput('own_hp_ratio', id, ctx, sys)).toBe(0.75);
    expect(getConsiderationInput('own_hp_critical', id, ctx, sys)).toBe(0.75);
    expect(getConsiderationInput('own_bonds_ratio', id, ctx, sys)).toBe(0.8);
    expect(getConsiderationInput('own_bonds_critical', id, ctx, sys)).toBe(0.8);
    expect(getConsiderationInput('tag_match', id, ctx, sys)).toBe(0);
    expect(getConsiderationInput('direction_affinity', id, ctx, sys)).toBe(1); // ACTIVE
    expect(getConsiderationInput('situation_match', id, ctx, sys)).toBe(1); // DANGER
    expect(getConsiderationInput('time_of_day', id, ctx, sys)).toBe(6);
    expect(getConsiderationInput('rest_need', id, ctx, sys)).toBe(170); // LIGHT_REST
  });
});
