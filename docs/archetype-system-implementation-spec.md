#涯庭 #Liminia

# Archetype System 実装+テスト仕様書

Claude Code向け実装ガイド。Archetype System v2 の実装とテストを定義する。
作成日: 2026-02-01

---

## 参照すべきファイル

実装前に必ず以下のファイルを読み込んでください：

```
# 型定義（実装の基盤）
src/lib/types/constants.ts     # MAX_ARCHETYPES, MAX_ENTITIES
src/lib/types/brand.ts         # ArchetypeId, archetypeId(), EntityId
src/lib/types/archetype.ts     # ArchetypeStorage, ArchetypeDefinition, ArchetypeAffinity, ArchetypeInfo, ARCHETYPE
src/lib/types/tags.ts          # DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG
src/lib/types/marks.ts         # WORLD_MARK

# 既存実装（パターン参照）
src/lib/core/entity/storage.ts     # createEntityStorage パターン
src/lib/core/tags/storage.ts       # createTagStorage パターン
src/lib/core/tags/accessors.ts     # Accessor Pattern 参照
src/lib/core/tags/queries.ts       # calculateTagMatchScore パターン

# 仕様書
docs/tag-system-implementation-spec.md  # Tag実装仕様（パターン参照）
```

---

## 設計原則（Entity / Tag と同一）

1. **純粋関数設計**: storageを第1引数で受け取る
2. **Branded Type使用**: アーキタイプIDには `ArchetypeId` 型を使用
3. **Accessor Pattern**: TypedArray読み取りの `!` はaccessor関数内に集約
4. **erasableSyntaxOnly準拠**: `enum` 不使用。`as const` + 派生型
5. **verbatimModuleSyntax準拠**: `import type` 明示
6. **JSDOCコメント**: 全公開関数に付与

---

## ディレクトリ構成

```
src/lib/core/archetype/
├── storage.ts        # ArchetypeStorage作成・登録・情報取得
├── definitions.ts    # 初期32アーキタイプ定義データ + 初期化関数
├── affinity.ts       # 親和性スコア計算
└── index.ts          # バレルエクスポート
```

---

## ArchetypeStorageの構造

```
ArchetypeStorage（capacity = MAX_ARCHETYPES = 64）
┌──────────────────────────────────────────────┐
│ names: string[]           ← デバッグ・UI用   │  ← ArchetypeIdでインデックス
│ directions: Uint8Array    ← DIRECTION_TAG値  │
│ primaryAxis: Uint8Array   ← AXIS_TAG値       │
│ secondaryAxis: Uint8Array ← AXIS_TAG値       │
│ motivations: Uint8Array   ← MOTIVATION_TAG値 │
│ worldMarks: Uint8Array    ← WORLD_MARK値     │
│ nextId: number            ← 次の登録ID       │
│ capacity: number          ← 64              │
└──────────────────────────────────────────────┘
```

**EntityStorageとの違い**:
- ArchetypeStorageはアーキタイプ定義を格納する（最大64エントリ）
- EntityStorage（最大2000エントリ）とは別のcapacity
- freeListやalive配列は不要（アーキタイプは削除されない）
- エンティティへのアーキタイプ割り当ては Character System（§7）で管理

---

## メモリバジェット

| 配列 | 型 | サイズ（capacity=64） |
|------|-----|--------|
| names | string[] | ~1,300 bytes（推定） |
| directions | Uint8Array | 64 bytes |
| primaryAxis | Uint8Array | 64 bytes |
| secondaryAxis | Uint8Array | 64 bytes |
| motivations | Uint8Array | 64 bytes |
| worldMarks | Uint8Array | 64 bytes |
| **TypedArray合計** | | **320 bytes** |
| **全体推定** | | **~1.6KB** |

Master Index見積もり ~2.4KB にはAffinity計算用バッファを含む。十分なマージンがある。

---

## ファイル別実装仕様

### 1. storage.ts

**責務**: ArchetypeStorageの作成・初期化・登録・情報取得

