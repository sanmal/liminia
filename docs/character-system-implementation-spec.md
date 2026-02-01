#涯庭 #Liminia

# Character System 実装+テスト仕様書

Claude Code向け実装ガイド。Character System v6 の MVP実装とテストを定義する。
HP回復、dejavuBonds、ダメージ処理、Anchor（錨）レベルの4つのサブシステムを含む。
作成日: 2026-02-01

---

## 参照すべきファイル

実装前に必ず以下のファイルを読み込んでください：

```
# 型定義（実装の基盤）
src/lib/types/constants.ts     # MAX_ENTITIES, CATEGORY
src/lib/types/brand.ts         # EntityId, entityId()
src/lib/types/character.ts     # CharacterStateStorage, HP_STAGE, DEJAVU_STAGE, REST_STATE, ANCHOR_LEVEL, ANCHOR_THRESHOLDS, Soul, Vessel, CurrentLife
src/lib/types/marks.ts         # WORLD_MARK（HP係数判定に参照）

# 既存実装（パターン参照）
src/lib/core/entity/storage.ts     # createEntityStorage パターン
src/lib/core/tags/storage.ts       # createTagStorage パターン
src/lib/core/tags/accessors.ts     # Accessor Pattern 参照

# 仕様書
docs/tag-system-implementation-spec.md       # パターン参照
docs/archetype-system-implementation-spec.md # パターン参照
```

---

## 設計原則（Entity / Tags / Archetype と同一）

1. **純粋関数設計**: storageを第1引数で受け取る
2. **Branded Type使用**: エンティティIDには `EntityId` 型を使用
3. **Accessor Pattern**: TypedArray読み取りの `!` はaccessor関数内に集約
4. **erasableSyntaxOnly準拠**: `enum` 不使用。`as const` + 派生型
5. **verbatimModuleSyntax準拠**: `import type` 明示
6. **JSDOCコメント**: 全公開関数に付与
7. **計算と変更の分離**: `calculate*` は純粋関数で値を返し、`apply*` / `damage*` が storage を変更する

---

## ディレクトリ構成

```
src/lib/core/character/
├── storage.ts        # CharacterStateStorage作成・クリア・アクセサ
├── hp.ts             # HPステージ判定・回復計算・HP増減
├── bonds.ts          # dejavuBondsステージ・回復・混沌ダメージ処理
├── anchor.ts         # Anchor（錨）レベル計算
└── index.ts          # バレルエクスポート
```

---

## CharacterStateStorageの構造

```
CharacterStateStorage（capacity = MAX_ENTITIES = 2000）
┌───────────────────────────────────────────────────────────────┐
│ hp: Uint16Array           ← 現在HP (0-65535)                 │
│ maxHp: Uint16Array        ← 最大HP (STR + floor(CON×係数))   │
│ dejavuBonds: Uint8Array   ← 現在dejavuBonds (0-100)          │
│ dejavuBondsTotal: Uint32Array ← 累計bonds (Anchor計算用)     │
│ locationIds: Uint32Array  ← 現在地EntityId                   │
│ restStates: Uint8Array    ← 休息状態 (REST_STATE)            │
│ capacity: number          ← 2000                             │
└───────────────────────────────────────────────────────────────┘
```

**EntityId直接インデックス**:
Entity/Tag/Archetypeと同様、EntityIdをそのまま配列インデックスとして使用。
キャラクター以外のエンティティ（Location, Faction等）の対応スロットは0のまま未使用。

**メモリ**: capacity=2000の場合
- hp: 2×2000 = 4KB
- maxHp: 2×2000 = 4KB
- dejavuBonds: 1×2000 = 2KB
- dejavuBondsTotal: 4×2000 = 8KB
- locationIds: 4×2000 = 8KB
- restStates: 1×2000 = 2KB
- **合計: 28KB** （52KB総予算内、十分なマージン）

Master Indexの ~0.6KB見積もりは103キャラクター分の見積もり。
MAX_ENTITIESでの28KBは直接インデックスの代償だが、
4GB制約に対し0.0007%であり問題ない。

---

## ファイル別実装仕様

### 1. storage.ts

**責務**: CharacterStateStorageの作成・クリア・全フィールドのアクセサ

```typescript
import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import { MAX_ENTITIES } from '$lib/types/constants';

// ─── Storage生成 ──────────────────────────────────────

/**
 * 新しいCharacterStateStorageを作成
 * @param capacity - 最大エンティティ数（デフォルト: MAX_ENTITIES）
 */
export function createCharacterStateStorage(
  capacity: number = MAX_ENTITIES
): CharacterStateStorage {
  return {
    hp: new Uint16Array(capacity),
    maxHp: new Uint16Array(capacity),
    dejavuBonds: new Uint8Array(capacity),
    dejavuBondsTotal: new Uint32Array(capacity),
    locationIds: new Uint32Array(capacity),
    restStates: new Uint8Array(capacity),
    capacity,
  };
}

/**
 * CharacterStateStorageをクリア（全フィールドを0に）
 */
export function clearCharacterStateStorage(s: CharacterStateStorage): void {
  s.hp.fill(0);
  s.maxHp.fill(0);
  s.dejavuBonds.fill(0);
  s.dejavuBondsTotal.fill(0);
  s.locationIds.fill(0);
  s.restStates.fill(0);
}

// ─── HP Accessors ─────────────────────────────────────

/** 現在HPを取得 */
export function getHp(s: CharacterStateStorage, id: EntityId): number {
  return s.hp[id]!;
}

/** 現在HPを設定 */
export function setHp(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.hp[id] = value;
}

/** 最大HPを取得 */
export function getMaxHp(s: CharacterStateStorage, id: EntityId): number {
  return s.maxHp[id]!;
}

/** 最大HPを設定 */
export function setMaxHp(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.maxHp[id] = value;
}

// ─── DejavuBonds Accessors ────────────────────────────

/** 現在dejavuBondsを取得 */
export function getDejavuBonds(s: CharacterStateStorage, id: EntityId): number {
  return s.dejavuBonds[id]!;
}

/** 現在dejavuBondsを設定（0-100にクランプ） */
export function setDejavuBonds(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.dejavuBonds[id] = Math.max(0, Math.min(100, value));
}

/** 累計dejavuBondsTotalを取得 */
export function getDejavuBondsTotal(s: CharacterStateStorage, id: EntityId): number {
  return s.dejavuBondsTotal[id]!;
}

/** 累計dejavuBondsTotalを設定 */
export function setDejavuBondsTotal(s: CharacterStateStorage, id: EntityId, value: number): void {
  s.dejavuBondsTotal[id] = value;
}

/**
 * 累計dejavuBondsTotalに加算
 * dejavuBondsTotalは減少しない（累計カウンター）
 */
export function addDejavuBondsTotal(s: CharacterStateStorage, id: EntityId, amount: number): void {
  s.dejavuBondsTotal[id] = (s.dejavuBondsTotal[id]! + Math.max(0, amount)) >>> 0;
}

// ─── Location Accessors ──────────────────────────────

/** 現在地EntityIdを取得 */
export function getLocationId(s: CharacterStateStorage, id: EntityId): number {
  return s.locationIds[id]!;
}

/** 現在地EntityIdを設定 */
export function setLocationId(s: CharacterStateStorage, id: EntityId, locationId: number): void {
  s.locationIds[id] = locationId;
}

// ─── Rest State Accessors ─────────────────────────────

/** 休息状態を取得 */
export function getRestState(s: CharacterStateStorage, id: EntityId): number {
  return s.restStates[id]!;
}

/** 休息状態を設定 */
export function setRestState(s: CharacterStateStorage, id: EntityId, state: number): void {
  s.restStates[id] = state;
}

// ─── Global Instance ──────────────────────────────────

/** グローバルCharacterStateStorageインスタンス */
export const globalCharacterStateStorage: CharacterStateStorage = createCharacterStateStorage();
```

