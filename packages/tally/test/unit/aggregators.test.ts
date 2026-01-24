/**
 * Unit tests for aggregator functions
 *
 * Tests the aggregator factory functions and their aggregate methods directly
 */

import { describe, expect, it } from 'bun:test';
import { createMeanAggregator } from '../../src/aggregators/mean';
import { createPercentileAggregator } from '../../src/aggregators/percentile';
import { createThresholdAggregator } from '../../src/aggregators/threshold';
import { createTrueRateAggregator, createFalseRateAggregator } from '../../src/aggregators/trueRate';
import { createDistributionAggregator, createModeAggregator } from '../../src/aggregators/distribution';

describe('Unit | Aggregators', () => {
  describe('createMeanAggregator', () => {
    it('creates aggregator with correct properties', () => {
      const agg = createMeanAggregator();
      expect(agg.kind).toBe('numeric');
      expect(agg.name).toBe('Mean');
      expect(agg.description).toBe('Arithmetic mean');
    });

    it('calculates mean of values', () => {
      const agg = createMeanAggregator();
      expect(agg.aggregate([1, 2, 3, 4, 5])).toBe(3);
    });

    it('handles single value', () => {
      const agg = createMeanAggregator();
      expect(agg.aggregate([42])).toBe(42);
    });

    it('handles decimal values', () => {
      const agg = createMeanAggregator();
      expect(agg.aggregate([0.1, 0.2, 0.3])).toBeCloseTo(0.2, 10);
    });

    it('throws on empty array', () => {
      const agg = createMeanAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });

    it('accepts custom description', () => {
      const agg = createMeanAggregator({ description: 'Custom mean' });
      expect(agg.description).toBe('Custom mean');
    });
  });

  describe('createPercentileAggregator', () => {
    const testData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('creates aggregator with literal name type', () => {
      const p50 = createPercentileAggregator({ percentile: 50 });
      expect(p50.kind).toBe('numeric');
      expect(p50.name).toBe('P50');
    });

    it('calculates P50 (median)', () => {
      const p50 = createPercentileAggregator({ percentile: 50 });
      expect(p50.aggregate(testData)).toBe(5.5);
    });

    it('calculates P0 (minimum)', () => {
      const p0 = createPercentileAggregator({ percentile: 0 });
      expect(p0.aggregate(testData)).toBe(1);
    });

    it('calculates P100 (maximum)', () => {
      const p100 = createPercentileAggregator({ percentile: 100 });
      expect(p100.aggregate(testData)).toBe(10);
    });

    it('calculates P25 (first quartile)', () => {
      const p25 = createPercentileAggregator({ percentile: 25 });
      expect(p25.aggregate(testData)).toBeCloseTo(3.25, 10);
    });

    it('calculates P75 (third quartile)', () => {
      const p75 = createPercentileAggregator({ percentile: 75 });
      expect(p75.aggregate(testData)).toBeCloseTo(7.75, 10);
    });

    it('calculates P95', () => {
      const p95 = createPercentileAggregator({ percentile: 95 });
      // For [1..10], P95 should be close to 9.55
      expect(p95.aggregate(testData)).toBeCloseTo(9.55, 1);
    });

    it('handles single value', () => {
      const p50 = createPercentileAggregator({ percentile: 50 });
      expect(p50.aggregate([42])).toBe(42);
    });

    it('throws on empty array', () => {
      const p50 = createPercentileAggregator({ percentile: 50 });
      expect(() => p50.aggregate([])).toThrow(/cannot aggregate empty array/);
    });

    it('throws on invalid percentile < 0', () => {
      expect(() => createPercentileAggregator({ percentile: -1 })).toThrow(/must be in \[0, 100\] range/);
    });

    it('throws on invalid percentile > 100', () => {
      expect(() => createPercentileAggregator({ percentile: 101 })).toThrow(/must be in \[0, 100\] range/);
    });
  });

  describe('createThresholdAggregator', () => {
    it('creates aggregator with default threshold 0.5', () => {
      const agg = createThresholdAggregator();
      expect(agg.name).toBe('Threshold >= 0.5');
    });

    it('creates aggregator with custom threshold', () => {
      const agg = createThresholdAggregator({ threshold: 0.7 });
      expect(agg.name).toBe('Threshold >= 0.7');
    });

    it('calculates proportion above threshold', () => {
      const agg = createThresholdAggregator({ threshold: 0.5 });
      // 3 out of 5 are >= 0.5
      expect(agg.aggregate([0.3, 0.5, 0.6, 0.4, 0.9])).toBe(0.6);
    });

    it('returns 1 when all values above threshold', () => {
      const agg = createThresholdAggregator({ threshold: 0.5 });
      expect(agg.aggregate([0.6, 0.7, 0.8, 0.9])).toBe(1);
    });

    it('returns 0 when no values above threshold', () => {
      const agg = createThresholdAggregator({ threshold: 0.5 });
      expect(agg.aggregate([0.1, 0.2, 0.3, 0.4])).toBe(0);
    });

    it('includes values exactly at threshold', () => {
      const agg = createThresholdAggregator({ threshold: 0.5 });
      expect(agg.aggregate([0.5])).toBe(1);
    });

    it('throws on empty array', () => {
      const agg = createThresholdAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });

    it('throws on invalid threshold', () => {
      expect(() => createThresholdAggregator({ threshold: 1.5 })).toThrow(/must be in \[0, 1\] range/);
      expect(() => createThresholdAggregator({ threshold: -0.1 })).toThrow(/must be in \[0, 1\] range/);
    });
  });

  describe('createTrueRateAggregator', () => {
    it('creates aggregator with correct properties', () => {
      const agg = createTrueRateAggregator();
      expect(agg.kind).toBe('boolean');
      expect(agg.name).toBe('TrueRate');
    });

    it('calculates proportion of true values', () => {
      const agg = createTrueRateAggregator();
      expect(agg.aggregate([true, true, false, true, false])).toBe(0.6);
    });

    it('returns 1 for all true', () => {
      const agg = createTrueRateAggregator();
      expect(agg.aggregate([true, true, true])).toBe(1);
    });

    it('returns 0 for all false', () => {
      const agg = createTrueRateAggregator();
      expect(agg.aggregate([false, false, false])).toBe(0);
    });

    it('handles single value', () => {
      const agg = createTrueRateAggregator();
      expect(agg.aggregate([true])).toBe(1);
      expect(agg.aggregate([false])).toBe(0);
    });

    it('throws on empty array', () => {
      const agg = createTrueRateAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });
  });

  describe('createFalseRateAggregator', () => {
    it('creates aggregator with correct properties', () => {
      const agg = createFalseRateAggregator();
      expect(agg.kind).toBe('boolean');
      expect(agg.name).toBe('FalseRate');
    });

    it('calculates proportion of false values', () => {
      const agg = createFalseRateAggregator();
      expect(agg.aggregate([true, true, false, true, false])).toBe(0.4);
    });

    it('returns 0 for all true', () => {
      const agg = createFalseRateAggregator();
      expect(agg.aggregate([true, true, true])).toBe(0);
    });

    it('returns 1 for all false', () => {
      const agg = createFalseRateAggregator();
      expect(agg.aggregate([false, false, false])).toBe(1);
    });

    it('throws on empty array', () => {
      const agg = createFalseRateAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });
  });

  describe('createDistributionAggregator', () => {
    it('creates aggregator with correct properties', () => {
      const agg = createDistributionAggregator();
      expect(agg.kind).toBe('categorical');
      expect(agg.name).toBe('Distribution');
    });

    it('calculates proportions by default', () => {
      const agg = createDistributionAggregator();
      const result = agg.aggregate(['A', 'B', 'A', 'C', 'A']);
      expect(result).toEqual({ A: 0.6, B: 0.2, C: 0.2 });
    });

    it('calculates counts when proportions=false', () => {
      const agg = createDistributionAggregator({ proportions: false });
      const result = agg.aggregate(['A', 'B', 'A', 'C', 'A']);
      expect(result).toEqual({ A: 3, B: 1, C: 1 });
    });

    it('handles single value', () => {
      const agg = createDistributionAggregator();
      expect(agg.aggregate(['A'])).toEqual({ A: 1 });
    });

    it('handles all same values', () => {
      const agg = createDistributionAggregator();
      expect(agg.aggregate(['X', 'X', 'X'])).toEqual({ X: 1 });
    });

    it('throws on empty array', () => {
      const agg = createDistributionAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });
  });

  describe('createModeAggregator', () => {
    it('creates aggregator with correct properties', () => {
      const agg = createModeAggregator();
      expect(agg.kind).toBe('categorical');
      expect(agg.name).toBe('Mode');
    });

    it('finds single mode', () => {
      const agg = createModeAggregator();
      const result = agg.aggregate(['A', 'B', 'A', 'C', 'A']);
      expect(result).toEqual({ A: 0.6 });
    });

    it('finds multiple modes (tie)', () => {
      const agg = createModeAggregator();
      const result = agg.aggregate(['A', 'B', 'A', 'B']);
      expect(result).toEqual({ A: 0.5, B: 0.5 });
    });

    it('handles all unique values', () => {
      const agg = createModeAggregator();
      const result = agg.aggregate(['A', 'B', 'C']);
      // All are modes since all have count 1
      expect(result).toEqual({ A: 1 / 3, B: 1 / 3, C: 1 / 3 });
    });

    it('handles single value', () => {
      const agg = createModeAggregator();
      expect(agg.aggregate(['X'])).toEqual({ X: 1 });
    });

    it('throws on empty array', () => {
      const agg = createModeAggregator();
      expect(() => agg.aggregate([])).toThrow(/cannot aggregate empty array/);
    });
  });
});
