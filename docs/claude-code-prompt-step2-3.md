#涯庭 #Liminia

# Claude Code Prompt - IAUS Step 2-3 Response Curves and Score Aggregation

## タスク

以下の4ファイルを新規作成する:

1. `src/lib/core/iaus/curves.ts` — 正規化 + 5曲線 + 統一ディスパッチャ + LUT
2. `src/lib/core/iaus/curves.test.ts` — ~30テスト
3. `src/lib/core/iaus/scoring.ts` — 幾何平均補正 + weight適用
4. `src/lib/core/iaus/scoring.test.ts` — ~12テスト

## 参照ファイル（実装前に必ず読むこと）

1. `docs/iaus-engine-implementation-spec.md` — §4 Response Curves、§5 Score Aggregation
2. `src/lib/types/iaus.ts` — CURVE_TYPE, CurveType, CurveParams（Step 1で作成済み）
3. `src/lib/core/character/hp.test.ts` — 既存テストのパターン参照（describe/it構造、import形式）

## 設計方針

- 全関数は**純粋関数**。外部状態への依存・副作用なし
- 他システム（Entity, Tags, Archetype, Character）への依存なし
- import type を使用（verbatimModuleSyntax準拠）

---

## Step 2: curves.ts の仕様

### エクスポート関数一覧

| 関数 | シグネチャ | 備考 |
|------|-----------|------|
| `clamp01` | `(v: number) => number` | 0-1クランプ。内部ヘルパーだがテスト用にexport |
| `normalize` | `(value: number, min: number, max: number) => number` | min=maxは0を返す |
| `linear` | `(x: number, m: number, b: number) => number` | `clamp01(m * x + b)` |
| `polynomial` | `(x: number, m: number, c: number, k: number, b: number) => number` | `clamp01(Math.pow(m * (x - c), k) + b)` |
| `logistic` | `(x: number, m: number, c: number, k: number, b: number) => number` | `clamp01(k / (1 + Math.exp(-m * (x - c))) + b)` |
| `logit` | `(x: number, epsilon?: number) => number` | ε=1e-6デフォルト。xSafeでクランプ後 `(ln(xSafe / (1-xSafe)) + 5) / 10` |
| `parabolic` | `(x: number) => number` | `clamp01(4 * x * (1 - x))` |
| `evaluateCurve` | `(x: number, curveType: CurveType, params: CurveParams) => number` | switch文ディスパッチ |
| `generateLUT` | `(curveType: CurveType, params: CurveParams, resolution?: number) => Float32Array` | デフォルト256 |
| `lookupLUT` | `(lut: Float32Array, x: number) => number` | `Math.round(x * (lut.length - 1))` でインデックス |

### 数式の注意点

- **polynomial**: k が偶数で `m * (x - c)` が負の場合、`Math.pow` は正の値を返す（期待通り）。k が奇数で負の場合は `NaN` になり得るので、`Math.pow` の結果に対して `clamp01` で処理。ただし `NaN` は clamp01 で 0 にフォールバックさせること: `v < 0 ? 0 : v > 1 ? 1 : v` では `NaN` は全比較が false になるため、明示的に `Number.isNaN(v) ? 0 : ...` のガードを追加するか、`if (!(v >= 0)) return 0; return v > 1 ? 1 : v;` のパターンを使う
- **logistic**: `Math.exp` が Infinity を返す場合でも `k / (1 + Infinity)` = 0 なので安全
- **logit**: 正規化の `(raw + 5) / 10` は標準logit出力 ≈ (-∞,+∞) を実用的に (0,1) に丸めるための近似。完璧な正規化ではないが IAUS の用途には十分

### curves.test.ts テスト構造

```
describe('clamp01')
  - 範囲内の値はそのまま
  - 負の値は0
  - 1超は1
  - NaN は 0（安全なフォールバック）

describe('normalize')
  - 基本正規化 (0-100 → 0-1)
  - min=max → 0
  - value < min → 0
  - value > max → 1
  - 負の範囲 (-500 to 500)

describe('linear')
  - m=1, b=0 → identity
  - m=0.5, b=0.5 → 中間値シフト
  - m=-1, b=1 → 反転
  - 出力が0-1にクランプされる

describe('polynomial')
  - k=1 → 線形と同等
  - k=2 → 二次曲線
  - c=0.5 → 中央シフト
  - 出力クランプ

describe('logistic')
  - m=10, c=0.5 → S字の中点が0.5
  - x=c → 出力 ≈ k/2 + b
  - 急峻な遷移（m=50）
  - 出力クランプ

describe('logit')
  - x=0.5 → 出力 ≈ 0.5
  - x→0 → 出力→0
  - x→1 → 出力→1
  - ε保護（x=0, x=1でエラーなし）

describe('parabolic')
  - x=0 → 0
  - x=0.5 → 1.0
  - x=1 → 0
  - 対称性: f(0.3) ≈ f(0.7)

describe('evaluateCurve')
  - 各CurveTypeに正しくディスパッチ
  - 不正なcurveType → 0

describe('generateLUT / lookupLUT')
  - LUT生成で正しい解像度
  - lookupでx=0, x=0.5, x=1の値が直接計算と一致
  - lookupの境界値（x<0, x>1）が安全
```

---

## Step 3: scoring.ts の仕様

### エクスポート関数一覧

| 関数 | シグネチャ | 備考 |
|------|-----------|------|
| `aggregateScores` | `(scores: readonly number[]) => number` | 幾何平均補正。空配列→0、要素に≤0→0 |
| `applyWeight` | `(score: number, weight: number) => number` | 単純乗算。クランプなし（weight>1.0が有効な値） |

### aggregateScores の数式

```
Score_final = (c₁ × c₂ × ... × cₙ)^(1/n)
```

- 空配列: return 0
- いずれかの要素 ≤ 0: return 0（自動Veto）
- 全要素が同じ値 v の場合: v^(n/n) = v（希釈問題の解決確認）

### scoring.test.ts テスト構造

```
describe('aggregateScores')
  - 空配列 → 0
  - 単一要素 [0.8] → 0.8
  - 全て同じ値 [0.9, 0.9, 0.9] → 0.9（幾何平均補正の検証）
  - ゼロ含む [0.5, 0, 0.8] → 0（自動Veto）
  - 負の値含む [0.5, -0.1, 0.8] → 0（自動Veto）
  - 異なる値 [0.8, 0.6, 0.4] → 期待値を計算して検証
  - 全て1.0 [1.0, 1.0, 1.0] → 1.0
  - 非常に小さい値 [0.01, 0.01] → 0.01

describe('applyWeight')
  - weight=1.0 → スコアそのまま
  - weight=1.5 → 1.5倍
  - weight=0.5 → 半減
  - score=0 → 0（weight無関係）
```

---

## 完了条件

- `bun run typecheck` が通ること
- 既存テスト（244テスト）が引き続き全パスすること
- curves.test.ts + scoring.test.ts の新規テストが全パスすること
- 浮動小数点比較は `toBeCloseTo(expected, 5)` 等の精度指定を使うこと
