#涯庭 #Liminia

# IAUS Engine Implementation Specification v1

Last updated: 2026-02-01

§9 IAUS Engine の実装仕様書。既存の設計文書（IAUS Implementation v1.0, IAUS Considerations v1, IAUS Time System v1.0）を統合し、MVP実装に必要な範囲に絞り込む。

---

## 1. スコープ定義

### 1.1 MVP（§9）に含まれるもの

| # | 項目 | 内容 |
|---|------|------|
| 9.1 | Response Curves | 5曲線 + 正規化 + LUT |
| 9.2 | Consideration定義 | Static/Dynamic 入力関数 + CurveParams |
| 9.3 | Score Aggregation | 乗算合成 + 幾何平均補正 |
| 9.4 | Batch Evaluation | 100NPC一括評価 (<50ms目標) |
| 9.5 | Decision Cache | TypedArray storage |
| 9.6 | Time System | 1.875min/tick, Action Lock, 2:3時間比 |

### 1.2 Phase 2 以降に延期するもの

| 項目 | 理由 |
|------|------|
| Inertia（慣性ボーナス） | MVP では単純な最高スコア選択で十分 |
| Cooldown（再選択制限） | Decision の数が少ない MVP では不要 |
| Dialogue Integration | The Mouth / テンプレート未実装 |
| Combined Decision | 行動+台詞統合は Phase 2 |
| Dynamic Considerations（高度） | 関係値・派閥・経済は未実装 |
| Interruption Handling | 戦闘システム未実装 |

### 1.3 MVP Decision 数の想定

MVP では最低限のゲームループを成立させる Decision を定義：

| カテゴリ | Decision 例 | 数 |
|---------|------------|:--:|
| 基本生存 | 休息、食事、睡眠 | 3 |
| 労働 | 仕事（職業別） | 4 |
| 社交 | 会話、挨拶 | 2 |
| 移動 | 場所移動 | 2 |
| 戦闘 | 攻撃、防御、逃走 | 3 |
| 回復 | 治療、待機 | 2 |
| 信仰 | 祈り | 1 |
| 探索 | 探索、調査 | 2 |
| **合計** | | **~19** |

---

## 2. ファイル構成

```
src/lib/
├── types/
│   └── iaus.ts              # IAUS固有の型定義・定数
├── core/iaus/
│   ├── curves.ts            # Response Curves（正規化 + 5曲線 + LUT）
│   ├── scoring.ts           # Score Aggregation（幾何平均補正）
│   ├── cache.ts             # Decision Cache Storage（TypedArray）
│   ├── time.ts              # Time System + Action Lock
│   ├── considerations.ts    # Consideration入力関数
│   ├── decisions.ts         # MVP Decision定義
│   ├── evaluator.ts         # 評価エンジン（単体 + バッチ）
│   └── index.ts             # バレルエクスポート
└── ...
```

---

## 3. 型定義（src/lib/types/iaus.ts）

### 3.1 Response Curve Types

```typescript
export const CURVE_TYPE = {
  LINEAR: 0,
  POLYNOMIAL: 1,
  LOGISTIC: 2,
  LOGIT: 3,
  PARABOLIC: 4,
} as const;

export type CurveType = (typeof CURVE_TYPE)[keyof typeof CURVE_TYPE];

export interface CurveParams {
  readonly m: number;  // Slope
  readonly k: number;  // Exponent
  readonly c: number;  // X-Shift
  readonly b: number;  // Y-Shift
}
```

### 3.2 Curve Presets

