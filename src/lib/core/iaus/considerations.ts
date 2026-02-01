// =============================================================================
// IAUS Consideration Definitions and Input Functions
// =============================================================================

import type { EntityId } from '$lib/types/brand';
import type { ConsiderationDef, EvaluationContext, ActionLockStorage } from '$lib/types/iaus';
import type { EntityStorage } from '$lib/types/entity';
import type { TagStorage } from '$lib/types/tags';
import type { ArchetypeStorage } from '$lib/types/archetype';
import type { CharacterStateStorage } from '$lib/types/character';
import { CURVE_TYPE, CURVE_PRESET } from '$lib/types/iaus';
import { getHp, getMaxHp, getDejavuBonds, getRestState } from '$lib/core/character/storage';
import { getDirection } from '$lib/core/tags/accessors';

// =============================================================================
// SystemRefs Interface
// =============================================================================

/**
 * References to all game system storages.
 * Used by consideration input functions to access entity state.
 */
export interface SystemRefs {
  readonly entity: EntityStorage;
  readonly tags: TagStorage;
  readonly archetype: ArchetypeStorage;
  readonly character: CharacterStateStorage;
  readonly actionLock: ActionLockStorage;
}

// =============================================================================
// Consideration Input Function Type
// =============================================================================

/**
 * Function signature for consideration input retrieval.
 * Returns raw (unnormalized) values. Normalization is done by evaluator.
 */
export type ConsiderationInputFn = (
  actorId: EntityId,
  context: EvaluationContext,
  systems: SystemRefs
) => number;

// =============================================================================
// Input Functions (Internal)
// =============================================================================

/**
 * HP ratio input: hp / maxHp
 * Returns 1.0 if maxHp is 0 (uninitialized/safe fallback)
 */
function hpRatioInput(actorId: EntityId, _ctx: EvaluationContext, sys: SystemRefs): number {
  const hp = getHp(sys.character, actorId);
  const maxHp = getMaxHp(sys.character, actorId);
  return maxHp > 0 ? hp / maxHp : 1;
}

/**
 * DejavuBonds ratio input: bonds / 100
 */
function bondsRatioInput(actorId: EntityId, _ctx: EvaluationContext, sys: SystemRefs): number {
  return getDejavuBonds(sys.character, actorId) / 100;
}

/**
 * Tag match input (placeholder).
 * Always returns 0. Actual tag matching is done by evaluator
 * using calculateTagMatchScore directly.
 */
function tagMatchInput(_actorId: EntityId, _ctx: EvaluationContext, _sys: SystemRefs): number {
  return 0;
}

/**
 * Direction affinity input.
 * Returns the actor's direction tag value (0-3).
 * Evaluator compares this with Decision.direction for match scoring.
 */
function directionAffinityInput(
  actorId: EntityId,
  _ctx: EvaluationContext,
  sys: SystemRefs
): number {
  return getDirection(sys.tags, actorId);
}

/**
 * Situation match input.
 * Returns the current situation from context.
 * Evaluator compares this with Decision.situationTag for match scoring.
 */
function situationMatchInput(
  _actorId: EntityId,
  ctx: EvaluationContext,
  _sys: SystemRefs
): number {
  return ctx.currentSituation;
}

/**
 * Time of day input.
 * Returns game hour (0-23).
 */
function timeOfDayInput(_actorId: EntityId, ctx: EvaluationContext, _sys: SystemRefs): number {
  return ctx.gameHour;
}

/**
 * Rest need input.
 * Uses restState to estimate rest need:
 * ACTIVE(0) → 255 (maximum need)
 * FULL_REST(3) → 0 (no need)
 */
function restNeedInput(actorId: EntityId, _ctx: EvaluationContext, sys: SystemRefs): number {
  const restState = getRestState(sys.character, actorId);
  // REST_STATE: ACTIVE=0, LIGHT_REST=1, SLEEP=2, FULL_REST=3
  // Invert: ACTIVE→255, FULL_REST→0
  return (3 - restState) * 85;
}

// =============================================================================
// Input Registry (Internal)
// =============================================================================

/**
 * Internal registry mapping consideration IDs to input functions.
 * Not exported - use getConsiderationInput instead.
 */
const INPUT_REGISTRY: Readonly<Record<string, ConsiderationInputFn>> = {
  own_hp_ratio: hpRatioInput,
  own_hp_critical: hpRatioInput, // Same input, different curve
  own_bonds_ratio: bondsRatioInput,
  own_bonds_critical: bondsRatioInput, // Same input, different curve
  tag_match: tagMatchInput,
  direction_affinity: directionAffinityInput,
  situation_match: situationMatchInput,
  time_of_day: timeOfDayInput,
  rest_need: restNeedInput,
};

// =============================================================================
// getConsiderationInput
// =============================================================================

/**
 * Get raw input value for a consideration.
 *
 * Returns the raw (unnormalized) value from the input function registry.
 * If the consideration ID is not found, returns 0.
 *
 * @param considerationId - ID from ConsiderationDef.id
 * @param actorId - Entity performing the action
 * @param context - Current evaluation context
 * @param systems - References to game system storages
 * @returns Raw input value (to be normalized by evaluator)
 */
export function getConsiderationInput(
  considerationId: string,
  actorId: EntityId,
  context: EvaluationContext,
  systems: SystemRefs
): number {
  const fn = INPUT_REGISTRY[considerationId];
  if (!fn) return 0;
  return fn(actorId, context, systems);
}

// =============================================================================
// MVP Consideration Definitions
// =============================================================================

/**
 * Build the MVP considerations map.
 */
function buildConsiderationMap(): ReadonlyMap<string, ConsiderationDef> {
  const defs: ConsiderationDef[] = [
    {
      id: 'own_hp_ratio',
      name: 'HP Ratio',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_STANDARD,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'own_hp_critical',
      name: 'HP Critical',
      curveType: CURVE_TYPE.LOGISTIC,
      curveParams: CURVE_PRESET.CRITICAL_DETECTOR,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'own_bonds_ratio',
      name: 'Bonds Ratio',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_STANDARD,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'own_bonds_critical',
      name: 'Bonds Critical',
      curveType: CURVE_TYPE.LOGISTIC,
      curveParams: CURVE_PRESET.CRITICAL_DETECTOR,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'tag_match',
      name: 'Tag Match Score',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_HALF,
      inputMin: -500,
      inputMax: 500,
    },
    {
      id: 'direction_affinity',
      name: 'Direction Affinity',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_STANDARD,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'situation_match',
      name: 'Situation Match',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_STANDARD,
      inputMin: 0,
      inputMax: 1,
    },
    {
      id: 'time_of_day',
      name: 'Time of Day',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_STANDARD,
      inputMin: 0,
      inputMax: 23,
    },
    {
      id: 'rest_need',
      name: 'Rest Need',
      curveType: CURVE_TYPE.POLYNOMIAL,
      curveParams: CURVE_PRESET.LATE_WEIGHT,
      inputMin: 0,
      inputMax: 255,
    },
  ];

  const map = new Map<string, ConsiderationDef>();
  for (const def of defs) {
    map.set(def.id, def);
  }
  return map;
}

/**
 * MVP Consideration definitions.
 * Immutable map of all considerations available in MVP.
 */
export const MVP_CONSIDERATIONS: ReadonlyMap<string, ConsiderationDef> = buildConsiderationMap();
