#涯庭 #Liminia

# Vitestセットアップ＋Entityテスト実装仕様書

Claude Code向け実装ガイド
作成日: 2026-01-31

---

## 参照すべきファイル

```
# 既存設定
package.json
tsconfig.json

# テスト対象
src/lib/types/constants.ts
src/lib/types/entity.ts
src/lib/core/entity/storage.ts
src/lib/core/entity/lifecycle.ts
src/lib/core/entity/queries.ts
src/lib/core/entity/validation.ts
```

---

## Step 1: Vitestセットアップ

### 1-1. パッケージインストール

```bash
bun add -D vitest
```

### 1-2. vitest.config.ts 作成（プロジェクトルート）

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src/lib'),
      '$types': resolve(__dirname, 'src/lib/types'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    globals: false,  // 明示的にimportを使用
  },
});
```

**重要**: tsconfig.jsonの`paths`エイリアス（`$lib/*`, `$types/*`）をVitestでも解決するために`resolve.alias`が必須。

### 1-3. package.json scriptsへの追加

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 1-4. tsconfig.json includeパターンの確認

現在の`"include": ["src/**/*.ts"]`で`.test.ts`ファイルもカバーされるため変更不要。

---

## Step 2: テストファイル実装

### ディレクトリ構成

```
src/lib/core/entity/
├── storage.ts
├── lifecycle.ts
├── queries.ts
├── validation.ts
├── index.ts
├── storage.test.ts       ← 新規
├── lifecycle.test.ts     ← 新規
├── queries.test.ts       ← 新規
└── validation.test.ts    ← 新規
```

テストファイルはテスト対象と同一ディレクトリに配置する（コロケーションパターン）。

---

### 2-1. storage.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { createEntityStorage, clearStorage } from './storage';
import { MAX_ENTITIES } from '$lib/types';

describe('createEntityStorage', () => {
  it('should create storage with default capacity', () => {
    const storage = createEntityStorage();
    expect(storage.capacity).toBe(MAX_ENTITIES);
    expect(storage.nextId).toBe(0);
    expect(storage.freeList).toEqual([]);
  });

  it('should create storage with custom capacity', () => {
    const storage = createEntityStorage(100);
    expect(storage.capacity).toBe(100);
    expect(storage.categories.length).toBe(100);
    expect(storage.hierarchyData.length).toBe(100);
    expect(storage.alive.length).toBe(100);
    expect(storage.generations.length).toBe(100);
  });

  it('should initialize all TypedArrays with zeros', () => {
    const storage = createEntityStorage(10);
    for (let i = 0; i < 10; i++) {
      expect(storage.categories[i]).toBe(0);
      expect(storage.hierarchyData[i]).toBe(0);
      expect(storage.alive[i]).toBe(0);
      expect(storage.generations[i]).toBe(0);
    }
  });
});

