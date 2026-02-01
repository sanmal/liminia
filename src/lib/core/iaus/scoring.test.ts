import { describe, it, expect } from 'vitest';
import { aggregateScores, applyWeight } from './scoring';

describe('aggregateScores', () => {
  it('should return 0 for empty array', () => {
    expect(aggregateScores([])).toBe(0);
  });

  it('should return the value itself for single element', () => {
    expect(aggregateScores([0.8])).toBe(0.8);
  });

  it('should return same value when all elements are identical (dilution fix)', () => {
    // Geometric mean of [0.9, 0.9, 0.9] = 0.9^(3/3) = 0.9
    expect(aggregateScores([0.9, 0.9, 0.9])).toBeCloseTo(0.9, 5);
    expect(aggregateScores([0.5, 0.5, 0.5, 0.5])).toBeCloseTo(0.5, 5);
  });

  it('should return 0 when any element is zero (auto-veto)', () => {
    expect(aggregateScores([0.5, 0, 0.8])).toBe(0);
    expect(aggregateScores([0, 0.5, 0.8])).toBe(0);
    expect(aggregateScores([0.5, 0.8, 0])).toBe(0);
  });

  it('should return 0 when any element is negative (auto-veto)', () => {
    expect(aggregateScores([0.5, -0.1, 0.8])).toBe(0);
    expect(aggregateScores([-0.5, 0.5, 0.8])).toBe(0);
  });

  it('should compute geometric mean for different values', () => {
    // Geometric mean of [0.8, 0.6, 0.4] = (0.8 * 0.6 * 0.4)^(1/3)
    // = (0.192)^(1/3) ≈ 0.5769
    const result = aggregateScores([0.8, 0.6, 0.4]);
    const expected = Math.pow(0.8 * 0.6 * 0.4, 1 / 3);
    expect(result).toBeCloseTo(expected, 5);
  });

  it('should return 1.0 when all elements are 1.0', () => {
    expect(aggregateScores([1.0, 1.0, 1.0])).toBe(1.0);
  });

  it('should handle very small values', () => {
    // Geometric mean of [0.01, 0.01] = 0.01
    expect(aggregateScores([0.01, 0.01])).toBeCloseTo(0.01, 5);
  });

  it('should handle two values', () => {
    // Geometric mean of [0.64, 0.36] = sqrt(0.64 * 0.36) = sqrt(0.2304) = 0.48
    expect(aggregateScores([0.64, 0.36])).toBeCloseTo(0.48, 5);
  });

  it('should handle values just above zero', () => {
    expect(aggregateScores([0.001, 0.001])).toBeCloseTo(0.001, 5);
  });

  it('should not auto-veto for very small positive values', () => {
    expect(aggregateScores([0.0001])).toBeCloseTo(0.0001, 8);
    expect(aggregateScores([0.0001])).toBeGreaterThan(0);
  });
});

describe('applyWeight', () => {
  it('should return score unchanged when weight is 1.0', () => {
    expect(applyWeight(0.8, 1.0)).toBe(0.8);
    expect(applyWeight(0.5, 1.0)).toBe(0.5);
  });

  it('should increase score when weight > 1.0', () => {
    expect(applyWeight(0.6, 1.5)).toBeCloseTo(0.9, 5);
    expect(applyWeight(0.5, 2.0)).toBe(1.0);
  });

  it('should decrease score when weight < 1.0', () => {
    expect(applyWeight(0.8, 0.5)).toBeCloseTo(0.4, 5);
    expect(applyWeight(1.0, 0.5)).toBe(0.5);
  });

  it('should return 0 when score is 0 (regardless of weight)', () => {
    expect(applyWeight(0, 1.5)).toBe(0);
    expect(applyWeight(0, 100)).toBe(0);
  });

  it('should return 0 when weight is 0', () => {
    expect(applyWeight(0.8, 0)).toBe(0);
  });

  it('should allow result > 1 (no clamping)', () => {
    // weight > 1 can produce values > 1, which is intentional
    expect(applyWeight(0.8, 1.5)).toBeCloseTo(1.2, 5);
  });
});