```typescript
import type { ArchetypeStorage, ArchetypeDefinition, ArchetypeInfo } from '$lib/types/archetype';
import type { ArchetypeId } from '$lib/types/brand';
import { archetypeId } from '$lib/types/brand';
import { MAX_ARCHETYPES } from '$lib/types/constants';

/**
 * 新しいArchetypeStorageを作成
 * @param capacity - 最大アーキタイプ数（デフォルト: MAX_ARCHETYPES = 64）
 */
export function createArchetypeStorage(
  capacity: number = MAX_ARCHETYPES
): ArchetypeStorage {
  return {
    names: [],
    directions: new Uint8Array(capacity),
    primaryAxis: new Uint8Array(capacity),
    secondaryAxis: new Uint8Array(capacity),
    motivations: new Uint8Array(capacity),
    worldMarks: new Uint8Array(capacity),
    nextId: 0,
    capacity,
  };
}

/**
 * ArchetypeStorageをクリア
 */
export function clearArchetypeStorage(storage: ArchetypeStorage): void {
  storage.names.length = 0;
  storage.directions.fill(0);
  storage.primaryAxis.fill(0);
  storage.secondaryAxis.fill(0);
  storage.motivations.fill(0);
  storage.worldMarks.fill(0);
  storage.nextId = 0;
}

/**
 * アーキタイプを登録し、ArchetypeIdを返す
 * @throws Error - ストレージが満杯の場合
 */
export function registerArchetype(
  storage: ArchetypeStorage,
  def: ArchetypeDefinition
): ArchetypeId {
  if (storage.nextId >= storage.capacity) {
    throw new Error('Archetype storage full');
  }

  const id = storage.nextId;
  storage.names[id] = def.name;
  storage.directions[id] = def.direction;
  storage.primaryAxis[id] = def.primaryAxis;
  storage.secondaryAxis[id] = def.secondaryAxis;
  storage.motivations[id] = def.motivation;
  storage.worldMarks[id] = def.worldMark;
  storage.nextId++;

  return archetypeId(id);
}

/**
 * アーキタイプ情報を取得
 * @returns ArchetypeInfo | null（範囲外または未登録の場合）
 */
export function getArchetypeInfo(
  storage: ArchetypeStorage,
  id: ArchetypeId
): ArchetypeInfo | null {
  if (id < 0 || id >= storage.nextId) {
    return null;
  }

  return {
    id,
    name: storage.names[id] ?? '',
    direction: storage.directions[id]!,
    primaryAxis: storage.primaryAxis[id]!,
    secondaryAxis: storage.secondaryAxis[id]!,
    motivation: storage.motivations[id]!,
    worldMark: storage.worldMarks[id]!,
  };
}

/**
 * 名前でアーキタイプを検索
 * @returns ArchetypeId | null
 */
export function getArchetypeByName(
  storage: ArchetypeStorage,
  name: string
): ArchetypeId | null {
  const index = storage.names.indexOf(name);
  if (index === -1 || index >= storage.nextId) {
    return null;
  }
  return archetypeId(index);
}

/**
 * 登録済みアーキタイプ数
 */
export function getArchetypeCount(storage: ArchetypeStorage): number {
  return storage.nextId;
}

/** グローバルArchetypeStorageインスタンス */
export const globalArchetypeStorage: ArchetypeStorage = createArchetypeStorage();
```

---

### 2. definitions.ts

**責務**: MVP用32アーキタイプの定義データと一括登録関数

```typescript
import type { ArchetypeDefinition } from '$lib/types/archetype';
import type { ArchetypeStorage } from '$lib/types/archetype';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import { registerArchetype } from './storage';

/**
 * MVP用32アーキタイプ定義。
 * 配列インデックスがARCHETYPE定数の値と一致する必要がある。
 * （例: ARCHETYPE.GUARDIAN = 0 → ARCHETYPE_DEFINITIONS[0]）
 */
export const ARCHETYPE_DEFINITIONS: readonly ArchetypeDefinition[] = [
  // ── Protectors (0-3): Order + Others ──────────────────
  {
    name: 'Guardian',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Sentinel',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Defender',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.JUSTICE,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Warden',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.ORDER,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.JUSTICE,
    worldMark: WORLD_MARK.EAR,
  },

  // ── Leaders (4-7): Social + Extra ─────────────────────
  {
    name: 'Commander',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.POWER,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Diplomat',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.BELONGING,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Merchant',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.WEALTH,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Preacher',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.EXTRA,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.RECOGNITION,
    worldMark: WORLD_MARK.TEAR,
  },

  // ── Seekers (8-11): Knowledge + Cautious ──────────────
  {
    name: 'Scholar',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Investigator',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Sage',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.TEAR,
  },
  {
    name: 'Archivist',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CAUTIOUS,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.EAR,
  },

  // ── Creators (12-15): Creation + Stable ───────────────
  {
    name: 'Artisan',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.SKIN,
  },
  {
    name: 'Builder',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.BONE,
  },
  {
    name: 'Healer',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.OTHERS,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.TEAR,
  },
  {
    name: 'Cultivator',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.STABLE,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.CREATION,
    worldMark: WORLD_MARK.SKIN,
  },

  // ── Adventurers (16-19): Freedom + Bold ───────────────
  {
    name: 'Explorer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.EXTRA,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.EYE,
  },
  {
    name: 'Pioneer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.ORDER,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BREATH,
  },
  {
    name: 'Nomad',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.EAR,
  },
  {
    name: 'Wanderer',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.BOLD,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BREATH,
  },

  // ── Warriors (20-23): Combat + Reactive ───────────────
  {
    name: 'Berserker',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.BOLD,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Duelist',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Hunter',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.MASTERY,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Veteran',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.REACTIVE,
    secondaryAxis: AXIS_TAG.STABLE,
    motivation: MOTIVATION_TAG.PROTECTION,
    worldMark: WORLD_MARK.BONE,
  },

  // ── Shadows (24-27): Stealth + Self ───────────────────
  {
    name: 'Assassin',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.POWER,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Thief',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.CAUTIOUS,
    motivation: MOTIVATION_TAG.WEALTH,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Spy',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.KNOWLEDGE,
    worldMark: WORLD_MARK.SHADOW,
  },
  {
    name: 'Trickster',
    direction: DIRECTION_TAG.SOCIAL,
    primaryAxis: AXIS_TAG.SELF,
    secondaryAxis: AXIS_TAG.CHAOS,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.SHADOW,
  },

  // ── Outcasts (28-31): Chaos + Survival ────────────────
  {
    name: 'Survivor',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.REACTIVE,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.SKIN,
  },
  {
    name: 'Hermit',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.INTRO,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.EAR,
  },
  {
    name: 'Rebel',
    direction: DIRECTION_TAG.ACTIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.BOLD,
    motivation: MOTIVATION_TAG.FREEDOM,
    worldMark: WORLD_MARK.BLOOD,
  },
  {
    name: 'Outcast',
    direction: DIRECTION_TAG.PASSIVE,
    primaryAxis: AXIS_TAG.CHAOS,
    secondaryAxis: AXIS_TAG.SELF,
    motivation: MOTIVATION_TAG.SURVIVAL,
    worldMark: WORLD_MARK.SHADOW,
  },
] as const;

/**
 * デフォルトの32アーキタイプをストレージに一括登録
 * @returns 登録数
 */
export function initializeDefaultArchetypes(
  storage: ArchetypeStorage
): number {
  let count = 0;
  for (const def of ARCHETYPE_DEFINITIONS) {
    registerArchetype(storage, def);
    count++;
  }
  return count;
}
```

