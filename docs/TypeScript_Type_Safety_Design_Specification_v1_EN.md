#涯庭 #Liminia

Last updated: 2026-02-01

---

## Overview

Cross-cutting type safety specification for the Liminia codebase. Defines compiler flag policy, Branded Types architecture, and TypedArray accessor patterns that apply to **all core systems** (Entity ID, Unified Tags, Archetype, IAUS, Character).

This document governs TypeScript-level safety guarantees. It does not cover runtime validation logic (e.g., IndexedDB import/export schemas), which will be addressed separately when external data boundaries are implemented.

### Scope

| Layer | This Document | Other Documents |
|-------|--------------|-----------------|
| Compiler flags (tsconfig) | ✓ Defined here | - |
| Branded ID types | ✓ Defined here | Referenced by Entity ID v5, Archetype v2, Tag v2 |
| TypedArray accessor pattern | ✓ Defined here | Implemented per-system |
| Enum alternative pattern | ✓ Defined here | Applied in Entity ID v5 (CATEGORY), Tag v2, etc. |
| Runtime schema validation | - | Future: Import/Export spec |

### Design Goals

1. **Compile-time bug detection**: Catch ID confusion, index-out-of-range, and type misuse before runtime
2. **Zero runtime overhead**: All type safety mechanisms erase completely at transpile time
3. **Ecosystem alignment**: Follow TypeScript's trajectory (Types as Comments, Node.js type stripping)
4. **Minimal boilerplate**: Centralized patterns that each system imports, not per-file ceremony

---

## Compiler Flag Policy

### Required tsconfig.json Configuration

```jsonc
{
  "compilerOptions": {
    // --- Baseline strictness ---
    "strict": true,

    // --- Additional type safety (not included in strict) ---
    "noUncheckedIndexedAccess": true,

    // --- Erasable syntax enforcement ---
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,

    // --- Project baseline ---
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Flag Rationale

#### noUncheckedIndexedAccess

**Purpose**: Adds `| undefined` to all index signature and array index access return types.

**Why mandatory**: The Separated Strategy uses TypedArray index access as its fundamental operation. Without this flag, out-of-range access silently returns `undefined` typed as `number`.

```typescript
// WITHOUT flag (dangerous)
const cat = storage.categories[9999]; // type: number — actually undefined at runtime

// WITH flag (safe)
const cat = storage.categories[9999]; // type: number | undefined — forces handling
```

**Interaction with Branded Types**: The accessor function pattern (§ Accessor Pattern) concentrates `!` assertions into validated callsites, keeping general code safe.

**Note**: This flag is NOT included in `strict` and will NOT be auto-enabled when TypeScript 7 defaults `strict` to `true`. Explicit opt-in is required.

#### erasableSyntaxOnly

**Purpose**: Errors on TypeScript constructs that generate runtime code (enums, namespaces, parameter properties).

**Why mandatory**:
- Aligns with Node.js v23.6+ type-stripping execution model
- Aligns with TC39 "Types as Comments" proposal direction
- Eliminates enum IIFE overhead (minor but principled for 4GB target)
- Liminia already uses `as const` objects exclusively — zero migration cost

**Prohibited constructs**:

| Construct | Alternative |
|-----------|-------------|
| `enum Foo { ... }` | `const Foo = { ... } as const` + `type Foo = ...` |
| `namespace Foo { ... }` | ES module exports |
| `constructor(private x: T)` | Explicit field declaration + assignment |

#### verbatimModuleSyntax

**Purpose**: Enforces explicit `import type` / `export type` syntax. Prevents implicit import elision.

**Why mandatory**: Recommended companion to `erasableSyntaxOnly`. Ensures import/export statements are unambiguous for type-stripping tools.

```typescript
// Required style
import type { EntityId } from './brand.js';
import { entityId } from './brand.js';

