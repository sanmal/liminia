#涯庭 #Liminia

# Claude Code Prompt - IAUS Step 6 Considerations

## タスク

以下の2ファイルを新規作成する:

1. `src/lib/core/iaus/considerations.ts` — Consideration定義 + 入力関数レジストリ
2. `src/lib/core/iaus/considerations.test.ts` — ~25テスト

## 参照ファイル（実装前に必ず読むこと）

1. `docs/iaus-engine-implementation-spec.md` — §8 Consideration関数（設計方針・SystemRefs・MVP一覧・入力関数例）
2. `src/lib/types/iaus.ts` — ConsiderationDef, CurveParams, CURVE_TYPE, CURVE_PRESET, EvaluationContext, DecisionDef
3. `src/lib/types/brand.ts` — EntityId, entityId()
4. `src/lib/types/tags.ts` — TagStorage, DIRECTION_TAG, DirectionTagType, SITUATION_TAG, SituationTagType
5. `src/lib/types/archetype.ts` — ArchetypeStorage, ArchetypeInfo
6. `src/lib/types/character.ts` — CharacterStateStorage
7. `src/lib/core/character/storage.ts` — getHp, getMaxHp, getDejavuBonds, getRestState
8. `src/lib/core/character/hp.ts` — getHpStage, HP_STAGE
9. `src/lib/core/tags/accessors.ts` — getDirection, getWorldMark
10. `src/lib/core/archetype/storage.ts` — getArchetypeInfo, ArchetypeStorage
11. `src/lib/core/iaus/cache.ts` — ActionLockStorage, getRemainingTicks（rest_need用）
12. `src/lib/core/iaus/curves.ts` — normalize, evaluateCurve（テストでの検証用参照）

## 依存関係

```
types/iaus.ts ────────┐
types/brand.ts ───────┤
types/tags.ts ────────┤
types/archetype.ts ───┼──→ considerations.ts
types/character.ts ───┤
core/character/* ─────┤
core/tags/accessors ──┤
core/archetype/storage┤
core/iaus/cache.ts ───┘ (ActionLockStorage for rest_need)
```

considerations.ts は既存4システム（Entity/Tags/Archetype/Character）全てを参照する統合レイヤー。
ただし、considerations.ts 自身は curves.ts/scoring.ts を import しない（正規化・曲線評価は evaluator 側の責務）。

---

## considerations.ts の仕様

### 設計方針

1. **ConsiderationDef は純粋データ**: 曲線タイプ・パラメータ・正規化範囲のみ。inputFn を含めない
2. **入力関数は別レジストリ**: ConsiderationDef.id をキーに対応する入力関数を呼び出す
3. **入力関数は生の値を返す**: 正規化（normalize）と曲線適用（evaluateCurve）は evaluator が行う
4. **SystemRefs で依存注入**: 既存システムのストレージを参照まとめたインターフェース

### エクスポート一覧

| エクスポート | 種類 | 説明 |
|-------------|------|------|
| `SystemRefs` | interface | 既存システムストレージへの参照 |
| `ConsiderationInputFn` | type | 入力関数のシグネチャ |
| `MVP_CONSIDERATIONS` | `ReadonlyMap<string, ConsiderationDef>` | MVP全Consideration定義 |
| `getConsiderationInput` | function | IDから入力値を取得する統一関数 |

### SystemRefs インターフェース

```typescript
import type { EntityStorage } from '$lib/types/entity';
import type { TagStorage } from '$lib/types/tags';
import type { ArchetypeStorage } from '$lib/types/archetype';
import type { CharacterStateStorage } from '$lib/types/character';
import type { ActionLockStorage } from '$lib/types/iaus';

export interface SystemRefs {
  readonly entity: EntityStorage;
  readonly tags: TagStorage;
  readonly archetype: ArchetypeStorage;
  readonly character: CharacterStateStorage;
  readonly actionLock: ActionLockStorage;
}
```

**注**: 仕様書 §8.2 の SystemRefs に ActionLockStorage を追加。rest_need の入力が remainingTicks を参照するため。

