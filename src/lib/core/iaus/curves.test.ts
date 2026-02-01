import { describe, it, expect } from 'vitest';
import {
  clamp01,
  normalize,
  linear,
  polynomial,
  logistic,
  logit,
  parabolic,
  evaluateCurve,
  generateLUT,
  lookupLUT,
} from './curves';
import { CURVE_TYPE, CURVE_PRESET } from '$lib/types/iaus';

describe('clamp01', () => {
  it('should return value unchanged when in range', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it('should return 0 for negative values', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it('should return 1 for values > 1', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(100)).toBe(1);
  });

  it('should return 0 for NaN (safe fallback)', () => {
    expect(clamp01(NaN)).toBe(0);
  });
});

describe('normalize', () => {
  it('should normalize 0-100 range to 0-1', () => {
    expect(normalize(0, 0, 100)).toBe(0);
    expect(normalize(50, 0, 100)).toBe(0.5);
    expect(normalize(100, 0, 100)).toBe(1);
  });

  it('should return 0 when min === max', () => {
    expect(normalize(50, 50, 50)).toBe(0);
  });

  it('should clamp value below min to 0', () => {
    expect(normalize(-10, 0, 100)).toBe(0);
  });

  it('should clamp value above max to 1', () => {
    expect(normalize(150, 0, 100)).toBe(1);
  });

  it('should handle negative ranges', () => {
    expect(normalize(-500, -500, 500)).toBe(0);
    expect(normalize(0, -500, 500)).toBe(0.5);
    expect(normalize(500, -500, 500)).toBe(1);
  });

  it('should handle inverted ranges (min > max)', () => {
    // When min > max, formula still works but values are inverted
    expect(normalize(0, 100, 0)).toBe(1);
    expect(normalize(100, 100, 0)).toBe(0);
  });
});

describe('linear', () => {
  it('should return identity when m=1, b=0', () => {
    expect(linear(0, 1, 0)).toBe(0);
    expect(linear(0.5, 1, 0)).toBe(0.5);
    expect(linear(1, 1, 0)).toBe(1);
  });

  it('should apply slope and offset (m=0.5, b=0.5)', () => {
    expect(linear(0, 0.5, 0.5)).toBe(0.5);
    expect(linear(1, 0.5, 0.5)).toBe(1);
  });

  it('should invert with m=-1, b=1', () => {
    expect(linear(0, -1, 1)).toBe(1);
    expect(linear(1, -1, 1)).toBe(0);
    expect(linear(0.5, -1, 1)).toBe(0.5);
  });

  it('should clamp output to 0-1', () => {
    expect(linear(0, 2, 0)).toBe(0);
    expect(linear(1, 2, 0)).toBe(1); // 2*1+0 = 2 → clamped to 1
    expect(linear(0, 1, -0.5)).toBe(0); // 0-0.5 = -0.5 → clamped to 0
  });
});

describe('polynomial', () => {
  it('should behave like linear when k=1', () => {
    expect(polynomial(0, 1, 0, 1, 0)).toBe(0);
    expect(polynomial(0.5, 1, 0, 1, 0)).toBe(0.5);
    expect(polynomial(1, 1, 0, 1, 0)).toBe(1);
  });

  it('should produce quadratic curve when k=2', () => {
    // (1 * (0.5 - 0))^2 = 0.25
    expect(polynomial(0.5, 1, 0, 2, 0)).toBeCloseTo(0.25, 5);
    // (1 * (1 - 0))^2 = 1
    expect(polynomial(1, 1, 0, 2, 0)).toBe(1);
  });

  it('should shift curve with c=0.5', () => {
    // (1 * (0.5 - 0.5))^2 = 0
    expect(polynomial(0.5, 1, 0.5, 2, 0)).toBe(0);
    // (1 * (1 - 0.5))^2 = 0.25
    expect(polynomial(1, 1, 0.5, 2, 0)).toBeCloseTo(0.25, 5);
  });

  it('should clamp output to 0-1', () => {
    // Large exponent can produce values > 1
    expect(polynomial(1, 2, 0, 2, 0)).toBe(1); // (2*1)^2 = 4 → clamped
  });
});

describe('logistic', () => {
  it('should return k/2 + b at x = c (midpoint)', () => {
    // At x = c, exp term = 1, so k/(1+1) + b = k/2 + b
    const k = 1.0;
    const b = 0.0;
    expect(logistic(0.5, 10, 0.5, k, b)).toBeCloseTo(0.5, 5);
  });

  it('should approach b as x << c', () => {
    // Very low x → exp term → infinity → k/infinity → 0
    // With m=10, c=0.5, the transition is gradual, so use precision 1
    expect(logistic(0, 10, 0.5, 1, 0)).toBeCloseTo(0, 1);
  });

  it('should approach k + b as x >> c', () => {
    // Very high x → exp term → 0 → k/1 = k
    // With m=10, c=0.5, the transition is gradual, so use precision 1
    expect(logistic(1, 10, 0.5, 1, 0)).toBeCloseTo(1, 1);
  });

  it('should produce steeper curve with higher m', () => {
    const gradual = logistic(0.6, 5, 0.5, 1, 0);
    const steep = logistic(0.6, 50, 0.5, 1, 0);
    expect(steep).toBeGreaterThan(gradual);
  });

  it('should clamp output to 0-1', () => {
    expect(logistic(1, 10, 0.5, 2, 0)).toBe(1); // k=2 → would exceed 1
  });
});