**32アーキタイプ属性の設計根拠**:

| カテゴリ | テーマ | Direction | Primary Axis | Motivation系統 | WorldMark |
|---------|--------|-----------|--------------|---------------|-----------|
| Protectors | 秩序と守護 | ACTIVE/PASSIVE | ORDER | PROTECTION/JUSTICE | BONE/EYE/EAR |
| Leaders | 社交と統率 | SOCIAL | EXTRA | POWER/BELONGING/WEALTH/RECOGNITION | BLOOD/BREATH/TEAR |
| Seekers | 知識と探求 | PASSIVE/ACTIVE | CAUTIOUS | KNOWLEDGE/MASTERY | EYE/TEAR/EAR |
| Creators | 創造と安定 | PASSIVE/SOCIAL | STABLE | CREATION/PROTECTION | SKIN/BONE/TEAR |
| Adventurers | 自由と大胆 | ACTIVE | BOLD | FREEDOM | EYE/BREATH/EAR |
| Warriors | 戦闘と反応 | ACTIVE | REACTIVE | SURVIVAL/MASTERY/PROTECTION | BLOOD/BONE |
| Shadows | 隠密と自己 | ACTIVE/PASSIVE/SOCIAL | SELF | POWER/WEALTH/KNOWLEDGE/FREEDOM | SHADOW |
| Outcasts | 混沌と生存 | PASSIVE/ACTIVE | CHAOS | SURVIVAL/FREEDOM | SKIN/EAR/BLOOD/SHADOW |

配列インデックスはARCHETYPE定数と一致している:
- `ARCHETYPE.GUARDIAN = 0` → `ARCHETYPE_DEFINITIONS[0]` = Guardian
- `ARCHETYPE.OUTCAST = 31` → `ARCHETYPE_DEFINITIONS[31]` = Outcast

---

### 3. affinity.ts

**責務**: アーキタイプ間およびエンティティ-アーキタイプ間の親和性スコア計算

**MVP方針**: 事前計算テーブルを持たず、定義データから都度計算する。
32×32=1024パターンでも計算は軽量（整数比較のみ）。
Phase 2でキャッシュ導入を検討する。