### ConsiderationInputFn 型

```typescript
import type { EntityId } from '$lib/types/brand';
import type { EvaluationContext } from '$lib/types/iaus';

export type ConsiderationInputFn = (
  actorId: EntityId,
  context: EvaluationContext,
  systems: SystemRefs
) => number;
```

### MVP Consideration 定義（9個）

以下の ConsiderationDef を `MVP_CONSIDERATIONS` Map に登録する。

| # | ID | name | curveType | curveParams | inputMin | inputMax |
|---|-----|------|-----------|-------------|:--------:|:--------:|
| 1 | `own_hp_ratio` | HP Ratio | LINEAR | CURVE_PRESET.LINEAR_INVERSE | 0 | 1 |
| 2 | `own_hp_critical` | HP Critical | LOGISTIC | CURVE_PRESET.CRITICAL_DETECTOR | 0 | 1 |
| 3 | `own_bonds_ratio` | Bonds Ratio | LINEAR | CURVE_PRESET.LINEAR_INVERSE | 0 | 1 |
| 4 | `own_bonds_critical` | Bonds Critical | LOGISTIC | CURVE_PRESET.CRITICAL_DETECTOR | 0 | 1 |
| 5 | `tag_match` | Tag Match Score | LINEAR | CURVE_PRESET.LINEAR_HALF | -500 | 500 |
| 6 | `direction_affinity` | Direction Affinity | LINEAR | CURVE_PRESET.LINEAR_STANDARD | 0 | 1 |
| 7 | `situation_match` | Situation Match | LINEAR | CURVE_PRESET.LINEAR_STANDARD | 0 | 1 |
| 8 | `time_of_day` | Time of Day | LINEAR | CURVE_PRESET.LINEAR_STANDARD | 0 | 23 |
| 9 | `rest_need` | Rest Need | POLYNOMIAL | CURVE_PRESET.LATE_WEIGHT | 0 | 255 |

**曲線選択の根拠**:

- `own_hp_ratio` / `own_bonds_ratio`: LINEAR_INVERSE (m=-1, b=1) → HP/Bondsが**低い**ほど「回復系Decision」のスコアが**高く**なる。入力0→出力1、入力1→出力0
- `own_hp_critical` / `own_bonds_critical`: CRITICAL_DETECTOR (logistic, m=-15, c=0.3) → 30%以下で急激に1.0に近づく。緊急行動のトリガー
- `tag_match`: LINEAR_HALF (m=0.5, b=0.5) → -500〜+500 を正規化後、0.0〜1.0に変換。不一致でも完全0にならない（0.25程度）
- `direction_affinity`: LINEAR_STANDARD → 一致=1.0を直接渡す。純粋な線形
- `situation_match`: LINEAR_STANDARD → 一致=1.0、不一致=0.5を渡す
- `time_of_day`: LINEAR_STANDARD → evaluator内で Decision ごとに異なる曲線パラメータを上書きする想定（Phase 2）。MVP ではそのまま正規化
- `rest_need`: LATE_WEIGHT (polynomial, k=2) → 後半で急上昇。長時間行動するほど休息の必要性が急激に増す

### 入力関数の実装詳細

```typescript
// 内部レジストリ（エクスポートしない）
const INPUT_REGISTRY: Readonly<Record<string, ConsiderationInputFn>> = {
```

#### 1. own_hp_ratio / own_hp_critical（同一入力関数）

```typescript
own_hp_ratio(actorId, _ctx, sys) {
  const hp = getHp(sys.character, actorId);
  const maxHp = getMaxHp(sys.character, actorId);
  return maxHp > 0 ? hp / maxHp : 1; // maxHp=0（初期化前）→ 満タン扱い
},
```

- `own_hp_critical` も同じ入力値を使う。曲線で挙動が変わる

#### 2. own_bonds_ratio / own_bonds_critical（同一入力関数）

```typescript
own_bonds_ratio(actorId, _ctx, sys) {
  return getDejavuBonds(sys.character, actorId) / 100;
},
```

