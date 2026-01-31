#涯庭 #Liminia

# EntityStorage実装仕様書

Claude Code向け実装ガイド
作成日: 2026-01-31

---

## 参照すべきファイル

実装前に必ず以下のファイルを読み込んでください：

```
# 型定義（実装の基盤）
src/lib/types/constants.ts    # CATEGORY, MAX_ENTITIES, SMI_MAX
src/lib/types/entity.ts       # EntityStorage, EntityHandle, CreateEntityOptions
```

---

## ディレクトリ構成

```
src/lib/core/entity/
├── storage.ts      # EntityStorage作成・初期化
├── lifecycle.ts    # create/destroy/recycle操作
├── queries.ts      # カテゴリ検索・フィルタリング
├── validation.ts   # EntityHandle検証
└── index.ts        # バレルエクスポート
```

---

## ファイル別実装仕様

### 1. storage.ts

**責務**: EntityStorageインスタンスの作成と初期化

```typescript
import type { EntityStorage } from '$types';
import { MAX_ENTITIES } from '$types';

/**
 * 新しいEntityStorageを作成
 * @param capacity - 最大エンティティ数（デフォルト: MAX_ENTITIES）
 */
export function createEntityStorage(capacity?: number): EntityStorage;

/**
 * EntityStorageをクリア（全エンティティ削除）
 * テストやリセット時に使用
 */
export function clearStorage(storage: EntityStorage): void;

/**
 * グローバルストレージインスタンス
 * アプリケーション全体で共有
 */
export const globalStorage: EntityStorage;
```

**実装ポイント**:
- TypedArrayは`new Uint8Array(capacity)`で初期化
- freeListは空配列`[]`で開始
- nextIdは0から開始
- capacityはデフォルトでMAX_ENTITIES (2000)

---

### 2. lifecycle.ts

**責務**: エンティティの作成・破棄・リサイクル

```typescript
import type { 
  EntityStorage, 
  EntityHandle, 
  CreateEntityOptions,
  CategoryType 
} from '$types';

/**
 * 新しいエンティティを作成
 * @returns EntityHandle（idとgenerationのペア）
 * @throws Error - ストレージが満杯の場合
 */
export function createEntity(
  storage: EntityStorage,
  options: CreateEntityOptions
): EntityHandle;

/**
 * エンティティを破棄（IDはリサイクル可能になる）
 * @returns true=成功, false=既に死亡または無効なID
 */
export function destroyEntity(
  storage: EntityStorage,
  id: number
): boolean;

/**
 * エンティティが生存しているか確認
 */
export function isAlive(storage: EntityStorage, id: number): boolean;

/**
 * 現在のアクティブエンティティ数を取得
 */
export function getActiveCount(storage: EntityStorage): number;
```

**実装ポイント**:

1. **createEntity フロー**:
   ```
   freeListが空でない → freeList.pop()でID取得
   freeListが空 → nextId使用、nextId++
   
   capacity超過チェック → Errorをthrow
   
   categories[id] = options.category
   hierarchyData[id] = options.hierarchyData ?? 0
   alive[id] = 1
   generations[id]++ (リサイクル時のみインクリメント)
   
   return { id, generation: generations[id] }
   ```

2. **destroyEntity フロー**:
   ```
   alive[id] === 0 → return false
   
   alive[id] = 0
   categories[id] = 0 (CATEGORY.NONE)
   freeList.push(id)
   
   return true
   ```

3. **generationの扱い**:
   - 新規ID（nextIdから）: generation = 0
   - リサイクルID: 既存のgeneration + 1
   - destroyではgenerationを変更しない（createでインクリメント）

---

### 3. queries.ts

**責務**: エンティティの検索・フィルタリング

```typescript
import type { EntityStorage, CategoryType, EntityQueryResult } from '$types';
import { CATEGORY, CATEGORY_RANGE } from '$types';

/**
 * 特定カテゴリの全エンティティIDを取得
 */
export function getEntitiesByCategory(
  storage: EntityStorage,
  category: CategoryType
): number[];

/**
 * カテゴリ範囲内の全エンティティIDを取得
 * 例: 全キャラクター、全ロケーション
 */
export function getEntitiesInRange(
  storage: EntityStorage,
  minCategory: number,
  maxCategory: number
): number[];

/**
 * 便利関数: 全キャラクター取得
 */
export function getAllCharacters(storage: EntityStorage): number[];

/**
 * 便利関数: 全敵対エンティティ取得
 */
export function getAllHostiles(storage: EntityStorage): number[];

/**
 * 便利関数: 全ロケーション取得
 */
export function getAllLocations(storage: EntityStorage): number[];

/**
 * 便利関数: 全PC取得
 */
export function getAllPCs(storage: EntityStorage): number[];

/**
 * 便利関数: 全NPC取得
 */
export function getAllNPCs(storage: EntityStorage): number[];

/**
 * エンティティの詳細情報を取得
 * @returns EntityQueryResult or null（無効/死亡の場合）
 */
export function getEntityInfo(
  storage: EntityStorage,
  id: number
): EntityQueryResult | null;

/**
 * カテゴリ判定ヘルパー
 */
export function isCharacter(storage: EntityStorage, id: number): boolean;
export function isHostile(storage: EntityStorage, id: number): boolean;
export function isLocation(storage: EntityStorage, id: number): boolean;
export function isFaction(storage: EntityStorage, id: number): boolean;
export function isPC(storage: EntityStorage, id: number): boolean;
export function isNPC(storage: EntityStorage, id: number): boolean;
```

