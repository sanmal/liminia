import type { ArchetypeDefinition, ArchetypeStorage } from '$lib/types/archetype';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import { registerArchetype } from './storage';

/**
 * MVP 32 archetype definitions.
 * Array index matches ARCHETYPE constant values.
 * (e.g., ARCHETYPE.GUARDIAN = 0 → ARCHETYPE_DEFINITIONS[0])
 */
export const ARCHETYPE_DEFINITIONS: readonly ArchetypeDefinition[] = [
  // ── Protectors (0-3): Order + Others ──────────────────
  {
    name: 'Guardian',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Sentinel',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Defender',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.JUSTICE,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Warden',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.JUSTICE,
    worldMark: WORLD_MARK.EAR,
  },

  // ── Leaders (4-7): Social + Extra ─────────────────────
  {
    name: 'Commander',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.POWER,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Diplomat',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.BELONGING,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Merchant',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.WEALTH,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Preacher',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.RECOGNITION,
    worldMark: WORLD_MARK.TEAR,
  },

  // ── Seekers (8-11): Knowledge + Cautious ──────────────
  {
    name: 'Scholar',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Investigator',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Sage',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.TEAR,
  },
  {
    name: 'Archivist',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EAR,
  },

  // ── Creators (12-15): Creation + Stable ───────────────
  {
    name: 'Artisan',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.SKIN,
  },
  {
    name: 'Builder',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Healer',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.TEAR,
  },
  {
    name: 'Cultivator',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.SKIN,
  },

  // ── Adventurers (16-19): Freedom + Bold ───────────────
  {
    name: 'Explorer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.EXTRA,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Pioneer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Nomad',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.EAR,
  },
  {
    name: 'Wanderer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BREATH,
  },

  // ── Warriors (20-23): Combat + Reactive ───────────────
  {
    name: 'Berserker',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.BOLD,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Duelist',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Hunter',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Veteran',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.BONE,
  },

  // ── Shadows (24-27): Stealth + Self ───────────────────
  {
    name: 'Assassin',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.POWER,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Thief',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.WEALTH,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Spy',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Trickster',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.CHAOS,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.SHADOW,
  },

  // ── Outcasts (28-31): Chaos + Survival ────────────────
  {
    name: 'Survivor',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.SKIN,
  },
  {
    name: 'Hermit',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.EAR,
  },
  {
    name: 'Rebel',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.BOLD,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Outcast',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.SHADOW,
  },
] as const;

/**
 * Register all 32 default archetypes to storage.
 * @returns Number of registered archetypes
 */
export function initializeDefaultArchetypes(storage: ArchetypeStorage): number {
  let count = 0;
  for (const def of ARCHETYPE_DEFINITIONS) {
    registerArchetype(storage, def);
    count++;
  }
  return count;
}
