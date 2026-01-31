// =============================================================================
// Location Hierarchy Components
// =============================================================================

/**
 * Urban location components extracted from hierarchyData
 */
export interface UrbanComponents {
  /** City ID (0-31) */
  cityId: number;

  /** Expansion layer: 0=urban core, 1-15=outside walls */
  expLayer: number;

  /** Distance from center (0-7) */
  distance: number;

  /** Cardinal direction (0-7) */
  direction: number;

  /** Distance subdivision: 0=center-side, 1=edge-side */
  distSub: number;

  /** Direction subdivision: 0=clockwise, 1=counter-clockwise */
  dirSub: number;
}

/**
 * Building components extracted from hierarchyData
 */
export interface BuildingComponents {
  /** City ID (0-31) */
  cityId: number;

  /** Building type (0-7) */
  buildingType: BuildingType;

  /** Building ID within city (0-4095) */
  buildingId: number;

  /** Floor number (0-255, 0=ground) */
  floor: number;
}

// =============================================================================
// Building Type Enum
// =============================================================================

export const BUILDING_TYPE = {
  GENERAL: 0,
  COMMERCIAL: 1, // Shops
  LODGING: 2, // Inns
  RELIGIOUS: 3, // Temples
  ADMINISTRATIVE: 4,
  MILITARY: 5,
  GUILD: 6,
  RESIDENTIAL: 7,
} as const;

export type BuildingType = (typeof BUILDING_TYPE)[keyof typeof BUILDING_TYPE];

// =============================================================================
// Direction Constants
// =============================================================================

export const DIRECTION = {
  NORTH: 0,
  NORTHEAST: 1,
  EAST: 2,
  SOUTHEAST: 3,
  SOUTH: 4,
  SOUTHWEST: 5,
  WEST: 6,
  NORTHWEST: 7,
} as const;

export type DirectionType = (typeof DIRECTION)[keyof typeof DIRECTION];

// =============================================================================
// Bit Masks and Shifts (for runtime extraction)
// =============================================================================

export const HIERARCHY_BITS = {
  // City/Urban layout
  CITY_ID_SHIFT: 23,
  CITY_ID_MASK: 0x1f, // 5 bits

  EXP_LAYER_SHIFT: 19,
  EXP_LAYER_MASK: 0x0f, // 4 bits

  DISTANCE_SHIFT: 16,
  DISTANCE_MASK: 0x07, // 3 bits

  DIRECTION_SHIFT: 13,
  DIRECTION_MASK: 0x07, // 3 bits

  DIST_SUB_SHIFT: 12,
  DIST_SUB_MASK: 0x01, // 1 bit

  DIR_SUB_SHIFT: 11,
  DIR_SUB_MASK: 0x01, // 1 bit

  // Building layout
  BUILDING_TYPE_SHIFT: 20,
  BUILDING_TYPE_MASK: 0x07, // 3 bits

  BUILDING_ID_SHIFT: 8,
  BUILDING_ID_MASK: 0x0fff, // 12 bits

  FLOOR_SHIFT: 0,
  FLOOR_MASK: 0xff, // 8 bits
} as const;