**setDejavuBondsのクランプ**:
dejavuBondsは仕様上 0-100（固定max）。Uint8Arrayの型制約（0-255）だけでは不十分なので、
set時に `Math.max(0, Math.min(100, value))` でクランプする。
他のフィールドは用途に応じてクランプなし（HP, maxHp等は上位ロジックで管理）。

**addDejavuBondsTotalの `>>> 0`**:
Uint32Arrayの範囲（0〜4,294,967,295）内に収めるための符号なしシフト。
通常のゲームプレイで上限に達することはないが、型安全のための防御。

---

### 2. hp.ts

**責務**: HPステージ判定、HP回復計算、HPダメージ/ヒール

```typescript
import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import type { HpStageType, RestStateType } from '$lib/types/character';
import { HP_STAGE, HP_STAGE_INFO, REST_STATE } from '$lib/types/character';
import { getHp, getMaxHp, setHp } from './storage';

// ─── Constants ────────────────────────────────────────

/** HP基本回復率: 最大HPの2%/時間 */
export const HP_BASE_RECOVERY_RATE = 0.02;

/** 休息状態ごとのボーナス係数 */
export const REST_BONUS: Readonly<Record<number, number>> = {
  [REST_STATE.ACTIVE]: 0,
  [REST_STATE.LIGHT_REST]: 0.15,
  [REST_STATE.SLEEP]: 0.30,
  [REST_STATE.FULL_REST]: 0.50,
};

// ─── HP Stage ─────────────────────────────────────────

/**
 * 現在HPと最大HPからHPステージを判定
 *
 * ステージ判定基準 (Master Index v5.6):
 *   HEALTHY:      100%
 *   LIGHT_INJURY: 75-99%
 *   INJURED:      50-74%
 *   SERIOUS:      25-49%
 *   CRITICAL:     1-24%
 *   DEAD:         0%
 *
 * @returns HpStageType
 */
export function getHpStage(currentHp: number, maxHp: number): HpStageType {
  if (maxHp <= 0 || currentHp <= 0) return HP_STAGE.DEAD;
  const pct = (currentHp / maxHp) * 100;
  if (pct >= 100) return HP_STAGE.HEALTHY;
  if (pct >= 75) return HP_STAGE.LIGHT_INJURY;
  if (pct >= 50) return HP_STAGE.INJURED;
  if (pct >= 25) return HP_STAGE.SERIOUS;
  return HP_STAGE.CRITICAL;
}

/**
 * エンティティのHPステージを取得（storageから読み取り）
 */
export function getEntityHpStage(s: CharacterStateStorage, id: EntityId): HpStageType {
  return getHpStage(getHp(s, id), getMaxHp(s, id));
}

/**
 * エンティティが死亡しているかチェック
 */
export function isDead(s: CharacterStateStorage, id: EntityId): boolean {
  return getHp(s, id) <= 0;
}

// ─── HP Recovery ──────────────────────────────────────

/**
 * HP回復コンテキスト
 * 外部システム（医療スキル、アイテム、環境）からの入力を受け取る
 */
export interface HpRecoveryContext {
  /** 現在HP */
  currentHp: number;
  /** 最大HP */
  maxHp: number;
  /** 医療スキル+アイテムによる軽減ボーナス（0.0〜1.0） */
  mitigationBonus: number;
  /** 休息状態 (REST_STATE値) */
  restState: number;
  /** 環境ペナルティ（0.0〜0.5） */
  environmentPenalty: number;
  /** 前回回復からの経過時間（時間） */
  elapsedHours: number;
}

/**
 * HP回復量を計算（純粋関数）
 *
 * Master Index回復式:
 *   finalRate = baseRate × mitigatedMultiplier × restBonus × envFactor
 *   mitigatedMultiplier = baseMultiplier + (1.0 - baseMultiplier) × mitigationBonus
 *
 * @returns 回復量（整数、0以上）。HEALTHY/DEADの場合は0。
 */
export function calculateHpRecovery(ctx: HpRecoveryContext): number {
  if (ctx.maxHp <= 0 || ctx.currentHp <= 0 || ctx.currentHp >= ctx.maxHp) {
    return 0;
  }

  const stage = getHpStage(ctx.currentHp, ctx.maxHp);
  const stageInfo = HP_STAGE_INFO[stage];
  if (!stageInfo || stageInfo.recoveryCoeff <= 0) {
    return 0;
  }

  const baseMultiplier = stageInfo.recoveryCoeff;

  // Mitigation: 医療スキル+アイテムが重傷時の回復低下を軽減
  const clampedMitigation = Math.max(0, Math.min(1.0, ctx.mitigationBonus));
  const mitigatedMultiplier = baseMultiplier + (1.0 - baseMultiplier) * clampedMitigation;

  // Rest bonus
  const restBonus = 1.0 + (REST_BONUS[ctx.restState] ?? 0);

  // Environment factor
  const clampedPenalty = Math.max(0, Math.min(0.5, ctx.environmentPenalty));
  const envFactor = 1.0 - clampedPenalty;

  const finalRate = HP_BASE_RECOVERY_RATE * mitigatedMultiplier * restBonus * envFactor;
  const recovery = Math.floor(ctx.maxHp * finalRate * ctx.elapsedHours);

  return Math.min(recovery, ctx.maxHp - ctx.currentHp);
}

// ─── HP Mutation ──────────────────────────────────────

/**
 * HPダメージ結果
 */
export interface HpDamageResult {
  /** ダメージ適用後のHP */
  newHp: number;
  /** 実際に与えたダメージ */
  actualDamage: number;
  /** 死亡したか */
  isDead: boolean;
}

/**
 * HPにダメージを与える
 * 0未満にはならない。
 *
 * @param amount - ダメージ量（正の整数）
 * @returns HpDamageResult
 */
export function damageHp(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): HpDamageResult {
  if (amount <= 0) {
    const current = getHp(s, id);
    return { newHp: current, actualDamage: 0, isDead: current <= 0 };
  }

  const current = getHp(s, id);
  const actual = Math.min(amount, current);
  const newHp = current - actual;
  setHp(s, id, newHp);

  return { newHp, actualDamage: actual, isDead: newHp <= 0 };
}

/**
 * HPを回復する
 * maxHpを超えない。
 *
 * @param amount - 回復量（正の整数）
 * @returns 回復後のHP
 */
export function healHp(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return getHp(s, id);

  const current = getHp(s, id);
  const max = getMaxHp(s, id);
  const newHp = Math.min(current + amount, max);
  setHp(s, id, newHp);

  return newHp;
}

/**
 * HP回復をコンテキストから計算して適用
 * calculateHpRecovery + healHp の一括処理。
 *
 * @returns 実際の回復量
 */
export function applyHpRecovery(
  s: CharacterStateStorage,
  id: EntityId,
  context: Omit<HpRecoveryContext, 'currentHp' | 'maxHp'>
): number {
  const currentHp = getHp(s, id);
  const maxHp = getMaxHp(s, id);
  const recovery = calculateHpRecovery({
    currentHp,
    maxHp,
    ...context,
  });

  if (recovery > 0) {
    healHp(s, id, recovery);
  }

  return recovery;
}

/**
 * 最大HPを計算
 * Master Index: STR + floor(CON × coefficient)
 * Bone/Blood Mark: coefficient = 2.0, Others: 1.5
 *
 * @param str - STR値
 * @param con - CON値
 * @param isBoneOrBloodMark - Bone/Blood WorldMarkか
 */
export function calculateMaxHp(str: number, con: number, isBoneOrBloodMark: boolean): number {
  const coefficient = isBoneOrBloodMark ? 2.0 : 1.5;
  return str + Math.floor(con * coefficient);
}

/**
 * キャラクターの最大HPを計算してstorageに設定
 * 現在HPが新しいmaxHpを超えている場合はmaxHpにクランプ。
 */
export function initializeHp(
  s: CharacterStateStorage,
  id: EntityId,
  str: number,
  con: number,
  isBoneOrBloodMark: boolean
): void {
  const max = calculateMaxHp(str, con, isBoneOrBloodMark);
  s.maxHp[id] = max;
  s.hp[id] = max; // 初期化時はフルHP
}
```

