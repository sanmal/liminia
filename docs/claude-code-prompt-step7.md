#涯庭 #Liminia

# IAUS Step 7 Evaluator 実装指示書 (Claude Code用)

Last updated: 2026-02-01

---

## 概要

§9 IAUS Engine の Step 7: evaluator.ts を実装する。
単体 Decision 評価、単体 NPC 評価（全 Decision から最高スコア選択）、バッチ評価（unlocked NPC 一括処理）の3関数 + MVP Decision 定義ファイルを作成する。

**目標**: 100 NPC × ~19 Decision のバッチ評価が < 50ms で完了すること（通常 tick では Action Lock により ~5 NPC/tick、< 2.5ms）

---

## 前提条件

### 完了済みステップ（依存先）

| Step | ファイル | 主要エクスポート |
|:----:|---------|----------------|
| 1 | `src/lib/types/iaus.ts` | CURVE_TYPE, CurveType, CurveParams, CURVE_PRESET, DecisionCacheStorage, ActionLockStorage, TIME_CONFIG, EvaluationContext, ConsiderationDef, DecisionDef |
| 2 | `src/lib/core/iaus/curves.ts` | clamp01, normalize, linear, polynomial, logistic, logit, parabolic, evaluateCurve, generateLUT, lookupLUT |
| 3 | `src/lib/core/iaus/scoring.ts` | aggregateScores, applyWeight |
| 4 | `src/lib/core/iaus/cache.ts` | createDecisionCacheStorage, createActionLockStorage, getCurrentDecision, getCurrentScore, getLastEvaluatedTick, setDecisionResult, isLocked, getRemainingTicks, getCurrentAction, setLock, clearLock |
| 5 | `src/lib/core/iaus/time.ts` | advanceLockCounters, calculateDuration, seededRandom, calculateGameHour, realSecondsToTicks, ticksToGameMinutes |
| 6 | `src/lib/core/iaus/considerations.ts` | SystemRefs, ConsiderationInputFn, MVP_CONSIDERATIONS, getConsiderationInput |

### 完了済みシステム（§3-§7）

| § | パス | 使用する関数 |
|:-:|------|------------|
| 3 | `src/lib/core/entity/` | createEntityStorage, createEntity, isAlive, getCategory |
| 5 | `src/lib/core/tags/` | createTagStorage, getDirection, getWorldMark, setDirection, setWorldMark, calculateTagMatchScore |
| 6 | `src/lib/core/archetype/` | createArchetypeStorage, registerArchetype, initializeArchetypes |
| 7 | `src/lib/core/character/` | createCharacterStateStorage, getHp, getMaxHp, setHp, setMaxHp, getDejavuBonds, setDejavuBonds, getRestState, setRestState |

---

## 作成するファイル

### 1. `src/lib/core/iaus/decisions.ts` — MVP Decision 定義

### 2. `src/lib/core/iaus/evaluator.ts` — 評価エンジン

### 3. `src/lib/core/iaus/evaluator.test.ts` — テスト

### 4. `src/lib/core/iaus/index.ts` — バレルエクスポート更新

---

## ファイル1: decisions.ts

MVP Decision の定義データファイル。ロジックは含まない。

### 型（iaus.ts で定義済み）

```typescript
export interface DecisionDef {
  readonly id: number;
  readonly name: string;
  readonly direction: number;          // DECISION_DIRECTION (0=ACTIVE, 1=PASSIVE, 2=SOCIAL)
  readonly worldMark: number;          // Primary WorldMark (0-7)
  readonly situationTag: number;       // Situation tag
  readonly considerationIds: readonly string[];
  readonly weight: number;             // 重要度 (1.0 = 標準)
  readonly baseDurationTicks: number;  // Action Lock 期間
  readonly durationVariance: number;   // ±variance (0.0-0.5)
}
```

### MVP Decision 一覧（~19個）

以下の Decision を `DECISIONS` 配列として定義する。id は配列インデックスと一致させること。