```typescript
export const CURVE_PRESET = {
  LINEAR_STANDARD:    { m: 1.0, k: 1.0, c: 0.0, b: 0.0 },
  LINEAR_HALF:        { m: 0.5, k: 1.0, c: 0.0, b: 0.5 },
  LINEAR_INVERSE:     { m: -1.0, k: 1.0, c: 0.0, b: 1.0 },
  CRITICAL_DETECTOR:  { m: -15, k: 1.0, c: 0.3, b: 0.0 },
  THRESHOLD_50:       { m: 20, k: 1.0, c: 0.5, b: 0.0 },
  THRESHOLD_25:       { m: 20, k: 1.0, c: 0.25, b: 0.0 },
  EARLY_WEIGHT:       { m: 1.0, k: 0.5, c: 0.0, b: 0.0 },
  LATE_WEIGHT:        { m: 1.0, k: 2.0, c: 0.0, b: 0.0 },
} as const satisfies Record<string, CurveParams>;
```

### 3.3 Consideration Definition

```typescript
export interface ConsiderationDef {
  readonly id: string;
  readonly name: string;
  readonly curveType: CurveType;
  readonly curveParams: CurveParams;
  readonly inputMin: number;
  readonly inputMax: number;
}
```

**設計判断: inputFn を ConsiderationDef に含めない**

仕様書 v1.0 では `inputFn: (actorId, targetId, context) => number` を含めていたが、以下の理由で分離する：

- ConsiderationDef は純粋なデータ（定義ファイルに配置可能）
- inputFn は他システムのストレージへの参照を含むため、実行時に解決する必要がある
- テストで inputFn をモック不要にする

代わりに、evaluator が ConsiderationDef.id をキーに対応する入力関数を呼び出す。

### 3.4 Decision Definition

```typescript
export const DECISION_DIRECTION = {
  ACTIVE: 0,
  PASSIVE: 1,
  SOCIAL: 2,
} as const;

export type DecisionDirection = (typeof DECISION_DIRECTION)[keyof typeof DECISION_DIRECTION];

export interface DecisionDef {
  readonly id: number;
  readonly name: string;
  readonly direction: DecisionDirection;
  readonly worldMark: number;          // Primary WorldMark (0-7)
  readonly situationTag: number;       // Situation tag
  readonly considerationIds: readonly string[];  // Which considerations to evaluate
  readonly weight: number;             // Importance factor (1.0 = standard)
  readonly baseDurationTicks: number;  // Action Lock duration
  readonly durationVariance: number;   // ±variance randomization (0.0-0.5)
}
```

### 3.5 Decision Cache Storage

```typescript
import type { EntityId } from './brand.js';

export interface DecisionCacheStorage {
  readonly currentDecision: Uint16Array;    // [entityId] → Decision ID
  readonly currentScore: Float32Array;      // [entityId] → Current score
  readonly lastEvaluatedTick: Uint32Array;  // [entityId] → Last evaluation tick
  readonly capacity: number;
}
```

### 3.6 Action Lock Storage

```typescript
export interface ActionLockStorage {
  readonly remainingTicks: Uint8Array;  // [entityId] → 0-255 (0 = unlocked)
  readonly currentAction: Uint8Array;   // [entityId] → action category
  readonly capacity: number;
}
```

### 3.7 Time System Config

```typescript
export const TIME_CONFIG = {
  TICK_GAME_MINUTES: 1.875,
  MAX_LOCK_TICKS: 255,
  TIME_RATIO_REAL: 2,
  TIME_RATIO_GAME: 3,
  TICKS_PER_GAME_HOUR: 32,      // 60 / 1.875
  TICKS_PER_GAME_DAY: 768,      // 24 * 32
  REAL_SECONDS_PER_TICK: 75,    // 1.875min * 60s / 1.5 ratio
} as const;
```

### 3.8 Evaluation Context

```typescript
export interface EvaluationContext {
  readonly currentTick: number;
  readonly currentSituation: number;  // Situation tag value
  readonly gameHour: number;          // 0-23
}
```

---

## 4. Response Curves（src/lib/core/iaus/curves.ts）

### 4.1 正規化関数

```typescript
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
```

### 4.2 Response Curve 関数群

全関数は入力 0〜1 → 出力 0〜1（clamp付き）。

