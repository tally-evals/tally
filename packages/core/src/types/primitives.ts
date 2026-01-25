/**
 * Primitive Type Definitions
 *
 * Foundational types with no dependencies. These are the building blocks
 * for all other type definitions in the Tally evaluation framework.
 */

// ============================================================================
// Scalar Types
// ============================================================================

/**
 * Valid scalar value types for metrics.
 *
 * Metrics can produce one of three value types:
 * - `number` - Numeric measurements (e.g., 0.85, 42)
 * - `boolean` - Binary pass/fail outcomes (e.g., true, false)
 * - `string` - Categorical/ordinal values (e.g., "high", "medium", "low")
 */
export type MetricScalar = number | boolean | string;

/**
 * Normalized score in the [0, 1] range.
 *
 * Branded type to ensure type safety - raw metric values must be
 * explicitly normalized to Score before aggregation.
 *
 * @see {@link toScore} - Factory function to create a Score
 */
export type Score = number & { readonly __brand: 'Score' };

/**
 * Creates a Score from a number, validating the [0, 1] range.
 *
 * @param n - Number to convert to Score
 * @returns Branded Score value
 * @throws Error if value is outside [0, 1] range
 *
 * @example
 * ```typescript
 * const score = toScore(0.85); // OK
 * const invalid = toScore(1.5); // throws Error
 * ```
 */
export const toScore = (n: number): Score => {
  if (n < 0 || n > 1) {
    throw new Error(`Score must be in [0, 1] range, got ${n}`);
  }
  return n as Score;
};

/**
 * Maps a TypeScript value type to its string representation.
 *
 * Used in metric definitions to declare the expected value type.
 *
 * @typeParam TMetricValue - The TypeScript type (number, boolean, or string)
 */
export type ValueTypeFor<TMetricValue> = TMetricValue extends number
  ? 'number' | 'ordinal'
  : TMetricValue extends boolean
    ? 'boolean'
    : 'string';

/**
 * Metric evaluation scope.
 *
 * - `'single'` - Evaluates individual items (ConversationStep or DatasetItem)
 * - `'multi'` - Evaluates entire conversations
 */
export type MetricScope = 'single' | 'multi';

// ============================================================================
// Data Types
// ============================================================================

/**
 * A single input-output pair for evaluation.
 *
 * Used for single-turn evaluations where each item represents
 * one prompt and its corresponding completion.
 *
 * @example
 * ```typescript
 * const item: DatasetItem = {
 *   id: 'item-001',
 *   prompt: 'What is the capital of France?',
 *   completion: 'The capital of France is Paris.',
 * };
 * ```
 */
export interface DatasetItem {
  /** Unique identifier for this item */
  id: string;
  /** The input prompt or question */
  prompt: string;
  /** The model's response or completion */
  completion: string;
  /** Optional metadata for custom properties */
  metadata?: Record<string, unknown>;
}