**HP回復式の解説**:

```
例: 重傷（baseMultiplier=0.5）、医療スキルLv50（mitigationBonus=0.5）、
    睡眠中（restBonus=1.3）、安全地帯（envFactor=1.0）、1時間経過

mitigatedMultiplier = 0.5 + (1.0 - 0.5) × 0.5 = 0.5 + 0.25 = 0.75
finalRate = 0.02 × 0.75 × 1.3 × 1.0 = 0.0195
maxHp=100: recovery = floor(100 × 0.0195 × 1) = floor(1.95) = 1

ポイント: mitigationBonusは「重傷ペナルティの軽減」であり、
直接的な回復速度倍率ではない。重傷で50%低下している回復速度を、
mitigation=0.5で25%分軽減 → 75%まで回復。
```

---

### 3. bonds.ts

**責務**: dejavuBondsのステージ判定、回復、混沌パッシブダメージ、混沌攻撃ダメージ（HPへの貫通含む）

```typescript
import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import type { DejavuStageType } from '$lib/types/character';
import { DEJAVU_STAGE } from '$lib/types/character';
import { getDejavuBonds, setDejavuBonds, getHp, setHp } from './storage';

// ─── Constants ────────────────────────────────────────

/** dejavuBonds最大値（固定） */
export const DEJAVU_BONDS_MAX = 100;

/** dejavuBonds基本回復速度: 10ポイント/時間（混沌エリア外のみ） */
export const BONDS_RECOVERY_RATE = 10;

/** 混沌パッシブダメージ基本速度: 5ポイント/時間 */
export const CHAOS_PASSIVE_DAMAGE_BASE = 5;

// ─── DejavuBonds Stage ────────────────────────────────

/**
 * dejavuBonds値からステージを判定
 *
 * Master Index表示段階:
 *   FULL(100), ENRICHED(90-99), GOOD(80-89), STABLE(70-79),
 *   MAINTAINED(60-69), HALVED(50-59), UNSTABLE(40-49),
 *   THIN(30-39), DANGER(20-29), VANISHING(1-19), ISOLATED(0)
 *
 * @param bonds - 現在のdejavuBonds値（0-100）
 * @returns DejavuStageType
 */
export function getDejavuStage(bonds: number): DejavuStageType {
  if (bonds >= 100) return DEJAVU_STAGE.FULL;
  if (bonds >= 90)  return DEJAVU_STAGE.ENRICHED;
  if (bonds >= 80)  return DEJAVU_STAGE.GOOD;
  if (bonds >= 70)  return DEJAVU_STAGE.STABLE;
  if (bonds >= 60)  return DEJAVU_STAGE.MAINTAINED;
  if (bonds >= 50)  return DEJAVU_STAGE.HALVED;
  if (bonds >= 40)  return DEJAVU_STAGE.UNSTABLE;
  if (bonds >= 30)  return DEJAVU_STAGE.THIN;
  if (bonds >= 20)  return DEJAVU_STAGE.DANGER;
  if (bonds >= 1)   return DEJAVU_STAGE.VANISHING;
  return DEJAVU_STAGE.ISOLATED;
}

/**
 * エンティティのdejavuBondsステージを取得（storageから読み取り）
 */
export function getEntityDejavuStage(s: CharacterStateStorage, id: EntityId): DejavuStageType {
  return getDejavuStage(getDejavuBonds(s, id));
}

/**
 * dejavuBondsステージがUI上で表示されるかどうか
 * FULL（100）のとき非表示、それ以外は表示。
 */
export function isDejavuBondsVisible(bonds: number): boolean {
  return bonds < 100;
}

// ─── DejavuBonds Recovery ─────────────────────────────

/**
 * dejavuBonds回復量を計算（純粋関数）
 *
 * Master Index: 10ポイント/時間（混沌エリア外のみ）
 * 混沌エリアでは回復しない。
 *
 * @param currentBonds - 現在のdejavuBonds
 * @param inChaosArea - 混沌エリア内か
 * @param elapsedHours - 経過時間
 * @returns 回復量（整数、0以上）
 */
export function calculateBondsRecovery(
  currentBonds: number,
  inChaosArea: boolean,
  elapsedHours: number
): number {
  if (inChaosArea || currentBonds >= DEJAVU_BONDS_MAX || elapsedHours <= 0) {
    return 0;
  }

  const recovery = Math.floor(BONDS_RECOVERY_RATE * elapsedHours);
  return Math.min(recovery, DEJAVU_BONDS_MAX - currentBonds);
}

/**
 * dejavuBonds回復を適用
 *
 * @returns 実際の回復量
 */
export function applyBondsRecovery(
  s: CharacterStateStorage,
  id: EntityId,
  inChaosArea: boolean,
  elapsedHours: number
): number {
  const current = getDejavuBonds(s, id);
  const recovery = calculateBondsRecovery(current, inChaosArea, elapsedHours);

  if (recovery > 0) {
    setDejavuBonds(s, id, current + recovery);
  }

  return recovery;
}

// ─── Chaos Passive Damage ─────────────────────────────

/**
 * 混沌パッシブダメージ量を計算（純粋関数）
 *
 * Master Index: 5ポイント/時間 × (1.0 + chaos_level)
 *
 * @param chaosLevel - 混沌レベル（0.0以上）
 * @param elapsedHours - 経過時間
 * @returns ダメージ量（整数、0以上）
 */
export function calculateChaosPassiveDamage(
  chaosLevel: number,
  elapsedHours: number
): number {
  if (elapsedHours <= 0 || chaosLevel < 0) return 0;
  return Math.floor(CHAOS_PASSIVE_DAMAGE_BASE * (1.0 + chaosLevel) * elapsedHours);
}

// ─── Chaos Attack Damage ──────────────────────────────

/**
 * 混沌攻撃ダメージ結果
 */
export interface ChaosAttackResult {
  /** bondsが吸収したダメージ量 */
  bondsAbsorbed: number;
  /** HPに貫通したダメージ量（bondsが0になった場合の余剰） */
  hpDamage: number;
  /** 適用後のdejavuBonds値 */
  newBonds: number;
  /** 適用後のHP値 */
  newHp: number;
  /** HPが0になったか */
  isDead: boolean;
}

/**
 * 混沌攻撃ダメージを処理
 *
 * Master Index:
 *   Chaos Damage → dejavuBonds absorbs first → Overflow penetrates to HP
 *
 * 1. まずdejavuBondsがダメージを吸収
 * 2. bondsが0になった場合、余剰ダメージがHPに貫通
 *
 * @param amount - 混沌攻撃のダメージ量（正の整数）
 * @returns ChaosAttackResult
 */
export function applyChaosAttackDamage(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): ChaosAttackResult {
  if (amount <= 0) {
    const bonds = getDejavuBonds(s, id);
    const hp = getHp(s, id);
    return { bondsAbsorbed: 0, hpDamage: 0, newBonds: bonds, newHp: hp, isDead: hp <= 0 };
  }

  const currentBonds = getDejavuBonds(s, id);
  const currentHp = getHp(s, id);

  // Step 1: Bonds absorb
  const bondsAbsorbed = Math.min(amount, currentBonds);
  const newBonds = currentBonds - bondsAbsorbed;
  setDejavuBonds(s, id, newBonds);

  // Step 2: Overflow penetrates to HP
  const overflow = amount - bondsAbsorbed;
  let hpDamage = 0;
  let newHp = currentHp;

  if (overflow > 0) {
    hpDamage = Math.min(overflow, currentHp);
    newHp = currentHp - hpDamage;
    s.hp[id] = newHp;
  }

  return {
    bondsAbsorbed,
    hpDamage,
    newBonds,
    newHp,
    isDead: newHp <= 0,
  };
}

/**
 * 混沌パッシブダメージをdejavuBondsに適用
 *
 * パッシブダメージはbondsのみに影響（HPには貫通しない）。
 * bonds=0のまま混沌エリアにいるとHPへの防護がない状態になるが、
 * パッシブダメージ自体はbondsのみ。
 *
 * 注意: 混沌攻撃（applyChaosAttackDamage）とは別処理。
 *
 * @returns 実際のダメージ量
 */
export function applyChaosPassiveDamage(
  s: CharacterStateStorage,
  id: EntityId,
  chaosLevel: number,
  elapsedHours: number
): number {
  const damage = calculateChaosPassiveDamage(chaosLevel, elapsedHours);
  if (damage <= 0) return 0;

  const current = getDejavuBonds(s, id);
  const actual = Math.min(damage, current);
  setDejavuBonds(s, id, current - actual);

  return actual;
}

/**
 * dejavuBondsにダメージを与える（通常のbonds減少用）
 *
 * @returns 実際のダメージ量
 */
export function damageBonds(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return 0;

  const current = getDejavuBonds(s, id);
  const actual = Math.min(amount, current);
  setDejavuBonds(s, id, current - actual);

  return actual;
}

/**
 * dejavuBondsを回復する（直接指定）
 *
 * @returns 回復後のbonds値
 */
export function healBonds(
  s: CharacterStateStorage,
  id: EntityId,
  amount: number
): number {
  if (amount <= 0) return getDejavuBonds(s, id);

  const current = getDejavuBonds(s, id);
  const newBonds = Math.min(current + amount, DEJAVU_BONDS_MAX);
  setDejavuBonds(s, id, newBonds);

  return newBonds;
}
```