```typescript
export function linear(x: number, m: number, b: number): number {
  return clamp01(m * x + b);
}

export function polynomial(x: number, m: number, c: number, k: number, b: number): number {
  return clamp01(Math.pow(m * (x - c), k) + b);
}

export function logistic(x: number, m: number, c: number, k: number, b: number): number {
  return clamp01(k / (1 + Math.exp(-m * (x - c))) + b);
}

export function logit(x: number, epsilon: number = 1e-6): number {
  const xSafe = Math.max(epsilon, Math.min(1 - epsilon, x));
  const raw = Math.log(xSafe / (1 - xSafe));
  return clamp01((raw + 5) / 10);
}

export function parabolic(x: number): number {
  return clamp01(4 * x * (1 - x));
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
```

### 4.3 統一ディスパッチャ

```typescript
export function evaluateCurve(
  x: number,
  curveType: CurveType,
  params: CurveParams
): number {
  switch (curveType) {
    case CURVE_TYPE.LINEAR:     return linear(x, params.m, params.b);
    case CURVE_TYPE.POLYNOMIAL: return polynomial(x, params.m, params.c, params.k, params.b);
    case CURVE_TYPE.LOGISTIC:   return logistic(x, params.m, params.c, params.k, params.b);
    case CURVE_TYPE.LOGIT:      return logit(x);
    case CURVE_TYPE.PARABOLIC:  return parabolic(x);
    default:                    return 0;
  }
}
```

### 4.4 LUT（Look-Up Table）

**MVP判断**: LUT 生成は実装するが、MVP では直接計算で十分な性能が出る可能性が高い。ベンチマーク後に LUT 使用を決定する。

```typescript
export function generateLUT(
  curveType: CurveType,
  params: CurveParams,
  resolution: number = 256
): Float32Array {
  const lut = new Float32Array(resolution);
  for (let i = 0; i < resolution; i++) {
    lut[i] = evaluateCurve(i / (resolution - 1), curveType, params);
  }
  return lut;
}

export function lookupLUT(lut: Float32Array, x: number): number {
  const idx = Math.round(x * (lut.length - 1));
  return lut[Math.max(0, Math.min(idx, lut.length - 1))]!;
}
```

---

## 5. Score Aggregation（src/lib/core/iaus/scoring.ts）

### 5.1 Compensation Factor（幾何平均補正）

```typescript
export function aggregateScores(scores: readonly number[]): number {
  const len = scores.length;
  if (len === 0) return 0;

  let product = 1.0;
  for (let i = 0; i < len; i++) {
    const s = scores[i]!;
    if (s <= 0) return 0;  // Auto-veto
    product *= s;
  }

  return Math.pow(product, 1.0 / len);
}
```

### 5.2 Weight 適用

```typescript
export function applyWeight(score: number, weight: number): number {
  return score * weight;
}
```

---

## 6. Decision Cache（src/lib/core/iaus/cache.ts）

### 6.1 ストレージ生成

```typescript
import type { DecisionCacheStorage, ActionLockStorage } from '../../types/iaus.js';
import { MAX_ENTITIES } from '../../types/constants.js';

export function createDecisionCacheStorage(
  capacity: number = MAX_ENTITIES
): DecisionCacheStorage {
  return {
    currentDecision: new Uint16Array(capacity),
    currentScore: new Float32Array(capacity),
    lastEvaluatedTick: new Uint32Array(capacity),
    capacity,
  };
}

export function createActionLockStorage(
  capacity: number = MAX_ENTITIES
): ActionLockStorage {
  return {
    remainingTicks: new Uint8Array(capacity),
    currentAction: new Uint8Array(capacity),
    capacity,
  };
}
```

### 6.2 アクセサ