```typescript
export const DECISIONS: readonly DecisionDef[] = [
  // --- 基本生存 (0-2) ---
  { id: 0, name: 'rest',     direction: 1, worldMark: 0, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'rest_need'],
    weight: 1.0, baseDurationTicks: 16, durationVariance: 0.2 },

  { id: 1, name: 'eat',      direction: 1, worldMark: 0, situationTag: 1,
    considerationIds: ['time_of_day'],
    weight: 1.0, baseDurationTicks: 16, durationVariance: 0.3 },

  { id: 2, name: 'sleep',    direction: 1, worldMark: 0, situationTag: 1,
    considerationIds: ['rest_need', 'time_of_day'],
    weight: 1.2, baseDurationTicks: 200, durationVariance: 0.15 },

  // --- 労働 (3-6) ---
  { id: 3, name: 'work_craft',   direction: 0, worldMark: 7, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 1.0, baseDurationTicks: 32, durationVariance: 0.25 },

  { id: 4, name: 'work_trade',   direction: 2, worldMark: 2, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 1.0, baseDurationTicks: 24, durationVariance: 0.25 },

  { id: 5, name: 'work_guard',   direction: 0, worldMark: 0, situationTag: 0,
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity', 'situation_match'],
    weight: 1.0, baseDurationTicks: 48, durationVariance: 0.2 },

  { id: 6, name: 'work_farm',    direction: 0, worldMark: 7, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity', 'time_of_day'],
    weight: 1.0, baseDurationTicks: 32, durationVariance: 0.2 },

  // --- 社交 (7-8) ---
  { id: 7, name: 'talk',     direction: 2, worldMark: 2, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'direction_affinity', 'rest_need'],
    weight: 0.9, baseDurationTicks: 8, durationVariance: 0.3 },

  { id: 8, name: 'greet',    direction: 2, worldMark: 2, situationTag: 1,
    considerationIds: ['direction_affinity', 'time_of_day'],
    weight: 0.7, baseDurationTicks: 4, durationVariance: 0.2 },

  // --- 移動 (9-10) ---
  { id: 9, name: 'travel',   direction: 0, worldMark: 1, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'own_bonds_ratio'],
    weight: 0.8, baseDurationTicks: 32, durationVariance: 0.3 },

  { id: 10, name: 'wander',  direction: 0, worldMark: 1, situationTag: 1,
    considerationIds: ['rest_need', 'direction_affinity'],
    weight: 0.5, baseDurationTicks: 16, durationVariance: 0.4 },

  // --- 戦闘 (11-13) ---
  { id: 11, name: 'attack',  direction: 0, worldMark: 1, situationTag: 0,
    considerationIds: ['own_hp_ratio', 'own_hp_critical', 'direction_affinity', 'situation_match'],
    weight: 1.1, baseDurationTicks: 8, durationVariance: 0.3 },

  { id: 12, name: 'defend',  direction: 1, worldMark: 0, situationTag: 0,
    considerationIds: ['own_hp_critical', 'situation_match', 'direction_affinity'],
    weight: 1.0, baseDurationTicks: 8, durationVariance: 0.2 },

  { id: 13, name: 'flee',    direction: 0, worldMark: 5, situationTag: 0,
    considerationIds: ['own_hp_critical', 'own_bonds_critical', 'situation_match'],
    weight: 1.3, baseDurationTicks: 8, durationVariance: 0.3 },

  // --- 回復 (14-15) ---
  { id: 14, name: 'heal_self', direction: 1, worldMark: 3, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'own_hp_critical', 'tag_match'],
    weight: 1.1, baseDurationTicks: 16, durationVariance: 0.2 },

  { id: 15, name: 'wait',    direction: 1, worldMark: 0, situationTag: 1,
    considerationIds: ['rest_need'],
    weight: 0.3, baseDurationTicks: 8, durationVariance: 0.5 },

  // --- 信仰 (16) ---
  { id: 16, name: 'pray',    direction: 1, worldMark: 3, situationTag: 1,
    considerationIds: ['own_bonds_ratio', 'tag_match', 'time_of_day'],
    weight: 0.8, baseDurationTicks: 16, durationVariance: 0.3 },

  // --- 探索 (17-18) ---
  { id: 17, name: 'explore', direction: 0, worldMark: 4, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'own_bonds_ratio', 'direction_affinity', 'tag_match'],
    weight: 0.9, baseDurationTicks: 32, durationVariance: 0.3 },

  { id: 18, name: 'investigate', direction: 0, worldMark: 4, situationTag: 1,
    considerationIds: ['own_hp_ratio', 'tag_match', 'direction_affinity'],
    weight: 0.8, baseDurationTicks: 24, durationVariance: 0.25 },
] as const satisfies readonly DecisionDef[];
```