- `own_bonds_critical` も同じ入力関数

#### 3. tag_match

```typescript
tag_match(actorId, _ctx, sys) {
  // NOTE: tag_match は actorId 対 Decision のタグ比較が本来の用途だが、
  // ConsiderationInputFn のシグネチャでは Decision 情報を持たない。
  // → evaluator が Decision のタグを一時的に TagStorage に書き込むか、
  //    evaluator 内で直接計算する。
  // MVP方針: ここでは 0 を返し、evaluator が calculateTagMatchScore を
  // 直接呼び出してスコアを注入する。
  return 0;
},
```

**重要な設計判断**: `tag_match` は ConsiderationInputFn のシグネチャ `(actorId, context, systems)` だけでは Decision のタグ情報にアクセスできない。以下の方針をとる：

- considerations.ts では**プレースホルダー関数**（常に0を返す）を登録
- evaluator.ts が `tag_match` を検出した場合、`calculateTagMatchScore` を直接呼び出して結果を注入する
- この方針により ConsiderationInputFn のシグネチャを複雑化させない

#### 4. direction_affinity

```typescript
direction_affinity(actorId, _ctx, sys) {
  // エンティティの direction タグを取得して 0-1 に変換
  // direction は既に DIRECTION_TAG 定数（0-3）
  // evaluator が Decision.direction との一致を判定する想定
  // → tag_match と同様、ここではアクターのdirectionをそのまま返す
  const dir = getDirection(sys.tags, actorId);
  return dir; // evaluator 側で Decision.direction と比較して 0 or 1 に変換
},
```

**設計判断**: `tag_match` と同じ理由で、Decision のタグとの比較は evaluator の責務。ここではアクターの direction 値（0-3）をそのまま返す。evaluator は以下のように使う：

```
score = actorDirection === decisionDirection ? 1.0 : 0.3
```

この比較結果を `direction_affinity` の正規化済みスコアとして使用する。

#### 5. situation_match

```typescript
situation_match(_actorId, ctx, _sys) {
  // evaluator が Decision.situationTag と ctx.currentSituation を比較して
  // 一致=1.0、不一致=0.5 を注入する
  // → tag_match/direction_affinity と同じパターン
  return ctx.currentSituation; // evaluator側で比較
},
```

#### 6. time_of_day

```typescript
time_of_day(_actorId, ctx, _sys) {
  return ctx.gameHour; // 0-23
},
```

#### 7. rest_need

```typescript
rest_need(actorId, _ctx, sys) {
  // Action Lock の remainingTicks から「連続活動 tick 数」を推定
  // remainingTicks が 0 = アンロック状態 = 活動中
  // ただし MVP では連続活動時間を正確に追跡しない
  // → 代替: restState を使用。ACTIVE=255(最大必要), LIGHT_REST=170, SLEEP=85, FULL_REST=0
  const restState = getRestState(sys.character, actorId);
  // REST_STATE: ACTIVE=0, LIGHT_REST=1, SLEEP=2, FULL_REST=3
  // 0 (ACTIVE) → 255 (最も休息が必要)
  // 3 (FULL_REST) → 0 (休息不要)
  return (3 - restState) * 85; // 0, 85, 170, 255
},
```

**設計判断**: 本来は「連続活動tick数」をトラッキングするのが理想だが、MVPでは CharacterStateStorage.restStates をそのまま利用する。restState が ACTIVE(0) なら休息の必要性が最大、FULL_REST(3) なら最小。

### getConsiderationInput 関数

```typescript
/**
 * Get raw input value for a consideration.
 *
 * Returns the raw (unnormalized) value from the input function registry.
 * If the consideration ID is not found, returns 0.
 *
 * @param considerationId - ID from ConsiderationDef.id
 * @param actorId - Entity performing the action
 * @param context - Current evaluation context
 * @param systems - References to game system storages
 * @returns Raw input value (to be normalized by evaluator)
 */
export function getConsiderationInput(
  considerationId: string,
  actorId: EntityId,
  context: EvaluationContext,
  systems: SystemRefs
): number {
  const fn = INPUT_REGISTRY[considerationId];
  if (!fn) return 0;
  return fn(actorId, context, systems);
}
```

