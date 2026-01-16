/**
 * Primitive Type Definitions
 *
 * Foundational types with no dependencies. These are the building blocks
 * for all other type definitions.
 */

// ============================================================================
// Scalar Types
// ============================================================================

/**
 * Valid scalar values for metrics
 */
export type MetricScalar = number | boolean | string;

/**
 * Score domain: normalized [0, 1] values
 * Branded type to ensure type safety for normalized scores
 */
export type Score = number & { readonly __brand: 'Score' };

/**
 * Helper function to create a Score from a number
 * Validates that the value is in [0, 1] range
 */
export const toScore = (n: number): Score => {
  if (n < 0 || n > 1) {
    throw new Error(`Score must be in [0, 1] range, got ${n}`);
  }
  return n as Score;
};

/**
 * Output value type aligned with T
 * Maps TypeScript types to their string representations
 */
export type ValueTypeFor<T> = T extends number
  ? 'number' | 'ordinal'
  : T extends boolean
    ? 'boolean'
    : 'string';

/**
 * Metric scope: single-turn or multi-turn
 */
export type MetricScope = 'single' | 'multi';

// ============================================================================
// Data Types
// ============================================================================

/**
 * Dataset item for single-turn evaluations
 */
export interface DatasetItem {
  id: string;
  prompt: string;
  completion: string;
  metadata?: Record<string, unknown>;
}