**注意事項**:
- `id` は配列インデックスと一致させる（`DECISIONS[n].id === n`）
- `direction` は DIRECTION_TAG の値（0=ACTIVE, 1=PASSIVE, 2=SOCIAL）に対応
- `worldMark` は WORLD_MARK の値（0=Bone, 1=Blood, 2=Breath, 3=Tear, 4=Eye, 5=Shadow, 6=Ear, 7=Skin）に対応
- `situationTag` は 0=DANGER, 1=PEACEFUL（MVP では 2 値のみ使用）
- `as const satisfies readonly DecisionDef[]` で型安全性を確保

---

## ファイル2: evaluator.ts

### エクスポート関数（3つ）

#### 2.1 evaluateDecision — 単体 Decision 評価

```typescript
/**
 * 特定アクターに対する単一 Decision のスコアを算出する。
 *
 * 処理フロー:
 *   1. situation_match スコアを追加（一致=1.0, 不一致=0.5）
 *   2. direction_affinity スコアを追加
 *      - Archetype の weightActive/weightPassive/weightSocial を参照
 *      - Decision.direction と照合して weight / 100 を返す
 *   3. 各 considerationId を順に評価:
 *      - 'tag_match': getConsiderationInput を使わず、Archetype の direction
 *        weights + WorldMark 一致で独自計算（後述）
 *      - 'direction_affinity': 既に Step 2 で追加済み → スキップ
 *      - 'situation_match': 既に Step 1 で追加済み → スキップ
 *      - それ以外: getConsiderationInput → normalize → evaluateCurve
 *   4. aggregateScores で幾何平均補正
 *   5. applyWeight で decision.weight を乗算
 *
 * @returns 0.0-1.0+ のスコア（weight > 1.0 なら 1.0 超の可能性あり）
 */
export function evaluateDecision(
  actorId: EntityId,
  decision: DecisionDef,
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): number
```

#### tag_match の特殊計算ロジック

Decision はエンティティではないため、`calculateTagMatchScore` を直接使えない。
代わりに以下の簡略化されたスコアリングを行う:

```typescript
function calculateTagMatchForDecision(
  actorId: EntityId,
  decision: DecisionDef,
  systems: SystemRefs
): number {
  let score = 0.5; // ベースライン（中立）

  // WorldMark一致チェック
  const actorMark = getWorldMark(systems.tags, actorId);
  if (actorMark === decision.worldMark) {
    score += 0.3;  // 主WorldMark一致ボーナス
  }

  // Direction × Archetype weight
  // （direction_affinity として既に別途評価されるため、ここでは含めない）

  return clamp01(score);
}
```

**重要**: `tag_match` は WorldMark の一致のみを評価する簡易版。Phase 2 で Archetype affinity table を使った本格的なタグマッチングに拡張予定。

#### direction_affinity の計算ロジック

```typescript
function calculateDirectionAffinity(
  actorId: EntityId,
  decision: DecisionDef,
  systems: SystemRefs
): number {
  // Archetype の direction weights を使用
  const archId = /* actorId から archetype ID を取得する方法 → 後述 */;
  
  // ArchetypeStorage から weightActive/weightPassive/weightSocial を取得
  // decision.direction (0=ACTIVE, 1=PASSIVE, 2=SOCIAL) に対応する weight を返す
  // weight は 0-100 の範囲 → 0.0-1.0 に正規化
  
  switch (decision.direction) {
    case 0: return getWeightActive(systems.archetype, archId) / 100;
    case 1: return getWeightPassive(systems.archetype, archId) / 100;
    case 2: return getWeightSocial(systems.archetype, archId) / 100;
    default: return 0.5;
  }
}
```

