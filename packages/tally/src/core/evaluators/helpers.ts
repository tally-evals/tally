/**
 * Evaluation Context Helpers
 *
 * Factory functions for creating EvaluationContext objects with type-safe
 * single-turn run policies. Provides convenient helpers for common patterns.
 */

import type { EvaluationContext, SingleTurnRunPolicy } from '@tally/core/types';

/**
 * Create an evaluation context that runs metrics on all targets
 *
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'all' run policy
 */
export function runAllTargets(metadata?: Record<string, unknown>): EvaluationContext {
  return {
    singleTurn: { run: 'all' },
    ...(metadata !== undefined && { metadata }),
  };
}

/**
 * Create an evaluation context that runs metrics on specific conversation steps
 *
 * @param stepIndices - Array of step indices to evaluate (0-based)
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'selectedSteps' run policy
 */
export function runSpecificSteps(
  stepIndices: readonly number[],
  metadata?: Record<string, unknown>
): EvaluationContext {
  if (stepIndices.length === 0) {
    throw new Error(
      'runSpecificSteps: stepIndices array cannot be empty. Use runAllTargets() to evaluate all steps.'
    );
  }

  return {
    singleTurn: {
      run: 'selectedSteps',
      stepIndices,
    },
    ...(metadata !== undefined && { metadata }),
  };
}

/**
 * Create an evaluation context that runs metrics on specific dataset items
 *
 * @param itemIndices - Array of item indices to evaluate (0-based)
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with 'selectedItems' run policy
 */
export function runSpecificItems(
  itemIndices: readonly number[],
  metadata?: Record<string, unknown>
): EvaluationContext {
  if (itemIndices.length === 0) {
    throw new Error(
      'runSpecificItems: itemIndices array cannot be empty. Use runAllTargets() to evaluate all items.'
    );
  }

  return {
    singleTurn: {
      run: 'selectedItems',
      itemIndices,
    },
    ...(metadata !== undefined && { metadata }),
  };
}

/**
 * Create a custom evaluation context with a specific run policy
 *
 * @param policy - Single-turn run policy
 * @param metadata - Optional metadata to attach to the context
 * @returns EvaluationContext with the specified policy
 */
export function createEvaluationContext(
  policy: SingleTurnRunPolicy,
  metadata?: Record<string, unknown>
): EvaluationContext {
  return {
    singleTurn: policy,
    ...(metadata !== undefined && { metadata }),
  };
}