```typescript
import type { ArchetypeStorage } from '$lib/types/archetype';
import type { TagStorage } from '$lib/types/tags';
import type { ArchetypeId } from '$lib/types/brand';
import type { EntityId } from '$lib/types/brand';

/**
 * 2つのアーキタイプ間の親和性スコアを計算
 *
 * 配点:
 *   ベースライン: 0
 *   Direction一致: +20
 *   PrimaryAxis一致: +30
 *   PrimaryAxis-SecondaryAxis交差一致: +15
 *   SecondaryAxis同士の一致: +10
 *   Motivation一致: +30
 *   Motivation同カテゴリ: +10
 *   WorldMark一致: +20
 *   対極Axis（ORDER↔CHAOS等）: -20
 *
 * @returns スコア（-20 〜 +130 の範囲）
 */
export function computeArchetypeCompatibility(
  storage: ArchetypeStorage,
  id1: ArchetypeId,
  id2: ArchetypeId
): number {
  let score = 0;

  // Direction match
  const dir1 = storage.directions[id1]!;
  const dir2 = storage.directions[id2]!;
  if (dir1 !== 0 && dir1 === dir2) {
    score += 20;
  }

  // Primary Axis match
  const ax1 = storage.primaryAxis[id1]!;
  const ax2 = storage.primaryAxis[id2]!;
  if (ax1 !== 0 && ax1 === ax2) {
    score += 30;
  } else if (ax1 !== 0 && ax2 !== 0 && areOppositeAxes(ax1, ax2)) {
    score -= 20;
  }

  // Cross-match: primary1 vs secondary2 and vice versa
  const ax1s = storage.secondaryAxis[id1]!;
  const ax2s = storage.secondaryAxis[id2]!;
  if (ax1 !== 0 && ax1 === ax2s) {
    score += 15;
  }
  if (ax2 !== 0 && ax2 === ax1s) {
    score += 15;
  }

  // Secondary Axis match
  if (ax1s !== 0 && ax1s === ax2s) {
    score += 10;
  }

  // Motivation match
  const mot1 = storage.motivations[id1]!;
  const mot2 = storage.motivations[id2]!;
  if (mot1 !== 0 && mot1 === mot2) {
    score += 30;
  } else if (mot1 !== 0 && mot2 !== 0 && sameMotivationCategory(mot1, mot2)) {
    score += 10;
  }

  // WorldMark match
  const wm1 = storage.worldMarks[id1]!;
  const wm2 = storage.worldMarks[id2]!;
  if (wm1 !== 0 && wm1 === wm2) {
    score += 20;
  }

  return score;
}

/**
 * エンティティのタグプロファイルとアーキタイプの親和性スコアを計算
 *
 * IAUSの静的Considerationとして使用される。
 * タグ配列からエンティティのタグを読み取り、アーキタイプ定義と比較する。
 *
 * 配点:
 *   ベースライン: 0
 *   Direction一致: +20
 *   Primary Axis一致（entity.axis or axis2 vs archetype.primary）: +30 / +15
 *   Secondary Axis一致: +15 / +10
 *   Motivation一致: +30、同カテゴリ: +10
 *   WorldMark一致（entity.worldMark or worldMark2 vs archetype）: +20 / +10
 *
 * @returns スコア（-20 〜 +125 の範囲）
 */
export function computeEntityArchetypeAffinity(
  archetypes: ArchetypeStorage,
  archId: ArchetypeId,
  tags: TagStorage,
  entityId: EntityId
): number {
  let score = 0;

  // Direction
  const eDir = tags.direction[entityId]!;
  const aDir = archetypes.directions[archId]!;
  if (eDir !== 0 && eDir === aDir) {
    score += 20;
  }

  // Axis
  const eAx = tags.axis[entityId]!;
  const eAx2 = tags.axis2[entityId]!;
  const aAx = archetypes.primaryAxis[archId]!;
  const aAx2 = archetypes.secondaryAxis[archId]!;

  // Entity primary vs Archetype primary
  if (eAx !== 0 && eAx === aAx) {
    score += 30;
  } else if (eAx !== 0 && eAx === aAx2) {
    score += 15;
  } else if (eAx2 !== 0 && eAx2 === aAx) {
    score += 15;
  } else if (eAx2 !== 0 && eAx2 === aAx2) {
    score += 10;
  }

  // Opposite axis penalty
  if (eAx !== 0 && aAx !== 0 && areOppositeAxes(eAx, aAx)) {
    score -= 20;
  }

  // Motivation
  const eMot = tags.motivation[entityId]!;
  const aMot = archetypes.motivations[archId]!;
  if (eMot !== 0 && eMot === aMot) {
    score += 30;
  } else if (eMot !== 0 && aMot !== 0 && sameMotivationCategory(eMot, aMot)) {
    score += 10;
  }

  // WorldMark
  const eWm = tags.worldMark[entityId]!;
  const eWm2 = tags.worldMark2[entityId]!;
  const aWm = archetypes.worldMarks[archId]!;
  if (eWm !== 0 && eWm === aWm) {
    score += 20;
  } else if (eWm2 !== 0 && eWm2 === aWm) {
    score += 10;
  }

  return score;
}

// ─── Helper Functions ────────────────────────────────────

/**
 * 2つのAxis値が対極関係にあるか判定
 *
 * 対極ペア:
 *   ORDER(1) ↔ CHAOS(2)
 *   INTRO(3) ↔ EXTRA(4)
 *   STABLE(5) ↔ REACTIVE(6)
 *   CAUTIOUS(7) ↔ BOLD(8)
 *   SELF(9) ↔ OTHERS(10)
 */
export function areOppositeAxes(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  // Pairs: (1,2), (3,4), (5,6), (7,8), (9,10)
  // For odd a: opposite is a+1. For even a: opposite is a-1.
  // Simpler: same pair if Math.ceil(a/2) === Math.ceil(b/2) and a !== b
  return a !== b && Math.ceil(a / 2) === Math.ceil(b / 2);
}

/**
 * 2つのMotivation値が同カテゴリに属するか判定
 *
 * カテゴリ:
 *   Achievement: MASTERY(1), POWER(2), WEALTH(3)
 *   Connection:  BELONGING(4), RECOGNITION(5), LOVE(6)
 *   Growth:      KNOWLEDGE(7), CREATION(8), FREEDOM(9)
 *   Preservation: PROTECTION(10), JUSTICE(11), SURVIVAL(12)
 */
export function sameMotivationCategory(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  // Same category if Math.ceil(a/3) === Math.ceil(b/3)
  return Math.ceil(a / 3) === Math.ceil(b / 3);
}
```