// Error under verbatimModuleSyntax
import { EntityId, entityId } from './brand.js';
// (EntityId is type-only but imported as value — ambiguous)
```

---

## Branded Types

### Core Type Helper

```typescript
// src/types/brand.ts

declare const __brand: unique symbol;

/**
 * Branded type helper.
 * Creates a nominal type from a structural base type.
 * Runtime cost: zero (erased at transpile time).
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };
```

**Design choice: `unique symbol` over template literal string**

The `unique symbol` approach prevents accidental brand collision structurally, without relying on naming conventions. Since the symbol is module-scoped and never exported, external code cannot forge branded values via `as` cast (by convention — TypeScript cannot fully enforce this).

Template literal approach (`{ readonly __brand: B }`) is acceptable and produces equivalent safety when naming is managed consistently. The `unique symbol` approach is chosen for Liminia as a stronger default given the project's emphasis on safety at the type level.

### ID Type Definitions

```typescript
// src/types/brand.ts (continued)

// --- Entity system IDs ---
export type EntityId = Brand<number, 'EntityId'>;
export type ArchetypeId = Brand<number, 'ArchetypeId'>;
export type CityId = Brand<number, 'CityId'>;

// --- Future IDs (define as needed) ---
// export type QuestId = Brand<number, 'QuestId'>;
// export type FactionId = Brand<number, 'FactionId'>;
```

### Constructor Functions

Each branded ID type has exactly one constructor function that serves as the sole legal creation point. All validation is concentrated here.

```typescript
// src/types/brand.ts (continued)

const SMI_MAX = 0x3FFFFFFF; // 2^30 - 1 (V8 Smi upper bound)

/**
 * Create a validated EntityId.
 * Guarantees: integer, non-negative, within Smi range.
 */
export function entityId(n: number): EntityId {
  if (!Number.isInteger(n) || n < 0 || n > SMI_MAX) {
    throw new RangeError(`Invalid EntityId: ${n}`);
  }
  return n as EntityId;
}

/**
 * Create a validated ArchetypeId.
 * Guarantees: integer, 0-63 range (64 archetypes max in v2).
 */
export function archetypeId(n: number): ArchetypeId {
  if (!Number.isInteger(n) || n < 0 || n > 63) {
    throw new RangeError(`Invalid ArchetypeId: ${n}`);
  }
  return n as ArchetypeId;
}

/**
 * Create a validated CityId.
 * Guarantees: integer, 0-31 range (5-bit city ID in hierarchy data).
 */
export function cityId(n: number): CityId {
  if (!Number.isInteger(n) || n < 0 || n > 31) {
    throw new RangeError(`Invalid CityId: ${n}`);
  }
  return n as CityId;
}
```

### Type Guard Functions

For external data boundaries (IndexedDB load, future import/export):

```typescript
// src/types/brand.ts (continued)

export function isValidEntityId(value: unknown): value is EntityId {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= SMI_MAX;
}

export function isValidArchetypeId(value: unknown): value is ArchetypeId {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 63;
}
```

### Arithmetic Behavior

Branded types lose their brand through arithmetic operations. This is by design — the result of `EntityId + 1` is not a valid EntityId without re-validation.

```typescript
const id = entityId(5);
const next = id + 1;       // type: number (brand lost)
const nextId = entityId(next); // re-validated and re-branded
```

---

## Accessor Pattern

### Problem

`noUncheckedIndexedAccess` makes every TypedArray index access return `T | undefined`. In the Separated Strategy, index access is the core operation and entity IDs are pre-validated by Branded Type constructors.

### Solution: Typed Accessor Functions

Concentrate `!` (non-null assertion) into a thin accessor layer. The assertion is safe because:
1. The `EntityId` brand guarantees the value passed validation (integer, non-negative, within Smi range)
2. The accessor can optionally add alive-check logic

```typescript
// src/core/entity-accessors.ts

import type { EntityId } from '../types/brand.js';
import type { EntityStorage } from './entity-storage.js';

