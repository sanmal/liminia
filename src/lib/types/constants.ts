// =============================================================================
// System Constants
// =============================================================================

export const MAX_ENTITIES = 2000;
export const MAX_ARCHETYPES = 64;

// V8 Smi safe range: -2³⁰ to 2³⁰-1
export const SMI_MAX = 1073741823;

// =============================================================================
// Flat Category Definitions
// =============================================================================

export const CATEGORY = {
  NONE: 0,

  // Characters (1-9)
  PC: 1,
  NPC: 2,
  HOSTILE_BEAST: 3,
  HOSTILE_CHAOS: 4,
  HOSTILE_UNDEAD: 5,
  HOSTILE_DEMON: 6,

  // Locations (10-29)
  LOCATION_CITY: 10,
  LOCATION_URBAN: 11,
  LOCATION_BUILDING: 12,
  LOCATION_DUNGEON: 13,
  LOCATION_WILD: 14,
  LOCATION_CHAOS: 15,
  LOCATION_GROUND: 16,

  // Factions (30-39)
  FACTION_GUILD: 30,
  FACTION_TEMPLE: 31,
  FACTION_NATION: 32,
  FACTION_MERCHANT: 33,
  FACTION_CRIMINAL: 34,

  // Instances (40-49)
  QUEST: 40,
  EVENT: 41,
  WORLDLINE: 42,

  // System
  SYSTEM: 255,
} as const;

export type CategoryType = (typeof CATEGORY)[keyof typeof CATEGORY];

// Category range constants for group checks
export const CATEGORY_RANGE = {
  CHARACTER: { min: 1, max: 9 },
  HOSTILE: { min: 3, max: 6 },
  LOCATION: { min: 10, max: 29 },
  FACTION: { min: 30, max: 39 },
  INSTANCE: { min: 40, max: 49 },
} as const;
