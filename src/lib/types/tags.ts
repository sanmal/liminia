// =============================================================================
// Tag Storage (Separated Strategy)
// =============================================================================

export interface TagStorage {
  /** Primary action direction */
  direction: Uint8Array;

  /** Primary personality axis */
  axis: Uint8Array;

  /** Secondary personality axis (optional, 0=none) */
  axis2: Uint8Array;

  /** Core motivation */
  motivation: Uint8Array;

  /** Primary WorldMark affinity */
  worldMark: Uint8Array;

  /** Secondary WorldMark (optional, 0=none) */
  worldMark2: Uint8Array;

  /** Situational effectiveness */
  situation: Uint8Array;
}

// =============================================================================
// Direction Tags
// =============================================================================

export const DIRECTION_TAG = {
  NONE: 0,
  ACTIVE: 1, // Combat, exploration
  PASSIVE: 2, // Crafting, research
  SOCIAL: 3, // Negotiation, leadership
} as const;

export type DirectionTagType =
  (typeof DIRECTION_TAG)[keyof typeof DIRECTION_TAG];

// =============================================================================
// Personality Axis Tags (5 axes × 2 poles = 10 values)
// =============================================================================

export const AXIS_TAG = {
  NONE: 0,

  // Order-Chaos axis
  ORDER: 1,
  CHAOS: 2,

  // Extraversion axis
  INTRO: 3,
  EXTRA: 4,

  // Stability axis
  STABLE: 5,
  REACTIVE: 6,

  // Approach axis
  CAUTIOUS: 7,
  BOLD: 8,

  // Focus axis
  SELF: 9,
  OTHERS: 10,
} as const;

export type AxisTagType = (typeof AXIS_TAG)[keyof typeof AXIS_TAG];

// =============================================================================
// Motivation Tags (12 types in 4 categories)
// =============================================================================

export const MOTIVATION_TAG = {
  NONE: 0,

  // Achievement
  MASTERY: 1,
  POWER: 2,
  WEALTH: 3,

  // Connection
  BELONGING: 4,
  RECOGNITION: 5,
  LOVE: 6,

  // Growth
  KNOWLEDGE: 7,
  CREATION: 8,
  FREEDOM: 9,

  // Preservation
  PROTECTION: 10,
  JUSTICE: 11,
  SURVIVAL: 12,
} as const;

export type MotivationTagType =
  (typeof MOTIVATION_TAG)[keyof typeof MOTIVATION_TAG];

// =============================================================================
// Situation Tags
// =============================================================================

export const SITUATION_TAG = {
  NONE: 0,
  DANGER: 1,
  PEACEFUL: 2,
  CHAOS_HIGH: 3,
  CHAOS_LOW: 4,
  CROWD: 5,
  QUIET: 6,
} as const;

export type SituationTagType =
  (typeof SITUATION_TAG)[keyof typeof SITUATION_TAG];
