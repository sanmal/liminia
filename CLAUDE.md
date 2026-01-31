# Liminia (涯庭) - Project Context

## Document Access via MCP

Detailed specifications are available through MCP filesystem server connected to Obsidian vault:
- Path: `~/Obsidian/obsidian/Liminia/`
- When implementation details are needed, read the relevant spec file via MCP

### Obsidian Folder Structure

```
Liminia/
├── 00_Index/              → Navigation, Master Index
├── 0_Currently_Working/   → Active work in progress
├── 10_Core_Specs/         → High-frequency: Entity ID, Character Template, Performance
├── 20_System_Design/      → Medium-frequency: IAUS, Dialogue, Storage
├── 30_World_Building/     → World lore: Gods, Chaos, Locations
├── 40_Character/          → Character design, templates
├── 50_Platform_Ops/       → PWA, Deployment
├── 60_Business/           → Monetization
├── 70_Ideas/              → Unconfirmed ideas
├── 80_Archive/            → Old versions
└── 99_Templates/          → Document templates
```

### File Naming Convention

- **アラビア数字で始まるファイル**: 採用済みの仕様定義（例: `10_Core_Specs/Entity_ID_v5_*.md`）
- **アラビア数字以外で始まるファイル**: 採用検討中のアイデア

### When to Fetch Specs via MCP

| Situation | Action |
|-----------|--------|
| Implementing Entity ID operations | Read `10_Core_Specs/Entity_ID_v5_*.md` |
| Character system work | Read `10_Core_Specs/Character_Template_v6_*.md` |
| IAUS decision logic | Read `20_System_Design/IAUS_*.md` |
| Platform-specific code | Read `50_Platform_Ops/PWA_*.md` |

---

## Master Index (v5.5)

### Game Title

| Market | Title | Reading | URL |
|--------|-------|---------|-----|
| Japan | 涯庭 | はてにわ (hateniwa) | liminia.net |
| Chinese | 涯庭 | yátíng | liminia.net |
| Global | Liminia | /lɪˈmɪniə/ | liminia.net |

**Etymology**:
- 涯庭: 涯（boundary/edge）+ 庭（garden）= "Garden at the Edge"
- Liminia: from Latin "limen" (threshold) → liminal (transitional/boundary)

---

### Overview

Liminia is a text-based idle RPG with autonomous NPC simulation. Players act as the "God of Time and Fate" overseeing 3 player characters (PCs) who share resources while maintaining individual personalities, skills, and faith systems. The game targets entry-level smartphones (4GB RAM minimum) and supports 100+ named NPCs with PC-equivalent depth.

---

### Core Design Principles (Priority Order)

#### 1. Accessibility-First (Top Priority)

> **The world of Liminia must be fully enjoyable through screen reader and haptic feedback alone.**

| Principle | Constraint | Rationale |
|-----------|------------|-----------|
| Max 50 characters per info unit | Comprehensible in single read-aloud | Screen reader cognitive load |
| Max 3 tap depth levels | Return to Level 0 in 3 taps | Hierarchy cognition limit |
| Max 30 seconds per screen read | Total 15 Atoms across all Zones | Measured verification |
| Max 4 actions limit | No-scroll display in Zone 3 | Choice cognition limit |

**WAI-ARIA 1.2 + WCAG 2.2 AA compliance is mandatory.**

#### 2. Mobile-First Philosophy

> **Mobile version is "complete", not "limited". PC version is "efficiency-enhanced".**

#### 3. BYOE (Bring Your Own Environment)

> **"Imagination is the best GPU ever!"**

Text-only simulation. Visuals, BGM omitted — like a TRPG session.

#### 4. Performance by Design

> **Speed is not a side effect, but something that must be designed.**

- **Separated Strategy**: Sequential IDs + attribute arrays
- **V8 Smi Optimization**: All IDs within Smi range (≤2³⁰-1)
- **TypedArray + SoA**: Structure of Arrays for data density

---

### Tech Stack

- **Frontend**: Svelte 5 + TypeScript + Dexie.js (IndexedDB)
- **Runtime**: PWA with iOS 7-day rule mitigation
- **Development**: Bun, Vite, ES2022 target
- **Data Structure**: Separated Strategy (Sequential ID + TypedArray)
- **AI System**: IAUS (Infinite Axis Utility System)

---

### Core Systems Architecture

All systems follow **Separated Strategy** pattern:

```
Sequential ID + Attribute Arrays + Map (metadata)
```

#### Memory Budget (2000 entities / 64 archetypes)

| System | Size |
|--------|------|
| Entity ID | 16KB |
| Unified Tags | 14KB |
| Archetype | ~2.4KB |
| IAUS | ~19KB |
| Character State | ~0.6KB |
| **Total** | **~52KB** |

---

### Entity ID System v5

Sequential integers + separate attribute arrays (not packed 32-bit).

```typescript
interface EntityStorage {
  categories: Uint8Array;       // Flat category (0-255)
  hierarchyData: Uint32Array;   // 32-bit hierarchy
  alive: Uint8Array;            // Lifecycle flag
  generations: Uint16Array;     // Recycling validation
  freeList: number[];
  nextId: number;
}
```

#### Flat Categories