**Archetype ID の取得について**:
- 現在の実装では、エンティティから archetype ID を直接取得するアクセサが存在しない可能性がある
- 対応方法（いずれか）:
  - (A) SystemRefs に `archetypeAssignments: Uint8Array` を追加（エンティティ → archetype ID マッピング）
  - (B) evaluator 内で一時的な Map を使用
  - (C) EvaluationContext に含める
- **推奨**: (A) SystemRefs 拡張。CharacterStateStorage か別の配列に archetype assignment を追加する。ただし、既存コード `src/lib/core/archetype/storage.ts` を確認し、entity → archetype のマッピングが既に存在するか確認すること
- **既存コードに存在しない場合**: `evaluateDecision` の追加パラメータとして `archetypeId: ArchetypeId` を受け取る。`evaluateNpc` と `evaluateBatch` 内でマッピングを管理する

#### 2.2 evaluateNpc — 単体 NPC 評価

```typescript
/**
 * 全 Decision から最高スコアの Decision を選択する。
 *
 * @returns { decisionId: number; score: number }
 *   decisionId は DECISIONS 配列のインデックス（= decision.id）
 *   score は 0.0 以上（最高スコア）
 */
export function evaluateNpc(
  actorId: EntityId,
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>
): { decisionId: number; score: number }
```

- 全 Decision をループし、`evaluateDecision` を呼び出す
- 最高スコアの decision.id と score を返す
- score が全て 0 以下の場合は `{ decisionId: 0, score: 0 }`（rest へフォールバック）

#### 2.3 evaluateBatch — バッチ評価

```typescript
/**
 * unlocked NPC を一括評価し、cache と lock を更新する。
 *
 * @param unlockedIds - advanceLockCounters の戻り値（unlocked entity IDs）
 *
 * 処理フロー:
 *   1. unlockedIds をループ
 *   2. entityId(rawId) でブランド化
 *   3. evaluateNpc で最高スコア Decision を取得
 *   4. setDecisionResult で cache 更新
 *   5. calculateDuration で Action Lock 期間を算出（決定論的シード: rawId * 10000 + currentTick）
 *   6. setLock で lock 設定
 */
export function evaluateBatch(
  unlockedIds: readonly number[],
  decisions: readonly DecisionDef[],
  context: EvaluationContext,
  systems: SystemRefs,
  considerations: ReadonlyMap<string, ConsiderationDef>,
  cache: DecisionCacheStorage,
  lock: ActionLockStorage
): void
```

- 戻り値は void（cache と lock を in-place mutation）
- ループ内で `entityId()` による再ブランド化が必要（unlockedIds は `number[]` で返される）

---

## テスト仕様 (evaluator.test.ts)

### テスト構造

```
describe('evaluateDecision')
  describe('situation matching')
    - situationTag === currentSituation → スコアに 1.0 寄与
    - situationTag !== currentSituation → スコアに 0.5 寄与

  describe('direction affinity')
    - ACTIVE decision + ACTIVE-weighted archetype → 高スコア
    - PASSIVE decision + ACTIVE-weighted archetype → 低スコア
    - decision.direction と archetype weights の一致度検証

  describe('tag_match consideration')
    - actorのWorldMark === decision.worldMark → ボーナス
    - actorのWorldMark !== decision.worldMark → ベースライン

  describe('standard considerations')
    - own_hp_ratio: HP低い → rest/heal系の Decision スコア高
    - rest_need: ACTIVE状態 → rest/sleep 系の Decision スコア高
    - own_hp_critical: HP30%以下 → flee/defend スコア急上昇
    - time_of_day: gameHour による変動

  describe('aggregation')
    - 複数 Consideration のスコアが幾何平均で集約される
    - 1つでも 0 の Consideration がある → 全体スコア 0

  describe('weight application')
    - weight: 1.2 の Decision → baseScore * 1.2

describe('evaluateNpc')
  describe('best decision selection')
    - 最高スコアの Decision が選択される
    - 同点の場合は先に評価された（低 id）が選択される
    - 全スコア 0 → decisionId: 0 (rest) フォールバック

  describe('scenario: healthy NPC in peaceful area')
    - work系 or social系 Decision が選択される傾向
    - rest/flee は低スコア

  describe('scenario: injured NPC in danger zone')
    - flee or defend が高スコア
    - work/social は低スコア

  describe('scenario: exhausted NPC at night')
    - sleep が最高スコア（rest_need + time_of_day 相乗効果）

describe('evaluateBatch')
  describe('cache and lock integration')
    - 評価後に cache が更新される
    - 評価後に lock が設定される
    - lock の duration が calculateDuration で算出される

  describe('multiple NPCs')
    - 異なる状態のNPCが異なる Decision を選択する
    - 全NPCが処理される（スキップなし）

  describe('deterministic seeding')
    - 同じ rawId + currentTick → 同じ duration
    - 異なる rawId → 異なる duration

  describe('performance')
    - 100 NPC × 19 Decision のバッチ評価が 50ms 以内で完了
    - （vitest の bench ではなく簡易的な performance.now() 計測）
```