```typescript
import type { EntityId } from '../../types/brand.js';

export function isLocked(lock: ActionLockStorage, id: EntityId): boolean {
  return lock.remainingTicks[id]! > 0;
}

export function getRemainingTicks(lock: ActionLockStorage, id: EntityId): number {
  return lock.remainingTicks[id]!;
}

export function setLock(
  lock: ActionLockStorage,
  id: EntityId,
  ticks: number,
  action: number
): void {
  lock.remainingTicks[id] = Math.min(ticks, 255);
  lock.currentAction[id] = action;
}

export function getCurrentDecision(cache: DecisionCacheStorage, id: EntityId): number {
  return cache.currentDecision[id]!;
}

export function setDecisionResult(
  cache: DecisionCacheStorage,
  id: EntityId,
  decisionId: number,
  score: number,
  tick: number
): void {
  cache.currentDecision[id] = decisionId;
  cache.currentScore[id] = score;
  cache.lastEvaluatedTick[id] = tick;
}
```

---

## 7. Time System（src/lib/core/iaus/time.ts）

### 7.1 Tick 進行

```typescript
import type { ActionLockStorage } from '../../types/iaus.js';

/**
 * 全NPCのロックカウンターをデクリメントし、アンロックされたIDを返す。
 * 処理コスト: 200 NPCs で ~0.005ms
 */
export function advanceLockCounters(
  lock: ActionLockStorage,
  activeEntityIds: readonly number[]
): number[] {
  const unlocked: number[] = [];

  for (let i = 0; i < activeEntityIds.length; i++) {
    const id = activeEntityIds[i]!;
    const remaining = lock.remainingTicks[id]!;
    if (remaining > 0) {
      lock.remainingTicks[id] = remaining - 1;
      if (remaining === 1) {
        unlocked.push(id);
      }
    } else {
      // Already unlocked (needs evaluation)
      unlocked.push(id);
    }
  }

  return unlocked;
}

/**
 * アクション期間を計算（分散付き）。
 * deterministic = true の場合、entityId + tick をシードとして使用。
 */
export function calculateDuration(
  baseTicks: number,
  variance: number,
  seed?: number
): number {
  if (variance <= 0 || baseTicks <= 1) return baseTicks;

  // Simple seeded random (deterministic replay 用)
  const random = seed !== undefined
    ? seededRandom(seed)
    : Math.random();

  const offset = Math.floor((random - 0.5) * 2 * baseTicks * variance);
  return Math.max(1, Math.min(255, baseTicks + offset));
}

/**
 * 簡易シード乱数（キャッチアップ時の決定論的再現用）
 * xorshift32 ベース
 */
export function seededRandom(seed: number): number {
  let x = seed | 0;
  if (x === 0) x = 1;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xFFFFFFFF;
}

/**
 * ゲーム内時刻を計算
 */
export function calculateGameHour(currentTick: number): number {
  const gameMinutes = currentTick * 1.875;
  return Math.floor((gameMinutes % 1440) / 60);  // 1440 = 24h in minutes
}
```

---

## 8. Consideration 関数（src/lib/core/iaus/considerations.ts）

### 8.1 設計方針

ConsiderationDef は純粋データ。入力値の取得は evaluator が Consideration ID に基づいて対応関数を呼び出す。

```typescript
/**
 * Consideration入力値を取得するレジストリ。
 * 各関数は 生の値 を返す（正規化は evaluator が行う）。
 */
export type ConsiderationInputFn = (
  actorId: EntityId,
  context: EvaluationContext,
  systems: SystemRefs
) => number;
```

### 8.2 SystemRefs（既存システムへの参照）

```typescript
import type { EntityStorage } from '../../types/entity.js';
import type { TagStorage } from '../../types/tags.js';
import type { ArchetypeStorage } from '../../types/archetype.js';
import type { CharacterStateStorage } from '../../types/character.js';

export interface SystemRefs {
  readonly entity: EntityStorage;
  readonly tags: TagStorage;
  readonly archetype: ArchetypeStorage;
  readonly character: CharacterStateStorage;
}
```

### 8.3 MVP Consideration 一覧