**混沌パッシブダメージ vs 混沌攻撃ダメージの違い**:

| 種類 | 対象 | HP貫通 | タイミング |
|------|------|--------|-----------|
| パッシブダメージ | bondsのみ | なし | 時間経過（混沌エリア滞在中） |
| 攻撃ダメージ | bonds → HP | bonds=0時にHPへ貫通 | 混沌攻撃時（戦闘イベント） |

---

### 4. anchor.ts

**責務**: 累計dejavuBondsTotalからAnchor（錨）レベルを計算

```typescript
import type { AnchorLevelType } from '$lib/types/character';
import { ANCHOR_LEVEL, ANCHOR_THRESHOLDS } from '$lib/types/character';
import type { CharacterStateStorage } from '$lib/types/character';
import type { EntityId } from '$lib/types/brand';
import { getDejavuBondsTotal } from './storage';

/**
 * 累計dejavuBondsTotalからAnchorレベルを計算
 *
 * Master Index Anchor System v1:
 *   Level 0: 0-499     → 継承なし（NPC永久死）
 *   Level 1: 500-1,499  → 職業のみ
 *   Level 2: 1,500-3,499 → + 信仰神
 *   Level 3: 3,500-6,999 → + 主要スキル3つ
 *   Level 4: 7,000+      → + スキルレベル50%
 *
 * @param totalBonds - 累計dejavuBondsTotal
 * @returns AnchorLevelType (0-4)
 */
export function getAnchorLevel(totalBonds: number): AnchorLevelType {
  // ANCHOR_THRESHOLDS = [0, 500, 1500, 3500, 7000]
  // 最も高い閾値から逆順でチェック
  for (let i = ANCHOR_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalBonds >= ANCHOR_THRESHOLDS[i]!) {
      return i as AnchorLevelType;
    }
  }
  return ANCHOR_LEVEL.LEVEL_0;
}

/**
 * エンティティのAnchorレベルを取得（storageから読み取り）
 */
export function getEntityAnchorLevel(
  s: CharacterStateStorage,
  id: EntityId
): AnchorLevelType {
  return getAnchorLevel(getDejavuBondsTotal(s, id));
}

/**
 * 次のAnchorレベルまでに必要な累計bonds残量を計算
 *
 * @returns 必要残量。Level 4の場合は0。
 */
export function bondsToNextAnchorLevel(totalBonds: number): number {
  const currentLevel = getAnchorLevel(totalBonds);
  if (currentLevel >= ANCHOR_LEVEL.LEVEL_4) return 0;

  const nextThreshold = ANCHOR_THRESHOLDS[currentLevel + 1];
  if (nextThreshold === undefined) return 0;

  return nextThreshold - totalBonds;
}

/**
 * NPC帰還時間を計算（日数）
 *
 * Master Index: Base 7日、Anchorレベルで短縮
 *   Level 4: ~3日
 * 線形補間: 7 - (level × 1)
 *
 * @returns 帰還日数
 */
export function calculateReturnDays(anchorLevel: AnchorLevelType): number {
  // Level 0: 永久死（帰還不可）→ -1 で表現
  if (anchorLevel === ANCHOR_LEVEL.LEVEL_0) return -1;

  // Level 1: 7日, Level 2: 6日, Level 3: 5日, Level 4: ~3日
  // Master Indexの「Level 4: ~3 days」に合わせる
  const baseDays = 7;
  const reductionPerLevel = 1;
  return Math.max(3, baseDays - anchorLevel * reductionPerLevel);
}

/**
 * Anchorレベルに応じた継承要素の一覧を返す
 *
 * Master Index:
 *   Level 0: なし
 *   Level 1: 職業のみ
 *   Level 2: + 信仰神
 *   Level 3: + 主要スキル3つ
 *   Level 4: + スキルレベル50%
 */
export function getInheritedElements(anchorLevel: AnchorLevelType): readonly string[] {
  switch (anchorLevel) {
    case ANCHOR_LEVEL.LEVEL_0: return [];
    case ANCHOR_LEVEL.LEVEL_1: return ['occupation'];
    case ANCHOR_LEVEL.LEVEL_2: return ['occupation', 'faith'];
    case ANCHOR_LEVEL.LEVEL_3: return ['occupation', 'faith', 'topSkills'];
    case ANCHOR_LEVEL.LEVEL_4: return ['occupation', 'faith', 'topSkills', 'skillLevels'];
    default: return [];
  }
}
```