**実装ポイント**:

1. **パフォーマンス優先のループ**:
   ```typescript
   // 良い例: シンプルなforループ
   for (let id = 0; id < storage.nextId; id++) {
     if (storage.alive[id] && storage.categories[id] === category) {
       results.push(id);
     }
   }
   
   // 避ける: Array.from + filter（メモリ確保が多い）
   ```

2. **範囲チェックの活用**:
   ```typescript
   export function getAllCharacters(storage: EntityStorage): number[] {
     return getEntitiesInRange(
       storage,
       CATEGORY_RANGE.CHARACTER.min,
       CATEGORY_RANGE.CHARACTER.max
     );
   }
   ```

---

### 4. validation.ts

**責務**: EntityHandleの有効性検証

```typescript
import type { EntityStorage, EntityHandle } from '$types';

/**
 * EntityHandleが有効か検証
 * - IDが範囲内
 * - エンティティが生存
 * - generationが一致
 */
export function isValidHandle(
  storage: EntityStorage,
  handle: EntityHandle
): boolean;

/**
 * EntityHandleからIDを安全に取得
 * @returns number or null（無効な場合）
 */
export function resolveHandle(
  storage: EntityStorage,
  handle: EntityHandle
): number | null;

/**
 * IDからEntityHandleを生成
 * @returns EntityHandle or null（無効/死亡の場合）
 */
export function getHandle(
  storage: EntityStorage,
  id: number
): EntityHandle | null;
```

**実装ポイント**:

```typescript
export function isValidHandle(
  storage: EntityStorage,
  handle: EntityHandle
): boolean {
  const { id, generation } = handle;
  
  // 範囲チェック
  if (id < 0 || id >= storage.nextId) return false;
  
  // 生存チェック
  if (!storage.alive[id]) return false;
  
  // 世代チェック
  if (storage.generations[id] !== generation) return false;
  
  return true;
}
```

---

### 5. index.ts

**責務**: バレルエクスポート

```typescript
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
```

---

## テスト要件

### テストファイル配置

```
src/lib/core/entity/
├── storage.test.ts
├── lifecycle.test.ts
├── queries.test.ts
└── validation.test.ts
```

### 最低限のテストケース

**lifecycle.test.ts**:
```typescript
describe('createEntity', () => {
  it('should create entity with sequential ID');
  it('should recycle IDs from freeList');
  it('should increment generation on recycle');
  it('should throw when storage is full');
});

describe('destroyEntity', () => {
  it('should mark entity as dead');
  it('should add ID to freeList');
  it('should return false for already dead entity');
});
```

**queries.test.ts**:
```typescript
describe('getEntitiesByCategory', () => {
  it('should return only alive entities');
  it('should return empty array when no matches');
});

describe('category helpers', () => {
  it('isPC should return true only for PC category');
  it('isCharacter should return true for PC, NPC, and hostiles');
});
```

**validation.test.ts**:
```typescript
describe('isValidHandle', () => {
  it('should return true for valid handle');
  it('should return false for dead entity');
  it('should return false for wrong generation');
});
```

---

## コーディング規約

1. **関数は純粋関数として設計**（storageを引数で受け取る）
2. **globalStorageは利便性のため提供**するが、テストでは個別storage使用
3. **TypedArrayへの直接アクセス**を隠蔽しない（パフォーマンス優先）
4. **エラーはthrowではなくnull/false返却**を基本とする（destroyEntity以外）
5. **JSDOCコメント**を全公開関数に付与

---

## 実装順序

```
1. storage.ts      （基盤、他が依存）
2. lifecycle.ts    （CRUD操作）
3. queries.ts      （検索機能）
4. validation.ts   （安全性機能）
5. index.ts        （エクスポート）
6. *.test.ts       （テスト）
```

---

## Claude Codeへの指示例

```
/read docs/entity-storage-implementation-spec.md
/read src/lib/types/constants.ts
/read src/lib/types/entity.ts

src/lib/core/entity/storage.ts を実装してください。
```

続けて：

```
src/lib/core/entity/lifecycle.ts を実装してください。
storage.tsをimportして使用。
```
