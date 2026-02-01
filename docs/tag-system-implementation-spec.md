#涯庭 #Liminia

# Tag System 実装+テスト仕様書

Claude Code向け実装ガイド。Unified Tag System v2 の実装とテストを定義する。
作成日: 2026-02-01

---

## 参照すべきファイル

実装前に必ず以下のファイルを読み込んでください：

```
# 型定義（実装の基盤）
src/lib/types/constants.ts    # MAX_ENTITIES, CATEGORY
src/lib/types/brand.ts        # EntityId, entityId()
src/lib/types/entity.ts       # EntityStorage
src/lib/types/tags.ts         # TagStorage, DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG, SITUATION_TAG
src/lib/types/marks.ts        # WORLD_MARK（worldMarkタグの値域）

# 既存実装（パターン参照）
src/lib/core/entity/storage.ts    # createEntityStorage パターン
src/lib/core/entity/lifecycle.ts  # EntityId使用パターン
src/lib/core/entity/queries.ts    # 検索関数パターン

# 仕様書
docs/entity-storage-implementation-spec.md  # Entity実装仕様（パターン参照）
```

---

## 設計原則（Entity実装との一貫性）

以下の原則はEntity実装と同一。Tag実装でも厳守する：

1. **純粋関数設計**: storageを第1引数で受け取る。グローバル変数への暗黙的依存を避ける
2. **Branded Type使用**: エンティティIDには `EntityId` 型を使用（`number` ではない）
3. **Accessor Pattern**: TypedArrayの読み取りでは `!` (non-null assertion) を accessor関数内に集約
4. **TypedArrayへの直接書き込み**: 書き込みは `!` 不要。直接代入で良い
5. **erasableSyntaxOnly準拠**: `enum` 不使用。`as const` + 派生型パターン
6. **verbatimModuleSyntax準拠**: 型のみのimportは `import type` を使用
7. **JSDOCコメント**: 全公開関数に付与
8. **エラー処理**: 基本は null/false 返却。致命的エラーのみ throw

---

## ディレクトリ構成

```
src/lib/core/tags/
├── storage.ts        # TagStorage作成・初期化
├── accessors.ts      # get*/set* — アクセサパターン層（!集約）
├── operations.ts     # 一括設定・クリア・コピー
├── queries.ts        # タグ検索・マッチングスコア計算
└── index.ts          # バレルエクスポート
```

---

## TagStorageとEntityStorageの関係

```
EntityStorage           TagStorage
┌──────────────┐       ┌──────────────┐
│ categories   │       │ direction    │
│ hierarchyData│       │ axis         │
│ alive        │  ←──  │ axis2        │   同じEntityIdでインデックス
│ generations  │  参照  │ motivation   │
│ freeList     │       │ worldMark    │
│ nextId       │       │ worldMark2   │
│ capacity     │       │ situation    │
└──────────────┘       │ capacity     │
                       └──────────────┘
```

- TagStorageはEntityStorageと同じ `capacity` で作成する
- EntityIdをインデックスとして共有する
- タグの生存管理はEntityStorage.alive に委譲（TagStorage自体は alive を持たない）
- エンティティ破棄時にタグをクリアするかは呼び出し側の責務

---

## ファイル別実装仕様

### 1. storage.ts

**責務**: TagStorageインスタンスの作成と初期化

```typescript
import type { TagStorage } from '$lib/types/tags';
import { MAX_ENTITIES } from '$lib/types/constants';

/**
 * 新しいTagStorageを作成
 * @param capacity - 最大エンティティ数（デフォルト: MAX_ENTITIES）
 */
export function createTagStorage(capacity: number = MAX_ENTITIES): TagStorage {
  return {
    direction: new Uint8Array(capacity),
    axis: new Uint8Array(capacity),
    axis2: new Uint8Array(capacity),
    motivation: new Uint8Array(capacity),
    worldMark: new Uint8Array(capacity),
    worldMark2: new Uint8Array(capacity),
    situation: new Uint8Array(capacity),
    capacity,
  };
}

/**
 * TagStorageをクリア（全タグをNONE=0にリセット）
 */
export function clearTagStorage(storage: TagStorage): void {
  storage.direction.fill(0);
  storage.axis.fill(0);
  storage.axis2.fill(0);
  storage.motivation.fill(0);
  storage.worldMark.fill(0);
  storage.worldMark2.fill(0);
  storage.situation.fill(0);
}

/** グローバルTagStorageインスタンス */
export const globalTagStorage: TagStorage = createTagStorage();
```

**メモリ計算（capacity=2000の場合）**:

| 配列 | 型 | サイズ |
|------|-----|--------|
| direction | Uint8Array | 2,000 bytes |
| axis | Uint8Array | 2,000 bytes |
| axis2 | Uint8Array | 2,000 bytes |
| motivation | Uint8Array | 2,000 bytes |
| worldMark | Uint8Array | 2,000 bytes |
| worldMark2 | Uint8Array | 2,000 bytes |
| situation | Uint8Array | 2,000 bytes |
| **合計** | | **14,000 bytes (14KB)** |

Master Indexの見積もり（14KB）と一致。

---

### 2. accessors.ts

**責務**: TypedArrayのread/writeをBranded EntityIdで型安全に行うアクセサ層

**設計方針**:
- 読み取り（get）: `noUncheckedIndexedAccess` 対応のため `!` を使用。EntityIdブランドが有効範囲を保証
- 書き込み（set）: TypedArrayへの代入は `!` 不要
- 戻り値は `number`（Entity accessorのgetCategoryと同じパターン）
- 呼び出し側で `DIRECTION_TAG.ACTIVE` 等と比較する

```typescript
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

export function getAxis(s: TagStorage, id: EntityId): number {
  return s.axis[id]!;
}

export function setAxis(s: TagStorage, id: EntityId, value: number): void {
  s.axis[id] = value;
}

// ─── Axis2 (Secondary) ──────────────────────────────

export function getAxis2(s: TagStorage, id: EntityId): number {
  return s.axis2[id]!;
}

export function setAxis2(s: TagStorage, id: EntityId, value: number): void {
  s.axis2[id] = value;
}

// ─── Motivation ─────────────────────────────────────

export function getMotivation(s: TagStorage, id: EntityId): number {
  return s.motivation[id]!;
}

export function setMotivation(s: TagStorage, id: EntityId, value: number): void {
  s.motivation[id] = value;
}

// ─── WorldMark (Primary) ────────────────────────────

export function getWorldMark(s: TagStorage, id: EntityId): number {
  return s.worldMark[id]!;
}

export function setWorldMark(s: TagStorage, id: EntityId, value: number): void {
  s.worldMark[id] = value;
}

// ─── WorldMark2 (Secondary) ─────────────────────────

export function getWorldMark2(s: TagStorage, id: EntityId): number {
  return s.worldMark2[id]!;
}

export function setWorldMark2(s: TagStorage, id: EntityId, value: number): void {
  s.worldMark2[id] = value;
}

// ─── Situation ──────────────────────────────────────

export function getSituation(s: TagStorage, id: EntityId): number {
  return s.situation[id]!;
}

export function setSituation(s: TagStorage, id: EntityId, value: number): void {
  s.situation[id] = value;
}
```

**注意**: set関数の `value` パラメータ型を `number` としている理由:
- TypeScript の `as const` 派生型（`DirectionTagType` 等）はリテラル型のunion
- Uint8Arrayの要素型は `number` のため、代入時に自動的に受け入れられる
- 型の厳密性が必要な場合は呼び出し側で `DIRECTION_TAG.ACTIVE` を渡す
- ランタイムバリデーションは外部データ境界（IndexedDB load）でのみ実施

---

### 3. operations.ts

**責務**: 複数タグの一括操作

```typescript
import type { TagStorage } from '$lib/types/tags';
import type { EntityId } from '$lib/types/brand';

/** タグ一括設定用のオプション */
export interface TagOptions {
  direction?: number;
  axis?: number;
  axis2?: number;
  motivation?: number;
  worldMark?: number;
  worldMark2?: number;
  situation?: number;
}

/**
 * エンティティのタグを一括設定。指定されたフィールドのみ更新。
 * 未指定のフィールドは変更しない。
 */
export function setEntityTags(
  s: TagStorage,
  id: EntityId,
  tags: TagOptions
): void {
  if (tags.direction !== undefined) s.direction[id] = tags.direction;
  if (tags.axis !== undefined) s.axis[id] = tags.axis;
  if (tags.axis2 !== undefined) s.axis2[id] = tags.axis2;
  if (tags.motivation !== undefined) s.motivation[id] = tags.motivation;
  if (tags.worldMark !== undefined) s.worldMark[id] = tags.worldMark;
  if (tags.worldMark2 !== undefined) s.worldMark2[id] = tags.worldMark2;
  if (tags.situation !== undefined) s.situation[id] = tags.situation;
}

/**
 * エンティティの全タグをNONE=0にリセット
 */
export function clearEntityTags(s: TagStorage, id: EntityId): void {
  s.direction[id] = 0;
  s.axis[id] = 0;
  s.axis2[id] = 0;
  s.motivation[id] = 0;
  s.worldMark[id] = 0;
  s.worldMark2[id] = 0;
  s.situation[id] = 0;
}

/**
 * タグをエンティティ間でコピー
 * 用途: NPC復帰時の部分継承、テンプレートからの初期化
 */
export function copyEntityTags(
  s: TagStorage,
  fromId: EntityId,
  toId: EntityId
): void {
  s.direction[toId] = s.direction[fromId]!;
  s.axis[toId] = s.axis[fromId]!;
  s.axis2[toId] = s.axis2[fromId]!;
  s.motivation[toId] = s.motivation[fromId]!;
  s.worldMark[toId] = s.worldMark[fromId]!;
  s.worldMark2[toId] = s.worldMark2[fromId]!;
  s.situation[toId] = s.situation[fromId]!;
}
```

