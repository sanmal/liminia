import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import { MAX_ENTITIES } from '$lib/types/constants';

// ─── Storage Creation ──────────────────────────────────────

/**
 * Create a new CharacterStateStorage instance.
 * @param capacity - Maximum number of entities (default: MAX_ENTITIES)
 */
export function createCharacterStateStorage(
  capacity: number = MAX_ENTITIES
): CharacterStateStorage {
  return {
    hp: new Uint16Array(capacity),
    maxHp: new Uint16Array(capacity),
    dejavuBonds: new Uint8Array(capacity),
    dejavuBondsTotal: new Uint32Array(capacity),
    locationIds: new Uint32Array(capacity),
    restStates: new Uint8Array(capacity),
    archetypeIds: new Uint8Array(capacity),
    capacity,
  };
}

/**
 * Clear CharacterStateStorage (reset all fields to 0).
 */
export function clearCharacterStateStorage(s: CharacterStateStorage): void {
  s.hp.fill(0);
  s.maxHp.fill(0);
  s.dejavuBonds.fill(0);
  s.dejavuBondsTotal.fill(0);
  s.locationIds.fill(0);
  s.restStates.fill(0);
  s.archetypeIds.fill(0);
}

// ─── HP Accessors ─────────────────────────────────────

/** Get current HP. */
export function getHp(s: CharacterStateStorage, id: EntityId): number {
  return s.hp[id]!;
}

/** Set current HP. */
export function setHp(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.hp[id] = value;
}

/** Get maximum HP. */
export function getMaxHp(s: CharacterStateStorage, id: EntityId): number {
  return s.maxHp[id]!;
}

/** Set maximum HP. */
export function setMaxHp(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.maxHp[id] = value;
}

// ─── DejavuBonds Accessors ────────────────────────────

/** Get current dejavuBonds. */
export function getDejavuBonds(s: CharacterStateStorage, id: EntityId): number {
  return s.dejavuBonds[id]!;
}

/** Set current dejavuBonds (clamped to 0-100). */
export function setDejavuBonds(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.dejavuBonds[id] = Math.max(0, Math.min(100, value));
}

/** Get accumulated dejavuBondsTotal. */
export function getDejavuBondsTotal(s: CharacterStateStorage, id: EntityId): number {
  return s.dejavuBondsTotal[id]!;
}

/** Set accumulated dejavuBondsTotal. */
export function setDejavuBondsTotal(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.dejavuBondsTotal[id] = value;
}

/**
 * Add to accumulated dejavuBondsTotal.
 * dejavuBondsTotal never decreases (cumulative counter).
 */
export function addDejavuBondsTotal(s: CharacterStateStorage, id: EntityId, amount: number): void {
  s.dejavuBondsTotal[id] = (s.dejavuBondsTotal[id]! + Math.max(0, amount)) >>> 0;
}

// ─── Location Accessors ──────────────────────────────

/** Get current location EntityId. */
export function getLocationId(s: CharacterStateStorage, id: EntityId): number {
  return s.locationIds[id]!;
}

/** Set current location EntityId. */
export function setLocationId(s: CharacterStateStorage, id: EntityId, locationId: number): void {
  s.locationIds[id] = locationId;
}

// ─── Rest State Accessors ─────────────────────────────

/** Get rest state. */
export function getRestState(s: CharacterStateStorage, id: EntityId): number {
  return s.restStates[id]!;
}

/** Set rest state. */
export function setRestState(s: CharacterStateStorage, id: EntityId, state: number): void {
  s.restStates[id] = state;
}

// ─── Archetype Accessors ──────────────────────────────

/** Get assigned archetype ID. */
export function getArchetypeId(s: CharacterStateStorage, id: EntityId): number {
  return s.archetypeIds[id]!;
}

/** Set assigned archetype ID (0-63). */
export function setArchetypeId(s: CharacterStateStorage, id: EntityId, archetypeId: number): void {
  s.archetypeIds[id] = Math.max(0, Math.min(63, archetypeId));
}

// ─── Global Instance ──────────────────────────────────

/** Global CharacterStateStorage instance. */
export const globalCharacterStateStorage: CharacterStateStorage = createCharacterStateStorage();
