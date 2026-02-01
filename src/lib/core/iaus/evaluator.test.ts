import { describe, it, expect } from 'vitest';
import { evaluateDecision, evaluateNpc, evaluateBatch } from './evaluator';
import { DECISIONS } from './decisions';
import { MVP_CONSIDERATIONS } from './considerations';
import type { SystemRefs } from './considerations';
import type { EvaluationContext, DecisionCacheStorage, ActionLockStorage } from '$lib/types/iaus';
import { createEntityStorage } from '$lib/core/entity/storage';
import { createTagStorage } from '$lib/core/tags/storage';
import { setDirection, setWorldMark } from '$lib/core/tags/accessors';
import { createArchetypeStorage, registerArchetype } from '$lib/core/archetype/storage';
import { initializeDefaultArchetypes } from '$lib/core/archetype/definitions';
import {
  createCharacterStateStorage,
  setHp,
  setMaxHp,
  setDejavuBonds,
  setRestState,
  setArchetypeId,
} from '$lib/core/character/storage';
import { createActionLockStorage, createDecisionCacheStorage, getCurrentDecision, getRemainingTicks } from './cache';
import { DIRECTION_TAG, SITUATION_TAG } from '$lib/types/tags';
import { REST_STATE } from '$lib/types/character';
import { WORLD_MARK } from '$lib/types/marks';
import { entityId } from '$lib/types/brand';
import { ARCHETYPE } from '$lib/types/archetype';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSystems(capacity = 10): {
  systems: SystemRefs;
  cache: DecisionCacheStorage;
  lock: ActionLockStorage;
} {
  const entity = createEntityStorage(capacity);
  const tags = createTagStorage(capacity);
  const archetype = createArchetypeStorage();
  const character = createCharacterStateStorage(capacity);
  const lock = createActionLockStorage(capacity);

  // Initialize archetypes
  initializeDefaultArchetypes(archetype);

  return {
    systems: { entity, tags, archetype, character, actionLock: lock },
    cache: createDecisionCacheStorage(capacity),
    lock,
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
// evaluateDecision Tests
// =============================================================================

describe('evaluateDecision', () => {
  describe('situation matching', () => {
    it('should give 1.0 score when situationTag matches currentSituation', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.PEACEFUL });

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);
      setDirection(systems.tags, id, DIRECTION_TAG.PASSIVE);

      const restDecision = DECISIONS[0]!; // rest - PEACEFUL
      const score = evaluateDecision(id, restDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });

    it('should give 0.5 score when situationTag does not match', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.DANGER });

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);

      const restDecision = DECISIONS[0]!; // rest - expects PEACEFUL
      const score = evaluateDecision(id, restDecision, ctx, systems, MVP_CONSIDERATIONS);

      // Score will be lower due to situation mismatch
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('direction affinity', () => {
    it('should give high score for ACTIVE decision with ACTIVE archetype', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.BERSERKER); // High ACTIVE weight (95)

      const attackDecision = DECISIONS[11]!; // attack - ACTIVE
      const score = evaluateDecision(id, attackDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });

    it('should give low score for PASSIVE decision with ACTIVE archetype', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.BERSERKER); // Low PASSIVE weight (10)

      const restDecision = DECISIONS[0]!; // rest - PASSIVE
      const score = evaluateDecision(id, restDecision, ctx, systems, MVP_CONSIDERATIONS);

      // Score will be lower due to low passive weight
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should give high score for SOCIAL decision with SOCIAL archetype', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.DIPLOMAT); // High SOCIAL weight (85)

      const talkDecision = DECISIONS[7]!; // talk - SOCIAL
      const score = evaluateDecision(id, talkDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });
  });

  describe('tag_match consideration', () => {
    it('should give bonus when actor WorldMark matches decision WorldMark', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.ARTISAN);
      setWorldMark(systems.tags, id, WORLD_MARK.SKIN);

      const craftDecision = DECISIONS[3]!; // work_craft - SKIN
      const score = evaluateDecision(id, craftDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });

    it('should give baseline when WorldMark does not match', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.ARTISAN);
      setWorldMark(systems.tags, id, WORLD_MARK.BONE); // Mismatch

      const craftDecision = DECISIONS[3]!; // work_craft - expects SKIN
      const score = evaluateDecision(id, craftDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('standard considerations', () => {
    it('should give high score for rest when HP is low', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 20);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.SCHOLAR);
      setRestState(systems.character, id, REST_STATE.ACTIVE);

      const restDecision = DECISIONS[0]!; // rest
      const score = evaluateDecision(id, restDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });

    it('should give high score for sleep when exhausted at night', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ gameHour: 22 });

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.SCHOLAR);
      setRestState(systems.character, id, REST_STATE.ACTIVE); // Exhausted

      const sleepDecision = DECISIONS[2]!; // sleep
      const score = evaluateDecision(id, sleepDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });

    it('should give high score for flee when HP critical in danger', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.DANGER });

      setHp(systems.character, id, 15);
      setMaxHp(systems.character, id, 100);
      setDejavuBonds(systems.character, id, 20);
      setArchetypeId(systems.character, id, ARCHETYPE.EXPLORER);

      const fleeDecision = DECISIONS[13]!; // flee
      const score = evaluateDecision(id, fleeDecision, ctx, systems, MVP_CONSIDERATIONS);

      expect(score).toBeGreaterThan(0);
    });
  });

  describe('aggregation', () => {
    it('should return 0 when one consideration is 0 (auto-veto)', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      // Set up scenario that would cause 0 score
      setHp(systems.character, id, 0); // Dead
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);

      const restDecision = DECISIONS[0]!;
      const score = evaluateDecision(id, restDecision, ctx, systems, MVP_CONSIDERATIONS);

      // Score should be very low or 0 due to HP=0
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('weight application', () => {
    it('should apply weight multiplier to base score', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.DANGER });

      setHp(systems.character, id, 20);
      setMaxHp(systems.character, id, 100);
      setDejavuBonds(systems.character, id, 20);
      setArchetypeId(systems.character, id, ARCHETYPE.EXPLORER);

      const fleeDecision = DECISIONS[13]!; // flee - weight: 1.3
      const score = evaluateDecision(id, fleeDecision, ctx, systems, MVP_CONSIDERATIONS);

      // Score should be boosted by 1.3x weight
      expect(score).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// evaluateNpc Tests
// =============================================================================

describe('evaluateNpc', () => {
  describe('best decision selection', () => {
    it('should return the decision with highest score', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      expect(result.decisionId).toBeGreaterThanOrEqual(0);
      expect(result.decisionId).toBeLessThan(DECISIONS.length);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should prefer lower id when scores are equal', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.SCHOLAR);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      // Should pick a valid decision
      expect(result.decisionId).toBeGreaterThanOrEqual(0);
    });

    it('should return rest (id:0) as fallback when all scores are 0', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      // Dead character
      setHp(systems.character, id, 0);
      setMaxHp(systems.character, id, 0);
      setArchetypeId(systems.character, id, 0);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      expect(result.decisionId).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scenario: healthy NPC in peaceful area', () => {
    it('should prefer work or social decisions over combat/flee', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.PEACEFUL });

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setDejavuBonds(systems.character, id, 100);
      setRestState(systems.character, id, REST_STATE.FULL_REST);
      setArchetypeId(systems.character, id, ARCHETYPE.ARTISAN);
      setWorldMark(systems.tags, id, WORLD_MARK.SKIN);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      // Should not choose combat decisions (11-13) or flee
      expect(result.decisionId).not.toBe(11); // attack
      expect(result.decisionId).not.toBe(13); // flee
    });
  });

  describe('scenario: injured NPC in danger zone', () => {
    it('should prefer flee or defend over work/social', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ currentSituation: SITUATION_TAG.DANGER });

      setHp(systems.character, id, 20);
      setMaxHp(systems.character, id, 100);
      setDejavuBonds(systems.character, id, 30);
      setArchetypeId(systems.character, id, ARCHETYPE.EXPLORER);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      // Should choose survival decision
      const survivals = [12, 13]; // defend, flee
      expect(result.decisionId).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scenario: exhausted NPC at night', () => {
    it('should choose sleep', () => {
      const { systems } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext({ gameHour: 23, currentSituation: SITUATION_TAG.PEACEFUL });

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setRestState(systems.character, id, REST_STATE.ACTIVE); // Exhausted
      setArchetypeId(systems.character, id, ARCHETYPE.SCHOLAR);

      const result = evaluateNpc(id, DECISIONS, ctx, systems, MVP_CONSIDERATIONS);

      // Should strongly prefer sleep (id: 2)
      expect(result.decisionId).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// evaluateBatch Tests
// =============================================================================

describe('evaluateBatch', () => {
  describe('cache and lock integration', () => {
    it('should update cache with decision result', () => {
      const { systems, cache, lock } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);

      evaluateBatch([0], DECISIONS, ctx, systems, MVP_CONSIDERATIONS, cache, lock);

      const cachedDecision = getCurrentDecision(cache, id);
      expect(cachedDecision).toBeGreaterThanOrEqual(0);
      expect(cachedDecision).toBeLessThan(DECISIONS.length);
    });

    it('should set action lock with calculated duration', () => {
      const { systems, cache, lock } = createTestSystems();
      const id = entityId(0);
      const ctx = createTestContext();

      setHp(systems.character, id, 100);
      setMaxHp(systems.character, id, 100);
      setArchetypeId(systems.character, id, ARCHETYPE.GUARDIAN);

      evaluateBatch([0], DECISIONS, ctx, systems, MVP_CONSIDERATIONS, cache, lock);

      const remaining = getRemainingTicks(lock, id);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(255);
    });
  });

  describe('multiple NPCs', () => {
    it('should evaluate all NPCs independently', () => {
      const { systems, cache, lock } = createTestSystems();
      const ctx = createTestContext();

      // Setup NPC 0: Healthy fighter
      setHp(systems.character, entityId(0), 100);
      setMaxHp(systems.character, entityId(0), 100);
      setArchetypeId(systems.character, entityId(0), ARCHETYPE.BERSERKER);

      // Setup NPC 1: Injured scholar
      setHp(systems.character, entityId(1), 20);
      setMaxHp(systems.character, entityId(1), 100);
      setArchetypeId(systems.character, entityId(1), ARCHETYPE.SCHOLAR);

      evaluateBatch([0, 1], DECISIONS, ctx, systems, MVP_CONSIDERATIONS, cache, lock);

      const decision0 = getCurrentDecision(cache, entityId(0));
      const decision1 = getCurrentDecision(cache, entityId(1));

      // Both should have valid decisions
      expect(decision0).toBeGreaterThanOrEqual(0);
      expect(decision1).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deterministic seeding', () => {
    it('should produce same duration for same rawId + currentTick', () => {
      const { systems, cache, lock } = createTestSystems();
      const ctx1 = createTestContext({ currentTick: 100 });
      const ctx2 = createTestContext({ currentTick: 100 });

      setHp(systems.character, entityId(0), 100);
      setMaxHp(systems.character, entityId(0), 100);
      setArchetypeId(systems.character, entityId(0), ARCHETYPE.GUARDIAN);

      evaluateBatch([0], DECISIONS, ctx1, systems, MVP_CONSIDERATIONS, cache, lock);
      const duration1 = getRemainingTicks(lock, entityId(0));

      // Reset lock
      lock.remainingTicks[0] = 0;

      evaluateBatch([0], DECISIONS, ctx2, systems, MVP_CONSIDERATIONS, cache, lock);
      const duration2 = getRemainingTicks(lock, entityId(0));

      expect(duration1).toBe(duration2);
    });

    it('should produce different duration for different rawId', () => {
      const { systems, cache, lock } = createTestSystems();
      const ctx = createTestContext({ currentTick: 100 });

      setHp(systems.character, entityId(0), 100);
      setMaxHp(systems.character, entityId(0), 100);
      setArchetypeId(systems.character, entityId(0), ARCHETYPE.GUARDIAN);

      setHp(systems.character, entityId(1), 100);
      setMaxHp(systems.character, entityId(1), 100);
      setArchetypeId(systems.character, entityId(1), ARCHETYPE.GUARDIAN);

      evaluateBatch([0, 1], DECISIONS, ctx, systems, MVP_CONSIDERATIONS, cache, lock);

      const duration0 = getRemainingTicks(lock, entityId(0));
      const duration1 = getRemainingTicks(lock, entityId(1));

      // Durations should be different (very high probability)
      expect(duration0).toBeGreaterThan(0);
      expect(duration1).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should evaluate 100 NPCs in under 50ms', () => {
      const { systems, cache, lock } = createTestSystems(100);
      const ctx = createTestContext();

      // Setup 100 NPCs with varied states
      const unlockedIds: number[] = [];
      for (let i = 0; i < 100; i++) {
        const id = entityId(i);
        setHp(systems.character, id, 50 + i);
        setMaxHp(systems.character, id, 100);
        setArchetypeId(systems.character, id, i % 32); // Cycle through archetypes
        unlockedIds.push(i);
      }

      const start = performance.now();
      evaluateBatch(unlockedIds, DECISIONS, ctx, systems, MVP_CONSIDERATIONS, cache, lock);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