**スコア範囲の整理**:

| 関数 | 最小 | 最大 | 用途 |
|------|:----:|:----:|------|
| computeArchetypeCompatibility | -20 | +130 | アーキタイプ間の類似度 |
| computeEntityArchetypeAffinity | -20 | +125 | エンティティとアーキタイプの適合度 |

IAUS正規化: `score / 130` で 0.0〜1.0 に変換する想定（IAUS実装時に調整）。

---

### 4. index.ts

```typescript
// Storage
export {
  createArchetypeStorage,
  clearArchetypeStorage,
  registerArchetype,
  getArchetypeInfo,
  getArchetypeByName,
  getArchetypeCount,
  globalArchetypeStorage,
} from './storage.js';

// Definitions
export { ARCHETYPE_DEFINITIONS, initializeDefaultArchetypes } from './definitions.js';

// Affinity
export {
  computeArchetypeCompatibility,
  computeEntityArchetypeAffinity,
  areOppositeAxes,
  sameMotivationCategory,
} from './affinity.js';
```

---

## テスト仕様

### テストファイル構成

```
src/lib/core/archetype/
├── storage.test.ts         # 12テスト
├── definitions.test.ts     # 8テスト
└── affinity.test.ts        # 16テスト
                              合計: 36テスト（目安）
```

---

### storage.test.ts（12テスト）

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createArchetypeStorage,
  clearArchetypeStorage,
  registerArchetype,
  getArchetypeInfo,
  getArchetypeByName,
  getArchetypeCount,
} from './storage';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import type { ArchetypeDefinition, ArchetypeStorage } from '$lib/types/archetype';

const SAMPLE_DEF: ArchetypeDefinition = {
  name: 'TestGuardian',
  direction: DIRECTION_TAG.ACTIVE,
  primaryAxis: AXIS_TAG.ORDER,
  secondaryAxis: AXIS_TAG.OTHERS,
  motivation: MOTIVATION_TAG.PROTECTION,
  worldMark: WORLD_MARK.BONE,
};

describe('createArchetypeStorage', () => {
  it('should create storage with default capacity (64)', () => {
    const s = createArchetypeStorage();
    expect(s.directions.length).toBe(64);
    expect(s.capacity).toBe(64);
    expect(s.nextId).toBe(0);
  });

  it('should create storage with custom capacity', () => {
    const s = createArchetypeStorage(16);
    expect(s.capacity).toBe(16);
  });

  it('should initialize all arrays to zero', () => {
    const s = createArchetypeStorage(8);
    for (let i = 0; i < 8; i++) {
      expect(s.directions[i]).toBe(0);
      expect(s.primaryAxis[i]).toBe(0);
      expect(s.motivations[i]).toBe(0);
    }
  });
});

describe('registerArchetype', () => {
  it('should register and return sequential ArchetypeId', () => {
    const s = createArchetypeStorage(8);
    const id0 = registerArchetype(s, SAMPLE_DEF);
    const id1 = registerArchetype(s, { ...SAMPLE_DEF, name: 'TestCommander' });
    expect(Number(id0)).toBe(0);
    expect(Number(id1)).toBe(1);
    expect(s.nextId).toBe(2);
  });

  it('should store definition attributes correctly', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    expect(s.names[0]).toBe('TestGuardian');
    expect(s.directions[0]).toBe(DIRECTION_TAG.ACTIVE);
    expect(s.primaryAxis[0]).toBe(AXIS_TAG.ORDER);
    expect(s.secondaryAxis[0]).toBe(AXIS_TAG.OTHERS);
    expect(s.motivations[0]).toBe(MOTIVATION_TAG.PROTECTION);
    expect(s.worldMarks[0]).toBe(WORLD_MARK.BONE);
  });

  it('should throw when storage is full', () => {
    const s = createArchetypeStorage(2);
    registerArchetype(s, SAMPLE_DEF);
    registerArchetype(s, { ...SAMPLE_DEF, name: 'Second' });
    expect(() => registerArchetype(s, { ...SAMPLE_DEF, name: 'Third' }))
      .toThrow('Archetype storage full');
  });
});

describe('clearArchetypeStorage', () => {
  it('should reset all data', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    clearArchetypeStorage(s);
    expect(s.nextId).toBe(0);
    expect(s.names).toHaveLength(0);
    expect(s.directions[0]).toBe(0);
  });
});

