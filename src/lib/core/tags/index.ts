// Storage
export { createTagStorage, clearTagStorage, globalTagStorage } from './storage';

// Accessors
export {
  getDirection,
  setDirection,
  getAxis,
  setAxis,
  getAxis2,
  setAxis2,
  getMotivation,
  setMotivation,
  getWorldMark,
  setWorldMark,
  getWorldMark2,
  setWorldMark2,
  getSituation,
  setSituation,
} from './accessors';

// Operations
export type { TagOptions } from './operations';
export { setEntityTags, clearEntityTags, copyEntityTags } from './operations';

// Queries
export {
  getEntitiesByDirection,
  getEntitiesByWorldMark,
  getEntitiesByMotivation,
  getEntitiesByAxis,
  getEntitiesBySituation,
  calculateTagMatchScore,
} from './queries';
