// Storage & Accessors
export {
  createCharacterStateStorage,
  clearCharacterStateStorage,
  getHp,
  setHp,
  getMaxHp,
  setMaxHp,
  getDejavuBonds,
  setDejavuBonds,
  getDejavuBondsTotal,
  setDejavuBondsTotal,
  addDejavuBondsTotal,
  getLocationId,
  setLocationId,
  getRestState,
  setRestState,
  globalCharacterStateStorage,
} from './storage';

// HP System
export {
  HP_BASE_RECOVERY_RATE,
  REST_BONUS,
  getHpStage,
  getEntityHpStage,
  isDead,
  calculateHpRecovery,
  damageHp,
  healHp,
  applyHpRecovery,
  calculateMaxHp,
  initializeHp,
} from './hp';
export type { HpRecoveryContext, HpDamageResult } from './hp';

// DejavuBonds System
export {
  DEJAVU_BONDS_MAX,
  BONDS_RECOVERY_RATE,
  CHAOS_PASSIVE_DAMAGE_BASE,
  getDejavuStage,
  getEntityDejavuStage,
  isDejavuBondsVisible,
  calculateBondsRecovery,
  applyBondsRecovery,
  calculateChaosPassiveDamage,
  applyChaosAttackDamage,
  applyChaosPassiveDamage,
  damageBonds,
  healBonds,
} from './bonds';
export type { ChaosAttackResult } from './bonds';

// Anchor System
export {
  getAnchorLevel,
  getEntityAnchorLevel,
  bondsToNextAnchorLevel,
  calculateReturnDays,
  getInheritedElements,
} from './anchor';