**calculateReturnDaysの補間設計**:

Master Indexは「Base 7日、Level 4で~3日」としか記述していない。
Level 1〜3は明示されていないため、線形補間を採用:
- Level 1: 6日
- Level 2: 5日
- Level 3: 4日
- Level 4: 3日

Phase 2でバランス調整の可能性あり。

---

### 5. index.ts

```typescript
// Storage & Accessors
export {
  createCharacterStateStorage,
  clearCharacterStateStorage,
  getHp,
  setHp,
  getMaxHp,
  setMaxHp,
  getDejavuBonds,
  setDejavuBonds,
  getDejavuBondsTotal,
  setDejavuBondsTotal,
  addDejavuBondsTotal,
  getLocationId,
  setLocationId,
  getRestState,
  setRestState,
  globalCharacterStateStorage,
} from './storage.js';

// HP System
export {
  HP_BASE_RECOVERY_RATE,
  REST_BONUS,
  getHpStage,
  getEntityHpStage,
  isDead,
  calculateHpRecovery,
  damageHp,
  healHp,
  applyHpRecovery,
  calculateMaxHp,
  initializeHp,
} from './hp.js';
export type { HpRecoveryContext, HpDamageResult } from './hp.js';

// DejavuBonds System
export {
  DEJAVU_BONDS_MAX,
  BONDS_RECOVERY_RATE,
  CHAOS_PASSIVE_DAMAGE_BASE,
  getDejavuStage,
  getEntityDejavuStage,
  isDejavuBondsVisible,
  calculateBondsRecovery,
  applyBondsRecovery,
  calculateChaosPassiveDamage,
  applyChaosAttackDamage,
  applyChaosPassiveDamage,
  damageBonds,
  healBonds,
} from './bonds.js';
export type { ChaosAttackResult } from './bonds.js';

// Anchor System
export {
  getAnchorLevel,
  getEntityAnchorLevel,
  bondsToNextAnchorLevel,
  calculateReturnDays,
  getInheritedElements,
} from './anchor.js';
```

---

## テスト仕様

### テストファイル構成

```
src/lib/core/character/
├── storage.test.ts         # 10テスト
├── hp.test.ts              # 18テスト
├── bonds.test.ts           # 16テスト
└── anchor.test.ts          # 8テスト
                              合計: 52テスト（目安）
```

---

### storage.test.ts（10テスト）

```typescript
import { describe, it, expect } from 'vitest';
import {
  createCharacterStateStorage,
  clearCharacterStateStorage,
  getHp, setHp,
  getMaxHp, setMaxHp,
  getDejavuBonds, setDejavuBonds,
  getDejavuBondsTotal, setDejavuBondsTotal, addDejavuBondsTotal,
  getLocationId, setLocationId,
  getRestState, setRestState,
} from './storage';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);
const id1 = entityId(1);

describe('createCharacterStateStorage', () => {
  it('should create storage with default capacity', () => {
    const s = createCharacterStateStorage();
    expect(s.hp.length).toBe(2000); // MAX_ENTITIES
    expect(s.capacity).toBe(2000);
  });

  it('should create storage with custom capacity', () => {
    const s = createCharacterStateStorage(128);
    expect(s.hp.length).toBe(128);
    expect(s.capacity).toBe(128);
  });

  it('should initialize all arrays to zero', () => {
    const s = createCharacterStateStorage(8);
    expect(s.hp[0]).toBe(0);
    expect(s.maxHp[0]).toBe(0);
    expect(s.dejavuBonds[0]).toBe(0);
    expect(s.dejavuBondsTotal[0]).toBe(0);
    expect(s.locationIds[0]).toBe(0);
    expect(s.restStates[0]).toBe(0);
  });
});

describe('clearCharacterStateStorage', () => {
  it('should reset all fields to zero', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    setDejavuBonds(s, id0, 80);
    clearCharacterStateStorage(s);
    expect(getHp(s, id0)).toBe(0);
    expect(getMaxHp(s, id0)).toBe(0);
    expect(getDejavuBonds(s, id0)).toBe(0);
  });
});

describe('HP accessors', () => {
  it('should get and set HP correctly', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 150);
    expect(getHp(s, id0)).toBe(150);
    expect(getHp(s, id1)).toBe(0); // 他エンティティに影響なし
  });

  it('should get and set maxHp correctly', () => {
    const s = createCharacterStateStorage(8);
    setMaxHp(s, id0, 200);
    expect(getMaxHp(s, id0)).toBe(200);
  });
});

describe('DejavuBonds accessors', () => {
  it('should clamp dejavuBonds to 0-100', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 150); // Over max
    expect(getDejavuBonds(s, id0)).toBe(100);

    setDejavuBonds(s, id0, -10); // Under min
    expect(getDejavuBonds(s, id0)).toBe(0);
  });

  it('should accumulate dejavuBondsTotal', () => {
    const s = createCharacterStateStorage(8);
    addDejavuBondsTotal(s, id0, 500);
    addDejavuBondsTotal(s, id0, 1000);
    expect(getDejavuBondsTotal(s, id0)).toBe(1500);
  });

  it('should not decrease dejavuBondsTotal with negative amount', () => {
    const s = createCharacterStateStorage(8);
    addDejavuBondsTotal(s, id0, 500);
    addDejavuBondsTotal(s, id0, -100);
    expect(getDejavuBondsTotal(s, id0)).toBe(500); // 減少しない
  });
});

describe('Location and RestState accessors', () => {
  it('should get and set locationId', () => {
    const s = createCharacterStateStorage(8);
    setLocationId(s, id0, 42);
    expect(getLocationId(s, id0)).toBe(42);
  });

  it('should get and set restState', () => {
    const s = createCharacterStateStorage(8);
    setRestState(s, id0, 3); // FULL_REST
    expect(getRestState(s, id0)).toBe(3);
  });
});
```