### MVP_CONSIDERATIONS Map の構築

```typescript
function buildConsiderationMap(): ReadonlyMap<string, ConsiderationDef> {
  const defs: ConsiderationDef[] = [
    {
      id: 'own_hp_ratio',
      name: 'HP Ratio',
      curveType: CURVE_TYPE.LINEAR,
      curveParams: CURVE_PRESET.LINEAR_INVERSE,
      inputMin: 0,
      inputMax: 1,
    },
    // ... 残り8個
  ];

  const map = new Map<string, ConsiderationDef>();
  for (const def of defs) {
    map.set(def.id, def);
  }
  return map;
}

export const MVP_CONSIDERATIONS: ReadonlyMap<string, ConsiderationDef> = buildConsiderationMap();
```

### own_hp_critical と own_bonds_critical の入力関数共有

`own_hp_critical` と `own_hp_ratio` は**同じ入力値**（HP割合）を使い、**異なる曲線**（LINEAR_INVERSE vs CRITICAL_DETECTOR）で変換される。入力関数レジストリでは：

```typescript
const INPUT_REGISTRY: Readonly<Record<string, ConsiderationInputFn>> = {
  own_hp_ratio: hpRatioInput,
  own_hp_critical: hpRatioInput,  // 同一関数
  own_bonds_ratio: bondsRatioInput,
  own_bonds_critical: bondsRatioInput,  // 同一関数
  // ...
};
```

---

## considerations.test.ts の仕様

### テストのセットアップ

テストでは実際の既存システムのストレージを手動構築して SystemRefs を組み立てる。モック不要。

```typescript
import { createEntityStorage } from '$lib/core/entity/storage';
import { createEntity } from '$lib/core/entity/lifecycle';
import { createTagStorage } from '$lib/core/tags/storage';
import { setDirection, setWorldMark } from '$lib/core/tags/accessors';
import { createArchetypeStorage } from '$lib/core/archetype/storage';
import { createCharacterStateStorage, setHp, setMaxHp, setDejavuBonds, setRestState } from '$lib/core/character/storage';
import { createActionLockStorage } from '$lib/core/iaus/cache';
import { CATEGORY } from '$lib/types/entity';
import { DIRECTION_TAG, SITUATION_TAG } from '$lib/types/tags';
import { REST_STATE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

function createTestSystems(capacity = 10): SystemRefs {
  return {
    entity: createEntityStorage(capacity),
    tags: createTagStorage(capacity),
    archetype: createArchetypeStorage(),
    character: createCharacterStateStorage(capacity),
    actionLock: createActionLockStorage(capacity),
  };
}
```

### テスト構造

```
describe('MVP_CONSIDERATIONS')
  - 9個の ConsiderationDef が登録されている
  - 全 ConsiderationDef が必須プロパティを持つ (id, name, curveType, curveParams, inputMin, inputMax)
  - 全 id が INPUT_REGISTRY にも存在する（getConsiderationInput が 0 以外を返せる）
  - curveParams が CurveParams 型に準拠（m, k, c, b が全て number）

describe('getConsiderationInput')
  describe('own_hp_ratio')
    - HP=100, maxHp=200 → 0.5
    - HP=200, maxHp=200 → 1.0（満タン）
    - HP=0, maxHp=200 → 0.0（死亡状態）
    - maxHp=0（未初期化）→ 1.0（安全なフォールバック）

  describe('own_hp_critical')
    - own_hp_ratio と同じ入力値を返す（曲線が異なるだけ）
    - HP=50, maxHp=200 → 0.25（同じ値）

  describe('own_bonds_ratio')
    - bonds=100 → 1.0
    - bonds=50 → 0.5
    - bonds=0 → 0.0

  describe('own_bonds_critical')
    - own_bonds_ratio と同じ入力値を返す

  describe('tag_match')
    - 常に 0 を返す（プレースホルダー）
    - evaluator での直接計算に委譲されることのコメント確認

  describe('direction_affinity')
    - direction=ACTIVE(1) → 1
    - direction=PASSIVE(2) → 2
    - direction=NONE(0) → 0

  describe('situation_match')
    - context.currentSituation=PEACEFUL(2) → 2
    - context.currentSituation=DANGER(1) → 1

  describe('time_of_day')
    - gameHour=0 → 0
    - gameHour=12 → 12
    - gameHour=23 → 23

  describe('rest_need')
    - restState=ACTIVE(0) → 255
    - restState=LIGHT_REST(1) → 170
    - restState=SLEEP(2) → 85
    - restState=FULL_REST(3) → 0

  describe('unknown consideration')
    - 存在しないID → 0

describe('SystemRefs integration')
  - 実際に createEntity でエンティティを作成し、HP/Bonds/Tags をセットして
    getConsiderationInput が正しい値を返すことを検証する統合テスト（1ケース）
```