### テストヘルパー（推奨）

```typescript
/**
 * テスト用に全システムのストレージを構築する。
 * 既存の create*Storage 関数を使用。
 */
function createTestSystems(entityCount: number = 10): {
  systems: SystemRefs;
  cache: DecisionCacheStorage;
  lock: ActionLockStorage;
} {
  const entity = createEntityStorage();
  const tags = createTagStorage();
  const archetype = createArchetypeStorage();
  const character = createCharacterStateStorage();
  const lock = createActionLockStorage();
  
  // archetype 定義を登録
  initializeArchetypes(archetype);
  
  return {
    systems: { entity, tags, archetype, character, actionLock: lock },
    cache: createDecisionCacheStorage(),
    lock,
  };
}

/**
 * テスト用NPCエンティティを作成し、基本的な状態をセットする。
 */
function createTestNpc(
  systems: SystemRefs,
  options: {
    hp?: number;
    maxHp?: number;
    bonds?: number;
    restState?: number;
    direction?: number;
    worldMark?: number;
    archetypeId?: number;  // archetypeマッピングの方法による
  }
): EntityId {
  const id = createEntity(systems.entity, CATEGORY.NPC);
  setHp(systems.character, id, options.hp ?? 100);
  setMaxHp(systems.character, id, options.maxHp ?? 100);
  setDejavuBonds(systems.character, id, options.bonds ?? 100);
  setRestState(systems.character, id, options.restState ?? 0);
  setDirection(systems.tags, id, options.direction ?? 0);
  setWorldMark(systems.tags, id, options.worldMark ?? 0);
  return id;
}
```

---

## コーディング規約

### import ルール（verbatimModuleSyntax 準拠）

```typescript
// 型のみ
import type { EntityId, ArchetypeId } from '$lib/types/brand.js';
import type { DecisionDef, ConsiderationDef, EvaluationContext, DecisionCacheStorage, ActionLockStorage } from '$lib/types/iaus.js';
import type { SystemRefs } from './considerations.js';

// 値
import { entityId } from '$lib/types/brand.js';
import { normalize } from './curves.js';
import { evaluateCurve } from './curves.js';
import { clamp01 } from './curves.js';
import { aggregateScores, applyWeight } from './scoring.js';
import { setDecisionResult } from './cache.js';
import { setLock } from './cache.js';
import { calculateDuration } from './time.js';
import { getConsiderationInput } from './considerations.js';
import { getWorldMark, getDirection } from '$lib/core/tags/accessors.js';
```

### erasableSyntaxOnly 準拠

- enum 禁止（as const + 派生型）
- namespace 禁止
- パラメータプロパティ禁止

### Branded Type 使用

- 関数パラメータで EntityId を受け取る場合は branded type を使用
- `!` 非null アサーションはアクセサ関数経由のみ
- `evaluateBatch` 内の `entityId(rawId)` で再ブランド化

### 純粋関数設計

- `evaluateDecision` と `evaluateNpc` はストレージを変更しない（読み取り専用）
- `evaluateBatch` のみ cache と lock を変更する（明示的に副作用あり）

---

