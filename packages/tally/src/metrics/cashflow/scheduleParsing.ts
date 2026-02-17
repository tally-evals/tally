/**
 * Cadence/Schedule Parsing Accuracy Metric
 *
 * A code-based single-turn metric that measures accuracy of parsing schedule/cadence
 * expressions (e.g., "biweekly", "1st of every month") to canonical schedule formats.
 *
 * Evaluates whether extracted schedule strings from tool calls match expected formats.
 * Supports DatasetItem containers with metadata containing expected schedules.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { type ExtractedToolCall, extractToolCalls } from '../common/utils';

/**
 * Metadata structure for schedule parsing evaluation
 */
export interface ScheduleParsingMetadata {
  /**
   * Expected normalized schedule(s)
   * Can be a single string or array of strings if multiple schedules expected
   */
  expectedSchedule: string | string[];
  /**
   * Raw schedule expression from user input
   */
  rawExpression?: string;
  /**
   * Allow semantic equivalents (e.g., "biweekly" === "every_2_weeks")
   * @default true
   */
  allowSemanticMatch?: boolean;
}

export interface ScheduleParsingOptions {
  /**
   * Field name(s) to extract schedule from in tool call args
   * @default ['schedule', 'cadence', 'frequency', 'recurrence']
   */
  scheduleFields?: string[];
  /**
   * Allow semantic matching of equivalent schedules
   * @default true
   */
  allowSemanticMatch?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a schedule parsing accuracy metric
 *
 * Measures accuracy of parsing schedule/cadence expressions to canonical formats.
 * Compares extracted schedules from tool calls against expected values.
 *
 * Scoring:
 * - 1.0: All schedules correctly parsed
 * - Proportional: Fraction of correctly parsed schedules
 * - 0.0: No schedules correctly parsed
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for schedule parsing accuracy
 */
export function createScheduleParsingMetric(
  options: ScheduleParsingOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const {
    scheduleFields = ['schedule', 'cadence', 'frequency', 'recurrence'],
    allowSemanticMatch = true,
    aggregators,
  } = options;

  const base = defineBaseMetric({
    name: 'scheduleParsingAccuracy',
    valueType: 'number',
    description:
      'Measures accuracy of parsing schedule/cadence expressions (e.g., "biweekly") to canonical formats',
    metadata: {
      scheduleFields,
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

      // Extract expected schedules from metadata
      const metadata = item.metadata as ScheduleParsingMetadata | undefined;
      let expectedSchedules: string[] = [];

      if (metadata?.expectedSchedule !== undefined) {
        expectedSchedules = Array.isArray(metadata.expectedSchedule)
          ? metadata.expectedSchedule
          : [metadata.expectedSchedule];
      }

      const semanticMatch = metadata?.allowSemanticMatch ?? allowSemanticMatch;

      return {
        toolCalls,
        expectedSchedules,
        semanticMatch,
        scheduleFields,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            toolCalls: ExtractedToolCall[];
            expectedSchedules: string[];
            semanticMatch: boolean;
            scheduleFields: string[];
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const { toolCalls, expectedSchedules, semanticMatch, scheduleFields: fields } = payload;

      if (expectedSchedules.length === 0) {
        return 1.0; // No schedules to parse
      }

      // Extract all schedules from tool calls
      const extractedSchedules: string[] = [];

      for (const toolCall of toolCalls) {
        const args = toolCall.args as Record<string, unknown>;

        for (const field of fields) {
          const value = args[field];
          if (typeof value === 'string') {
            extractedSchedules.push(value);
          }
        }
      }

      if (extractedSchedules.length === 0) {
        return 0; // No schedules extracted
      }

      // Match extracted schedules to expected schedules
      const matchedExpected = new Set<number>();
      const matchedExtracted = new Set<number>();

      for (let i = 0; i < expectedSchedules.length; i++) {
        const expected = expectedSchedules[i];
        if (!expected) continue;

        for (let j = 0; j < extractedSchedules.length; j++) {
          if (matchedExtracted.has(j)) continue;

          const extracted = extractedSchedules[j];
          if (!extracted) continue;

          // Check if schedules match
          let matches = false;

          if (expected === extracted) {
            matches = true;
          } else if (semanticMatch && schedulesAreSemanticallyEquivalent(expected, extracted)) {
            matches = true;
          }

          if (matches) {
            matchedExpected.add(i);
            matchedExtracted.add(j);
            break;
          }
        }
      }

      // Calculate accuracy based on expected schedules
      const correctCount = matchedExpected.size;
      const totalExpected = expectedSchedules.length;

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
 * Check if two schedule strings are semantically equivalent
 */
function schedulesAreSemanticallyEquivalent(schedule1: string, schedule2: string): boolean {
  const s1 = normalizeSchedule(schedule1);
  const s2 = normalizeSchedule(schedule2);

  return s1 === s2;
}

/**
 * Normalize schedule string to canonical format for comparison
 */
function normalizeSchedule(schedule: string): string {
  const lower = schedule.toLowerCase().replace(/[_-]/g, '');

  // Map common variations
  const equivalents: Record<string, string> = {
    biweekly: 'every2weeks',
    every2weeks: 'every2weeks',
    everyotherweek: 'every2weeks',
    semimonthly: 'twicemonthly',
    twicemonthly: 'twicemonthly',
    weekly: 'everyweek',
    everyweek: 'everyweek',
    monthly: 'everymonth',
    everymonth: 'everymonth',
    daily: 'everyday',
    everyday: 'everyday',
    annually: 'everyyear',
    yearly: 'everyyear',
    everyyear: 'everyyear',
  };

  return equivalents[lower] || lower;
}