describe('getArchetypeInfo', () => {
  it('should return info for registered archetype', () => {
    const s = createArchetypeStorage(8);
    const id = registerArchetype(s, SAMPLE_DEF);
    const info = getArchetypeInfo(s, id);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('TestGuardian');
    expect(info!.direction).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should return null for unregistered id', () => {
    const s = createArchetypeStorage(8);
    const { archetypeId } = await import('$lib/types/brand');
    expect(getArchetypeInfo(s, archetypeId(5))).toBeNull();
  });
});

describe('getArchetypeByName', () => {
  it('should find archetype by name', () => {
    const s = createArchetypeStorage(8);
    registerArchetype(s, SAMPLE_DEF);
    const id = getArchetypeByName(s, 'TestGuardian');
    expect(id).not.toBeNull();
    expect(Number(id)).toBe(0);
  });

  it('should return null for unknown name', () => {
    const s = createArchetypeStorage(8);
    expect(getArchetypeByName(s, 'NonExistent')).toBeNull();
  });
});

describe('getArchetypeCount', () => {
  it('should return count of registered archetypes', () => {
    const s = createArchetypeStorage(8);
    expect(getArchetypeCount(s)).toBe(0);
    registerArchetype(s, SAMPLE_DEF);
    expect(getArchetypeCount(s)).toBe(1);
  });
});
```

**注意**: `getArchetypeInfo` テスト内で `archetypeId` をインポートする方法は、テスト実装時に実際のimportスタイルに合わせて調整すること。上記は概略。

---

### definitions.test.ts（8テスト）

```typescript
import { describe, it, expect } from 'vitest';
import { ARCHETYPE_DEFINITIONS, initializeDefaultArchetypes } from './definitions';
import { createArchetypeStorage, getArchetypeInfo, getArchetypeCount } from './storage';
import { ARCHETYPE } from '$lib/types/archetype';
import { archetypeId } from '$lib/types/brand';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';

