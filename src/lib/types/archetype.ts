import type { AxisTagType, DirectionTagType } from './tags';
import type { WorldMarkType } from './marks';
import type { ArchetypeId } from './brand';

// =============================================================================
// Archetype Storage (Separated Strategy)
// =============================================================================

export interface ArchetypeStorage {
  /** Archetype names for debugging */
  names: string[];

  /** Primary direction preference */
  directions: Uint8Array;

  /** Primary axis */
  primaryAxis: Uint8Array;

  /** Secondary axis */
  secondaryAxis: Uint8Array;

  /** Primary motivation */
  motivations: Uint8Array;

  /** Primary WorldMark affinity */
  worldMarks: Uint8Array;

  /** Next archetype ID */
  nextId: number;

  /** Maximum archetypes */
  capacity: number;
}

// =============================================================================
// Archetype Definition (for creation)
// =============================================================================

export interface ArchetypeDefinition {
  name: string;
  direction: DirectionTagType;
  primaryAxis: AxisTagType;
  secondaryAxis: AxisTagType;
  motivation: number; // MotivationTagType
  worldMark: WorldMarkType;
}

// =============================================================================
// Archetype Affinity Table
// =============================================================================

export interface ArchetypeAffinity {
  /** Source archetype ID */
  id: number;

  /** Base affinity scores to other archetypes (-128 to +127) */
  baseAffinities: Int8Array;

  /** Direction-specific score modifiers */
  directionBonus: Float32Array;

  /** Axis-specific score modifiers */
  axisBonuses: Float32Array;
}

// =============================================================================
// Archetype Query Result
// =============================================================================

export interface ArchetypeInfo {
  id: number;
  name: string;
  direction: DirectionTagType;
  primaryAxis: AxisTagType;
  secondaryAxis: AxisTagType;
  motivation: number;
  worldMark: WorldMarkType;
}

// =============================================================================
// Pre-defined Archetype IDs (MVP: 32 archetypes)
// =============================================================================

export const ARCHETYPE = {
  // Protectors (Order + Others)
  GUARDIAN: 0,
  SENTINEL: 1,
  DEFENDER: 2,
  WARDEN: 3,

  // Leaders (Social + Extra)
  COMMANDER: 4,
  DIPLOMAT: 5,
  MERCHANT: 6,
  PREACHER: 7,

  // Seekers (Knowledge + Cautious)
  SCHOLAR: 8,
  INVESTIGATOR: 9,
  SAGE: 10,
  ARCHIVIST: 11,

  // Creators (Creation + Stable)
  ARTISAN: 12,
  BUILDER: 13,
  HEALER: 14,
  CULTIVATOR: 15,

  // Adventurers (Freedom + Bold)
  EXPLORER: 16,
  PIONEER: 17,
  NOMAD: 18,
  WANDERER: 19,

  // Warriors (Combat + Reactive)
  BERSERKER: 20,
  DUELIST: 21,
  HUNTER: 22,
  VETERAN: 23,

  // Shadows (Stealth + Self)
  ASSASSIN: 24,
  THIEF: 25,
  SPY: 26,
  TRICKSTER: 27,

  // Outcasts (Chaos + Survival)
  SURVIVOR: 28,
  HERMIT: 29,
  REBEL: 30,
  OUTCAST: 31,
} as const;

/** Literal type for ARCHETYPE constant values (0-31) */
export type ArchetypeKey = (typeof ARCHETYPE)[keyof typeof ARCHETYPE];

// Re-export ArchetypeId branded type for convenience
export type { ArchetypeId } from './brand';