---

### 4. queries.ts

**責務**: タグによるエンティティ検索とマッチングスコア計算

**EntityStorage依存**: 検索関数はEntityStorageの `alive` 配列を参照して生存エンティティのみ返す。

```typescript
import type { TagStorage } from '$lib/types/tags';
import type { EntityStorage } from '$lib/types/entity';
import type { EntityId } from '$lib/types/brand';
import { entityId } from '$lib/types/brand';

/**
 * 指定Directionタグを持つ生存エンティティを返す
 */
export function getEntitiesByDirection(
  tags: TagStorage,
  entities: EntityStorage,
  direction: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.direction[i] === direction) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * 指定WorldMarkタグを持つ生存エンティティを返す
 * プライマリ・セカンダリの両方をチェック
 */
export function getEntitiesByWorldMark(
  tags: TagStorage,
  entities: EntityStorage,
  mark: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (
      entities.alive[i] === 1 &&
      (tags.worldMark[i] === mark || tags.worldMark2[i] === mark)
    ) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * 指定Motivationタグを持つ生存エンティティを返す
 */
export function getEntitiesByMotivation(
  tags: TagStorage,
  entities: EntityStorage,
  motivation: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.motivation[i] === motivation) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * 指定Axisタグを持つ生存エンティティを返す
 * プライマリ・セカンダリの両方をチェック
 */
export function getEntitiesByAxis(
  tags: TagStorage,
  entities: EntityStorage,
  axis: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (
      entities.alive[i] === 1 &&
      (tags.axis[i] === axis || tags.axis2[i] === axis)
    ) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * 指定Situationタグを持つ生存エンティティを返す
 */
export function getEntitiesBySituation(
  tags: TagStorage,
  entities: EntityStorage,
  situation: number
): EntityId[] {
  const result: EntityId[] = [];
  const limit = entities.nextId;
  for (let i = 0; i < limit; i++) {
    if (entities.alive[i] === 1 && tags.situation[i] === situation) {
      result.push(entityId(i));
    }
  }
  return result;
}

/**
 * 2つのエンティティ間のタグマッチングスコアを計算
 * 
 * IAUSの静的Considerationとして使用される。
 * 各タグカテゴリの一致/不一致をスコア化し、合計を返す。
 * 
 * スコア範囲: -500 〜 +500（IAUSで 0〜1 に正規化される）
 * 
 * 配点:
 *   - Direction一致: +100
 *   - Axis一致（primary-primary or primary-secondary）: +150
 *   - Motivation一致: +150
 *   - WorldMark一致（primary-primary or primary-secondary）: +100
 *   - Situation一致: +0（状況タグは動的なため静的スコアに含めない）
 *   - 全不一致ベースライン: -500
 * 
 * @returns スコア（-500 〜 +500）
 */
export function calculateTagMatchScore(
  s: TagStorage,
  id1: EntityId,
  id2: EntityId
): number {
  let score = -500; // Baseline: all mismatched

  // Direction match: +100
  const dir1 = s.direction[id1]!;
  const dir2 = s.direction[id2]!;
  if (dir1 !== 0 && dir1 === dir2) {
    score += 100;
  }

  // Axis match: +150 (check cross-match with secondary)
  const ax1 = s.axis[id1]!;
  const ax1s = s.axis2[id1]!;
  const ax2 = s.axis[id2]!;
  const ax2s = s.axis2[id2]!;
  if (ax1 !== 0 && (ax1 === ax2 || ax1 === ax2s)) {
    score += 150;
  } else if (ax1s !== 0 && (ax1s === ax2 || ax1s === ax2s)) {
    score += 75; // Secondary-only match: half points
  }

  // Motivation match: +150
  const mot1 = s.motivation[id1]!;
  const mot2 = s.motivation[id2]!;
  if (mot1 !== 0 && mot1 === mot2) {
    score += 150;
  }

  // WorldMark match: +100 (check cross-match with secondary)
  const wm1 = s.worldMark[id1]!;
  const wm1s = s.worldMark2[id1]!;
  const wm2 = s.worldMark[id2]!;
  const wm2s = s.worldMark2[id2]!;
  if (wm1 !== 0 && (wm1 === wm2 || wm1 === wm2s)) {
    score += 100;
  } else if (wm1s !== 0 && (wm1s === wm2 || wm1s === wm2s)) {
    score += 50; // Secondary-only match: half points
  }

  return score;
}
```

