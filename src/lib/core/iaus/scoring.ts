// =============================================================================
// IAUS Score Aggregation
// =============================================================================

/**
 * Aggregate multiple consideration scores using geometric mean (compensation factor).
 *
 * Formula: Score_final = (c₁ × c₂ × ... × cₙ)^(1/n)
 *
 * This solves the "dilution problem" where many average scores
 * would unfairly penalize decisions with more considerations.
 *
 * @param scores - Array of consideration scores (each should be 0-1)
 * @returns Aggregated score (0-1). Returns 0 for empty array or if any score ≤ 0 (auto-veto).
 */
export function aggregateScores(scores: readonly number[]): number {
  const len = scores.length;
  if (len === 0) return 0;

  let product = 1.0;
  for (let i = 0; i < len; i++) {
    const s = scores[i]!;
    if (s <= 0) return 0; // Auto-veto
    product *= s;
  }

  return Math.pow(product, 1.0 / len);
}

/**
 * Apply decision weight to an aggregated score.
 *
 * Weight > 1.0 increases importance (e.g., survival actions).
 * Weight < 1.0 decreases importance (e.g., optional actions).
 *
 * Note: Result is NOT clamped to 0-1 because weight > 1.0 is valid.
 *
 * @param score - Base aggregated score
 * @param weight - Importance factor (typically 0.5-2.0)
 * @returns Weighted score
 */
export function applyWeight(score: number, weight: number): number {
  return score * weight;
}