describe('ARCHETYPE_DEFINITIONS', () => {
  it('should contain exactly 32 definitions', () => {
    expect(ARCHETYPE_DEFINITIONS).toHaveLength(32);
  });

  it('should have unique names', () => {
    const names = ARCHETYPE_DEFINITIONS.map(d => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(32);
  });

  it('should have valid Direction values for all definitions', () => {
    const validDirections = [DIRECTION_TAG.ACTIVE, DIRECTION_TAG.PASSIVE, DIRECTION_TAG.SOCIAL];
    for (const def of ARCHETYPE_DEFINITIONS) {
      expect(validDirections).toContain(def.direction);
    }
  });

  it('should have non-NONE primaryAxis for all definitions', () => {
    for (const def of ARCHETYPE_DEFINITIONS) {
      expect(def.primaryAxis).not.toBe(AXIS_TAG.NONE);
    }
  });

  it('should align index 0 with ARCHETYPE.GUARDIAN', () => {
    expect(ARCHETYPE_DEFINITIONS[ARCHETYPE.GUARDIAN]!.name).toBe('Guardian');
  });

  it('should align index 31 with ARCHETYPE.OUTCAST', () => {
    expect(ARCHETYPE_DEFINITIONS[ARCHETYPE.OUTCAST]!.name).toBe('Outcast');
  });
});

describe('initializeDefaultArchetypes', () => {
  it('should register all 32 archetypes', () => {
    const s = createArchetypeStorage();
    const count = initializeDefaultArchetypes(s);
    expect(count).toBe(32);
    expect(getArchetypeCount(s)).toBe(32);
  });

  it('should produce retrievable archetype info', () => {
    const s = createArchetypeStorage();
    initializeDefaultArchetypes(s);
    const guardian = getArchetypeInfo(s, archetypeId(ARCHETYPE.GUARDIAN));
    expect(guardian).not.toBeNull();
    expect(guardian!.name).toBe('Guardian');
    expect(guardian!.direction).toBe(DIRECTION_TAG.ACTIVE);
    expect(guardian!.worldMark).toBe(WORLD_MARK.BONE);
  });
});
```

---

### affinity.test.ts（16テスト）

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeArchetypeCompatibility,
  computeEntityArchetypeAffinity,
  areOppositeAxes,
  sameMotivationCategory,
} from './affinity';
import { createArchetypeStorage, registerArchetype } from './storage';
import { initializeDefaultArchetypes } from './definitions';
import { createTagStorage } from '../tags/storage';
import { setDirection, setAxis, setAxis2, setMotivation, setWorldMark } from '../tags/accessors';
import { createEntityStorage } from '../entity/storage';
import { createEntity } from '../entity/lifecycle';
import { ARCHETYPE } from '$lib/types/archetype';
import { archetypeId, entityId } from '$lib/types/brand';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import { CATEGORY } from '$lib/types/constants';

describe('areOppositeAxes', () => {
  it('should detect ORDER-CHAOS as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.CHAOS)).toBe(true);
  });

  it('should detect INTRO-EXTRA as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.INTRO, AXIS_TAG.EXTRA)).toBe(true);
  });

  it('should not treat same value as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.ORDER)).toBe(false);
  });

  it('should not treat cross-axis as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.BOLD)).toBe(false);
  });

  it('should return false for NONE', () => {
    expect(areOppositeAxes(AXIS_TAG.NONE, AXIS_TAG.ORDER)).toBe(false);
  });
});

describe('sameMotivationCategory', () => {
  it('should detect Achievement category (MASTERY, POWER, WEALTH)', () => {
    expect(sameMotivationCategory(MOTIVATION_TAG.MASTERY, MOTIVATION_TAG.POWER)).toBe(true);
    expect(sameMotivationCategory(MOTIVATION_TAG.POWER, MOTIVATION_TAG.WEALTH)).toBe(true);
  });

  it('should detect Connection category (BELONGING, RECOGNITION, LOVE)', () => {
    expect(sameMotivationCategory(MOTIVATION_TAG.BELONGING, MOTIVATION_TAG.LOVE)).toBe(true);
  });

  it('should not match across categories', () => {
    expect(sameMotivationCategory(MOTIVATION_TAG.MASTERY, MOTIVATION_TAG.BELONGING)).toBe(false);
  });

  it('should return false for NONE', () => {
    expect(sameMotivationCategory(0, MOTIVATION_TAG.MASTERY)).toBe(false);
  });
});

describe('computeArchetypeCompatibility', () => {
  let s: ArchetypeStorage;

  beforeEach(() => {
    s = createArchetypeStorage();
    initializeDefaultArchetypes(s);
  });

  it('should return high score for same-category archetypes', () => {
    // GUARDIAN(0) and SENTINEL(1) - both Protectors (ORDER-based)
    const score = computeArchetypeCompatibility(
      s, archetypeId(ARCHETYPE.GUARDIAN), archetypeId(ARCHETYPE.SENTINEL)
    );
    // Same primary axis (ORDER): +30, Same motivation (PROTECTION): +30
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it('should return negative for opposing archetypes', () => {
    // GUARDIAN(ORDER) vs REBEL(CHAOS) - opposite primary axes
    const score = computeArchetypeCompatibility(
      s, archetypeId(ARCHETYPE.GUARDIAN), archetypeId(ARCHETYPE.REBEL)
    );
    expect(score).toBeLessThan(0);
  });

  it('should return 0 for completely unrelated archetypes', () => {
    // No particular overlap expected to score exactly 0,
    // but archetypes with no matching attributes should score low
    const score = computeArchetypeCompatibility(
      s, archetypeId(ARCHETYPE.SCHOLAR), archetypeId(ARCHETYPE.BERSERKER)
    );
    // CAUTIOUS vs REACTIVE, KNOWLEDGE vs SURVIVAL → low/negative
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should be symmetric', () => {
    const ab = computeArchetypeCompatibility(
      s, archetypeId(ARCHETYPE.MERCHANT), archetypeId(ARCHETYPE.THIEF)
    );
    const ba = computeArchetypeCompatibility(
      s, archetypeId(ARCHETYPE.THIEF), archetypeId(ARCHETYPE.MERCHANT)
    );
    // Note: may not be perfectly symmetric due to cross-match direction
    // but for this MVP should be close
    expect(Math.abs(ab - ba)).toBeLessThanOrEqual(15);
  });
});

describe('computeEntityArchetypeAffinity', () => {
  let archetypes: ArchetypeStorage;
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    archetypes = createArchetypeStorage();
    initializeDefaultArchetypes(archetypes);
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should return high score when entity tags match archetype', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    // Set tags matching Guardian: ACTIVE, ORDER, OTHERS, PROTECTION, BONE
    setDirection(tags, h.id, DIRECTION_TAG.ACTIVE);
    setAxis(tags, h.id, AXIS_TAG.ORDER);
    setAxis2(tags, h.id, AXIS_TAG.OTHERS);
    setMotivation(tags, h.id, MOTIVATION_TAG.PROTECTION);
    setWorldMark(tags, h.id, WORLD_MARK.BONE);

    const score = computeEntityArchetypeAffinity(
      archetypes, archetypeId(ARCHETYPE.GUARDIAN), tags, h.id
    );
    // Direction(+20) + Primary Axis(+30) + Motivation(+30) + WorldMark(+20) = 100+
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should return low score when entity tags mismatch', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h.id, DIRECTION_TAG.SOCIAL);
    setAxis(tags, h.id, AXIS_TAG.CHAOS);
    setMotivation(tags, h.id, MOTIVATION_TAG.FREEDOM);
    setWorldMark(tags, h.id, WORLD_MARK.SHADOW);

    const score = computeEntityArchetypeAffinity(
      archetypes, archetypeId(ARCHETYPE.GUARDIAN), tags, h.id
    );
    // ORDER↔CHAOS opposite penalty: -20, no matches
    expect(score).toBeLessThanOrEqual(0);
  });

  it('should return 0 for untagged entity', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    const score = computeEntityArchetypeAffinity(
      archetypes, archetypeId(ARCHETYPE.GUARDIAN), tags, h.id
    );
    expect(score).toBe(0);
  });

  it('should score secondary tag matches', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    // Only secondary axis matches archetype primary
    setAxis(tags, h.id, AXIS_TAG.BOLD);       // No match with Guardian
    setAxis2(tags, h.id, AXIS_TAG.ORDER);      // Matches Guardian primary
    setMotivation(tags, h.id, MOTIVATION_TAG.PROTECTION);

    const score = computeEntityArchetypeAffinity(
      archetypes, archetypeId(ARCHETYPE.GUARDIAN), tags, h.id
    );
    // Axis2 match with archetype primary: +15, Motivation: +30
    expect(score).toBeGreaterThanOrEqual(30);
  });
});
```

---

## Claude Codeへの指示手順

### Step 1: 型定義の確認

```
以下のファイルを読んでください:
- src/lib/types/archetype.ts
- src/lib/types/brand.ts
- src/lib/types/tags.ts
- src/lib/types/marks.ts
- src/lib/types/constants.ts
```

### Step 2: 既存パターンの確認

```
以下の既存実装を読んで、コードスタイルとパターンを確認してください:
- src/lib/core/entity/storage.ts
- src/lib/core/tags/storage.ts
- src/lib/core/tags/queries.ts（calculateTagMatchScore参照）
- docs/archetype-system-implementation-spec.md（この仕様書）
```

### Step 3: 実装（段階的に）

```
docs/archetype-system-implementation-spec.md に従って、
src/lib/core/archetype/storage.ts を実装してください。
```

```
src/lib/core/archetype/definitions.ts を実装してください。
ARCHETYPE_DEFINITIONS配列のインデックスがARCHETYPE定数と一致するよう注意。
```

```
src/lib/core/archetype/affinity.ts を実装してください。
areOppositeAxesとsameMotivationCategoryをexportすること。
```

```
src/lib/core/archetype/index.ts を作成してください。
```

### Step 4: テスト

```
docs/archetype-system-implementation-spec.md のテスト仕様に従って、
以下のテストファイルを作成してください:
- src/lib/core/archetype/storage.test.ts
- src/lib/core/archetype/definitions.test.ts
- src/lib/core/archetype/affinity.test.ts
```

### Step 5: 検証

```
bun run test を実行して全テストがパスすることを確認してください。
bun run typecheck も実行してください。
失敗があれば原因を特定して修正してください。
```

---

## 注意事項

### ArchetypeIdとARCHETYPE定数の関係

`ARCHETYPE` 定数はarchetype.tsで定義済み:
```typescript
export const ARCHETYPE = {
  GUARDIAN: 0, SENTINEL: 1, ..., OUTCAST: 31,
} as const;
```

`ARCHETYPE_DEFINITIONS[n]` のインデックス `n` が `ARCHETYPE` 定数の値と一致する必要がある。
`initializeDefaultArchetypes` で配列順にregisterArchetypeを呼ぶため、自然に一致する。

### ArchetypeStorage の names 配列

`names` は `string[]` であり TypedArray ではない。
`clearArchetypeStorage` では `.length = 0` でクリアする（TypedArrayの `.fill(0)` パターンではない）。

### ArchetypeAffinity型との関係

型定義に `ArchetypeAffinity` インターフェースがあるが、MVP実装では使用しない。
MVPではaffinity.tsの関数で都度計算する方式を採用し、
Phase 2で事前計算テーブル（ArchetypeAffinityの配列）導入を検討する。

### areOppositeAxesの実装

AXIS_TAG値のペア構造を利用:
```
ORDER(1) ↔ CHAOS(2)     → ceil(1/2)=1, ceil(2/2)=1 → same group
INTRO(3) ↔ EXTRA(4)     → ceil(3/2)=2, ceil(4/2)=2 → same group
STABLE(5) ↔ REACTIVE(6) → ceil(5/2)=3, ceil(6/2)=3 → same group
CAUTIOUS(7) ↔ BOLD(8)   → ceil(7/2)=4, ceil(8/2)=4 → same group
SELF(9) ↔ OTHERS(10)    → ceil(9/2)=5, ceil(10/2)=5 → same group
```

### sameMotivationCategoryの実装

MOTIVATION_TAG値のグループ構造を利用:
```
Achievement: MASTERY(1), POWER(2), WEALTH(3)     → ceil(n/3)=1
Connection:  BELONGING(4), RECOGNITION(5), LOVE(6) → ceil(n/3)=2
Growth:      KNOWLEDGE(7), CREATION(8), FREEDOM(9) → ceil(n/3)=3
Preservation: PROTECTION(10), JUSTICE(11), SURVIVAL(12) → ceil(n/3)=4
```

---

Last updated: 2026-02-01