**スコア設計の根拠**:

| カテゴリ | Primary一致 | Secondary一致 | 重要度の理由 |
|---------|:-----------:|:------------:|-------------|
| Direction | +100 | — | 行動傾向は重要だが、状況で変わりうる |
| Axis | +150 | +75 | 性格の根幹。IAUSでの重み付け最大 |
| Motivation | +150 | — | 深層動機の一致は強い親和性を示す |
| WorldMark | +100 | +50 | 元素親和性。スキル相性に影響 |
| Situation | +0 | — | 動的タグのため静的スコアに含めない |

最大スコア: -500 + 100 + 150 + 150 + 100 = **0**（全primary一致）
最大スコア（secondary含む）: -500 + 100 + 150 + 150 + 100 = **0**
全一致+secondary bonus: 0 + 75 + 50 = **+125**

→ IAUS正規化: `(score + 500) / 1000` で 0.0 〜 0.625 の範囲

**Note**: スコア配点はIAUS実装時に調整される可能性がある。MVPではこの配点で実装し、ゲームプレイテストで調整する。

---

### 5. index.ts

**責務**: バレルエクスポート（tree-shaking対応）

```typescript
// Storage
export { createTagStorage, clearTagStorage, globalTagStorage } from './storage.js';

// Accessors
export {
  getDirection, setDirection,
  getAxis, setAxis,
  getAxis2, setAxis2,
  getMotivation, setMotivation,
  getWorldMark, setWorldMark,
  getWorldMark2, setWorldMark2,
  getSituation, setSituation,
} from './accessors.js';

// Operations
export type { TagOptions } from './operations.js';
export { setEntityTags, clearEntityTags, copyEntityTags } from './operations.js';

// Queries
export {
  getEntitiesByDirection,
  getEntitiesByWorldMark,
  getEntitiesByMotivation,
  getEntitiesByAxis,
  getEntitiesBySituation,
  calculateTagMatchScore,
} from './queries.js';
```

---

## テスト仕様

### テストファイル構成

```
src/lib/core/tags/
├── storage.test.ts        # 5テスト
├── accessors.test.ts      # 18テスト
├── operations.test.ts     # 12テスト
└── queries.test.ts        # 17テスト
                            合計: 52テスト（目安）
```

### 共通パターン

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTagStorage, clearTagStorage } from './storage';
import { createEntityStorage } from '../entity/storage';
import { createEntity } from '../entity/lifecycle';
import { CATEGORY } from '$lib/types/constants';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG, SITUATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
```

---

### storage.test.ts（5テスト）

```typescript
describe('createTagStorage', () => {
  it('should create storage with default capacity', () => {
    const s = createTagStorage();
    expect(s.direction.length).toBe(2000); // MAX_ENTITIES
    expect(s.capacity).toBe(2000);
  });

  it('should create storage with custom capacity', () => {
    const s = createTagStorage(100);
    expect(s.direction.length).toBe(100);
    expect(s.axis.length).toBe(100);
    expect(s.capacity).toBe(100);
  });

  it('should initialize all arrays to zero', () => {
    const s = createTagStorage(10);
    for (let i = 0; i < 10; i++) {
      expect(s.direction[i]).toBe(0);
      expect(s.axis[i]).toBe(0);
      expect(s.axis2[i]).toBe(0);
      expect(s.motivation[i]).toBe(0);
      expect(s.worldMark[i]).toBe(0);
      expect(s.worldMark2[i]).toBe(0);
      expect(s.situation[i]).toBe(0);
    }
  });
});

describe('clearTagStorage', () => {
  it('should reset all arrays to zero', () => {
    const s = createTagStorage(10);
    // Set some values
    s.direction[0] = 1;
    s.axis[1] = 3;
    s.worldMark[2] = 5;

    clearTagStorage(s);

    expect(s.direction[0]).toBe(0);
    expect(s.axis[1]).toBe(0);
    expect(s.worldMark[2]).toBe(0);
  });

  it('should not change capacity', () => {
    const s = createTagStorage(50);
    clearTagStorage(s);
    expect(s.capacity).toBe(50);
  });
});
```

---

### accessors.test.ts（18テスト）

各タグフィールドについて `get → 初期値0`, `set → get で確認`, `複数エンティティ独立性` の3パターン。
7フィールド × 2テスト（初期値 + set/get） + 4テスト（複数エンティティ独立性・境界値） = 18テスト目安。

```typescript
describe('direction accessors', () => {
  it('should return 0 (NONE) for unset entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.NONE);
  });

  it('should set and get direction', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.ACTIVE);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE);
  });
});

