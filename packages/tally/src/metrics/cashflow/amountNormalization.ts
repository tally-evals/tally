/**
 * Amount Normalization Accuracy Metric
 *
 * A code-based single-turn metric that measures accuracy of normalizing shorthand
 * amount expressions (e.g., "45k", "$2.5k", "three hundred") to numeric values.
 *
 * Evaluates whether extracted amounts from tool calls match expected normalized values.
 * Supports DatasetItem containers with metadata containing expected amounts.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Metadata structure for amount normalization evaluation
 */
export interface AmountNormalizationMetadata {
  /**
   * Expected normalized amount(s)
   * Can be a single number or array of numbers if multiple amounts expected
   */
  expectedAmount: number | number[];
  /**
   * Raw amount expression from user input
   */
  rawExpression?: string;
  /**
   * Tolerance for floating point comparison (default: 0.01)
   */
  tolerance?: number;
}

export interface AmountNormalizationOptions {
  /**
   * Field name(s) to extract amount from in tool call args
   * @default ['amount', 'cost', 'price', 'value']
   */
  amountFields?: string[];
  /**
   * Tolerance for numeric comparison
   * @default 0.01
   */
  tolerance?: number;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create an amount normalization accuracy metric
 *
 * Measures accuracy of normalizing shorthand amounts to numeric values.
 * Compares extracted amounts from tool calls against expected values.
 *
 * Scoring:
 * - 1.0: All amounts correctly normalized (within tolerance)
 * - Proportional: Fraction of correctly normalized amounts
 * - 0.0: No amounts correctly normalized
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for amount normalization accuracy
 */
export function createAmountNormalizationMetric(
  options: AmountNormalizationOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const {
    amountFields = ['amount', 'cost', 'price', 'value'],
    tolerance = 0.01,
    aggregators,
  } = options;

  const base = defineBaseMetric({
    name: 'amountNormalizationAccuracy',
    valueType: 'number',
    description:
      'Measures accuracy of normalizing shorthand amount expressions (e.g., "45k") to numeric values',
    metadata: {
      amountFields,
      tolerance,
    },
  });

  const metric = defineSingleTurnCode<number, DatasetItem>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: DatasetItem) => {
      const item = selected;

      // Extract tool calls from completion
      let toolCalls: ExtractedToolCall[] = [];

      if (
        typeof item.completion === 'object' &&
        item.completion !== null &&
        'role' in item.completion &&
        'content' in item.completion
      ) {
        const outputMessage = item.completion as ModelMessage;
        toolCalls = extractToolCalls(outputMessage);
      }

      // Extract expected amounts from metadata
      const metadata = item.metadata as AmountNormalizationMetadata | undefined;
      let expectedAmounts: number[] = [];

      if (metadata?.expectedAmount !== undefined) {
        expectedAmounts = Array.isArray(metadata.expectedAmount)
          ? metadata.expectedAmount
          : [metadata.expectedAmount];
      }

      const metadataTolerance = metadata?.tolerance ?? tolerance;

      return {
        toolCalls,
        expectedAmounts,
        tolerance: metadataTolerance,
        amountFields,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            expectedAmounts: number[];
            tolerance: number;
            amountFields: string[];
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const { toolCalls, expectedAmounts, tolerance: tol, amountFields: fields } = payload;

      if (expectedAmounts.length === 0) {
        return 1.0; // No amounts to normalize
      }

      // Extract all amounts from tool calls
      const extractedAmounts: number[] = [];

      for (const toolCall of toolCalls) {
        const args = toolCall.args as Record<string, unknown>;

        for (const field of fields) {
          const value = args[field];
          if (typeof value === 'number') {
            extractedAmounts.push(value);
          }
        }
      }

      if (extractedAmounts.length === 0) {
        return 0; // No amounts extracted
      }

      // Match extracted amounts to expected amounts
      const matchedExpected = new Set<number>();
      const matchedExtracted = new Set<number>();

      for (let i = 0; i < expectedAmounts.length; i++) {
        const expected = expectedAmounts[i];
        if (expected === undefined) continue;

        for (let j = 0; j < extractedAmounts.length; j++) {
          if (matchedExtracted.has(j)) continue;

          const extracted = extractedAmounts[j];
          if (extracted === undefined) continue;

          // Check if amounts match within tolerance
          if (Math.abs(expected - extracted) <= tol) {
            matchedExpected.add(i);
            matchedExtracted.add(j);
            break;
          }
        }
      }

      // Calculate accuracy based on expected amounts
      const correctCount = matchedExpected.size;
      const totalExpected = expectedAmounts.length;

      const accuracy = correctCount / totalExpected;

      return Math.min(1, Math.max(0, accuracy));
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