| ID | 名前 | 入力源 | inputMin | inputMax | 推奨曲線 |
|----|------|--------|:--------:|:--------:|---------|
| `own_hp_ratio` | HP割合 | character.hp / character.maxHp | 0 | 1 | LINEAR_STANDARD |
| `own_hp_critical` | HP危険域 | 同上 | 0 | 1 | CRITICAL_DETECTOR |
| `own_bonds_ratio` | dejavuBonds割合 | character.dejavuBonds / 100 | 0 | 1 | LINEAR_STANDARD |
| `own_bonds_critical` | bonds危険域 | 同上 | 0 | 1 | CRITICAL_DETECTOR |
| `tag_match` | Tagスコア一致 | calculateTagMatchScore() | -500 | 500 | LINEAR_HALF |
| `direction_affinity` | Direction適合 | archetype.weight* / 100 | 0 | 1 | LINEAR_STANDARD |
| `situation_match` | 状況一致 | 一致=1, 不一致=0.5 | 0 | 1 | LINEAR_STANDARD |
| `time_of_day` | 時間帯適合 | gameHour | 0 | 23 | 用途による |
| `rest_need` | 休息必要度 | 連続活動tick数 | 0 | 255 | LATE_WEIGHT |

### 8.4 入力関数の実装例

```typescript
const considerationInputs: Record<string, ConsiderationInputFn> = {
  own_hp_ratio(actorId, _ctx, sys) {
    const hp = getHp(sys.character, actorId);
    const maxHp = getMaxHp(sys.character, actorId);
    return maxHp > 0 ? hp / maxHp : 0;
  },

  own_bonds_ratio(actorId, _ctx, sys) {
    return getDejavuBonds(sys.character, actorId) / 100;
  },

  situation_match(_actorId, ctx, _sys) {
    // Decision側のsituation tagとcontextのsituation比較は
    // evaluator内で行うため、ここでは常に1を返す
    // （evaluatorがmatch/mismatchを判定してスコアを掛ける）
    return 1;
  },

  time_of_day(_actorId, ctx, _sys) {
    return ctx.gameHour;
  },
};
```

---

## 9. MVP Decision 定義（src/lib/core/iaus/decisions.ts）

### 9.1 Decision 一覧

```typescript
import { CURVE_TYPE, CURVE_PRESET } from '../../types/iaus.js';
import type { DecisionDef } from '../../types/iaus.js';

export const DECISIONS: readonly DecisionDef[] = [
  // --- 基本生存 ---
  {
    id: 0,
    name: 'rest',
    direction: 1,  // PASSIVE
    worldMark: 0,
    situationTag: 1,  // PEACEFUL
    considerationIds: ['own_hp_ratio', 'rest_need'],
    weight: 1.0,
    baseDurationTicks: 16,   // ~30min
    durationVariance: 0.2,
  },
  {
    id: 1,
    name: 'eat',
    direction: 1,  // PASSIVE
    worldMark: 0,
    situationTag: 1,  // PEACEFUL
    considerationIds: ['time_of_day'],  // 食事時間帯で高スコア
    weight: 1.0,
    baseDurationTicks: 16,   // ~30min
    durationVariance: 0.3,
  },
  {
    id: 2,
    name: 'sleep',
    direction: 1,  // PASSIVE
    worldMark: 0,
    situationTag: 1,  // PEACEFUL
    considerationIds: ['rest_need', 'time_of_day'],
    weight: 1.2,  // やや高い（生存に必須）
    baseDurationTicks: 200,  // ~6.25h
    durationVariance: 0.15,
  },
  // ... 残りは実装時に追加（~19 Decisions）
] as const;
```

**注**: 具体的な全 Decision 定義は実装フェーズで段階的に追加。ここでは構造と代表例のみ。

---

## 10. 評価エンジン（src/lib/core/iaus/evaluator.ts）

### 10.1 単体 Decision 評価