describe('logit', () => {
  it('should return ~0.5 at x=0.5', () => {
    // log(0.5/0.5) = log(1) = 0, (0+5)/10 = 0.5
    expect(logit(0.5)).toBeCloseTo(0.5, 5);
  });

  it('should return ~0 as x approaches 0', () => {
    expect(logit(0.01)).toBeLessThan(0.2);
  });

  it('should return ~1 as x approaches 1', () => {
    expect(logit(0.99)).toBeGreaterThan(0.8);
  });

  it('should handle x=0 without error (epsilon protection)', () => {
    expect(() => logit(0)).not.toThrow();
    expect(logit(0)).toBeCloseTo(0, 1);
  });

  it('should handle x=1 without error (epsilon protection)', () => {
    expect(() => logit(1)).not.toThrow();
    expect(logit(1)).toBeCloseTo(1, 1);
  });

  it('should allow custom epsilon', () => {
    const result = logit(0, 0.001);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe('parabolic', () => {
  it('should return 0 at x=0', () => {
    expect(parabolic(0)).toBe(0);
  });

  it('should return 1 at x=0.5 (peak)', () => {
    expect(parabolic(0.5)).toBe(1);
  });

  it('should return 0 at x=1', () => {
    expect(parabolic(1)).toBe(0);
  });

  it('should be symmetric around x=0.5', () => {
    expect(parabolic(0.3)).toBeCloseTo(parabolic(0.7), 5);
    expect(parabolic(0.2)).toBeCloseTo(parabolic(0.8), 5);
  });

  it('should clamp for out-of-range inputs', () => {
    // x > 1 or x < 0 can produce negative values
    expect(parabolic(-0.5)).toBe(0); // 4 * -0.5 * 1.5 = -3 → clamped
    expect(parabolic(1.5)).toBe(0); // 4 * 1.5 * -0.5 = -3 → clamped
  });
});

describe('evaluateCurve', () => {
  const defaultParams = { m: 1, k: 1, c: 0, b: 0 };

  it('should dispatch to linear curve', () => {
    expect(evaluateCurve(0.5, CURVE_TYPE.LINEAR, defaultParams)).toBe(0.5);
  });

  it('should dispatch to polynomial curve', () => {
    const params = { m: 1, k: 2, c: 0, b: 0 };
    expect(evaluateCurve(0.5, CURVE_TYPE.POLYNOMIAL, params)).toBeCloseTo(0.25, 5);
  });

  it('should dispatch to logistic curve', () => {
    const params = { m: 10, k: 1, c: 0.5, b: 0 };
    expect(evaluateCurve(0.5, CURVE_TYPE.LOGISTIC, params)).toBeCloseTo(0.5, 5);
  });

  it('should dispatch to logit curve', () => {
    expect(evaluateCurve(0.5, CURVE_TYPE.LOGIT, defaultParams)).toBeCloseTo(0.5, 5);
  });

  it('should dispatch to parabolic curve', () => {
    expect(evaluateCurve(0.5, CURVE_TYPE.PARABOLIC, defaultParams)).toBe(1);
  });

  it('should return 0 for invalid curve type', () => {
    expect(evaluateCurve(0.5, 999 as any, defaultParams)).toBe(0);
  });

  it('should work with CURVE_PRESET values', () => {
    expect(evaluateCurve(0.5, CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD)).toBe(0.5);
    expect(evaluateCurve(0, CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_HALF)).toBe(0.5);
    expect(evaluateCurve(0, CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_INVERSE)).toBe(1);
  });
});

describe('generateLUT', () => {
  it('should generate LUT with default resolution (256)', () => {
    const lut = generateLUT(CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD);
    expect(lut.length).toBe(256);
  });

  it('should generate LUT with custom resolution', () => {
    const lut = generateLUT(CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD, 64);
    expect(lut.length).toBe(64);
  });

  it('should contain correct values for linear curve', () => {
    const lut = generateLUT(CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD, 11);
    expect(lut[0]).toBeCloseTo(0, 5);
    expect(lut[5]).toBeCloseTo(0.5, 5);
    expect(lut[10]).toBeCloseTo(1, 5);
  });

  it('should return Float32Array', () => {
    const lut = generateLUT(CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD);
    expect(lut).toBeInstanceOf(Float32Array);
  });
});

describe('lookupLUT', () => {
  const lut = generateLUT(CURVE_TYPE.LINEAR, CURVE_PRESET.LINEAR_STANDARD, 256);

  it('should return correct value for x=0', () => {
    expect(lookupLUT(lut, 0)).toBeCloseTo(0, 5);
  });

  it('should return correct value for x=0.5', () => {
    expect(lookupLUT(lut, 0.5)).toBeCloseTo(0.5, 2);
  });

  it('should return correct value for x=1', () => {
    expect(lookupLUT(lut, 1)).toBeCloseTo(1, 5);
  });

  it('should handle x < 0 safely (clamp to first element)', () => {
    expect(lookupLUT(lut, -0.5)).toBeCloseTo(0, 5);
  });

  it('should handle x > 1 safely (clamp to last element)', () => {
    expect(lookupLUT(lut, 1.5)).toBeCloseTo(1, 5);
  });

  it('should match direct calculation', () => {
    const params = CURVE_PRESET.LINEAR_STANDARD;
    const testLut = generateLUT(CURVE_TYPE.LINEAR, params, 256);

    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      const direct = evaluateCurve(x, CURVE_TYPE.LINEAR, params);
      const lookup = lookupLUT(testLut, x);
      expect(lookup).toBeCloseTo(direct, 2);
    }
  });
});