describe('clearStorage', () => {
  it('should reset all state to initial values', () => {
    const storage = createEntityStorage(10);
    // Manually dirty the storage
    storage.categories[0] = 1;
    storage.alive[0] = 1;
    storage.nextId = 5;
    storage.freeList.push(3);

    clearStorage(storage);

    expect(storage.nextId).toBe(0);
    expect(storage.freeList).toEqual([]);
    expect(storage.categories[0]).toBe(0);
    expect(storage.alive[0]).toBe(0);
  });

  it('should preserve capacity after clear', () => {
    const storage = createEntityStorage(50);
    clearStorage(storage);
    expect(storage.capacity).toBe(50);
    expect(storage.categories.length).toBe(50);
  });
});
```

---

### 2-2. lifecycle.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage, clearStorage } from './storage';
import { createEntity, destroyEntity, isAlive, getActiveCount } from './lifecycle';
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';

describe('createEntity', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should create entity with sequential ID starting from 0', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(handle.id).toBe(0);
    expect(handle.generation).toBe(0);
  });

  it('should assign sequential IDs', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    const h2 = createEntity(storage, { category: CATEGORY.PC });
    const h3 = createEntity(storage, { category: CATEGORY.NPC });
    expect(h1.id).toBe(0);
    expect(h2.id).toBe(1);
    expect(h3.id).toBe(2);
    expect(storage.nextId).toBe(3);
  });

  it('should set category and hierarchyData correctly', () => {
    createEntity(storage, {
      category: CATEGORY.LOCATION_URBAN,
      hierarchyData: 0x00A00000,
    });
    expect(storage.categories[0]).toBe(CATEGORY.LOCATION_URBAN);
    expect(storage.hierarchyData[0]).toBe(0x00A00000);
  });

  it('should default hierarchyData to 0', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    expect(storage.hierarchyData[0]).toBe(0);
  });

  it('should mark entity as alive', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(storage.alive[handle.id]).toBe(1);
  });

  it('should recycle IDs from freeList', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);

    // New entity should reuse ID 0
    const h3 = createEntity(storage, { category: CATEGORY.PC });
    expect(h3.id).toBe(0);
  });

  it('should increment generation on recycle', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    expect(h1.generation).toBe(0);

    destroyEntity(storage, h1.id);

    const h2 = createEntity(storage, { category: CATEGORY.PC });
    expect(h2.id).toBe(0);
    expect(h2.generation).toBe(1);
  });

  it('should increment generation on each recycle', () => {
    // Create, destroy, recreate 3 times
    for (let cycle = 0; cycle < 3; cycle++) {
      const handle = createEntity(storage, { category: CATEGORY.NPC });
      expect(handle.id).toBe(0);
      expect(handle.generation).toBe(cycle);
      destroyEntity(storage, 0);
    }
  });

  it('should throw when storage is full', () => {
    const small = createEntityStorage(3);
    createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });

    expect(() =>
      createEntity(small, { category: CATEGORY.NPC })
    ).toThrow();
  });

  it('should not throw when recycling at full capacity', () => {
    const small = createEntityStorage(2);
    const h1 = createEntity(small, { category: CATEGORY.NPC });
    createEntity(small, { category: CATEGORY.NPC });
    destroyEntity(small, h1.id);

    // Should not throw - freeList has ID available
    expect(() =>
      createEntity(small, { category: CATEGORY.NPC })
    ).not.toThrow();
  });
});

describe('destroyEntity', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should mark entity as dead', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.alive[handle.id]).toBe(0);
  });

  it('should reset category to NONE', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.categories[handle.id]).toBe(CATEGORY.NONE);
  });

  it('should add ID to freeList', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(storage.freeList).toContain(handle.id);
  });

  it('should return true on success', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(destroyEntity(storage, handle.id)).toBe(true);
  });

  it('should return false for already dead entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(destroyEntity(storage, handle.id)).toBe(false);
  });

  it('should return false for out of range ID', () => {
    expect(destroyEntity(storage, -1)).toBe(false);
    expect(destroyEntity(storage, 9999)).toBe(false);
  });

  it('should return false for unallocated ID', () => {
    // nextId is 0, so ID 5 was never allocated
    expect(destroyEntity(storage, 5)).toBe(false);
  });
});

describe('isAlive', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return true for alive entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(isAlive(storage, handle.id)).toBe(true);
  });

  it('should return false for destroyed entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(isAlive(storage, handle.id)).toBe(false);
  });

  it('should return false for out of range ID', () => {
    expect(isAlive(storage, -1)).toBe(false);
    expect(isAlive(storage, 9999)).toBe(false);
  });
});

describe('getActiveCount', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return 0 for empty storage', () => {
    expect(getActiveCount(storage)).toBe(0);
  });

  it('should count alive entities', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.PC });
    expect(getActiveCount(storage)).toBe(3);
  });

  it('should exclude destroyed entities', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    expect(getActiveCount(storage)).toBe(1);
  });
});
```

---

### 2-3. queries.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage } from './storage';
import { createEntity, destroyEntity } from './lifecycle';
import {
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
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';

describe('getEntitiesByCategory', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
  });

  it('should return matching alive entities', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.PC });
    createEntity(storage, { category: CATEGORY.NPC });

    const npcs = getEntitiesByCategory(storage, CATEGORY.NPC);
    expect(npcs).toEqual([0, 2]);
  });

  it('should return empty array when no matches', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    const pcs = getEntitiesByCategory(storage, CATEGORY.PC);
    expect(pcs).toEqual([]);
  });

  it('should exclude destroyed entities', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);

    const npcs = getEntitiesByCategory(storage, CATEGORY.NPC);
    expect(npcs).toEqual([1]);
  });

  it('should return empty array for empty storage', () => {
    expect(getEntitiesByCategory(storage, CATEGORY.NPC)).toEqual([]);
  });
});

describe('getEntitiesInRange', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
  });

  it('should return entities within category range', () => {
    createEntity(storage, { category: CATEGORY.PC });          // 1
    createEntity(storage, { category: CATEGORY.NPC });         // 2
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST }); // 3
    createEntity(storage, { category: CATEGORY.LOCATION_CITY }); // 10

    // Characters range: 1-9
    const chars = getEntitiesInRange(storage, 1, 9);
    expect(chars).toEqual([0, 1, 2]);
  });
});