describe('axis accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get primary axis', () => { /* ... */ });
});

describe('axis2 accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get secondary axis', () => { /* ... */ });
});

describe('motivation accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get motivation', () => { /* ... */ });
});

describe('worldMark accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get primary worldMark', () => { /* ... */ });
});

describe('worldMark2 accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get secondary worldMark', () => { /* ... */ });
});

describe('situation accessors', () => {
  it('should return 0 (NONE) for unset entity', () => { /* ... */ });
  it('should set and get situation', () => { /* ... */ });
});

describe('accessor independence', () => {
  it('should not affect other entities when setting tags', () => {
    const s = createTagStorage(10);
    setDirection(s, entityId(0), DIRECTION_TAG.ACTIVE);
    setDirection(s, entityId(1), DIRECTION_TAG.PASSIVE);
    expect(getDirection(s, entityId(0))).toBe(DIRECTION_TAG.ACTIVE);
    expect(getDirection(s, entityId(1))).toBe(DIRECTION_TAG.PASSIVE);
  });

  it('should not affect other tag fields when setting one', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.ACTIVE);
    expect(getAxis(s, id)).toBe(AXIS_TAG.NONE); // unchanged
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.NONE);
  });

  it('should handle max Uint8 value (255)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, 255);
    expect(getDirection(s, id)).toBe(255);
  });

  it('should clamp values above 255 to Uint8 range', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, 256); // Uint8Array auto-clamps
    expect(getDirection(s, id)).toBe(0); // 256 % 256 = 0
  });
});
```

---

### operations.test.ts（12テスト）

```typescript
describe('setEntityTags', () => {
  it('should set all specified tags at once', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.BOLD,
      motivation: MOTIVATION_TAG.MASTERY,
      worldMark: WORLD_MARK.BLOOD,
    });
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE);
    expect(getAxis(s, id)).toBe(AXIS_TAG.BOLD);
    expect(getMotivation(s, id)).toBe(MOTIVATION_TAG.MASTERY);
    expect(getWorldMark(s, id)).toBe(WORLD_MARK.BLOOD);
  });

  it('should only update specified fields (partial update)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.ORDER,
    });
    setEntityTags(s, id, { axis: AXIS_TAG.CHAOS });
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.ACTIVE); // unchanged
    expect(getAxis(s, id)).toBe(AXIS_TAG.CHAOS); // updated
  });

  it('should handle empty options (no-op)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.SOCIAL);
    setEntityTags(s, id, {});
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.SOCIAL);
  });

  it('should set secondary tags', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      axis: AXIS_TAG.ORDER,
      axis2: AXIS_TAG.STABLE,
      worldMark: WORLD_MARK.BONE,
      worldMark2: WORLD_MARK.BLOOD,
    });
    expect(getAxis2(s, id)).toBe(AXIS_TAG.STABLE);
    expect(getWorldMark2(s, id)).toBe(WORLD_MARK.BLOOD);
  });
});

describe('clearEntityTags', () => {
  it('should reset all tags to NONE for specified entity', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setEntityTags(s, id, {
      direction: DIRECTION_TAG.ACTIVE,
      axis: AXIS_TAG.BOLD,
      motivation: MOTIVATION_TAG.POWER,
      worldMark: WORLD_MARK.BLOOD,
      situation: SITUATION_TAG.DANGER,
    });
    clearEntityTags(s, id);
    expect(getDirection(s, id)).toBe(0);
    expect(getAxis(s, id)).toBe(0);
    expect(getMotivation(s, id)).toBe(0);
    expect(getWorldMark(s, id)).toBe(0);
    expect(getSituation(s, id)).toBe(0);
  });

  it('should not affect other entities', () => {
    const s = createTagStorage(10);
    const id0 = entityId(0);
    const id1 = entityId(1);
    setDirection(s, id0, DIRECTION_TAG.ACTIVE);
    setDirection(s, id1, DIRECTION_TAG.PASSIVE);
    clearEntityTags(s, id0);
    expect(getDirection(s, id0)).toBe(0);
    expect(getDirection(s, id1)).toBe(DIRECTION_TAG.PASSIVE); // unchanged
  });
});

