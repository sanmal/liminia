import type { EntityId, ArchetypeId } from './brand';
import type { WorldMarkType } from './marks';

// =============================================================================
// Character State Storage (Separated Strategy)
// =============================================================================

export interface CharacterStateStorage {
  /** Current HP values */
  hp: Uint16Array;

  /** Maximum HP values */
  maxHp: Uint16Array;

  /** DejavuBonds values (0-100) */
  dejavuBonds: Uint8Array;

  /** Accumulated dejavuBonds total for Anchor level */
  dejavuBondsTotal: Uint32Array;

  /** Current location entity ID */
  locationIds: Uint32Array;

  /** Recovery state (rest level) */
  restStates: Uint8Array;

  /** Assigned archetype IDs (0-63) */
  archetypeIds: Uint8Array;

  /** Capacity */
  capacity: number;
}

// =============================================================================
// HP Display Stages
// =============================================================================

export const HP_STAGE = {
  HEALTHY: 0, // 100% - Hidden
  LIGHT_INJURY: 1, // 75-99% - 軽傷
  INJURED: 2, // 50-74% - 負傷
  SERIOUS: 3, // 25-49% - 重傷
  CRITICAL: 4, // 1-24% - 瀕死
  DEAD: 5, // 0% - 死亡
} as const;

export type HpStageType = (typeof HP_STAGE)[keyof typeof HP_STAGE];

export const HP_STAGE_INFO: Record<
  HpStageType,
  { nameJa: string; threshold: number; recoveryCoeff: number }
> = {
  [HP_STAGE.HEALTHY]: { nameJa: '健康', threshold: 100, recoveryCoeff: 1.0 },
  [HP_STAGE.LIGHT_INJURY]: {
    nameJa: '軽傷',
    threshold: 75,
    recoveryCoeff: 1.0,
  },
  [HP_STAGE.INJURED]: { nameJa: '負傷', threshold: 50, recoveryCoeff: 0.75 },
  [HP_STAGE.SERIOUS]: { nameJa: '重傷', threshold: 25, recoveryCoeff: 0.5 },
  [HP_STAGE.CRITICAL]: { nameJa: '瀕死', threshold: 1, recoveryCoeff: 0.25 },
  [HP_STAGE.DEAD]: { nameJa: '死亡', threshold: 0, recoveryCoeff: 0 },
};

// =============================================================================
// DejavuBonds Display Stages
// =============================================================================

export const DEJAVU_STAGE = {
  FULL: 0, // 100 - Hidden
  ENRICHED: 1, // 90-99 - 充実
  GOOD: 2, // 80-89 - 良好
  STABLE: 3, // 70-79 - 安定
  MAINTAINED: 4, // 60-69 - 維持
  HALVED: 5, // 50-59 - 半減
  UNSTABLE: 6, // 40-49 - 不安定
  THIN: 7, // 30-39 - 希薄
  DANGER: 8, // 20-29 - 危険
  VANISHING: 9, // 1-19 - 消失寸前
  ISOLATED: 10, // 0 - 孤立
} as const;

export type DejavuStageType = (typeof DEJAVU_STAGE)[keyof typeof DEJAVU_STAGE];

// =============================================================================
// Rest States
// =============================================================================

export const REST_STATE = {
  ACTIVE: 0, // +0%
  LIGHT_REST: 1, // +15%
  SLEEP: 2, // +30%
  FULL_REST: 3, // +50%
} as const;

export type RestStateType = (typeof REST_STATE)[keyof typeof REST_STATE];

// =============================================================================
// Anchor Levels
// =============================================================================

export const ANCHOR_LEVEL = {
  LEVEL_0: 0, // 0-499: No inheritance (permanent death for NPCs)
  LEVEL_1: 1, // 500-1,499: Occupation only
  LEVEL_2: 2, // 1,500-3,499: + Faith deity
  LEVEL_3: 3, // 3,500-6,999: + 3 main skills
  LEVEL_4: 4, // 7,000+: + 50% skill levels
} as const;

export type AnchorLevelType = (typeof ANCHOR_LEVEL)[keyof typeof ANCHOR_LEVEL];

export const ANCHOR_THRESHOLDS: readonly number[] = [
  0, 500, 1500, 3500, 7000,
] as const;

// =============================================================================
// Soul Layer (Permanent traits)
// =============================================================================

export interface Soul {
  /** Primary WorldMark affinity */
  worldMark: WorldMarkType;

  /** Secondary WorldMark affinity (optional) */
  worldMark2: WorldMarkType;

  /** Base archetype */
  archetype: ArchetypeId;

  /** Core personality traits (immutable) */
  coreTraits: number; // Bitfield
}

// =============================================================================
// Vessel Layer (Semi-permanent: body, skills)
// =============================================================================

export interface Vessel {
  /** Base stats (STR, CON, DEX, INT, WIS, CHA) */
  stats: Uint8Array; // 6 values, 0-255

  /** Skill levels (indexed by skill ID) */
  skills: Uint8Array;

  /** HP coefficient type (based on WorldMark) */
  hpCoefficient: number; // 1.5 or 2.0
}

// =============================================================================
// CurrentLife Layer (Volatile: state, relationships)
// =============================================================================

export interface CurrentLife {
  /** Entity ID reference */
  entityId: EntityId;

  /** Display name */
  name: string;

  /** Current occupation */
  occupation: number;

  /** Faith deity ID */
  faithDeity: number;

  /** Current location */
  locationId: number;

  /** Relationship map (entity ID -> affinity) */
  relationships: Map<number, number>;
}

// =============================================================================
// Full Character (Combined layers)
// =============================================================================

export interface Character {
  soul: Soul;
  vessel: Vessel;
  currentLife: CurrentLife;
}
