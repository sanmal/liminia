#涯庭 #Liminia

# Claude Code Prompt - IAUS Step 4-5 Decision Cache and Time System

## タスク

以下の4ファイルを新規作成する:

1. `src/lib/core/iaus/cache.ts` — Decision Cache + Action Lock ストレージ生成・アクセサ
2. `src/lib/core/iaus/cache.test.ts` — ~15テスト
3. `src/lib/core/iaus/time.ts` — Lock Counter 進行 + Duration 計算 + Game Hour
4. `src/lib/core/iaus/time.test.ts` — ~20テスト

## 参照ファイル（実装前に必ず読むこと）

1. `docs/iaus-engine-implementation-spec.md` — §6 Decision Cache、§7 Time System
2. `src/lib/types/iaus.ts` — DecisionCacheStorage, ActionLockStorage, TIME_CONFIG, EvaluationContext
3. `src/lib/types/brand.ts` — EntityId, entityId()
4. `src/lib/types/constants.ts` — MAX_ENTITIES
5. `src/lib/core/entity/storage.ts` — createEntityStorage パターン参照（同じ TypedArray 初期化パターンを踏襲）

## 依存関係

```
types/iaus.ts ← cache.ts ← time.ts
types/brand.ts ←┘            │
types/constants.ts ←─────────┘
```

time.ts は cache.ts の `createActionLockStorage` を直接importしない（ストレージは呼び出し元が生成して渡す）が、time.test.ts は cache.ts の `createActionLockStorage` を使ってテスト用ストレージを構築する。

---

## Step 4: cache.ts の仕様

### エクスポート関数一覧

| 関数 | シグネチャ | 備考 |
|------|-----------|------|
| `createDecisionCacheStorage` | `(capacity?: number) => DecisionCacheStorage` | デフォルト MAX_ENTITIES |
| `createActionLockStorage` | `(capacity?: number) => ActionLockStorage` | デフォルト MAX_ENTITIES |
| `getCurrentDecision` | `(cache: DecisionCacheStorage, id: EntityId) => number` | Uint16 |
| `getCurrentScore` | `(cache: DecisionCacheStorage, id: EntityId) => number` | Float32 |
| `getLastEvaluatedTick` | `(cache: DecisionCacheStorage, id: EntityId) => number` | Uint32 |
| `setDecisionResult` | `(cache: DecisionCacheStorage, id: EntityId, decisionId: number, score: number, tick: number) => void` | 3値を一括セット |
| `isLocked` | `(lock: ActionLockStorage, id: EntityId) => boolean` | remainingTicks > 0 |
| `getRemainingTicks` | `(lock: ActionLockStorage, id: EntityId) => number` | |
| `getCurrentAction` | `(lock: ActionLockStorage, id: EntityId) => number` | |
| `setLock` | `(lock: ActionLockStorage, id: EntityId, ticks: number, action: number) => void` | ticks は Math.min(ticks, 255) |
| `clearLock` | `(lock: ActionLockStorage, id: EntityId) => void` | remainingTicks=0, currentAction=0 |

### 設計パターン

既存の `src/lib/core/entity/storage.ts` と同じパターン:
- create関数: TypedArray を capacity 分確保して返す
- アクセサ関数: EntityId (branded type) を引数に取り、`!` 非nullアサーションはアクセサ内に集約
- ストレージ自体は引数として受け取る（グローバル状態を持たない）

### cache.test.ts テスト構造

```
describe('createDecisionCacheStorage')
  - デフォルト capacity = MAX_ENTITIES
  - カスタム capacity
  - TypedArray が正しい型（Uint16/Float32/Uint32）
  - 初期値が全て0

describe('createActionLockStorage')
  - デフォルト capacity
  - カスタム capacity
  - TypedArray が正しい型（Uint8/Uint8）
  - 初期値が全て0

describe('Decision Cache accessors')
  - setDecisionResult → getCurrentDecision/getCurrentScore/getLastEvaluatedTick で読み取り
  - 複数エンティティに独立してセット
  - setDecisionResult の上書き

describe('Action Lock accessors')
  - 初期状態: isLocked = false, remainingTicks = 0
  - setLock → isLocked = true, getRemainingTicks/getCurrentAction で読み取り
  - setLock で ticks > 255 → 255 にクランプ
  - clearLock → isLocked = false
```

---

## Step 5: time.ts の仕様

### エクスポート関数一覧