describe('copyEntityTags', () => {
  it('should copy all tags from source to destination', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setEntityTags(s, src, {
      direction: DIRECTION_TAG.SOCIAL,
      axis: AXIS_TAG.EXTRA,
      axis2: AXIS_TAG.OTHERS,
      motivation: MOTIVATION_TAG.BELONGING,
      worldMark: WORLD_MARK.BREATH,
      worldMark2: WORLD_MARK.TEAR,
      situation: SITUATION_TAG.CROWD,
    });
    copyEntityTags(s, src, dst);
    expect(getDirection(s, dst)).toBe(DIRECTION_TAG.SOCIAL);
    expect(getAxis(s, dst)).toBe(AXIS_TAG.EXTRA);
    expect(getAxis2(s, dst)).toBe(AXIS_TAG.OTHERS);
    expect(getMotivation(s, dst)).toBe(MOTIVATION_TAG.BELONGING);
    expect(getWorldMark(s, dst)).toBe(WORLD_MARK.BREATH);
    expect(getWorldMark2(s, dst)).toBe(WORLD_MARK.TEAR);
    expect(getSituation(s, dst)).toBe(SITUATION_TAG.CROWD);
  });

  it('should not modify source', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setDirection(s, src, DIRECTION_TAG.ACTIVE);
    copyEntityTags(s, src, dst);
    expect(getDirection(s, src)).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should overwrite destination tags', () => {
    const s = createTagStorage(10);
    const src = entityId(0);
    const dst = entityId(1);
    setDirection(s, src, DIRECTION_TAG.ACTIVE);
    setDirection(s, dst, DIRECTION_TAG.PASSIVE);
    copyEntityTags(s, src, dst);
    expect(getDirection(s, dst)).toBe(DIRECTION_TAG.ACTIVE);
  });

  it('should handle copy to same entity (self-copy)', () => {
    const s = createTagStorage(10);
    const id = entityId(0);
    setDirection(s, id, DIRECTION_TAG.SOCIAL);
    copyEntityTags(s, id, id);
    expect(getDirection(s, id)).toBe(DIRECTION_TAG.SOCIAL);
  });
});
```

---

### queries.test.ts（17テスト）

テストではEntityStorageとTagStorageの両方をセットアップし、実際のエンティティ作成フローを模倣する。

```typescript
describe('getEntitiesByDirection', () => {
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should return entities with matching direction', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    const h3 = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h1.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h2.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h3.id, DIRECTION_TAG.PASSIVE);

    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.ACTIVE);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(h1.id);
    expect(result).toContainEqual(h2.id);
  });

  it('should exclude dead entities', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h1.id, DIRECTION_TAG.ACTIVE);
    setDirection(tags, h2.id, DIRECTION_TAG.ACTIVE);
    destroyEntity(entities, h1.id);

    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.ACTIVE);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(h2.id);
  });

  it('should return empty array when no match', () => {
    createEntity(entities, { category: CATEGORY.NPC });
    const result = getEntitiesByDirection(tags, entities, DIRECTION_TAG.SOCIAL);
    expect(result).toHaveLength(0);
  });
});

describe('getEntitiesByWorldMark', () => {
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should match primary worldMark', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BONE);
    expect(result).toHaveLength(1);
  });

  it('should match secondary worldMark', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    setWorldMark2(tags, h1.id, WORLD_MARK.BLOOD);
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BLOOD);
    expect(result).toHaveLength(1);
  });

  it('should not double-count entity matching both primary and secondary', () => {
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setWorldMark(tags, h1.id, WORLD_MARK.BONE);
    setWorldMark2(tags, h1.id, WORLD_MARK.BONE); // same mark on both
    const result = getEntitiesByWorldMark(tags, entities, WORLD_MARK.BONE);
    expect(result).toHaveLength(1); // still 1, not 2
  });
});

describe('getEntitiesByMotivation', () => {
  it('should return entities with matching motivation', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    const h2 = createEntity(entities, { category: CATEGORY.NPC });
    setMotivation(tags, h1.id, MOTIVATION_TAG.KNOWLEDGE);
    setMotivation(tags, h2.id, MOTIVATION_TAG.WEALTH);

    const result = getEntitiesByMotivation(tags, entities, MOTIVATION_TAG.KNOWLEDGE);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(h1.id);
  });
});

describe('getEntitiesByAxis', () => {
  it('should match primary axis', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setAxis(tags, h1.id, AXIS_TAG.ORDER);
    const result = getEntitiesByAxis(tags, entities, AXIS_TAG.ORDER);
    expect(result).toHaveLength(1);
  });

  it('should match secondary axis', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setAxis(tags, h1.id, AXIS_TAG.ORDER);
    setAxis2(tags, h1.id, AXIS_TAG.STABLE);
    const result = getEntitiesByAxis(tags, entities, AXIS_TAG.STABLE);
    expect(result).toHaveLength(1);
  });
});

describe('getEntitiesBySituation', () => {
  it('should return entities with matching situation', () => {
    const tags = createTagStorage(20);
    const entities = createEntityStorage(20);
    const h1 = createEntity(entities, { category: CATEGORY.NPC });
    setSituation(tags, h1.id, SITUATION_TAG.DANGER);
    const result = getEntitiesBySituation(tags, entities, SITUATION_TAG.DANGER);
    expect(result).toHaveLength(1);
  });
});

