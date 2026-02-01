---
paths:
  - "src/**/*.ts"
  - "src/**/*.svelte"
---

# Type Safety Rules

## Branded Types
- Function parameters receiving IDs must use branded types (EntityId, etc.)
- Create branded IDs only via constructor functions: `entityId()`, `archetypeId()`, `cityId()`
- Arithmetic strips the brand. Re-validate: `entityId(id + 1)`
- Type guards (`isValidEntityId()`) required at external data boundaries (IndexedDB load, import)

## Accessor Pattern
- TypedArray access via branded ID: use accessor functions in `src/core/entity-accessors.ts`
- `!` (non-null assertion) allowed ONLY inside accessor functions
- Regular array / Record / Map access: `!` forbidden. Handle `undefined`

## Enum Alternative
- TypeScript `enum` is prohibited (erasableSyntaxOnly)
- Pattern: `const CATEGORY = { ... } as const` + `type Category = (typeof CATEGORY)[keyof typeof CATEGORY]`

## Import Style
- Type-only: `import type { EntityId } from './brand.js'`
- Value: `import { entityId } from './brand.js'`
- Mixed type+value in single import statement: forbidden

## Key Files
- `src/types/brand.ts` — Brand helper, ID type definitions, constructors, type guards
- `src/core/entity-accessors.ts` — TypedArray accessor functions (! concentrated here)
- `src/core/entity-lifecycle.ts` — createEntity / destroyEntity (branded ID in/out)
- `src/core/entity-queries.ts` — Category checks, location queries (branded parameters)
