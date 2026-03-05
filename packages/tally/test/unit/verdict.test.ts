/**
 * Unit tests for verdict computation and summary functions
 *
 * Tests the verdict logic and aggregation summary calculations
 */

import { describe, expect, it } from 'bun:test';
import { computeVerdict } from '../../src/core/evals/verdict';
import {
  calculateVerdictSummary,
  calculateVerdictPassRate,
  calculateDistribution,
} from '../../src/core/evals/aggregations';
import type { Score } from '@tally-evals/core';

describe('Unit | Verdict', () => {
  describe('computeVerdict', () => {
    describe('none policy', () => {
      it('returns unknown for none policy', () => {
        const result = computeVerdict(0.5 as Score, 0.5, { kind: 'none' });
        expect(result).toBe('unknown');
      });
    });

    describe('boolean policy', () => {
      it('returns pass when value matches passWhen=true', () => {
        const result = computeVerdict(1 as Score, true, { kind: 'boolean', passWhen: true });
        expect(result).toBe('pass');
      });

      it('returns fail when value does not match passWhen=true', () => {
        const result = computeVerdict(0 as Score, false, { kind: 'boolean', passWhen: true });
        expect(result).toBe('fail');
      });

      it('returns pass when value matches passWhen=false', () => {
        const result = computeVerdict(0 as Score, false, { kind: 'boolean', passWhen: false });
        expect(result).toBe('pass');
      });

      it('returns fail when value does not match passWhen=false', () => {
        const result = computeVerdict(1 as Score, true, { kind: 'boolean', passWhen: false });
        expect(result).toBe('fail');
      });
    });

    describe('number threshold policy', () => {
      it('returns pass when value >= passAt', () => {
        const result = computeVerdict(0.8 as Score, 0.8, {
          kind: 'number',
          type: 'threshold',
          passAt: 0.7,
        });
        expect(result).toBe('pass');
      });

      it('returns pass when value equals passAt', () => {
        const result = computeVerdict(0.7 as Score, 0.7, {
          kind: 'number',
          type: 'threshold',
          passAt: 0.7,
        });
        expect(result).toBe('pass');
      });

      it('returns fail when value < passAt', () => {
        const result = computeVerdict(0.5 as Score, 0.5, {
          kind: 'number',
          type: 'threshold',
          passAt: 0.7,
        });
        expect(result).toBe('fail');
      });
    });

    describe('number range policy', () => {
      it('returns pass when value in range', () => {
        const result = computeVerdict(0.5 as Score, 0.5, {
          kind: 'number',
          type: 'range',
          min: 0.3,
          max: 0.7,
        });
        expect(result).toBe('pass');
      });

      it('returns pass at min boundary', () => {
        const result = computeVerdict(0.3 as Score, 0.3, {
          kind: 'number',
          type: 'range',
          min: 0.3,
          max: 0.7,
        });
        expect(result).toBe('pass');
      });

      it('returns pass at max boundary', () => {
        const result = computeVerdict(0.7 as Score, 0.7, {
          kind: 'number',
          type: 'range',
          min: 0.3,
          max: 0.7,
        });
        expect(result).toBe('pass');
      });

      it('returns fail when value below min', () => {
        const result = computeVerdict(0.2 as Score, 0.2, {
          kind: 'number',
          type: 'range',
          min: 0.3,
          max: 0.7,
        });
        expect(result).toBe('fail');
      });

      it('returns fail when value above max', () => {
        const result = computeVerdict(0.8 as Score, 0.8, {
          kind: 'number',
          type: 'range',
          min: 0.3,
          max: 0.7,
        });
        expect(result).toBe('fail');
      });

      it('uses default min=0, max=1 when not specified', () => {
        const result = computeVerdict(0.5 as Score, 0.5, {
          kind: 'number',
          type: 'range',
        });
        expect(result).toBe('pass');
      });
    });

    describe('ordinal policy', () => {
      it('returns pass when value in passWhenIn', () => {
        const result = computeVerdict(0.8 as Score, 'excellent', {
          kind: 'ordinal',
          passWhenIn: ['excellent', 'good'],
        });
        expect(result).toBe('pass');
      });

      it('returns fail when value not in passWhenIn', () => {
        const result = computeVerdict(0.3 as Score, 'poor', {
          kind: 'ordinal',
          passWhenIn: ['excellent', 'good'],
        });
        expect(result).toBe('fail');
      });
    });

    describe('custom policy', () => {
      it('uses custom verdict function', () => {
        const result = computeVerdict(0.5 as Score, 0.5, {
          kind: 'custom',
          verdict: (score, rawValue) => (score >= 0.5 && rawValue === 0.5 ? 'pass' : 'fail'),
        });
        expect(result).toBe('pass');
      });

      it('can return unknown from custom function', () => {
        const result = computeVerdict(0.5 as Score, null as any, {
          kind: 'custom',
          verdict: (_score, rawValue) => (rawValue === null ? 'unknown' : 'pass'),
        });
        expect(result).toBe('unknown');
      });
    });
  });

  describe('calculateVerdictSummary', () => {
    it('calculates correct summary for mixed verdicts', () => {
      const scores = [0.8, 0.9, 0.3, 0.7] as Score[];
      const rawValues = [0.8, 0.9, 0.3, 0.7];
      const policy = { kind: 'number' as const, type: 'threshold' as const, passAt: 0.5 };

      const summary = calculateVerdictSummary(scores, policy, rawValues);

      expect(summary.passCount).toBe(3);
      expect(summary.failCount).toBe(1);
      expect(summary.unknownCount).toBe(0);
      expect(summary.totalCount).toBe(4);
      expect(summary.passRate).toBe(0.75);
      expect(summary.failRate).toBe(0.25);
      expect(summary.unknownRate).toBe(0);
    });

    it('returns all unknown for none policy', () => {
      const scores = [0.5, 0.6, 0.7] as Score[];
      const policy = { kind: 'none' as const };

      const summary = calculateVerdictSummary(scores, policy);

      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.unknownCount).toBe(3);
      expect(summary.unknownRate).toBe(1);
    });

    it('handles all pass', () => {
      const scores = [0.8, 0.9, 0.7] as Score[];
      const rawValues = [0.8, 0.9, 0.7];
      const policy = { kind: 'number' as const, type: 'threshold' as const, passAt: 0.5 };

      const summary = calculateVerdictSummary(scores, policy, rawValues);

      expect(summary.passRate).toBe(1);
      expect(summary.failRate).toBe(0);
    });

    it('handles all fail', () => {
      const scores = [0.1, 0.2, 0.3] as Score[];
      const rawValues = [0.1, 0.2, 0.3];
      const policy = { kind: 'number' as const, type: 'threshold' as const, passAt: 0.5 };

      const summary = calculateVerdictSummary(scores, policy, rawValues);

      expect(summary.passRate).toBe(0);
      expect(summary.failRate).toBe(1);
    });

    it('throws on empty scores array', () => {
      expect(() =>
        calculateVerdictSummary([], { kind: 'none' })
      ).toThrow(/Cannot calculate verdict summary for empty/);
    });

    it('treats missing rawValues as unknown', () => {
      const scores = [0.8, 0.9] as Score[];
      const policy = { kind: 'number' as const, type: 'threshold' as const, passAt: 0.5 };

      // No rawValues provided - should be unknown
      const summary = calculateVerdictSummary(scores, policy, undefined);

      expect(summary.unknownCount).toBe(2);
      expect(summary.passCount).toBe(0);
    });
  });

  describe('calculateVerdictPassRate', () => {
    it('returns pass rate as Score', () => {
      const scores = [0.8, 0.9, 0.3, 0.7] as Score[];
      const rawValues = [0.8, 0.9, 0.3, 0.7];
      const policy = { kind: 'number' as const, type: 'threshold' as const, passAt: 0.5 };

      const passRate = calculateVerdictPassRate(scores, policy, rawValues);

      expect(passRate).toBe(0.75);
    });
  });

  describe('calculateDistribution', () => {
    it('calculates distribution of values', () => {
      const result = calculateDistribution(['A', 'B', 'A', 'C', 'A']);
      expect(result).toEqual({ A: 3, B: 1, C: 1 });
    });

    it('handles single value', () => {
      const result = calculateDistribution(['X']);
      expect(result).toEqual({ X: 1 });
    });

    it('handles all same values', () => {
      const result = calculateDistribution(['Y', 'Y', 'Y']);
      expect(result).toEqual({ Y: 3 });
    });

    it('handles numeric values as strings', () => {
      const result = calculateDistribution([1, 2, 1, 3]);
      expect(result).toEqual({ '1': 2, '2': 1, '3': 1 });
    });

    it('returns empty object for empty array', () => {
      const result = calculateDistribution([]);
      expect(result).toEqual({});
    });
  });
});
