// =============================================================================
// IAUS Evaluation Engine
// =============================================================================

import type { EntityId } from '$lib/types/brand';
import type {
  DecisionDef,
  ConsiderationDef,
  EvaluationContext,
  DecisionCacheStorage,
  ActionLockStorage,
} from '$lib/types/iaus';
import type { SystemRefs } from './considerations';
import { entityId, archetypeId } from '$lib/types/brand';
import { clamp01, normalize, evaluateCurve } from './curves';
import { aggregateScores, applyWeight } from './scoring';
import { setDecisionResult, setLock } from './cache';
import { calculateDuration } from './time';
import { getConsiderationInput } from './considerations';
import { getWorldMark } from '$lib/core/tags/accessors';
import { getArchetypeId } from '$lib/core/character/storage';
import {
  getWeightActive,
  getWeightPassive,
  getWeightSocial,
} from '$lib/core/archetype/storage';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate tag match score for decision.
 * Simplified version: WorldMark matching only.
 *
 * @returns 0.0-1.0 score
 */
function calculateTagMatchForDecision(
  actorId: EntityId,
  decision: DecisionDef,
  systems: SystemRefs
): number {
  let score = 0.5; // Baseline (neutral)

  // WorldMark match check
  const actorMark = getWorldMark(systems.tags, actorId);
  if (actorMark === decision.worldMark) {
    score += 0.3; // Primary WorldMark match bonus
  }

  return clamp01(score);
}

/**
 * Calculate direction affinity score for decision.
 * Uses archetype direction weights.
 *
 * @returns 0.0-1.0 score (weight / 100)
 */
function calculateDirectionAffinity(
  actorId: EntityId,
  decision: DecisionDef,
  systems: SystemRefs
): number {
  // Get actor's archetype ID
  const rawArchetypeId = getArchetypeId(systems.character, actorId);
  const archId = archetypeId(rawArchetypeId);

  // Get direction weight from archetype
  let weight: number;
  switch (decision.direction) {
    case 0: // ACTIVE
      weight = getWeightActive(systems.archetype, archId);
      break;
    case 1: // PASSIVE
      weight = getWeightPassive(systems.archetype, archId);
      break;
    case 3: // SOCIAL
      weight = getWeightSocial(systems.archetype, archId);
      break;
    default:
      weight = 50; // Neutral if unknown
  }

  // Normalize 0-100 to 0.0-1.0
  return weight / 100;
}

// =============================================================================
// Evaluation Functions
// =============================================================================

/**
 * Evaluate a single decision for an actor.
 *
 * Processing flow:
 * 1. Add situation_match score (match=1.0, mismatch=0.5)
 * 2. Add direction_affinity score (archetype weights)
 * 3. Evaluate each consideration:
 *    - 'tag_match': WorldMark matching (custom calculation)
 *    - 'direction_affinity': Skip (already added in step 2)
 *    - 'situation_match': Skip (already added in step 1)
 *    - Others: getConsiderationInput → normalize → evaluateCurve
 * 4. Aggregate scores with geometric mean
 * 5. Apply decision weight
 *
 * @returns 0.0-1.0+ score (weight > 1.0 can produce scores > 1.0)
 */
export function evaluateDecision(
  actorId: EntityId,
  decision: DecisionDef,
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): number {
  const scores: number[] = [];

  // Step 1: Situation match
  const situationScore = decision.situationTag === context.currentSituation ? 1.0 : 0.5;
  scores.push(situationScore);

  // Step 2: Direction affinity
  const directionScore = calculateDirectionAffinity(actorId, decision, systems);
  scores.push(directionScore);

  // Step 3: Evaluate considerations
  for (const conId of decision.considerationIds) {
    // Special handling for tag_match
    if (conId === 'tag_match') {
      const tagScore = calculateTagMatchForDecision(actorId, decision, systems);
      scores.push(tagScore);
      continue;
    }

    // Skip direction_affinity and situation_match (already handled)
    if (conId === 'direction_affinity' || conId === 'situation_match') {
      continue;
    }

    // Standard consideration evaluation
    const conDef = considerations.get(conId);
    if (!conDef) continue;

    const rawInput = getConsiderationInput(conId, actorId, context, systems);
    const normalized = normalize(rawInput, conDef.inputMin, conDef.inputMax);
    const curveScore = evaluateCurve(normalized, conDef.curveType, conDef.curveParams);
    scores.push(curveScore);
  }

  // Step 4: Aggregate scores
  const baseScore = aggregateScores(scores);

  // Step 5: Apply decision weight
  return applyWeight(baseScore, decision.weight);
}

/**
 * Evaluate all decisions for an NPC and return the best one.
 *
 * @returns { decisionId, score } - Best decision and its score
 */
export function evaluateNpc(
  actorId: EntityId,
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): { decisionId: number; score: number } {
  let bestId = 0;
  let bestScore = -1;

  for (const decision of decisions) {
    const score = evaluateDecision(actorId, decision, context, systems, considerations);
    if (score > bestScore) {
      bestScore = score;
      bestId = decision.id;
    }
  }

  return { decisionId: bestId, score: Math.max(0, bestScore) };
}

/**
 * Batch evaluate unlocked NPCs and update cache and lock.
 *
 * @param unlockedIds - Entity IDs that became unlocked (from advanceLockCounters)
 */
export function evaluateBatch(
  unlockedIds: readonly number[],
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>,
  cache: DecisionCacheStorage,
  lock: ActionLockStorage
): void {
  for (const rawId of unlockedIds) {
    const id = entityId(rawId);

    // Evaluate best decision
    const result = evaluateNpc(id, decisions, context, systems, considerations);

    // Update cache
    setDecisionResult(cache, id, result.decisionId, result.score, context.currentTick);

    // Set action lock with deterministic duration
    const decision = decisions[result.decisionId];
    if (decision) {
      const seed = rawId * 10000 + context.currentTick;
      const duration = calculateDuration(decision.baseDurationTicks, decision.durationVariance, seed);
      setLock(lock, id, duration, result.decisionId);
    }
  }
}