---

### hp.test.ts（18テスト）

```typescript
import { describe, it, expect } from 'vitest';
import {
  getHpStage,
  isDead,
  calculateHpRecovery,
  damageHp,
  healHp,
  applyHpRecovery,
  calculateMaxHp,
  initializeHp,
  REST_BONUS,
} from './hp';
import {
  createCharacterStateStorage,
  setHp, setMaxHp, getHp, getMaxHp,
} from './storage';
import { HP_STAGE, REST_STATE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);

describe('getHpStage', () => {
  it('should return DEAD for hp=0', () => {
    expect(getHpStage(0, 100)).toBe(HP_STAGE.DEAD);
  });

  it('should return DEAD for maxHp=0', () => {
    expect(getHpStage(50, 0)).toBe(HP_STAGE.DEAD);
  });

  it('should return HEALTHY for full HP', () => {
    expect(getHpStage(100, 100)).toBe(HP_STAGE.HEALTHY);
  });

  it('should return LIGHT_INJURY for 75-99%', () => {
    expect(getHpStage(75, 100)).toBe(HP_STAGE.LIGHT_INJURY);
    expect(getHpStage(99, 100)).toBe(HP_STAGE.LIGHT_INJURY);
  });

  it('should return INJURED for 50-74%', () => {
    expect(getHpStage(50, 100)).toBe(HP_STAGE.INJURED);
    expect(getHpStage(74, 100)).toBe(HP_STAGE.INJURED);
  });

  it('should return SERIOUS for 25-49%', () => {
    expect(getHpStage(25, 100)).toBe(HP_STAGE.SERIOUS);
    expect(getHpStage(49, 100)).toBe(HP_STAGE.SERIOUS);
  });

  it('should return CRITICAL for 1-24%', () => {
    expect(getHpStage(1, 100)).toBe(HP_STAGE.CRITICAL);
    expect(getHpStage(24, 100)).toBe(HP_STAGE.CRITICAL);
  });
});

describe('calculateHpRecovery', () => {
  it('should return 0 for full HP', () => {
    expect(calculateHpRecovery({
      currentHp: 100, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0, elapsedHours: 1,
    })).toBe(0);
  });

  it('should return 0 for dead character', () => {
    expect(calculateHpRecovery({
      currentHp: 0, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0, elapsedHours: 1,
    })).toBe(0);
  });

  it('should calculate base recovery (2%/hour)', () => {
    // Light injury, no bonuses, 1 hour
    const recovery = calculateHpRecovery({
      currentHp: 80, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0, elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.0 × 1.0 × 100 × 1 = 2
    expect(recovery).toBe(2);
  });

  it('should apply rest bonus', () => {
    const recovery = calculateHpRecovery({
      currentHp: 80, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.FULL_REST,
      environmentPenalty: 0, elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.5 × 1.0 × 100 × 1 = 3
    expect(recovery).toBe(3);
  });

  it('should apply environment penalty', () => {
    const recovery = calculateHpRecovery({
      currentHp: 80, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0.5, elapsedHours: 1,
    });
    // 0.02 × 1.0 × 1.0 × 0.5 × 100 × 1 = 1
    expect(recovery).toBe(1);
  });

  it('should reduce recovery for serious injury', () => {
    const recovery = calculateHpRecovery({
      currentHp: 30, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0, elapsedHours: 1,
    });
    // Serious: baseMultiplier=0.5
    // 0.02 × 0.5 × 1.0 × 1.0 × 100 × 1 = 1
    expect(recovery).toBe(1);
  });

  it('should apply mitigation to reduce injury penalty', () => {
    const recovery = calculateHpRecovery({
      currentHp: 30, maxHp: 100,
      mitigationBonus: 1.0, restState: REST_STATE.ACTIVE,
      environmentPenalty: 0, elapsedHours: 1,
    });
    // Serious: baseMultiplier=0.5, mitigation=1.0
    // mitigated = 0.5 + (1.0-0.5)*1.0 = 1.0
    // 0.02 × 1.0 × 1.0 × 1.0 × 100 × 1 = 2
    expect(recovery).toBe(2);
  });

  it('should not exceed remaining HP to max', () => {
    const recovery = calculateHpRecovery({
      currentHp: 99, maxHp: 100,
      mitigationBonus: 0, restState: REST_STATE.FULL_REST,
      environmentPenalty: 0, elapsedHours: 10,
    });
    expect(recovery).toBe(1); // 最大まで1しか回復しない
  });
});

describe('damageHp', () => {
  it('should reduce HP and return result', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    const result = damageHp(s, id0, 20);
    expect(result.newHp).toBe(30);
    expect(result.actualDamage).toBe(20);
    expect(result.isDead).toBe(false);
  });

  it('should detect death', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 10);
    const result = damageHp(s, id0, 15);
    expect(result.newHp).toBe(0);
    expect(result.actualDamage).toBe(10);
    expect(result.isDead).toBe(true);
  });

  it('should handle zero damage', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    const result = damageHp(s, id0, 0);
    expect(result.actualDamage).toBe(0);
    expect(result.newHp).toBe(50);
  });
});

describe('healHp', () => {
  it('should increase HP up to maxHp', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 50);
    setMaxHp(s, id0, 100);
    const newHp = healHp(s, id0, 30);
    expect(newHp).toBe(80);
    expect(getHp(s, id0)).toBe(80);
  });

  it('should not exceed maxHp', () => {
    const s = createCharacterStateStorage(8);
    setHp(s, id0, 90);
    setMaxHp(s, id0, 100);
    const newHp = healHp(s, id0, 50);
    expect(newHp).toBe(100);
  });
});

describe('calculateMaxHp', () => {
  it('should calculate with Bone/Blood coefficient (2.0)', () => {
    // STR=10, CON=20, Bone mark
    expect(calculateMaxHp(10, 20, true)).toBe(50); // 10 + floor(20*2.0) = 50
  });

  it('should calculate with standard coefficient (1.5)', () => {
    // STR=10, CON=20, Other mark
    expect(calculateMaxHp(10, 20, false)).toBe(40); // 10 + floor(20*1.5) = 40
  });
});

describe('initializeHp', () => {
  it('should set both maxHp and hp to calculated value', () => {
    const s = createCharacterStateStorage(8);
    initializeHp(s, id0, 10, 20, false);
    expect(getMaxHp(s, id0)).toBe(40);
    expect(getHp(s, id0)).toBe(40);
  });
});
```