---

## コーディング規約（既存パターン踏襲）

### import ルール（verbatimModuleSyntax準拠）

```typescript
// 型のみのインポート
import type { EntityId } from '$lib/types/brand';
import type { ConsiderationDef, CurveParams, EvaluationContext } from '$lib/types/iaus';
import type { EntityStorage } from '$lib/types/entity';
import type { TagStorage } from '$lib/types/tags';
import type { ArchetypeStorage } from '$lib/types/archetype';
import type { CharacterStateStorage } from '$lib/types/character';
import type { ActionLockStorage } from '$lib/types/iaus';

// 値のインポート
import { CURVE_TYPE, CURVE_PRESET } from '$lib/types/iaus';
import { getHp, getMaxHp, getDejavuBonds, getRestState } from '$lib/core/character/storage';
import { getDirection } from '$lib/core/tags/accessors';
```

### erasableSyntaxOnly 準拠

- enum 禁止（as const + 派生型）
- namespace 禁止
- パラメータプロパティ禁止

### Branded Type 使用

- 関数パラメータで EntityId を受け取る場合は branded type を使用
- 内部実装で `!` 非nullアサーションは使わない（アクセサ関数経由）

### 純粋関数設計

- getConsiderationInput はストレージを変更しない（読み取り専用）
- 全入力関数は副作用なし

---

## 完了条件

- [ ] `bun run typecheck` が通ること
- [ ] 既存テスト（363テスト）が引き続き全パスすること
- [ ] considerations.test.ts の新規テスト（~25テスト）が全パスすること
- [ ] MVP_CONSIDERATIONS に 9 個の ConsiderationDef が登録されていること
- [ ] getConsiderationInput が全9個の ID に対して正しい値を返すこと
- [ ] tag_match がプレースホルダー（常に0）であること
- [ ] SystemRefs が EntityStorage, TagStorage, ArchetypeStorage, CharacterStateStorage, ActionLockStorage を含むこと
- [ ] verbatimModuleSyntax 準拠（import type 明示）
- [ ] erasableSyntaxOnly 準拠（enum 不使用）

---

## Evaluator（Step 7）への申し送り事項

Step 6 完了後、evaluator.ts で以下の特殊処理が必要：

1. **tag_match の直接計算**: `considerationId === 'tag_match'` の場合、getConsiderationInput を使わず `calculateTagMatchScore(tags, actorId, decisionEntityId)` を直接呼び出す。ただし Decision はエンティティではないため、evaluator 内で Decision のタグを一時比較する方法を設計する必要あり

2. **direction_affinity の比較**: `considerationId === 'direction_affinity'` の場合、入力値（アクターのdirection）と Decision.direction を比較して一致=1.0/不一致=0.3 のスコアを生成

3. **situation_match の比較**: `considerationId === 'situation_match'` の場合、`context.currentSituation === decision.situationTag` で一致=1.0/不一致=0.5

これらの特殊ケースは evaluator の `evaluateDecision` 関数内で処理する。considerations.ts は入力値の取得のみに責務を限定する。