```typescript
export function evaluateDecision(
  actorId: EntityId,
  decision: DecisionDef,
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): number {
  const scores: number[] = [];

  // Situation match check
  const situationScore = decision.situationTag === context.currentSituation
    ? 1.0
    : 0.5;
  scores.push(situationScore);

  // Evaluate each consideration
  for (const conId of decision.considerationIds) {
    const conDef = considerations.get(conId);
    if (!conDef) continue;

    const rawInput = getConsiderationInput(conId, actorId, context, systems);
    const normalized = normalize(rawInput, conDef.inputMin, conDef.inputMax);
    const curveScore = evaluateCurve(normalized, conDef.curveType, conDef.curveParams);
    scores.push(curveScore);
  }

  // Aggregate with compensation factor
  const baseScore = aggregateScores(scores);

  // Apply decision weight
  return applyWeight(baseScore, decision.weight);
}
```

### 10.2 単体 NPC 評価（全 Decision から最高スコアを選択）

```typescript
export function evaluateNpc(
  actorId: EntityId,
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): { decisionId: number; score: number } {
  let bestId = 0;
  let bestScore = -1;

  for (const decision of decisions) {
    const score = evaluateDecision(actorId, decision, context, systems, considerations);
    if (score > bestScore) {
      bestScore = score;
      bestId = decision.id;
    }
  }

  return { decisionId: bestId, score: Math.max(0, bestScore) };
}
```

### 10.3 バッチ評価

```typescript
export function evaluateBatch(
  unlockedIds: readonly number[],
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>,
  cache: DecisionCacheStorage,
  lock: ActionLockStorage
): void {
  for (const rawId of unlockedIds) {
    const id = entityId(rawId);

    const result = evaluateNpc(id, decisions, context, systems, considerations);

    // Update cache
    setDecisionResult(cache, id, result.decisionId, result.score, context.currentTick);

    // Set action lock
    const decision = decisions[result.decisionId];
    if (decision) {
      const duration = calculateDuration(
        decision.baseDurationTicks,
        decision.durationVariance,
        rawId * 10000 + context.currentTick  // Deterministic seed
      );
      setLock(lock, id, duration, result.decisionId);
    }
  }
}
```

---

## 11. メモリバジェット

| 要素 | 計算 | サイズ |
|------|------|:------:|
| Decision Cache: currentDecision | 2000 × 2B | 4,000B |
| Decision Cache: currentScore | 2000 × 4B | 8,000B |
| Decision Cache: lastEvaluatedTick | 2000 × 4B | 8,000B |
| Action Lock: remainingTicks | 2000 × 1B | 2,000B |
| Action Lock: currentAction | 2000 × 1B | 2,000B |
| Consideration defs (~10個) | ~10 × ~100B | ~1,000B |
| Decision defs (~19個) | ~19 × ~80B | ~1,520B |
| LUT (使用する場合) | ~5 × 256 × 4B | ~5,120B |
| **合計** | | **~31.6KB** |

Master Index の見積もり ~19KB は Decision Cache を 100 NPC 前提で算出していた。MAX_ENTITIES=2000 で算出すると ~32KB。ただしアクティブNPC は 100 前後なので、capacity をアクティブ数に合わせる最適化が可能。

**判断**: MVP では capacity = MAX_ENTITIES (2000) で統一。52KB 全体予算の範囲内。§8（永続化）前に実測してアクティブ数ベースの最適化を検討。

---

## 12. パフォーマンス目標

| 指標 | 目標 | 計測方法 |
|------|------|---------|
| 単体NPC評価 | < 0.5ms | 19 Decisions × ~9 Considerations |
| バッチ評価（~5 NPC/tick） | < 2.5ms | advanceLockCounters + evaluateBatch |
| ロックデクリメント（200 NPC） | < 0.01ms | advanceLockCounters のみ |
| LUT lookup | < 0.001ms | 配列インデックスアクセス |

**注**: vitest のベンチマーク機能でBun上の実測値を収集。ブラウザ実測は §10（UI）以降。

---

## 13. テスト計画

### 13.1 テストファイル構成