describe('calculateTagMatchScore', () => {
  let s: TagStorage;

  beforeEach(() => {
    s = createTagStorage(10);
  });

  it('should return -500 for two untagged entities', () => {
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500);
  });

  it('should add 100 for direction match', () => {
    setDirection(s, entityId(0), DIRECTION_TAG.ACTIVE);
    setDirection(s, entityId(1), DIRECTION_TAG.ACTIVE);
    // Only direction matches, others are NONE (0) → 0===0 but guarded by !== 0 check
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 100);
  });

  it('should not score NONE matches (0 === 0)', () => {
    // Both entities have all tags = NONE (0)
    // The !== 0 guard should prevent scoring NONE === NONE as a match
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500);
  });

  it('should add 150 for primary axis match', () => {
    setAxis(s, entityId(0), AXIS_TAG.ORDER);
    setAxis(s, entityId(1), AXIS_TAG.ORDER);
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 150);
  });

  it('should add 75 for secondary-only axis match', () => {
    setAxis(s, entityId(0), AXIS_TAG.ORDER);
    setAxis2(s, entityId(0), AXIS_TAG.STABLE);
    setAxis(s, entityId(1), AXIS_TAG.BOLD);
    setAxis2(s, entityId(1), AXIS_TAG.STABLE);
    // Primary mismatch (ORDER vs BOLD), secondary match (STABLE vs STABLE)
    expect(calculateTagMatchScore(s, entityId(0), entityId(1))).toBe(-500 + 75);
  });

  it('should score full match correctly', () => {
    const id0 = entityId(0);
    const id1 = entityId(1);
    // Set identical primary tags
    setDirection(s, id0, DIRECTION_TAG.ACTIVE);
    setDirection(s, id1, DIRECTION_TAG.ACTIVE);
    setAxis(s, id0, AXIS_TAG.BOLD);
    setAxis(s, id1, AXIS_TAG.BOLD);
    setMotivation(s, id0, MOTIVATION_TAG.MASTERY);
    setMotivation(s, id1, MOTIVATION_TAG.MASTERY);
    setWorldMark(s, id0, WORLD_MARK.BLOOD);
    setWorldMark(s, id1, WORLD_MARK.BLOOD);

    // -500 + 100 + 150 + 150 + 100 = 0
    expect(calculateTagMatchScore(s, id0, id1)).toBe(0);
  });

  it('should handle cross-match (primary1 vs secondary2)', () => {
    const id0 = entityId(0);
    const id1 = entityId(1);
    setAxis(s, id0, AXIS_TAG.ORDER);
    setAxis(s, id1, AXIS_TAG.BOLD);
    setAxis2(s, id1, AXIS_TAG.ORDER);  // secondary matches id0's primary
    // Primary axis: id0.ORDER vs id1.BOLD → mismatch
    // But id0.ORDER === id1.axis2.ORDER → primary-to-secondary match = 150
    expect(calculateTagMatchScore(s, id0, id1)).toBe(-500 + 150);
  });
});
```

---

## Claude Codeへの指示手順

### Step 1: 型定義の確認

```
以下のファイルを読んでください:
- src/lib/types/tags.ts
- src/lib/types/marks.ts
- src/lib/types/brand.ts
- src/lib/types/constants.ts
- src/lib/types/entity.ts
```

### Step 2: 既存パターンの確認

```
以下の既存実装を読んで、コードスタイルとパターンを確認してください:
- src/lib/core/entity/storage.ts
- src/lib/core/entity/lifecycle.ts
- src/lib/core/entity/queries.ts
- docs/tag-system-implementation-spec.md（この仕様書）
```

### Step 3: 実装（ファイルごとに段階的に）

```
docs/tag-system-implementation-spec.md に従って、
src/lib/core/tags/storage.ts を実装してください。
```

```
src/lib/core/tags/accessors.ts を実装してください。
EntityのAccessor Patternに従い、!はget関数内に集約。
```

```
src/lib/core/tags/operations.ts を実装してください。
```

```
src/lib/core/tags/queries.ts を実装してください。
EntityStorageのaliveチェックを必ず含めること。
```

```
src/lib/core/tags/index.ts を作成してください。
```

### Step 4: テスト

```
docs/tag-system-implementation-spec.md のテスト仕様に従って、
以下のテストファイルを作成してください:
- src/lib/core/tags/storage.test.ts
- src/lib/core/tags/accessors.test.ts
- src/lib/core/tags/operations.test.ts
- src/lib/core/tags/queries.test.ts
```

### Step 5: 検証

```
bun run test を実行して全テストがパスすることを確認してください。
bun run typecheck も実行してください。
失敗があれば原因を特定して修正してください。
```

---

## タグ定数値一覧（型定義ファイルからの参照用）

### DIRECTION_TAG（src/lib/types/tags.ts）

| 名前 | 値 | 用途 |
|------|:--:|------|
| NONE | 0 | 未設定 |
| ACTIVE | 1 | 戦闘・探索 |
| PASSIVE | 2 | 制作・研究 |
| SOCIAL | 3 | 交渉・指導 |

### AXIS_TAG（src/lib/types/tags.ts）

| 名前 | 値 | 軸 |
|------|:--:|-----|
| NONE | 0 | 未設定 |
| ORDER | 1 | Order-Chaos |
| CHAOS | 2 | Order-Chaos |
| INTRO | 3 | Extraversion |
| EXTRA | 4 | Extraversion |
| STABLE | 5 | Stability |
| REACTIVE | 6 | Stability |
| CAUTIOUS | 7 | Approach |
| BOLD | 8 | Approach |
| SELF | 9 | Focus |
| OTHERS | 10 | Focus |

### MOTIVATION_TAG（src/lib/types/tags.ts）

| 名前 | 値 | カテゴリ |
|------|:--:|---------|
| NONE | 0 | 未設定 |
| MASTERY | 1 | Achievement |
| POWER | 2 | Achievement |
| WEALTH | 3 | Achievement |
| BELONGING | 4 | Connection |
| RECOGNITION | 5 | Connection |
| LOVE | 6 | Connection |
| KNOWLEDGE | 7 | Growth |
| CREATION | 8 | Growth |
| FREEDOM | 9 | Growth |
| PROTECTION | 10 | Preservation |
| JUSTICE | 11 | Preservation |
| SURVIVAL | 12 | Preservation |

### SITUATION_TAG（src/lib/types/tags.ts）

| 名前 | 値 | 用途 |
|------|:--:|------|
| NONE | 0 | 未設定 |
| DANGER | 1 | 危険状態 |
| PEACEFUL | 2 | 平和状態 |
| CHAOS_HIGH | 3 | 高Chaos |
| CHAOS_LOW | 4 | 低Chaos |
| CROWD | 5 | 群衆 |
| QUIET | 6 | 静寂 |

### WORLD_MARK（src/lib/types/marks.ts）

| 名前 | 値 | 日本語 |
|------|:--:|--------|
| NONE | 0 | 未設定 |
| BONE | 1 | 骨 |
| BLOOD | 2 | 血 |
| BREATH | 3 | 息 |
| TEAR | 4 | 涙 |
| EYE | 5 | 眼 |
| SHADOW | 6 | 影 |
| EAR | 7 | 耳 |
| SKIN | 8 | 肌 |

---

## TagStorage の capacity フィールドについて

tags.ts の `TagStorage` インターフェースに `capacity` フィールドが定義されていない場合、
以下のいずれかの対応が必要：

**選択肢A（推奨）**: `tags.ts` に `capacity: number` を追加

```typescript
export interface TagStorage {
  direction: Uint8Array;
  axis: Uint8Array;
  axis2: Uint8Array;
  motivation: Uint8Array;
  worldMark: Uint8Array;
  worldMark2: Uint8Array;
  situation: Uint8Array;
  capacity: number;  // ← 追加
}
```

**選択肢B**: `createTagStorage` の戻り値で `TagStorage & { capacity: number }` とする

EntityStorageが `capacity` を持つのと整合性を取るため、**選択肢A** を推奨。
型定義ファイルの変更が必要な場合は実装前に確認すること。

---

## 注意事項

### TypedArrayアクセスの ! パターン

`noUncheckedIndexedAccess` が有効なため、TypedArray要素アクセスは `T | undefined` を返す。
`!` は **accessor関数内のみ** で使用し、他の場所では使わない。

```typescript
// ✅ OK: accessor内
export function getDirection(s: TagStorage, id: EntityId): number {
  return s.direction[id]!;
}

// ❌ NG: accessor外でのraw access with !
const dir = tagStorage.direction[someId]!;  // 禁止
```

### copyEntityTagsの読み取り側 !

`copyEntityTags` は fromId からの読み取りに `!` を使用する。
これはaccessor関数ではないが、Branded EntityIdの保証により安全。

### import type の使用

`verbatimModuleSyntax` 有効のため、型のみのimportは必ず `import type` を使用：

```typescript
import type { TagStorage } from '$lib/types/tags';
import type { EntityId } from '$lib/types/brand';
import { entityId } from '$lib/types/brand';           // 値もimportする場合はseparate
import { DIRECTION_TAG } from '$lib/types/tags';        // 値のimportはimport typeなし
```

---

Last updated: 2026-02-01
