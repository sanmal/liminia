#涯庭 #Liminia

# Claude Code Prompt - IAUS Step 1 型定義

## タスク

`src/lib/types/iaus.ts` を新規作成し、`src/lib/types/index.ts` のバレルエクスポートに追加する。

## 参照ファイル（実装前に必ず読むこと）

1. `docs/iaus-engine-implementation-spec.md` — §9 IAUS Engine 実装仕様書 v1（§3 型定義セクション）
2. `src/lib/types/brand.ts` — EntityId 型（DecisionCacheStorage で使用）
3. `src/lib/types/constants.ts` — MAX_ENTITIES（デフォルト capacity）
4. `src/lib/types/tags.ts` — DIRECTION_TAG, SITUATION_TAG, DirectionTagType, SituationTagType の再利用
5. `src/lib/types/index.ts` — バレルエクスポートに iaus.ts を追加

## 仕様書からの修正点（重要）

実装仕様書 §3.4 で `DECISION_DIRECTION` を独自定義しているが、これは **採用しない**。

理由: `tags.ts` に `DIRECTION_TAG` が既に存在し、値が異なる（DIRECTION_TAG は NONE=0, ACTIVE=1 始まり / DECISION_DIRECTION は ACTIVE=0 始まり）。独自定義すると Tag System との統合で値の不整合が発生する。

### 修正内容

- `DECISION_DIRECTION` は作成しない
- `DecisionDef.direction` の型は `DirectionTagType`（tags.ts から import type）
- `DecisionDef.situationTag` の型は `SituationTagType`（tags.ts から import type）
- `EvaluationContext.currentSituation` の型も `SituationTagType`

## 実装パターン（既存コードとの統一）

- `erasableSyntaxOnly`: enum 不使用。`as const` + 派生型パターン
- `verbatimModuleSyntax`: `import type` を明示
- `noUncheckedIndexedAccess`: TypedArray アクセスは accessor 経由
- 定数オブジェクトには `as const` を付与
- インターフェースのフィールドは `readonly`

## 作成するもの

### 1. `src/lib/types/iaus.ts`

以下のエクスポートを含むこと:

**定数:**
- `CURVE_TYPE` — 5曲線種別（LINEAR=0, POLYNOMIAL=1, LOGISTIC=2, LOGIT=3, PARABOLIC=4）
- `CURVE_PRESET` — 曲線パラメータプリセット（8種）
- `TIME_CONFIG` — 時間システム定数

**型:**
- `CurveType` — CURVE_TYPE の派生型
- `CurveParams` — { m, k, c, b } readonly
- `ConsiderationDef` — { id, name, curveType, curveParams, inputMin, inputMax }
- `DecisionDef` — { id, name, direction: DirectionTagType, worldMark, situationTag: SituationTagType, considerationIds, weight, baseDurationTicks, durationVariance }
- `DecisionCacheStorage` — TypedArray ストレージ（currentDecision: Uint16Array, currentScore: Float32Array, lastEvaluatedTick: Uint32Array, capacity）
- `ActionLockStorage` — TypedArray ストレージ（remainingTicks: Uint8Array, currentAction: Uint8Array, capacity）
- `EvaluationContext` — { currentTick, currentSituation: SituationTagType, gameHour }

### 2. `src/lib/types/index.ts` の更新

iaus.ts の全エクスポートをバレルに追加。

## 完了条件

- `bun run typecheck` が通ること
- 既存テスト（244テスト）が引き続き全パスすること
- `tags.ts` の型を再利用し、IAUS 独自の direction/situation 定数を作成していないこと