/**
 * Get entity category. Requires valid EntityId (brand-guaranteed).
 * Non-null assertion is safe: EntityId constructor validates range.
 */
export function getCategory(s: EntityStorage, id: EntityId): number {
  return s.categories[id]!;
}

export function getHierarchyData(s: EntityStorage, id: EntityId): number {
  return s.hierarchyData[id]!;
}

export function isAlive(s: EntityStorage, id: EntityId): boolean {
  return s.alive[id]! === 1;
}

export function getGeneration(s: EntityStorage, id: EntityId): number {
  return s.generations[id]!;
}
```

### When NOT to Use Non-null Assertion

General array access (non-TypedArray, non-branded-index) must handle `undefined`:

```typescript
// General arrays: undefined check is REQUIRED (this is the value of the flag)
function getFirstNpc(npcs: EntityId[]): EntityId | undefined {
  return npcs[0]; // EntityId | undefined — correct, must be handled by caller
}

// Record/Map access: undefined check is REQUIRED
const nameMap: Record<string, string> = {};
const name = nameMap['unknown_key']; // string | undefined — correct
```

### Pattern Summary

| Access Type | `!` Allowed? | Rationale |
|-------------|-------------|-----------|
| TypedArray via branded EntityId | ✓ In accessor only | Brand guarantees valid index |
| TypedArray via raw number | ✗ | No validation guarantee |
| Regular array `arr[i]` | ✗ | Length not statically known |
| Record/Map `obj[key]` | ✗ | Key existence not guaranteed |

---

## Enum Alternative Pattern

`erasableSyntaxOnly` prohibits TypeScript enums. All enumerated constants use the `as const` object pattern:

```typescript
// Pattern: const object + derived type
export const CATEGORY = {
  NONE: 0,
  PC: 1,
  NPC: 2,
  HOSTILE_BEAST: 3,
  // ...
} as const;

export type Category = (typeof CATEGORY)[keyof typeof CATEGORY];
// Resolves to: 0 | 1 | 2 | 3 | ...
```

**Advantages over enum**:
- No IIFE generated (better tree-shaking, smaller bundle)
- V8 can inline constant values directly
- Compatible with type-stripping (Node.js, future browsers)
- Works identically with `===` checks and `switch` statements

**Existing usage**: Entity ID v5 `CATEGORY` definition already follows this pattern. No migration needed.

---

## Integration with Core Systems

### Affected Systems and Changes

| System | Current (v5/v2) | With Type Safety v1 |
|--------|----------------|---------------------|
| Entity ID v5 | `id: number` parameters | `id: EntityId` parameters |
| Unified Tag v2 | Direct array access | Via accessor functions |
| Archetype v2 | `id: number` for archetype | `id: ArchetypeId` parameter |
| IAUS v1 | Entity references as number | `EntityId` in decision cache |
| Character v6 | HP/dejavuBonds array access | Via accessor functions |

### Entity ID v5 Impact Example

```typescript
// BEFORE (current Entity ID v5 spec)
export function isCharacter(id: number): boolean {
  const cat = storage.categories[id];
  return cat >= 1 && cat <= 9;
}

// AFTER (with Type Safety v1 applied)
export function isCharacter(s: EntityStorage, id: EntityId): boolean {
  const cat = getCategory(s, id);
  return cat >= 1 && cat <= 9;
}
```

### Entity Lifecycle with Branded Types

```typescript
// Entity creation returns branded EntityId
export function createEntity(
  s: EntityStorage,
  category: Category,
  hierarchyData: number = 0
): EntityId {
  let id: number;

  if (s.freeList.length > 0) {
    id = s.freeList.pop()!;  // ! safe: length check above
  } else {
    if (s.nextId >= s.capacity) {
      throw new Error('Entity storage full');
    }
    id = s.nextId++;
  }

  s.categories[id] = category;
  s.hierarchyData[id] = hierarchyData;
  s.alive[id] = 1;

  return entityId(id);  // Branded on return
}

