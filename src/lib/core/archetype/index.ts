// Storage
export {
  createArchetypeStorage,
  clearArchetypeStorage,
  registerArchetype,
  getArchetypeInfo,
  getArchetypeByName,
  getArchetypeCount,
  globalArchetypeStorage,
} from './storage';

// Definitions
export { ARCHETYPE_DEFINITIONS, initializeDefaultArchetypes } from './definitions';

// Affinity
export {
  computeArchetypeCompatibility,
  computeEntityArchetypeAffinity,
  areOppositeAxes,
  sameMotivationCategory,
} from './affinity';