## 既存ファイルの確認ポイント

実装前に以下を必ず確認すること:

### 1. ArchetypeStorage の direction weights

```bash
grep -n "weightActive\|weightPassive\|weightSocial" src/lib/types/archetype.ts
grep -n "weightActive\|weightPassive\|weightSocial" src/lib/core/archetype/storage.ts
```

- `weightActive`, `weightPassive`, `weightSocial` が TypedArray として存在するか
- アクセサ関数が export されているか
- 存在しない場合は、`ArchetypeStorage` に追加するか、別アプローチを検討

### 2. Entity → Archetype マッピング

```bash
grep -rn "archetypeId\|archetype_id\|getArchetype" src/lib/
```

- エンティティに archetype が割り当てられるメカニズムを確認
- 存在しない場合の対応方針:
  - **推奨**: `CharacterStateStorage` に `archetypeIds: Uint8Array` を追加
  - **代替**: `evaluateNpc` / `evaluateBatch` に `archetypeMap: Map<number, ArchetypeId>` パラメータを追加
  - **注**: どちらの場合も既存テスト（394テスト）が壊れないことを確認

### 3. EvaluationContext の現在の定義

```bash
grep -A 20 "EvaluationContext" src/lib/types/iaus.ts
```

- `currentTick`, `gameHour`, `currentSituation` が含まれているか確認
- 不足があれば追加

### 4. considerations.ts の実際のエクスポート

```bash
grep -n "export" src/lib/core/iaus/considerations.ts
```

- `SystemRefs` interface の実際のフィールド名を確認
- `getConsiderationInput` のシグネチャを確認

### 5. index.ts（バレルエクスポート）の現状

```bash
cat src/lib/core/iaus/index.ts
```

- 既存の re-export を確認し、decisions.ts と evaluator.ts を追加

---

## index.ts 更新

```typescript
// 既存
export * from './curves.js';
export * from './scoring.js';
export * from './cache.js';
export * from './time.js';
export * from './considerations.js';

// 追加
export * from './decisions.js';
export * from './evaluator.js';
```

---

## 完了条件

- [ ] `bun run typecheck` が通ること
- [ ] 既存テスト（394テスト）が引き続き全パスすること
- [ ] evaluator.test.ts の新規テスト（~30-40テスト）が全パスすること
- [ ] decisions.ts に 19 個の DecisionDef が定義されていること
- [ ] `DECISIONS[n].id === n` がすべての Decision で成立すること
- [ ] evaluateDecision が situation_match / direction_affinity / tag_match を特殊処理していること
- [ ] evaluateBatch が cache と lock を正しく更新すること
- [ ] 100 NPC バッチ評価が 50ms 以内（performance.now() 簡易計測）
- [ ] verbatimModuleSyntax 準拠（import type 明示）
- [ ] erasableSyntaxOnly 準拠（enum 不使用）
- [ ] Branded Type 使用（EntityId パラメータ）

---

## Phase 2 への申し送り事項

Step 7 完了後、以下は Phase 2 以降の課題:

1. **Inertia（慣性ボーナス）**: 同じ Decision を連続選択するとボーナス。`DecisionCacheStorage.consecutiveCount` を活用
2. **Cooldown（再選択制限）**: 特定 Decision の再選択を一定 tick 禁止
3. **tag_match の本格化**: Archetype affinity table を使ったフルタグマッチング
4. **Dynamic Considerations 追加**: 関係値、派閥、経済状況
5. **Combined Decision**: 行動 + セリフの統合評価
6. **Interruption**: 戦闘・イベントによる Decision 中断

---

## チェックリスト更新指示

Step 7 完了時に `0_0_liminia_mvp_progress_checklist_v4.md` を以下のように更新:

1. 全体サマリーの「実装中: §9 IAUS Engine（Step 7 evaluator.ts から再開）」を「完了: §9 IAUS Engine（全 Step 完了）」に変更
2. §9 テーブルの Step 7 を ✅ に更新、テスト数を記入
3. テスト合計を更新（394 + 新規テスト数）
4. 変更履歴に v5 エントリ追加

---

Last updated: 2026-02-01
