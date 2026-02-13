/**
 * Date/Due Date Parsing Accuracy Metric
 *
 * A code-based single-turn metric that measures accuracy of parsing due date
 * expressions (e.g., "5th of every month", "end of month") to canonical date rule formats.
 *
 * Evaluates whether extracted date rules from tool calls match expected formats.
 * Supports DatasetItem containers with metadata containing expected date rules.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Metadata structure for date parsing evaluation
 */
export interface DateParsingMetadata {
  /**
   * Expected normalized date rule(s)
   * Can be a single string or array of strings if multiple dates expected
   */
  expectedDateRule: string | string[];
  /**
   * Raw date expression from user input
   */
  rawExpression?: string;
  /**
   * Allow semantic equivalents (e.g., "monthly_day_-1" === "monthly_day_last")
   * @default true
   */
  allowSemanticMatch?: boolean;
}

export interface DateParsingOptions {
  /**
   * Field name(s) to extract date from in tool call args
   * @default ['dueDateRule', 'dueDate', 'date', 'effectiveDate']
   */
  dateFields?: string[];
  /**
   * Allow semantic matching of equivalent date rules
   * @default true
   */
  allowSemanticMatch?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a date parsing accuracy metric
 *
 * Measures accuracy of parsing due date expressions to canonical date rule formats.
 * Compares extracted date rules from tool calls against expected values.
 *
 * Scoring:
 * - 1.0: All date rules correctly parsed
 * - Proportional: Fraction of correctly parsed date rules
 * - 0.0: No date rules correctly parsed
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for date parsing accuracy
 */
export function createDateParsingMetric(
  options: DateParsingOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const {
    dateFields = ['dueDateRule', 'dueDate', 'date', 'effectiveDate'],
    allowSemanticMatch = true,
    aggregators,
  } = options;

  const base = defineBaseMetric({
    name: 'dateParsingAccuracy',
    valueType: 'number',
    description:
      'Measures accuracy of parsing due date expressions (e.g., "5th of every month") to canonical formats',
    metadata: {
      dateFields,
      allowSemanticMatch,
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

      // Extract expected date rules from metadata
      const metadata = item.metadata as DateParsingMetadata | undefined;
      let expectedDateRules: string[] = [];

      if (metadata?.expectedDateRule !== undefined) {
        expectedDateRules = Array.isArray(metadata.expectedDateRule)
          ? metadata.expectedDateRule
          : [metadata.expectedDateRule];
      }

      const semanticMatch = metadata?.allowSemanticMatch ?? allowSemanticMatch;

      return {
        toolCalls,
        expectedDateRules,
        semanticMatch,
        dateFields,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            expectedDateRules: string[];
            semanticMatch: boolean;
            dateFields: string[];
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const { toolCalls, expectedDateRules, semanticMatch, dateFields: fields } = payload;

      if (expectedDateRules.length === 0) {
        return 1.0; // No date rules to parse
      }

      // Extract all date rules from tool calls
      const extractedDateRules: string[] = [];

      for (const toolCall of toolCalls) {
        const args = toolCall.args as Record<string, unknown>;

        for (const field of fields) {
          const value = args[field];
          if (typeof value === 'string') {
            extractedDateRules.push(value);
          }
        }
      }

      if (extractedDateRules.length === 0) {
        return 0; // No date rules extracted
      }

      // Match extracted date rules to expected date rules
      const matchedExpected = new Set<number>();
      const matchedExtracted = new Set<number>();

      for (let i = 0; i < expectedDateRules.length; i++) {
        const expected = expectedDateRules[i];
        if (!expected) continue;

        for (let j = 0; j < extractedDateRules.length; j++) {
          if (matchedExtracted.has(j)) continue;

          const extracted = extractedDateRules[j];
          if (!extracted) continue;

          // Check if date rules match
          let matches = false;

          if (expected === extracted) {
            matches = true;
          } else if (semanticMatch && dateRulesAreSemanticallyEquivalent(expected, extracted)) {
            matches = true;
          }

          if (matches) {
            matchedExpected.add(i);
            matchedExtracted.add(j);
            break;
          }
        }
      }

      // Calculate accuracy based on expected date rules
      const correctCount = matchedExpected.size;
      const totalExpected = expectedDateRules.length;

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

/**
 * Check if two date rule strings are semantically equivalent
 */
function dateRulesAreSemanticallyEquivalent(rule1: string, rule2: string): boolean {
  const r1 = normalizeDateRule(rule1);
  const r2 = normalizeDateRule(rule2);

  return r1 === r2;
}

/**
 * Normalize date rule string to canonical format for comparison
 */
function normalizeDateRule(rule: string): string {
  const lower = rule.toLowerCase().replace(/[_-]/g, '');

  // Map common variations
  const equivalents: Record<string, string> = {
    monthlyday1: 'monthlyday1',
    monthlybeginning: 'monthlyday1',
    monthlyfirst: 'monthlyday1',
    monthlyday15: 'monthlyday15',
    monthlymid: 'monthlyday15',
    monthlymiddle: 'monthlyday15',
    monthlydaylast: 'monthlydaylast',
    monthlyday31: 'monthlydaylast',
    monthlydayneg1: 'monthlydaylast',
    monthlyend: 'monthlydaylast',
    weeklyfriday: 'weeklyfriday',
    weeklyfri: 'weeklyfriday',
    weeklymonday: 'weeklymonday',
    weeklymon: 'weeklymonday',
  };

  return equivalents[lower] || lower;
}
