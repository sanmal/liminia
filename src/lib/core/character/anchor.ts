import type { AnchorLevelType } from '$lib/types/character';
import { ANCHOR_LEVEL, ANCHOR_THRESHOLDS } from '$lib/types/character';
import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import { getDejavuBondsTotal } from './storage';

/**
 * Calculate Anchor level from cumulative dejavuBondsTotal.
 *
 * Master Index Anchor System v1:
 *   Level 0: 0-499     → No inheritance (permanent death for NPCs)
 *   Level 1: 500-1,499  → Occupation only
 *   Level 2: 1,500-3,499 → + Faith deity
 *   Level 3: 3,500-6,999 → + 3 main skills
 *   Level 4: 7,000+      → + 50% skill levels
 *
 * @param totalBonds - Cumulative dejavuBondsTotal
 * @returns AnchorLevelType (0-4)
 */
export function getAnchorLevel(totalBonds: number): AnchorLevelType {
  // ANCHOR_THRESHOLDS = [0, 500, 1500, 3500, 7000]
  // Check from highest threshold in reverse order
  for (let i = ANCHOR_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalBonds >= ANCHOR_THRESHOLDS[i]!) {
      return i as AnchorLevelType;
    }
  }
  return ANCHOR_LEVEL.LEVEL_0;
}

/**
 * Get entity Anchor level from storage.
 */
export function getEntityAnchorLevel(
  s: CharacterStateStorage,
  id: EntityId
): AnchorLevelType {
  return getAnchorLevel(getDejavuBondsTotal(s, id));
}

/**
 * Calculate remaining bonds needed for next Anchor level.
 *
 * @returns Remaining amount. Returns 0 for Level 4.
 */
export function bondsToNextAnchorLevel(totalBonds: number): number {
  const currentLevel = getAnchorLevel(totalBonds);
  if (currentLevel >= ANCHOR_LEVEL.LEVEL_4) return 0;

  const nextThreshold = ANCHOR_THRESHOLDS[currentLevel + 1];
  if (nextThreshold === undefined) return 0;

  return nextThreshold - totalBonds;
}

/**
 * Calculate NPC return days after death.
 *
 * Master Index: Base 7 days, reduced by Anchor level.
 *   Level 4: ~3 days
 * Linear interpolation: 7 - (level × 1)
 *
 * @returns Return days. Returns -1 for Level 0 (permanent death).
 */
export function calculateReturnDays(anchorLevel: AnchorLevelType): number {
  // Level 0: Permanent death (no return)
  if (anchorLevel === ANCHOR_LEVEL.LEVEL_0) return -1;

  // Level 1: 6 days, Level 2: 5 days, Level 3: 4 days, Level 4: 3 days
  // Match Master Index "Level 4: ~3 days"
  const baseDays = 7;
  const reductionPerLevel = 1;
  return Math.max(3, baseDays - anchorLevel * reductionPerLevel);
}

/**
 * Get list of inherited elements for Anchor level.
 *
 * Master Index:
 *   Level 0: None
 *   Level 1: Occupation only
 *   Level 2: + Faith deity
 *   Level 3: + 3 main skills
 *   Level 4: + 50% skill levels
 */
export function getInheritedElements(anchorLevel: AnchorLevelType): readonly string[] {
  switch (anchorLevel) {
    case ANCHOR_LEVEL.LEVEL_0:
      return [];
    case ANCHOR_LEVEL.LEVEL_1:
      return ['occupation'];
    case ANCHOR_LEVEL.LEVEL_2:
      return ['occupation', 'faith'];
    case ANCHOR_LEVEL.LEVEL_3:
      return ['occupation', 'faith', 'topSkills'];
    case ANCHOR_LEVEL.LEVEL_4:
      return ['occupation', 'faith', 'topSkills', 'skillLevels'];
    default:
      return [];
  }
}
