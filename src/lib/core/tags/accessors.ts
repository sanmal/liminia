import type { TagStorage } from '$lib/types/tags';
import type { EntityId } from '$lib/types/brand';

// ─── Direction ───────────────────────────────────────

/** Get direction tag. EntityId brand guarantees valid index. */
export function getDirection(s: TagStorage, id: EntityId): number {
  return s.direction[id]!;
}

/** Set direction tag. */
export function setDirection(s: TagStorage, id: EntityId, value: number): void {
  s.direction[id] = value;
}

// ─── Axis (Primary) ─────────────────────────────────

/** Get primary axis tag. */
export function getAxis(s: TagStorage, id: EntityId): number {
  return s.axis[id]!;
}

/** Set primary axis tag. */
export function setAxis(s: TagStorage, id: EntityId, value: number): void {
  s.axis[id] = value;
}

// ─── Axis2 (Secondary) ──────────────────────────────

/** Get secondary axis tag. */
export function getAxis2(s: TagStorage, id: EntityId): number {
  return s.axis2[id]!;
}

/** Set secondary axis tag. */
export function setAxis2(s: TagStorage, id: EntityId, value: number): void {
  s.axis2[id] = value;
}

// ─── Motivation ─────────────────────────────────────

/** Get motivation tag. */
export function getMotivation(s: TagStorage, id: EntityId): number {
  return s.motivation[id]!;
}

/** Set motivation tag. */
export function setMotivation(s: TagStorage, id: EntityId, value: number): void {
  s.motivation[id] = value;
}

// ─── WorldMark (Primary) ────────────────────────────

/** Get primary worldMark tag. */
export function getWorldMark(s: TagStorage, id: EntityId): number {
  return s.worldMark[id]!;
}

/** Set primary worldMark tag. */
export function setWorldMark(s: TagStorage, id: EntityId, value: number): void {
  s.worldMark[id] = value;
}

// ─── WorldMark2 (Secondary) ─────────────────────────

/** Get secondary worldMark tag. */
export function getWorldMark2(s: TagStorage, id: EntityId): number {
  return s.worldMark2[id]!;
}

/** Set secondary worldMark tag. */
export function setWorldMark2(
  s: TagStorage,
  id: EntityId,
  value: number
): void {
  s.worldMark2[id] = value;
}

// ─── Situation ──────────────────────────────────────

/** Get situation tag. */
export function getSituation(s: TagStorage, id: EntityId): number {
  return s.situation[id]!;
}

/** Set situation tag. */
export function setSituation(s: TagStorage, id: EntityId, value: number): void {
  s.situation[id] = value;
}