describe('convenience query functions', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
    createEntity(storage, { category: CATEGORY.PC });              // id: 0
    createEntity(storage, { category: CATEGORY.NPC });             // id: 1
    createEntity(storage, { category: CATEGORY.NPC });             // id: 2
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST });   // id: 3
    createEntity(storage, { category: CATEGORY.HOSTILE_CHAOS });   // id: 4
    createEntity(storage, { category: CATEGORY.LOCATION_CITY });   // id: 5
    createEntity(storage, { category: CATEGORY.LOCATION_URBAN });  // id: 6
    createEntity(storage, { category: CATEGORY.FACTION_GUILD });   // id: 7
  });

  it('getAllCharacters should return PCs, NPCs, and hostiles', () => {
    expect(getAllCharacters(storage)).toEqual([0, 1, 2, 3, 4]);
  });

  it('getAllHostiles should return only hostile entities', () => {
    expect(getAllHostiles(storage)).toEqual([3, 4]);
  });

  it('getAllLocations should return only locations', () => {
    expect(getAllLocations(storage)).toEqual([5, 6]);
  });

  it('getAllPCs should return only PCs', () => {
    expect(getAllPCs(storage)).toEqual([0]);
  });

  it('getAllNPCs should return only NPCs', () => {
    expect(getAllNPCs(storage)).toEqual([1, 2]);
  });
});

describe('getEntityInfo', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return entity info for alive entity', () => {
    createEntity(storage, {
      category: CATEGORY.LOCATION_BUILDING,
      hierarchyData: 0x00500000,
    });

    const info = getEntityInfo(storage, 0);
    expect(info).not.toBeNull();
    expect(info!.category).toBe(CATEGORY.LOCATION_BUILDING);
    expect(info!.hierarchyData).toBe(0x00500000);
    expect(info!.generation).toBe(0);
  });

  it('should return null for dead entity', () => {
    const h = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h.id);
    expect(getEntityInfo(storage, h.id)).toBeNull();
  });

  it('should return null for out of range ID', () => {
    expect(getEntityInfo(storage, -1)).toBeNull();
    expect(getEntityInfo(storage, 999)).toBeNull();
  });
});