---

### bonds.test.ts（16テスト）

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDejavuStage,
  isDejavuBondsVisible,
  calculateBondsRecovery,
  applyBondsRecovery,
  calculateChaosPassiveDamage,
  applyChaosAttackDamage,
  applyChaosPassiveDamage,
  damageBonds,
  healBonds,
  DEJAVU_BONDS_MAX,
} from './bonds';
import { createCharacterStateStorage, setDejavuBonds, getDejavuBonds, setHp, getHp, setMaxHp } from './storage';
import { DEJAVU_STAGE } from '$lib/types/character';
import { entityId } from '$lib/types/brand';

const id0 = entityId(0);

describe('getDejavuStage', () => {
  it('should return FULL for 100', () => {
    expect(getDejavuStage(100)).toBe(DEJAVU_STAGE.FULL);
  });

  it('should return ENRICHED for 90-99', () => {
    expect(getDejavuStage(90)).toBe(DEJAVU_STAGE.ENRICHED);
    expect(getDejavuStage(99)).toBe(DEJAVU_STAGE.ENRICHED);
  });

  it('should return VANISHING for 1-19', () => {
    expect(getDejavuStage(1)).toBe(DEJAVU_STAGE.VANISHING);
    expect(getDejavuStage(19)).toBe(DEJAVU_STAGE.VANISHING);
  });

  it('should return ISOLATED for 0', () => {
    expect(getDejavuStage(0)).toBe(DEJAVU_STAGE.ISOLATED);
  });
});

describe('isDejavuBondsVisible', () => {
  it('should be hidden at 100', () => {
    expect(isDejavuBondsVisible(100)).toBe(false);
  });

  it('should be visible below 100', () => {
    expect(isDejavuBondsVisible(99)).toBe(true);
    expect(isDejavuBondsVisible(0)).toBe(true);
  });
});

describe('calculateBondsRecovery', () => {
  it('should recover 10 points per hour outside chaos', () => {
    expect(calculateBondsRecovery(50, false, 1)).toBe(10);
  });

  it('should not recover in chaos area', () => {
    expect(calculateBondsRecovery(50, true, 1)).toBe(0);
  });

  it('should not exceed max bonds', () => {
    expect(calculateBondsRecovery(95, false, 1)).toBe(5); // only up to 100
  });

  it('should return 0 when already full', () => {
    expect(calculateBondsRecovery(100, false, 1)).toBe(0);
  });
});

describe('calculateChaosPassiveDamage', () => {
  it('should calculate base damage at chaos_level=0', () => {
    // 5 × (1.0 + 0.0) × 1 = 5
    expect(calculateChaosPassiveDamage(0, 1)).toBe(5);
  });

  it('should scale with chaos level', () => {
    // 5 × (1.0 + 1.0) × 1 = 10
    expect(calculateChaosPassiveDamage(1.0, 1)).toBe(10);
  });

  it('should scale with elapsed hours', () => {
    // 5 × (1.0 + 0.0) × 3 = 15
    expect(calculateChaosPassiveDamage(0, 3)).toBe(15);
  });
});

describe('applyChaosAttackDamage', () => {
  it('should absorb all damage with bonds', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 50);
    setHp(s, id0, 100);
    setMaxHp(s, id0, 100);

    const result = applyChaosAttackDamage(s, id0, 30);
    expect(result.bondsAbsorbed).toBe(30);
    expect(result.hpDamage).toBe(0);
    expect(result.newBonds).toBe(20);
    expect(result.newHp).toBe(100);
    expect(result.isDead).toBe(false);
  });

  it('should overflow to HP when bonds depleted', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 20);
    setHp(s, id0, 100);
    setMaxHp(s, id0, 100);

    const result = applyChaosAttackDamage(s, id0, 50);
    expect(result.bondsAbsorbed).toBe(20);
    expect(result.hpDamage).toBe(30);
    expect(result.newBonds).toBe(0);
    expect(result.newHp).toBe(70);
    expect(result.isDead).toBe(false);
  });

  it('should cause death when overflow exceeds HP', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 10);
    setHp(s, id0, 20);

    const result = applyChaosAttackDamage(s, id0, 50);
    expect(result.bondsAbsorbed).toBe(10);
    expect(result.hpDamage).toBe(20);
    expect(result.newBonds).toBe(0);
    expect(result.newHp).toBe(0);
    expect(result.isDead).toBe(true);
  });

  it('should handle zero bonds (all damage to HP)', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 0);
    setHp(s, id0, 50);

    const result = applyChaosAttackDamage(s, id0, 20);
    expect(result.bondsAbsorbed).toBe(0);
    expect(result.hpDamage).toBe(20);
    expect(result.newHp).toBe(30);
  });
});

describe('applyChaosPassiveDamage', () => {
  it('should only damage bonds (no HP penetration)', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 30);
    setHp(s, id0, 100);

    const actual = applyChaosPassiveDamage(s, id0, 0, 1);
    expect(actual).toBe(5);
    expect(getDejavuBonds(s, id0)).toBe(25);
    expect(getHp(s, id0)).toBe(100); // HP unchanged
  });

  it('should not go below 0 bonds', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 3);

    const actual = applyChaosPassiveDamage(s, id0, 0, 1);
    expect(actual).toBe(3);
    expect(getDejavuBonds(s, id0)).toBe(0);
  });
});

