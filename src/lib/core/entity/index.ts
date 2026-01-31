// Storage
export { createEntityStorage, clearStorage, globalStorage } from './storage';

// Lifecycle
export { createEntity, destroyEntity, isAlive, getActiveCount } from './lifecycle';

// Queries
export {
  getEntitiesByCategory,
  getEntitiesInRange,
  getAllCharacters,
  getAllHostiles,
  getAllLocations,
  getAllPCs,
  getAllNPCs,
  getEntityInfo,
  isCharacter,
  isHostile,
  isLocation,
  isFaction,
  isPC,
  isNPC,
} from './queries';

// Validation
export { isValidHandle, resolveHandle, getHandle } from './validation';