| Range | Categories |
|-------|------------|
| 0 | NONE (invalid) |
| 1-9 | Characters (PC, NPC, HOSTILE_*) |
| 10-29 | Locations (CITY, DUNGEON, WILD, etc.) |
| 30-39 | Factions (GUILD, TEMPLE, etc.) |
| 40-49 | Instances (QUEST, EVENT) |
| 255 | SYSTEM |

---

### Character System v6

#### HP System

- Calculation: `STR + floor(CON × coefficient)`
- Coefficient: Bone/Blood Mark = 2.0, Others = 1.5
- Display: 5 stages (hidden when full)

| Stage | HP Range | Display |
|-------|----------|---------|
| Healthy | 100% | Hidden |
| Light Injury | 75-99% | 軽傷 |
| Injured | 50-74% | 負傷 |
| Serious | 25-49% | 重傷 |
| Critical | 1-24% | 瀕死 |

#### HP Recovery Formula

```
finalRate = baseRate × mitigatedMultiplier × restBonus × envFactor
```

- Base: 2% max HP per hour
- Rest bonus: Active +0%, Sleep +30%, Full Rest +50%
- Environment: Safe 0%, Outdoors -10%, Danger -25%, Chaos -50%

#### dejavuBonds System

Buffer against Chaos damage. Max 100, recovers 10/hour (not in Chaos).
Chaos passive damage: 5/hour × (1.0 + chaos_level)

---

### Anchor System v1

When characters die, "Anchors" enable return from Chaos.

| Level | Total dejavuBonds | Inherited |
|-------|-------------------|-----------|
| 0 | 0-499 | None (permanent death for NPCs) |
| 1 | 500-1,499 | Occupation only |
| 2 | 1,500-3,499 | + Faith deity |
| 3 | 3,500-6,999 | + 3 main skills |
| 4 | 7,000+ | + 50% skill levels |

---

### Unified Tag System v2

| Category | Values | Purpose |
|----------|--------|---------|
| Direction | ACTIVE, PASSIVE, SOCIAL | Action alignment |
| Axis | 10 values (5 axes × 2) | Personality |
| Motivation | 12 deep motivations | Core drive |
| WorldMark | 8 marks | Elemental affinity |
| Situation | DANGER, PEACEFUL, etc. | Context |

---

### WorldMark System v3 (8 Marks)

| Mark | Japanese | Domain |
|------|----------|--------|
| Bone | 骨 | Structure, Defense |
| Blood | 血 | Life Force, Combat |
| Breath | 息 | Communication, Trade |
| Tear | 涙 | Emotion, Healing |
| Eye | 眼 | Knowledge, Perception |
| Shadow | 影 | Stealth, Deception |
| Ear | 耳 | Hearing, Music |
| Skin | 肌 | Touch, Crafting |

---

### IAUS (Infinite Axis Utility System)

Decision-making engine evaluating all actions by utility score.

```
Considerations → Response Curves → Aggregation → Selection
```

- Static scores cached until entity change
- Dynamic scores computed per tick
- Batch evaluation for all NPCs

---

### Development Phases

#### Phase 1: MVP (Current)

- 5-zone layout, 50-char info unit limit
- 4 fixed actions, 3 haptic patterns
- Entity ID v5, Tag v2, Archetype v2
- IAUS MVP, Character System v6
- Anchor System v1

#### Phase 2

- Extended haptic patterns
- NPC Control Mode
- Multi-city support
- IAUS Dialogue Integration

---

## Code Conventions

### TypeScript

- Strict mode enabled
- Prefer `const` over `let`
- Use TypedArray for performance-critical data
- Avoid `any` type

### Naming

- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Performance

- All IDs must be Smi-safe (≤2³⁰-1)
- Prefer SoA over AoS for bulk data
- Batch IndexedDB writes (5s flush)

---

## Type Definition Rules

- All IDs are `number` type (V8 Smi optimization)
- Constants use `as const` to preserve literal types
- 0 always represents "unset/invalid"
- TypedArray types are managed with corresponding interface definitions
- Circular references between files are prohibited

### Import Paths for Types

```typescript
import { EntityStorage, EntityId } from '$lib/types/entity';
import { CATEGORY, CategoryType } from '$lib/types/constants';
import { TagStorage, AXIS_TAG } from '$lib/types/tags';
import { ARCHETYPE, ArchetypeId } from '$lib/types/archetype';
import { Character, Soul, Vessel } from '$lib/types/character';
import { WORLD_MARK, WorldMarkType } from '$lib/types/marks';

// Or import all from barrel
import * as Types from '$lib/types';
```

---

## Quick Reference

### Repository

- **GitHub**: `git@github.com:sanmal/liminia.git`

### File Locations

| Type | Path |
|------|------|
| Source | `src/lib/` |
| Type Definitions | `src/lib/types/` |
| Core Systems | `src/lib/core/` |
| Character | `src/lib/character/` |
| IAUS | `src/lib/iaus/` |
| Storage | `src/lib/storage/` |
| Routes | `src/routes/` |

### Import Aliases

```typescript
import { EntityStorage } from '$lib/core/entity';
import { CharacterState } from '$lib/character/state';
import { IAUSEngine } from '$lib/iaus/engine';
```
