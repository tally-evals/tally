/**
 * Unit tests for normalizer functions
 *
 * Tests the pure normalization functions directly with test data
 */

import { describe, expect, it } from 'bun:test';
import { normalizeMinMax } from '../../src/core/normalization/normalizers/minMax';
import { normalizeZScore } from '../../src/core/normalization/normalizers/zScore';
import { normalizeThreshold } from '../../src/core/normalization/normalizers/threshold';
import { normalizeLinear } from '../../src/core/normalization/normalizers/linear';
import { normalizeOrdinalMap } from '../../src/core/normalization/normalizers/ordinalMap';
import { normalizeIdentity } from '../../src/core/normalization/normalizers/identity';

describe('Unit | Normalizers', () => {
  describe('normalizeMinMax', () => {
    it('normalizes value to middle of range', () => {
      const result = normalizeMinMax(50, { type: 'min-max', min: 0, max: 100 }, {});
      expect(result).toBe(0.5);
    });

    it('normalizes minimum value to 0', () => {
      const result = normalizeMinMax(0, { type: 'min-max', min: 0, max: 100 }, {});
      expect(result).toBe(0);
    });

    it('normalizes maximum value to 1', () => {
      const result = normalizeMinMax(100, { type: 'min-max', min: 0, max: 100 }, {});
      expect(result).toBe(1);
    });

    it('clips value above max when clip=true', () => {
      const result = normalizeMinMax(150, { type: 'min-max', min: 0, max: 100, clip: true }, {});
      expect(result).toBe(1);
    });

    it('clips value below min when clip=true', () => {
      const result = normalizeMinMax(-50, { type: 'min-max', min: 0, max: 100, clip: true }, {});
      expect(result).toBe(0);
    });

    it('throws when value out of range and clip=false', () => {
      expect(() => normalizeMinMax(150, { type: 'min-max', min: 0, max: 100 }, {})).toThrow(
        /out of \[0, 1\] range/
      );
    });

    it('returns 0.5 when min equals max', () => {
      const result = normalizeMinMax(50, { type: 'min-max', min: 50, max: 50 }, {});
      expect(result).toBe(0.5);
    });

    it('inverts score when direction=lower', () => {
      const result = normalizeMinMax(25, { type: 'min-max', min: 0, max: 100, direction: 'lower' }, {});
      expect(result).toBe(0.75); // 1 - 0.25 = 0.75
    });

    it('reads min/max from context when not in spec', () => {
      const result = normalizeMinMax(50, { type: 'min-max' }, { range: { min: 0, max: 100 } });
      expect(result).toBe(0.5);
    });

    it('throws when min/max not provided in spec or context', () => {
      expect(() => normalizeMinMax(50, { type: 'min-max' }, {})).toThrow(/requires min and max/);
    });
  });

  describe('normalizeZScore', () => {
    it('normalizes value at mean to 0.5', () => {
      const result = normalizeZScore(50, { type: 'z-score', mean: 50, stdDev: 10 }, {});
      expect(result).toBe(0.5);
    });

    it('normalizes value above mean to > 0.5', () => {
      const result = normalizeZScore(60, { type: 'z-score', mean: 50, stdDev: 10 }, {});
      expect(result).toBeGreaterThan(0.5);
    });

    it('normalizes value below mean to < 0.5', () => {
      const result = normalizeZScore(40, { type: 'z-score', mean: 50, stdDev: 10 }, {});
      expect(result).toBeLessThan(0.5);
    });

    it('returns 0.5 when stdDev is 0 (no variance)', () => {
      const result = normalizeZScore(50, { type: 'z-score', mean: 50, stdDev: 0 }, {});
      expect(result).toBe(0.5);
    });

    it('inverts score when direction=lower', () => {
      const higher = normalizeZScore(60, { type: 'z-score', mean: 50, stdDev: 10 }, {});
      const lower = normalizeZScore(60, { type: 'z-score', mean: 50, stdDev: 10, direction: 'lower' }, {});
      expect(lower).toBeCloseTo(1 - higher, 10);
    });

    it('reads mean/stdDev from context when not in spec', () => {
      const result = normalizeZScore(
        50,
        { type: 'z-score' },
        { distribution: { mean: 50, stdDev: 10 } }
      );
      expect(result).toBe(0.5);
    });

    it('throws when mean/stdDev not provided', () => {
      expect(() => normalizeZScore(50, { type: 'z-score' }, {})).toThrow(/requires mean and stdDev/);
    });
  });

  describe('normalizeThreshold', () => {
    it('returns 1 for value at threshold', () => {
      const result = normalizeThreshold(0.5, { type: 'threshold', threshold: 0.5 }, {});
      expect(result).toBe(1);
    });

    it('returns 1 for value above threshold', () => {
      const result = normalizeThreshold(0.8, { type: 'threshold', threshold: 0.5 }, {});
      expect(result).toBe(1);
    });

    it('returns 0 for value below threshold', () => {
      const result = normalizeThreshold(0.3, { type: 'threshold', threshold: 0.5 }, {});
      expect(result).toBe(0);
    });

    it('uses custom above/below scores', () => {
      const result = normalizeThreshold(0.3, { type: 'threshold', threshold: 0.5, above: 0.9, below: 0.1 }, {});
      expect(result).toBe(0.1);
    });

    it('reads threshold from context when not in spec', () => {
      const result = normalizeThreshold(0.6, { type: 'threshold' }, { thresholds: { pass: 0.5 } });
      expect(result).toBe(1);
    });

    it('throws when threshold not provided', () => {
      expect(() => normalizeThreshold(0.5, { type: 'threshold' }, {})).toThrow(/requires threshold/);
    });

    it('throws when above/below scores out of range', () => {
      expect(() =>
        normalizeThreshold(0.5, { type: 'threshold', threshold: 0.5, above: 1.5 }, {})
      ).toThrow(/must be in \[0, 1\] range/);
    });
  });

  describe('normalizeLinear', () => {
    it('applies linear transformation', () => {
      // normalized = 0.5 * 0.8 + 0.1 = 0.5
      const result = normalizeLinear(0.8, { type: 'linear', slope: 0.5, intercept: 0.1 }, {});
      expect(result).toBe(0.5);
    });

    it('clips to custom range', () => {
      // normalized = 2 * 0.8 + 0.5 = 2.1, clipped to [0, 1] = 1
      const result = normalizeLinear(0.8, { type: 'linear', slope: 2, intercept: 0.5, clip: [0, 1] }, {});
      expect(result).toBe(1);
    });

    it('inverts when direction=lower', () => {
      // normalized = 0.5 * 0.8 + 0.1 = 0.5, inverted = 0.5
      const result = normalizeLinear(0.8, { type: 'linear', slope: 0.5, intercept: 0.1, direction: 'lower' }, {});
      expect(result).toBe(0.5); // 1 - 0.5 = 0.5
    });

    it('throws when result out of range and no clipping', () => {
      expect(() => normalizeLinear(0.8, { type: 'linear', slope: 2, intercept: 0.5 }, {})).toThrow(
        /out of \[0, 1\] range/
      );
    });

    it('throws when slope/intercept not provided', () => {
      expect(() => normalizeLinear(0.5, { type: 'linear' } as any, {})).toThrow(/requires slope and intercept/);
    });
  });

  describe('normalizeOrdinalMap', () => {
    const map = { excellent: 1.0, good: 0.75, fair: 0.5, poor: 0.25, bad: 0.0 };

    it('maps ordinal value to score', () => {
      const result = normalizeOrdinalMap('good', { type: 'ordinal-map', map }, {});
      expect(result).toBe(0.75);
    });

    it('maps extreme values correctly', () => {
      expect(normalizeOrdinalMap('excellent', { type: 'ordinal-map', map }, {})).toBe(1.0);
      expect(normalizeOrdinalMap('bad', { type: 'ordinal-map', map }, {})).toBe(0.0);
    });

    it('reads map from context when not in spec', () => {
      const result = normalizeOrdinalMap('fair', { type: 'ordinal-map' }, { map });
      expect(result).toBe(0.5);
    });

    it('throws for unknown value', () => {
      expect(() => normalizeOrdinalMap('unknown', { type: 'ordinal-map', map }, {})).toThrow(
        /not found in mapping/
      );
    });

    it('throws when map not provided', () => {
      expect(() => normalizeOrdinalMap('good', { type: 'ordinal-map' }, {})).toThrow(/requires map/);
    });

    it('throws when mapped value out of range', () => {
      expect(() =>
        normalizeOrdinalMap('test', { type: 'ordinal-map', map: { test: 1.5 } }, {})
      ).toThrow(/must be in \[0, 1\] range/);
    });
  });

  describe('normalizeIdentity', () => {
    it('returns number value as-is', () => {
      expect(normalizeIdentity(0.5)).toBe(0.5);
      expect(normalizeIdentity(0)).toBe(0);
      expect(normalizeIdentity(1)).toBe(1);
    });

    it('converts true to 1', () => {
      expect(normalizeIdentity(true)).toBe(1);
    });

    it('converts false to 0', () => {
      expect(normalizeIdentity(false)).toBe(0);
    });

    it('throws for number out of [0, 1] range', () => {
      expect(() => normalizeIdentity(1.5)).toThrow(/expects value in \[0, 1\] range/);
      expect(() => normalizeIdentity(-0.1)).toThrow(/expects value in \[0, 1\] range/);
    });

    it('throws for string values', () => {
      expect(() => normalizeIdentity('test')).toThrow(/does not support string values/);
    });
  });
});
