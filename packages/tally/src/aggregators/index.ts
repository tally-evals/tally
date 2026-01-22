/**
 * Aggregators
 *
 * Aggregators summarize evaluation results across multiple data points.
 *
 * ## Aggregator Types (discriminated by `kind`)
 * - 'numeric': Operates on number arrays (scores, numeric raw values)
 * - 'boolean': Operates on boolean arrays (boolean raw values)
 * - 'categorical': Operates on string arrays (string raw values)
 *
 * ## Creating Aggregators
 * - **Custom:** Use `defineNumericAggregator`, `defineBooleanAggregator`, `defineCategoricalAggregator`
 * - **Prebuilt:** Use `createMeanAggregator`, `createPercentileAggregator`, etc.
 *
 * For verdict-based pass/fail rates, use eval.verdict policies with VerdictSummary.
 */

// ============================================================================
// Custom Aggregator Definitions (define*)
// ============================================================================

export {
  defineNumericAggregator,
  defineBooleanAggregator,
  defineCategoricalAggregator,
} from './define';

export type {
  DefineNumericAggregatorArgs,
  DefineBooleanAggregatorArgs,
  DefineCategoricalAggregatorArgs,
} from './define';

// ============================================================================
// Prebuilt Aggregators (create*)
// ============================================================================

// Numeric aggregators (work on scores and numeric raw values)
export { createMeanAggregator } from './mean';
export { createPercentileAggregator } from './percentile';
export { createThresholdAggregator } from './threshold';

// Boolean aggregators (work on boolean raw values)
export { createTrueRateAggregator, createFalseRateAggregator } from './trueRate';

// Categorical aggregators (work on string raw values)
export {
  createDistributionAggregator,
  createModeAggregator,
} from './distribution';

// ============================================================================
// Default Aggregators
// ============================================================================

export {
  DEFAULT_AGGREGATORS,
  DEFAULT_NUMERIC_AGGREGATORS,
  getDefaultAggregators,
} from './default';

// ============================================================================
// Option Types
// ============================================================================

export type { MeanAggregatorOptions } from './mean';
export type { PercentileAggregatorOptions } from './percentile';
export type { ThresholdAggregatorOptions } from './threshold';
export type { TrueRateAggregatorOptions } from './trueRate';
export type { DistributionAggregatorOptions } from './distribution';
