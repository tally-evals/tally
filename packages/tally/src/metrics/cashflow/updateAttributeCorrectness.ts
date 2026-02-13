/**
 * Update Attribute Correctness Metric
 *
 * A code-based metric that measures whether entity update operations modify
 * the correct fields with correct values while leaving other fields unchanged.
 *
 * Evaluates attribute-level correctness of updates (e.g., "Rent increased to $2200"
 * should update amount field only, not name or due date).
 *
 * Supports ConversationStep and DatasetItem with metadata containing expected changes.
 */

import type {
  ConversationStep,
  DatasetItem,
  NumericAggregatorDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
  SingleTargetFor,
} from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Expected field change
 */
export interface ExpectedFieldChange {
  field: string;
  newValue: unknown;
  oldValue?: unknown; // Optional for validation
}

/**
 * Entity state before and after
 */
export interface EntityStateChange {
  entityId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * Metadata structure for update attribute correctness evaluation
 */
export interface UpdateAttributeCorrectnessMetadata {
  /**
   * Expected field changes
   */
  expectedChanges: ExpectedFieldChange[];
  /**
   * Fields that should remain unchanged
   */
  unchangedFields?: string[];
  /**
   * Entity state change (before/after)
   */
  stateChange?: EntityStateChange;
  /**
   * Tool call args (alternative to stateChange)
   */
  toolCallArgs?: Record<string, unknown>;
  /**
   * Tolerance for numeric comparison
   * @default 0.01
   */
  tolerance?: number;
}

export interface UpdateAttributeCorrectnessOptions {
  /**
   * Tool names that indicate entity updates
   * @default All tools with 'update' in name
   */
  updateToolNames?: string[];
  /**
   * Tolerance for numeric field comparison
   * @default 0.01
   */
  tolerance?: number;
  /**
   * Strict mode: any incorrect field modification results in 0 score
   * @default false
   */
  strictMode?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create an update attribute correctness metric
 *
 * Measures whether entity updates modify correct fields with correct values.
 * Validates that expected fields are changed and unchanged fields remain unchanged.
 *
 * Scoring:
 * - 1.0: All expected changes correct, all unchanged fields preserved
 * - Proportional: Based on fraction of correct field updates
 * - Penalty: Applied for incorrect values or unintended field changes
 * - 0.0: None of the expected changes are correct
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for update attribute correctness
 */
export function createUpdateAttributeCorrectnessMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: UpdateAttributeCorrectnessOptions = {}): SingleTurnMetricDef<number, TContainer> {
  const { updateToolNames, tolerance = 0.01, strictMode = false, aggregators } = options;

  const base = defineBaseMetric({
    name: 'updateAttributeCorrectness',
    valueType: 'number',
    description:
      'Measures whether entity updates modify correct fields with correct values while preserving other fields',
    metadata: {
      updateToolNames,
      tolerance,
      strictMode,
    },
  });

  const metric = defineSingleTurnCode<number, TContainer>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: SingleTargetFor<TContainer>) => {
      // Extract tool calls if present
      let toolCalls: ExtractedToolCall[] = [];

      if ('completion' in selected) {
        // DatasetItem
        const item = selected as DatasetItem;
        if (
          typeof item.completion === 'object' &&
          item.completion !== null &&
          'role' in item.completion
        ) {
          const outputMessage = item.completion as ModelMessage;
          toolCalls = extractToolCalls(outputMessage);
        }
      } else if ('output' in selected) {
        // ConversationStep
        const step = selected as ConversationStep;
        for (const msg of step.output) {
          if (msg.role === 'assistant') {
            toolCalls.push(...extractToolCalls(msg));
          }
        }
      }

      // Filter to update-related tools
      if (updateToolNames && updateToolNames.length > 0) {
        toolCalls = toolCalls.filter((tc) => updateToolNames.includes(tc.toolName));
      } else {
        toolCalls = toolCalls.filter((tc) => tc.toolName.toLowerCase().includes('update'));
      }

      // Extract metadata
      let metadata: UpdateAttributeCorrectnessMetadata | undefined;
      if ('metadata' in selected && selected.metadata) {
        metadata = selected.metadata as unknown as UpdateAttributeCorrectnessMetadata;
      }

      const expectedChanges = metadata?.expectedChanges ?? [];
      const unchangedFields = metadata?.unchangedFields ?? [];
      const stateChange = metadata?.stateChange;
      const toolCallArgs = metadata?.toolCallArgs;
      const metadataTolerance = metadata?.tolerance ?? tolerance;

      return {
        toolCalls,
        expectedChanges,
        unchangedFields,
        stateChange,
        toolCallArgs,
        tolerance: metadataTolerance,
        strictMode,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            expectedChanges: ExpectedFieldChange[];
            unchangedFields: string[];
            stateChange?: EntityStateChange;
            toolCallArgs?: Record<string, unknown>;
            tolerance: number;
            strictMode: boolean;
          }
        | undefined;

      if (!payload || payload.expectedChanges.length === 0) {
        return 1.0; // No changes expected
      }

      const {
        toolCalls,
        expectedChanges,
        unchangedFields,
        stateChange,
        toolCallArgs,
        tolerance: tol,
        strictMode: strict,
      } = payload;

      // Determine actual changes from tool calls, tool call args, or state change
      let actualChanges: Record<string, unknown> = {};

      if (toolCalls.length > 0) {
        const firstCall = toolCalls[0];
        if (firstCall) {
          actualChanges = firstCall.args as Record<string, unknown>;
        }
      } else if (toolCallArgs) {
        actualChanges = toolCallArgs;
      } else if (stateChange) {
        // Compute diff between before and after
        actualChanges = {};
        for (const [field, afterValue] of Object.entries(stateChange.after)) {
          const beforeValue = stateChange.before[field];
          if (!valuesEqual(beforeValue, afterValue, tol)) {
            actualChanges[field] = afterValue;
          }
        }
      }

      if (Object.keys(actualChanges).length === 0) {
        return 0; // No changes detected
      }

      // Check expected changes
      let correctChanges = 0;
      let incorrectChanges = 0;

      for (const expected of expectedChanges) {
        const actualValue = actualChanges[expected.field];

        if (actualValue === undefined) {
          // Expected field not changed
          incorrectChanges++;
          continue;
        }

        if (valuesEqual(expected.newValue, actualValue, tol)) {
          correctChanges++;
        } else {
          incorrectChanges++;
        }
      }

      // Check unchanged fields
      let incorrectlyChangedFields = 0;

      for (const field of unchangedFields) {
        if (actualChanges[field] !== undefined) {
          // Field was changed but should have remained unchanged
          incorrectlyChangedFields++;
        }
      }

      // Calculate score
      if (strict && (incorrectChanges > 0 || incorrectlyChangedFields > 0)) {
        return 0; // Strict mode: any error is failure
      }

      const totalExpected = expectedChanges.length;
      const correctRatio = totalExpected > 0 ? correctChanges / totalExpected : 1;

      // Apply penalties
      let score = correctRatio;

      if (incorrectlyChangedFields > 0) {
        const unchangedPenalty = (incorrectlyChangedFields / (unchangedFields.length || 1)) * 0.3;
        score -= unchangedPenalty;
      }

      return Math.min(1, Math.max(0, score));
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, TContainer>;
}

/**
 * Check if two values are equal (with tolerance for numbers)
 */
function valuesEqual(val1: unknown, val2: unknown, tolerance: number): boolean {
  if (val1 === val2) return true;

  // Numeric comparison with tolerance
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return Math.abs(val1 - val2) <= tolerance;
  }

  // Object comparison
  if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
    return JSON.stringify(val1) === JSON.stringify(val2);
  }

  return false;
}