describe('damageBonds and healBonds', () => {
  it('should damage bonds directly', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 80);
    expect(damageBonds(s, id0, 30)).toBe(30);
    expect(getDejavuBonds(s, id0)).toBe(50);
  });

  it('should heal bonds up to max', () => {
    const s = createCharacterStateStorage(8);
    setDejavuBonds(s, id0, 80);
    const newBonds = healBonds(s, id0, 50);
    expect(newBonds).toBe(100); // clamped at max
  });
});
```

---

### anchor.test.ts（8テスト）

```typescript
import { describe, it, expect } from 'vitest';
import {
  getAnchorLevel,
  bondsToNextAnchorLevel,
  calculateReturnDays,
  getInheritedElements,
} from './anchor';
import { ANCHOR_LEVEL } from '$lib/types/character';

describe('getAnchorLevel', () => {
  it('should return LEVEL_0 for 0-499', () => {
    expect(getAnchorLevel(0)).toBe(ANCHOR_LEVEL.LEVEL_0);
    expect(getAnchorLevel(499)).toBe(ANCHOR_LEVEL.LEVEL_0);
  });

  it('should return LEVEL_1 for 500-1499', () => {
    expect(getAnchorLevel(500)).toBe(ANCHOR_LEVEL.LEVEL_1);
    expect(getAnchorLevel(1499)).toBe(ANCHOR_LEVEL.LEVEL_1);
  });

  it('should return LEVEL_2 for 1500-3499', () => {
    expect(getAnchorLevel(1500)).toBe(ANCHOR_LEVEL.LEVEL_2);
    expect(getAnchorLevel(3499)).toBe(ANCHOR_LEVEL.LEVEL_2);
  });

  it('should return LEVEL_3 for 3500-6999', () => {
    expect(getAnchorLevel(3500)).toBe(ANCHOR_LEVEL.LEVEL_3);
    expect(getAnchorLevel(6999)).toBe(ANCHOR_LEVEL.LEVEL_3);
  });

  it('should return LEVEL_4 for 7000+', () => {
    expect(getAnchorLevel(7000)).toBe(ANCHOR_LEVEL.LEVEL_4);
    expect(getAnchorLevel(99999)).toBe(ANCHOR_LEVEL.LEVEL_4);
  });
});

describe('bondsToNextAnchorLevel', () => {
  it('should return remaining bonds to next threshold', () => {
    expect(bondsToNextAnchorLevel(300)).toBe(200); // 500 - 300
    expect(bondsToNextAnchorLevel(1000)).toBe(500); // 1500 - 1000
  });

  it('should return 0 for max level', () => {
    expect(bondsToNextAnchorLevel(10000)).toBe(0);
  });
});

describe('calculateReturnDays', () => {
  it('should return -1 for Level 0 (permanent death)', () => {
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_0)).toBe(-1);
  });

  it('should return 3 for Level 4', () => {
    expect(calculateReturnDays(ANCHOR_LEVEL.LEVEL_4)).toBe(3);
  });

  it('should decrease with level', () => {
    const l1 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_1);
    const l2 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_2);
    const l3 = calculateReturnDays(ANCHOR_LEVEL.LEVEL_3);
    expect(l1).toBeGreaterThan(l2);
    expect(l2).toBeGreaterThan(l3);
  });
});

describe('getInheritedElements', () => {
  it('should return empty for Level 0', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_0)).toEqual([]);
  });

  it('should return occupation for Level 1', () => {
    expect(getInheritedElements(ANCHOR_LEVEL.LEVEL_1)).toEqual(['occupation']);
  });

  it('should include all elements for Level 4', () => {
    const elements = getInheritedElements(ANCHOR_LEVEL.LEVEL_4);
    expect(elements).toContain('occupation');
    expect(elements).toContain('faith');
    expect(elements).toContain('topSkills');
    expect(elements).toContain('skillLevels');
  });
});
```

---

## Claude Codeへの指示手順

### Step 1: 型定義の確認

```
以下のファイルを読んでください:
- src/lib/types/character.ts
- src/lib/types/brand.ts
- src/lib/types/constants.ts
```

### Step 2: 既存パターンの確認

```
以下の既存実装を読んで、コードスタイルとパターンを確認してください:
- src/lib/core/entity/storage.ts
- src/lib/core/tags/storage.ts
- src/lib/core/tags/accessors.ts
- docs/character-system-implementation-spec.md（この仕様書）
```

### Step 3: 実装（段階的に）

```
docs/character-system-implementation-spec.md に従って、
以下の順序でファイルを実装してください:
1. src/lib/core/character/storage.ts
2. src/lib/core/character/hp.ts
3. src/lib/core/character/bonds.ts
4. src/lib/core/character/anchor.ts
5. src/lib/core/character/index.ts
```

### Step 4: テスト

```
docs/character-system-implementation-spec.md のテスト仕様に従って、
以下のテストファイルを作成してください:
- src/lib/core/character/storage.test.ts
- src/lib/core/character/hp.test.ts
- src/lib/core/character/bonds.test.ts
- src/lib/core/character/anchor.test.ts
```

### Step 5: 検証

```
bun run test を実行して全テストがパスすることを確認してください。
bun run typecheck も実行してください。
失敗があれば原因を特定して修正してください。
```

---

## 注意事項

### CharacterStateStorageのcapacity

既存3システムと同様、`MAX_ENTITIES`をデフォルトcapacityとして使用。
キャラクター以外のエンティティのスロットは0のまま未使用。
EntityIdで直接インデックスできるため、追加のマッピング不要。

### setDejavuBondsのクランプ

dejavuBondsの仕様上max=100（固定）なので、setDejavuBonds内で0-100にクランプする。
これは他のset関数にはない特別な処理。HP等は外部ロジックで管理するためクランプしない。

### HP_STAGE_INFOの型参照

`HP_STAGE_INFO`はcharacter.tsで定義済み。hp.ts内では`HP_STAGE_INFO[stage].recoveryCoeff`で
回復係数を取得する。もしHP_STAGE_INFOにDEADステージのrecoveryCoeffがない場合（0の場合）、
calculateHpRecoveryの先頭で`recoveryCoeff <= 0`チェックにより早期returnされる。

### Soul / Vessel / CurrentLife について

character.ts型定義にSoul/Vessel/CurrentLifeインターフェースがあるが、
MVPのCharacter System実装ではCharacterStateStorageのみ対象。
Soul/Vessel/CurrentLifeの実体管理はPhase 2以降で、
NPCの生成・死亡・転生ライフサイクルと合わせて実装する。

### REST_BONUSの定義場所

`REST_STATE`定数はcharacter.tsに定義済み。
休息ボーナス値（0, 0.15, 0.30, 0.50）はMaster Indexの仕様値であり、
hp.ts内で`REST_BONUS`定数として定義してexportする。

### 混沌パッシブダメージのHP非貫通

Master Indexの「Chaos Passive Damage: 5 points/hour × (1.0 + chaos_level)」は
dejavuBondsのみに影響する設計。bonds=0でもパッシブダメージはHP不貫通。
ただし、bonds=0の状態で混沌攻撃を受けると全ダメージがHPに直撃する。

---

Last updated: 2026-02-01
