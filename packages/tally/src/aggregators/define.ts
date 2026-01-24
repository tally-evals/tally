/**
 * Custom Aggregator Definition Factories
 *
 * Use these functions to define custom aggregators for your metrics.
 * Each function ensures the correct `kind` is set for type safety.
 *
 * Uses `const` type parameters to preserve literal aggregator names
 * for type-safe report access.
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
 * // typeof stdDevAggregator.name is 'StdDev' (literal type)
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

/**
 * Args for defining a numeric aggregator.
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface DefineNumericAggregatorArgs<TName extends string = string> {
  /** Name of the aggregator (appears in reports) */
  name: TName;
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
 * Uses `const` type parameter to preserve literal name type for type-safe reports.
 *
 * @typeParam TName - Literal string type for aggregator name
 * @param args - Aggregator configuration
 * @returns A NumericAggregatorDef with preserved name type
 *
 * @example
 * ```ts
 * const minAggregator = defineNumericAggregator({
 *   name: 'Min',
 *   description: 'Minimum value',
 *   aggregate: (values) => Math.min(...values),
 * });
 * // typeof minAggregator.name is 'Min'
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
export function defineNumericAggregator<const TName extends string>(
  args: DefineNumericAggregatorArgs<TName>
): NumericAggregatorDef<TName> {
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

/**
 * Args for defining a boolean aggregator.
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface DefineBooleanAggregatorArgs<TName extends string = string> {
  /** Name of the aggregator (appears in reports) */
  name: TName;
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
 * Uses `const` type parameter to preserve literal name type for type-safe reports.
 *
 * @typeParam TName - Literal string type for aggregator name
 * @param args - Aggregator configuration
 * @returns A BooleanAggregatorDef with preserved name type
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
 * // typeof consecutiveTrueAggregator.name is 'MaxTrueStreak'
 * ```
 */
export function defineBooleanAggregator<const TName extends string>(
  args: DefineBooleanAggregatorArgs<TName>
): BooleanAggregatorDef<TName> {
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

/**
 * Args for defining a categorical aggregator.
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface DefineCategoricalAggregatorArgs<TName extends string = string> {
  /** Name of the aggregator (appears in reports) */
  name: TName;
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
 * Uses `const` type parameter to preserve literal name type for type-safe reports.
 *
 * @typeParam TName - Literal string type for aggregator name
 * @param args - Aggregator configuration
 * @returns A CategoricalAggregatorDef with preserved name type
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
 * // typeof entropyAggregator.name is 'Entropy'
 * ```
 */
export function defineCategoricalAggregator<const TName extends string>(
  args: DefineCategoricalAggregatorArgs<TName>
): CategoricalAggregatorDef<TName> {
  return {
    kind: 'categorical',
    name: args.name,
    ...(args.description !== undefined && { description: args.description }),
    aggregate: args.aggregate,
    ...(args.metadata !== undefined && { metadata: args.metadata }),
  };
}
