/**
 * Entity Extraction Accuracy Metric
 *
 * A code-based single-turn metric that measures accuracy of extracting financial entities
 * (income sources, bills, subscriptions, etc.) from user input. Evaluates precision and recall
 * of entity extraction by comparing tool calls against expected entities.
 *
 * Supports DatasetItem containers with metadata containing expected entities.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Expected entity structure in metadata
 */
export interface ExpectedEntity {
  type: 'income' | 'bill' | 'subscription' | 'budget' | 'activity';
  name?: string;
  amount?: number;
  schedule?: string;
  [key: string]: unknown;
}

/**
 * Metadata structure for entity extraction evaluation
 */
export interface EntityExtractionMetadata {
  expectedEntities: ExpectedEntity[];
  strictMatching?: boolean; // If true, requires exact field matches
}

export interface EntityExtractionOptions {
  /**
   * Tool names to consider for entity extraction
   * @default All tool calls with 'add' prefix
   */
  entityToolNames?: string[];
  /**
   * Require strict field matching (amount, schedule, etc.)
   * @default false
   */
  strictMatching?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create an entity extraction accuracy metric
 *
 * Measures precision and recall of entity extraction from user input.
 * Compares extracted entities (via tool calls) against expected entities.
 *
 * Scoring:
 * - Precision: Correct entities / Total extracted entities
 * - Recall: Correct entities / Total expected entities
 * - F1 Score: Harmonic mean of precision and recall
 *
 * Final score: F1 score (0-1 scale)
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for entity extraction accuracy
 */
export function createEntityExtractionMetric(
  options: EntityExtractionOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const { entityToolNames, strictMatching = false, aggregators } = options;

  const base = defineBaseMetric({
    name: 'entityExtractionAccuracy',
    valueType: 'number',
    description:
      'Measures accuracy of extracting financial entities (income, bills, etc.) from user input',
    metadata: {
      strictMatching,
      entityToolNames,
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

      // Filter to entity-related tool calls if specified
      if (entityToolNames && entityToolNames.length > 0) {
        toolCalls = toolCalls.filter((tc) => entityToolNames.includes(tc.toolName));
      } else {
        // Default: consider tool calls with 'add' prefix (addIncome, addBill, etc.)
        toolCalls = toolCalls.filter((tc) => tc.toolName.startsWith('add'));
      }

      // Extract expected entities from metadata
      const metadata = item.metadata as EntityExtractionMetadata | undefined;
      const expectedEntities = metadata?.expectedEntities ?? [];
      const strictMatch = metadata?.strictMatching ?? strictMatching;

      return {
        toolCalls,
        expectedEntities,
        strictMatch,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            expectedEntities: ExpectedEntity[];
            strictMatch: boolean;
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const { toolCalls, expectedEntities, strictMatch } = payload;

      if (expectedEntities.length === 0 && toolCalls.length === 0) {
        return 1.0; // Perfect score if nothing expected and nothing extracted
      }

      if (expectedEntities.length === 0) {
        return 0; // Extracted entities when none expected
      }

      // Match extracted entities to expected entities
      const matchedExpected = new Set<number>();
      const matchedExtracted = new Set<number>();

      for (let i = 0; i < expectedEntities.length; i++) {
        const expected = expectedEntities[i];
        if (!expected) continue;

        for (let j = 0; j < toolCalls.length; j++) {
          if (matchedExtracted.has(j)) continue; // Already matched

          const toolCall = toolCalls[j];
          if (!toolCall) continue;

          const args = toolCall.args as Record<string, unknown>;

          // Check if entity type matches (based on tool name)
          const entityTypeMatch = checkEntityTypeMatch(toolCall.toolName, expected.type);
          if (!entityTypeMatch) continue;

          // Check if fields match
          let fieldsMatch = true;

          if (strictMatch) {
            // Strict: check all specified fields in expected entity
            for (const [key, expectedValue] of Object.entries(expected)) {
              if (key === 'type') continue; // Already checked

              const actualValue = args[key];
              if (expectedValue !== undefined && actualValue !== expectedValue) {
                fieldsMatch = false;
                break;
              }
            }
          } else {
            // Lenient: check only name or type
            if (expected.name && args.name !== expected.name) {
              fieldsMatch = false;
            }
          }

          if (fieldsMatch) {
            matchedExpected.add(i);
            matchedExtracted.add(j);
            break;
          }
        }
      }

      const correctCount = matchedExpected.size;
      const extractedCount = toolCalls.length;
      const expectedCount = expectedEntities.length;

      // Calculate precision and recall
      const precision = extractedCount > 0 ? correctCount / extractedCount : 0;
      const recall = expectedCount > 0 ? correctCount / expectedCount : 0;

      // Calculate F1 score
      if (precision + recall === 0) {
        return 0;
      }

      const f1 = (2 * precision * recall) / (precision + recall);

      return Math.min(1, Math.max(0, f1));
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}

/**
 * Check if tool name matches expected entity type
 */
function checkEntityTypeMatch(toolName: string, entityType: string): boolean {
  const lowerToolName = toolName.toLowerCase();
  const lowerEntityType = entityType.toLowerCase();

  // Direct match
  if (lowerToolName.includes(lowerEntityType)) {
    return true;
  }

  // Handle variations
  if (
    entityType === 'bill' &&
    (lowerToolName.includes('expense') || lowerToolName.includes('payment'))
  ) {
    return true;
  }

  if (
    entityType === 'income' &&
    (lowerToolName.includes('salary') || lowerToolName.includes('revenue'))
  ) {
    return true;
  }

  return false;
}