| ファイル | 対象 | 見積テスト数 |
|---------|------|:----------:|
| curves.test.ts | normalize, 5曲線, evaluateCurve, LUT | ~30 |
| scoring.test.ts | aggregateScores, applyWeight | ~12 |
| cache.test.ts | create/clear/get/set, lock操作 | ~15 |
| time.test.ts | advanceLockCounters, calculateDuration, seededRandom, gameHour | ~20 |
| considerations.test.ts | 各入力関数の正しい値取得 | ~15 |
| evaluator.test.ts | evaluateDecision, evaluateNpc, evaluateBatch | ~20 |
| **合計** | | **~112** |

### 13.2 テスト方針

- 全関数は純粋関数またはストレージ引数パターン → モック不要
- Consideration テストでは SystemRefs を手動構築（既存の createXxxStorage 関数を使用）
- バッチ評価テストでは 100 NPC のストレージを生成してパフォーマンスも簡易計測

---

## 14. 実装順序

| Step | ファイル | 依存 | 備考 |
|:----:|---------|------|------|
| 1 | types/iaus.ts | types/brand.ts, types/constants.ts | 型定義のみ。テスト不要 |
| 2 | curves.ts + curves.test.ts | types/iaus.ts | 純粋数学。依存なし |
| 3 | scoring.ts + scoring.test.ts | なし | 純粋数学。依存なし |
| 4 | cache.ts + cache.test.ts | types/iaus.ts, types/brand.ts | TypedArray操作 |
| 5 | time.ts + time.test.ts | types/iaus.ts | Action Lock + tick管理 |
| 6 | considerations.ts + considerations.test.ts | 既存4システム | 統合テスト的な性格 |
| 7 | decisions.ts | types/iaus.ts | データ定義。テスト軽量 |
| 8 | evaluator.ts + evaluator.test.ts | 全上位ファイル | 統合。バッチベンチマーク |

Step 2〜5 は相互依存がないため並行実装可能（実質的には順番に進める）。
Step 6 は §3-§7 の全システムを参照するため、統合テストとして最も重要。

---

## 15. 既存システムとの整合性チェックポイント

実装中に確認すべき点：

| チェック項目 | 関連システム | 確認内容 |
|-------------|-------------|---------|
| EntityId branded type | §3 Entity | evaluator の引数型が EntityId であること |
| TagStorage accessors | §5 Tags | getDirection, getWorldMark 等の戻り値型 |
| ArchetypeStorage | §6 Archetype | weightActive/Passive/Social の存在と型 |
| CharacterStateStorage | §7 Character | getHp, getMaxHp, getDejavuBonds の戻り値 |
| MAX_ENTITIES | §2 Types | capacity 統一 |

---

## 16. MVP 完了基準

- [ ] 全テスト通過（~112テスト）
- [ ] `bun run typecheck` 通過
- [ ] 5曲線 + 正規化の数学的正確性（境界値テスト含む）
- [ ] 100 NPC バッチ評価が Bun 上で < 50ms
- [ ] Decision Cache + Action Lock が正しく連携
- [ ] 既存4システム（Entity/Tags/Archetype/Character）との統合テスト通過
- [ ] Checklist v3 への反映

---

## Document References

| Document | Relationship |
|----------|-------------|
| IAUS Implementation v1.0 | アーキテクチャ・数式・統合設計の原典 |
| IAUS Considerations v1 | Consideration定義の原典 |
| IAUS Time System v1.0 | Action Lock・tick・時間比の原典 |
| IAUS未定義パラメータガイド | 曲線プリセット・デフォルト値 |
| Type Safety Specification v1 | Branded Types, accessor pattern |
| Entity ID Specification v5 | EntityId, EntityStorage |
| Unified Tag System v2 | TagStorage, calculateTagMatchScore |
| Archetype System v2 | ArchetypeStorage, direction weights |
| Character Template v6 | HP, dejavuBonds accessors |
| Master Index v5.6 | 全体整合性 |

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-02-01 | 初版。MVP スコープ定義、ファイル構成、全コンポーネント仕様、テスト計画、実装順序。 |

---

Last updated: 2026-02-01