describe('category predicates', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(20);
    createEntity(storage, { category: CATEGORY.PC });              // 0
    createEntity(storage, { category: CATEGORY.NPC });             // 1
    createEntity(storage, { category: CATEGORY.HOSTILE_BEAST });   // 2
    createEntity(storage, { category: CATEGORY.LOCATION_CITY });   // 3
    createEntity(storage, { category: CATEGORY.FACTION_GUILD });   // 4
  });

  it('isPC should identify only PCs', () => {
    expect(isPC(storage, 0)).toBe(true);
    expect(isPC(storage, 1)).toBe(false);
  });

  it('isNPC should identify only NPCs', () => {
    expect(isNPC(storage, 1)).toBe(true);
    expect(isNPC(storage, 0)).toBe(false);
  });

  it('isCharacter should include PC, NPC, and hostiles', () => {
    expect(isCharacter(storage, 0)).toBe(true);  // PC
    expect(isCharacter(storage, 1)).toBe(true);  // NPC
    expect(isCharacter(storage, 2)).toBe(true);  // HOSTILE
    expect(isCharacter(storage, 3)).toBe(false); // LOCATION
  });

  it('isHostile should identify only hostiles', () => {
    expect(isHostile(storage, 2)).toBe(true);
    expect(isHostile(storage, 0)).toBe(false);
    expect(isHostile(storage, 1)).toBe(false);
  });

  it('isLocation should identify only locations', () => {
    expect(isLocation(storage, 3)).toBe(true);
    expect(isLocation(storage, 0)).toBe(false);
  });

  it('isFaction should identify only factions', () => {
    expect(isFaction(storage, 4)).toBe(true);
    expect(isFaction(storage, 0)).toBe(false);
  });

  it('predicates should return false for dead entities', () => {
    destroyEntity(storage, 0);
    expect(isPC(storage, 0)).toBe(false);
    expect(isCharacter(storage, 0)).toBe(false);
  });

  it('predicates should return false for out of range IDs', () => {
    expect(isPC(storage, -1)).toBe(false);
    expect(isNPC(storage, 9999)).toBe(false);
  });
});
```

---

### 2-4. validation.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createEntityStorage } from './storage';
import { createEntity, destroyEntity } from './lifecycle';
import { isValidHandle, resolveHandle, getHandle } from './validation';
import { CATEGORY } from '$lib/types';
import type { EntityStorage } from '$lib/types';

describe('isValidHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return true for valid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(isValidHandle(storage, handle)).toBe(true);
  });

  it('should return false for dead entity', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(isValidHandle(storage, handle)).toBe(false);
  });

  it('should return false after recycling (wrong generation)', () => {
    const oldHandle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, oldHandle.id);
    createEntity(storage, { category: CATEGORY.PC }); // Recycles ID 0

    // Old handle has generation 0, new entity has generation 1
    expect(isValidHandle(storage, oldHandle)).toBe(false);
  });

  it('should return true for recycled entity with correct generation', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    const h2 = createEntity(storage, { category: CATEGORY.PC });

    expect(isValidHandle(storage, h2)).toBe(true);
  });

  it('should return false for out of range ID', () => {
    expect(isValidHandle(storage, { id: -1, generation: 0 })).toBe(false);
    expect(isValidHandle(storage, { id: 9999, generation: 0 })).toBe(false);
  });

  it('should return false for forged handle with wrong generation', () => {
    createEntity(storage, { category: CATEGORY.NPC });
    // Forge a handle with wrong generation
    expect(isValidHandle(storage, { id: 0, generation: 999 })).toBe(false);
  });
});

describe('resolveHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return ID for valid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    expect(resolveHandle(storage, handle)).toBe(handle.id);
  });

  it('should return null for invalid handle', () => {
    const handle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, handle.id);
    expect(resolveHandle(storage, handle)).toBeNull();
  });

  it('should return null for stale handle after recycle', () => {
    const oldHandle = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, oldHandle.id);
    createEntity(storage, { category: CATEGORY.PC });

    expect(resolveHandle(storage, oldHandle)).toBeNull();
  });
});

describe('getHandle', () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = createEntityStorage(10);
  });

  it('should return handle for alive entity', () => {
    const created = createEntity(storage, { category: CATEGORY.NPC });
    const handle = getHandle(storage, created.id);

    expect(handle).not.toBeNull();
    expect(handle!.id).toBe(created.id);
    expect(handle!.generation).toBe(created.generation);
  });

  it('should return null for dead entity', () => {
    const h = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h.id);
    expect(getHandle(storage, h.id)).toBeNull();
  });

  it('should return null for out of range ID', () => {
    expect(getHandle(storage, -1)).toBeNull();
    expect(getHandle(storage, 9999)).toBeNull();
  });

  it('should return correct generation for recycled entity', () => {
    const h1 = createEntity(storage, { category: CATEGORY.NPC });
    destroyEntity(storage, h1.id);
    const h2 = createEntity(storage, { category: CATEGORY.PC });

    const handle = getHandle(storage, h2.id);
    expect(handle).not.toBeNull();
    expect(handle!.generation).toBe(1); // Recycled once
  });
});
```

---

## Claude Codeへの指示

### Step 1: Vitestセットアップ

```
この仕様書に従ってVitestをセットアップしてください。

1. bun add -D vitest
2. vitest.config.ts を作成（$lib, $typesエイリアス解決）
3. package.json に test, test:watch スクリプトを追加
```

### Step 2: テストファイル作成

```
docs/entity-test-spec.md を読んで、以下のテストファイルを作成してください。

- src/lib/core/entity/storage.test.ts
- src/lib/core/entity/lifecycle.test.ts
- src/lib/core/entity/queries.test.ts
- src/lib/core/entity/validation.test.ts

仕様書のテストケースをベースに実装してください。
```

### Step 3: テスト実行

```
bun run test を実行して、全テストがパスすることを確認してください。
失敗したテストがあれば原因を特定して修正してください。
```

---

## テストカバレッジ一覧

| ファイル | テストケース数 | カバー内容 |
|----------|:-----------:|------------|
| storage.test.ts | 5 | 作成、初期値、クリア、容量保持 |
| lifecycle.test.ts | 16 | 作成、連番ID、リサイクル、世代管理、容量超過、破棄、生存確認、カウント |
| queries.test.ts | 18 | カテゴリ検索、範囲検索、便利関数、エンティティ情報、述語関数、死亡・範囲外 |
| validation.test.ts | 11 | ハンドル検証、解決、取得、世代不一致、リサイクル後、範囲外 |
| **合計** | **50** | |

---

## 期待される実行結果

```
$ bun run test

 ✓ src/lib/core/entity/storage.test.ts (5 tests)
 ✓ src/lib/core/entity/lifecycle.test.ts (16 tests)
 ✓ src/lib/core/entity/queries.test.ts (18 tests)
 ✓ src/lib/core/entity/validation.test.ts (11 tests)

 Test Files  4 passed (4)
      Tests  50 passed (50)
```
