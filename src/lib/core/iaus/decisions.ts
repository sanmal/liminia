// =============================================================================
// IAUS MVP Decision Definitions
// =============================================================================

import type { DecisionDef } from '$lib/types/iaus';

/**
 * MVP Decision definitions (19 decisions).
 * Array index matches decision.id for direct access.
 */
export const DECISIONS: readonly DecisionDef[] = [
  // ─── 基本生存 (0-2) ───────────────────────────────────
  {
    id: 0,
    name: 'rest',
    direction: 1, // PASSIVE
    worldMark: 0, // BONE
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'rest_need'],
    weight: 1.0,
    baseDurationTicks: 16,
    durationVariance: 0.2,
  },

  {
    id: 1,
    name: 'eat',
    direction: 1, // PASSIVE
    worldMark: 0, // BONE
    situationTag: 2, // PEACEFUL
    considerationIds: ['time_of_day'],
    weight: 1.0,
    baseDurationTicks: 16,
    durationVariance: 0.3,
  },

  {
    id: 2,
    name: 'sleep',
    direction: 1, // PASSIVE
    worldMark: 0, // BONE
    situationTag: 2, // PEACEFUL
    considerationIds: ['rest_need', 'time_of_day'],
    weight: 1.2,
    baseDurationTicks: 200,
    durationVariance: 0.15,
  },

  // ─── 労働 (3-6) ───────────────────────────────────────
  {
    id: 3,
    name: 'work_craft',
    direction: 0, // ACTIVE
    worldMark: 8, // SKIN
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 1.0,
    baseDurationTicks: 32,
    durationVariance: 0.25,
  },

  {
    id: 4,
    name: 'work_trade',
    direction: 3, // SOCIAL
    worldMark: 3, // BREATH
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 1.0,
    baseDurationTicks: 24,
    durationVariance: 0.25,
  },

  {
    id: 5,
    name: 'work_guard',
    direction: 0, // ACTIVE
    worldMark: 0, // BONE
    situationTag: 0, // NONE (both peaceful and danger)
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity', 'situation_match'],
    weight: 1.0,
    baseDurationTicks: 48,
    durationVariance: 0.2,
  },

  {
    id: 6,
    name: 'work_farm',
    direction: 0, // ACTIVE
    worldMark: 8, // SKIN
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity', 'time_of_day'],
    weight: 1.0,
    baseDurationTicks: 32,
    durationVariance: 0.2,
  },

  // ─── 社交 (7-8) ───────────────────────────────────────
  {
    id: 7,
    name: 'talk',
    direction: 3, // SOCIAL
    worldMark: 3, // BREATH
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'direction_affinity', 'rest_need'],
    weight: 0.9,
    baseDurationTicks: 8,
    durationVariance: 0.3,
  },

  {
    id: 8,
    name: 'greet',
    direction: 3, // SOCIAL
    worldMark: 3, // BREATH
    situationTag: 2, // PEACEFUL
    considerationIds: ['direction_affinity', 'time_of_day'],
    weight: 0.7,
    baseDurationTicks: 4,
    durationVariance: 0.2,
  },

  // ─── 移動 (9-10) ──────────────────────────────────────
  {
    id: 9,
    name: 'travel',
    direction: 0, // ACTIVE
    worldMark: 2, // BLOOD
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'own_bonds_ratio'],
    weight: 0.8,
    baseDurationTicks: 32,
    durationVariance: 0.3,
  },

  {
    id: 10,
    name: 'wander',
    direction: 0, // ACTIVE
    worldMark: 2, // BLOOD
    situationTag: 2, // PEACEFUL
    considerationIds: ['rest_need', 'direction_affinity'],
    weight: 0.5,
    baseDurationTicks: 16,
    durationVariance: 0.4,
  },

  // ─── 戦闘 (11-13) ─────────────────────────────────────
  {
    id: 11,
    name: 'attack',
    direction: 0, // ACTIVE
    worldMark: 2, // BLOOD
    situationTag: 1, // DANGER
    considerationIds: ['own_hp_ratio', 'own_hp_critical', 'direction_affinity', 'situation_match'],
    weight: 1.1,
    baseDurationTicks: 8,
    durationVariance: 0.3,
  },

  {
    id: 12,
    name: 'defend',
    direction: 1, // PASSIVE
    worldMark: 1, // BONE
    situationTag: 1, // DANGER
    considerationIds: ['own_hp_critical', 'situation_match', 'direction_affinity'],
    weight: 1.0,
    baseDurationTicks: 8,
    durationVariance: 0.2,
  },

  {
    id: 13,
    name: 'flee',
    direction: 0, // ACTIVE
    worldMark: 6, // SHADOW
    situationTag: 1, // DANGER
    considerationIds: ['own_hp_critical', 'own_bonds_critical', 'situation_match'],
    weight: 1.3,
    baseDurationTicks: 8,
    durationVariance: 0.3,
  },

  // ─── 回復 (14-15) ─────────────────────────────────────
  {
    id: 14,
    name: 'heal_self',
    direction: 1, // PASSIVE
    worldMark: 4, // TEAR
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'own_hp_critical', 'tag_match'],
    weight: 1.1,
    baseDurationTicks: 16,
    durationVariance: 0.2,
  },

  {
    id: 15,
    name: 'wait',
    direction: 1, // PASSIVE
    worldMark: 0, // NONE
    situationTag: 2, // PEACEFUL
    considerationIds: ['rest_need'],
    weight: 0.3,
    baseDurationTicks: 8,
    durationVariance: 0.5,
  },

  // ─── 信仰 (16) ────────────────────────────────────────
  {
    id: 16,
    name: 'pray',
    direction: 1, // PASSIVE
    worldMark: 4, // TEAR
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_bonds_ratio', 'tag_match', 'time_of_day'],
    weight: 0.8,
    baseDurationTicks: 16,
    durationVariance: 0.3,
  },

  // ─── 探索 (17-18) ─────────────────────────────────────
  {
    id: 17,
    name: 'explore',
    direction: 0, // ACTIVE
    worldMark: 5, // EYE
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'own_bonds_ratio', 'direction_affinity', 'tag_match'],
    weight: 0.9,
    baseDurationTicks: 32,
    durationVariance: 0.3,
  },

  {
    id: 18,
    name: 'investigate',
    direction: 0, // ACTIVE
    worldMark: 5, // EYE
    situationTag: 2, // PEACEFUL
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 0.8,
    baseDurationTicks: 24,
    durationVariance: 0.25,
  },
] as const satisfies readonly DecisionDef[];
