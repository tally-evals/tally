/**
 * Custom Aggregator Definition Factories
 *
 * Use these functions to define custom aggregators for your metrics.
 * Each function ensures the correct `kind` is set for type safety.
 *
 * @example
 * ```ts
 * // Custom standard deviation aggregator
 * const stdDevAggregator = defineNumericAggregator({
 *   name: 'StdDev',
 *   description: 'Standard deviation of values',
 *   aggregate: (values) => {
 *     const mean = values.reduce((a, b) => a + b, 0) / values.length;
 *     const squaredDiffs = values.map(v => (v - mean) ** 2);
 *     return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
 *   },
 * });
 * ```
 */

import type {
  BooleanAggregatorDef,
  CategoricalAggregatorDef,
  NumericAggregatorDef,
} from '@tally/core/types';

// ============================================================================
// Numeric Aggregator Definition
// ============================================================================

export interface DefineNumericAggregatorArgs {
  /** Name of the aggregator (appears in reports) */
  name: string;
  /** Description of what this aggregator computes */
  description?: string;
  /** The aggregation function - receives array of numbers, returns a number */
  aggregate: (values: readonly number[]) => number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Define a custom numeric aggregator
 *
 * Numeric aggregators operate on number arrays. They work with:
 * - Normalized scores (always numbers 0-1)
 * - Raw values from number-typed metrics
 *
 * @param args - Aggregator configuration
 * @returns A NumericAggregatorDef ready to use with metrics
 *
 * @example
 * ```ts
 * const minAggregator = defineNumericAggregator({
 *   name: 'Min',
 *   description: 'Minimum value',
 *   aggregate: (values) => Math.min(...values),
 * });
 *
 * const stdDevAggregator = defineNumericAggregator({
 *   name: 'StdDev',
 *   aggregate: (values) => {
 *     const mean = values.reduce((a, b) => a + b, 0) / values.length;
 *     return Math.sqrt(
 *       values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
 *     );
 *   },
 * });
 * ```
 */
export function defineNumericAggregator(args: DefineNumericAggregatorArgs): NumericAggregatorDef {
  return {
    kind: 'numeric',
    name: args.name,
    ...(args.description !== undefined && { description: args.description }),
    aggregate: args.aggregate,
    ...(args.metadata !== undefined && { metadata: args.metadata }),
  };
}

// ============================================================================
// Boolean Aggregator Definition
// ============================================================================

export interface DefineBooleanAggregatorArgs {
  /** Name of the aggregator (appears in reports) */
  name: string;
  /** Description of what this aggregator computes */
  description?: string;
  /** The aggregation function - receives array of booleans, returns a number */
  aggregate: (values: readonly boolean[]) => number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Define a custom boolean aggregator
 *
 * Boolean aggregators operate on boolean arrays. They work with:
 * - Raw values from boolean-typed metrics
 *
 * Note: For normalized scores, use numeric aggregators (scores are always numbers).
 *
 * @param args - Aggregator configuration
 * @returns A BooleanAggregatorDef ready to use with boolean metrics
 *
 * @example
 * ```ts
 * const consecutiveTrueAggregator = defineBooleanAggregator({
 *   name: 'MaxTrueStreak',
 *   description: 'Longest consecutive true values',
 *   aggregate: (values) => {
 *     let maxStreak = 0, currentStreak = 0;
 *     for (const v of values) {
 *       if (v) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
 *       else { currentStreak = 0; }
 *     }
 *     return maxStreak;
 *   },
 * });
 * ```
 */
export function defineBooleanAggregator(args: DefineBooleanAggregatorArgs): BooleanAggregatorDef {
  return {
    kind: 'boolean',
    name: args.name,
    ...(args.description !== undefined && { description: args.description }),
    aggregate: args.aggregate,
    ...(args.metadata !== undefined && { metadata: args.metadata }),
  };
}

// ============================================================================
// Categorical Aggregator Definition
// ============================================================================

export interface DefineCategoricalAggregatorArgs {
  /** Name of the aggregator (appears in reports) */
  name: string;
  /** Description of what this aggregator computes */
  description?: string;
  /** The aggregation function - receives array of strings, returns a record of counts/proportions */
  aggregate: (values: readonly string[]) => Record<string, number>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Define a custom categorical aggregator
 *
 * Categorical aggregators operate on string arrays. They work with:
 * - Raw values from string-typed metrics
 * - Raw values from ordinal-typed metrics
 *
 * Note: For normalized scores, use numeric aggregators (scores are always numbers).
 *
 * @param args - Aggregator configuration
 * @returns A CategoricalAggregatorDef ready to use with string/ordinal metrics
 *
 * @example
 * ```ts
 * const entropyAggregator = defineCategoricalAggregator({
 *   name: 'Entropy',
 *   description: 'Shannon entropy of category distribution',
 *   aggregate: (values) => {
 *     const counts: Record<string, number> = {};
 *     for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
 *
 *     let entropy = 0;
 *     const total = values.length;
 *     for (const count of Object.values(counts)) {
 *       const p = count / total;
 *       entropy -= p * Math.log2(p);
 *     }
 *     return { entropy };
 *   },
 * });
 * ```
 */
export function defineCategoricalAggregator(
  args: DefineCategoricalAggregatorArgs
): CategoricalAggregatorDef {
  return {
    kind: 'categorical',
    name: args.name,
    ...(args.description !== undefined && { description: args.description }),
    aggregate: args.aggregate,
    ...(args.metadata !== undefined && { metadata: args.metadata }),
  };
}