| 関数 | シグネチャ | 備考 |
|------|-----------|------|
| `advanceLockCounters` | `(lock: ActionLockStorage, activeEntityIds: readonly number[]) => number[]` | アンロックされた ID の配列を返す |
| `calculateDuration` | `(baseTicks: number, variance: number, seed?: number) => number` | 1-255 の範囲にクランプ |
| `seededRandom` | `(seed: number) => number` | xorshift32。0-1 の浮動小数点を返す |
| `calculateGameHour` | `(currentTick: number) => number` | 0-23。`floor((tick * 1.875 % 1440) / 60)` |
| `realSecondsToTicks` | `(realSeconds: number) => number` | 現実秒 → tick数変換。TIME_CONFIG の比率を使用 |
| `ticksToGameMinutes` | `(ticks: number) => number` | tick × 1.875 |

### advanceLockCounters の詳細

```typescript
function advanceLockCounters(
  lock: ActionLockStorage,
  activeEntityIds: readonly number[]
): number[] {
  const unlocked: number[] = [];

  for (let i = 0; i < activeEntityIds.length; i++) {
    const id = activeEntityIds[i]!;
    const remaining = lock.remainingTicks[id]!;
    if (remaining > 0) {
      lock.remainingTicks[id] = remaining - 1;
      if (remaining === 1) {  // このtickで0になる = アンロック
        unlocked.push(id);
      }
    } else {
      // 既にアンロック済み（評価が必要）
      unlocked.push(id);
    }
  }

  return unlocked;
}
```

**重要な挙動**:
- `remaining > 0`: デクリメントし、0になったら unlocked に追加
- `remaining === 0`: 既にアンロック（まだ次のアクションが割り当てられていない）→ unlocked に追加
- activeEntityIds に含まれない ID は一切触れない

### seededRandom の詳細

xorshift32 ベース。キャッチアップ（オフライン時間の高速再生）で同じ入力に対して同じ結果を保証するための決定論的乱数。

```typescript
function seededRandom(seed: number): number {
  let x = seed | 0;  // 整数化
  if (x === 0) x = 1;  // xorshift は seed=0 だと常に0を返すため回避
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xFFFFFFFF;  // 符号なし32bit → 0-1
}
```

### calculateDuration の詳細

```typescript
function calculateDuration(
  baseTicks: number,
  variance: number,
  seed?: number
): number {
  if (variance <= 0 || baseTicks <= 1) return Math.max(1, Math.min(255, baseTicks));

  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  const offset = Math.floor((random - 0.5) * 2 * baseTicks * variance);
  return Math.max(1, Math.min(255, baseTicks + offset));
}
```

- variance=0.2, baseTicks=100 → ±20 の範囲
- 最小1tick（0以下にならない）、最大255tick
- seed ありで決定論的、なしで Math.random()

### time.test.ts テスト構造

```
describe('seededRandom')
  - 同一シードで同一結果（決定論性）
  - 異なるシードで異なる結果
  - 出力が 0-1 の範囲内
  - seed=0 でもエラーなし（0→1に補正）
  - 多数回実行して分布が偏りすぎていないこと（簡易チェック: 100回で0.3-0.7の範囲に50%以上）

describe('calculateDuration')
  - variance=0 → baseTicks そのまま
  - baseTicks=1 → 常に1
  - seed あり → 決定論的（同じ引数で同じ結果）
  - 結果が 1-255 の範囲にクランプ
  - baseTicks=200, variance=0.5 → 100-255 の範囲内
  - baseTicks=2, variance=0.5 → 1-3 程度の範囲

describe('calculateGameHour')
  - tick=0 → 0時
  - tick=32 → 1時（32 ticks = 1 game hour）
  - tick=384 → 12時（384 = 32 × 12）
  - tick=768 → 0時（1日分 = 768 ticks でリセット）
  - tick=800 → 1時（768+32）
  - 常に 0-23 の範囲

describe('realSecondsToTicks')
  - 75秒 → 1 tick（2:3比率で 75 real seconds = 1 tick）
  - 0秒 → 0
  - 3600秒(1h) → 48 ticks

describe('ticksToGameMinutes')
  - 1 tick → 1.875 分
  - 32 ticks → 60 分
  - 0 tick → 0

describe('advanceLockCounters')
  - 空の activeEntityIds → 空の unlocked
  - 全員 remaining=0 → 全員が unlocked に含まれる
  - remaining=1 → デクリメント後 unlocked に含まれる
  - remaining=5 → デクリメントのみ、unlocked に含まれない
  - 混合: 一部ロック中、一部アンロック → 正しく分離
  - activeEntityIds に含まれないエンティティのロックは変わらない
  - 連続呼び出し: remaining=3 → 3回呼び出しで unlocked に現れる
```

---

## 完了条件

- `bun run typecheck` が通ること
- 既存テスト（312テスト）が引き続き全パスすること
- cache.test.ts + time.test.ts の新規テストが全パスすること
- advanceLockCounters が ActionLockStorage を**直接変更**すること（新しいストレージを返すのではなく、in-place mutation）
- seededRandom が決定論的であること（テストで検証）