// Entity destruction accepts branded EntityId
export function destroyEntity(s: EntityStorage, id: EntityId): void {
  s.alive[id] = 0;
  s.generations[id]!++;  // Accessor pattern applies
  s.freeList.push(id);   // EntityId is assignable to number (safe widening)
}
```

### IndexedDB Load Boundary

When loading from external storage, raw numbers must pass through type guards before becoming branded:

```typescript
export async function loadAllEntities(s: EntityStorage): Promise<void> {
  const records = await db.entities.toArray();

  s.freeList = [];
  s.nextId = 0;
  s.alive.fill(0);

  let maxId = -1;

  for (const record of records) {
    // Validation boundary: raw DB data → branded type
    if (!isValidEntityId(record.id)) {
      console.warn(`Skipping invalid entity ID: ${record.id}`);
      continue;
    }

    const id = record.id; // Now typed as EntityId via type guard narrowing
    maxId = Math.max(maxId, id);

    s.categories[id] = record.category;
    s.hierarchyData[id] = record.hierarchyData;
    s.generations[id] = record.generation;
    s.alive[id] = 1;
  }

  s.nextId = maxId + 1;

  for (let i = 0; i < s.nextId; i++) {
    if (!s.alive[i]) {
      s.freeList.push(i);
    }
  }
}
```

---

## File Structure

```
src/
├── types/
│   └── brand.ts          // Brand helper, ID types, constructors, type guards
├── core/
│   ├── entity-storage.ts // EntityStorage interface, createEntityStorage
│   ├── entity-accessors.ts // Typed accessor functions (! concentrated here)
│   ├── entity-lifecycle.ts // createEntity, destroyEntity (returns/accepts branded IDs)
│   └── entity-queries.ts  // Category checks, location queries (branded parameters)
└── ...
```

---

## Decisions Not Taken

| Decision | Status | Rationale |
|----------|--------|-----------|
| `isolatedDeclarations` flag | **Deferred to Phase 2+** | Benefit is for monorepo/library builds. Single PWA project gains little. TypeScript 7 Go rewrite addresses build speed. |
| Validation library (Zod, Valibot, Typia) | **Not adopted** | Current validation needs are integer range checks only. ~15 lines of self-contained code. Reassess when import/export schemas exceed 10 types. |
| Flavor types (permissive branding) | **Not adopted** | MVP stage with minimal existing code. Brand (strict) is preferable — no legacy migration cost. |

---

## Implementation Priority

| Priority | Item | Phase |
|----------|------|-------|
| 1 | `brand.ts` — Brand helper + EntityId/ArchetypeId/CityId | MVP |
| 2 | tsconfig.json flag updates | MVP |
| 3 | `entity-accessors.ts` — Accessor function layer | MVP |
| 4 | Entity ID v5 code examples updated to use branded types | MVP |
| 5 | Tag v2 / Archetype v2 accessor integration | MVP |
| 6 | IAUS decision cache typed with EntityId | MVP |
| 7 | Reassess `isolatedDeclarations` | Phase 2 |
| 8 | Reassess validation library need | Phase 2 (import/export) |

---

## Document References

| Document | Relationship |
|----------|-------------|
| Entity ID Specification v5 | Consumes EntityId branded type. Code to be updated. |
| Unified Tag System v2 | Consumes EntityId for tag lookups. |
| Archetype System v2 | Consumes ArchetypeId branded type. |
| IAUS Implementation v1.0 | Consumes EntityId in decision cache. |
| Character Template v6 | Consumes EntityId for HP/dejavuBonds access. |
| Master Index v5.5 | References this document in Tech Stack and Document References. |

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| **v1.0** | **2026-02-01** | **Initial specification. Branded Types (Brand strict, unique symbol), compiler flags (noUncheckedIndexedAccess, erasableSyntaxOnly, verbatimModuleSyntax), accessor pattern, enum alternative pattern, integration guide.** |

---

Last updated: 2026-02-01
