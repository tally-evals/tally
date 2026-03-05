/**
 * Event Timing Accuracy Metric
 *
 * A code-based single-turn metric that measures whether income/expense events
 * occur on the correct dates according to their schedules.
 *
 * Evaluates whether generated event occurrences match expected dates based on
 * recurring schedules (weekly, monthly, biweekly, etc.).
 *
 * Requires DatasetItem with metadata containing generated events and expected dates.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';

/**
 * Event occurrence
 */
export interface EventOccurrence {
  date: string; // ISO date string
  type: 'income' | 'bill' | 'expense' | 'subscription';
  name: string;
  amount?: number;
}

/**
 * Expected event dates for a named entity
 */
export interface ExpectedEventDates {
  [entityName: string]: string[]; // Array of ISO date strings
}

/**
 * Metadata structure for event timing evaluation
 */
export interface EventTimingMetadata {
  /**
   * Generated event occurrences from the system
   */
  generatedEvents: EventOccurrence[];
  /**
   * Expected event dates (ground truth) organized by entity name
   */
  expectedEventDates: ExpectedEventDates;
  /**
   * Allow off-by-one day errors (for edge cases like weekend adjustments)
   * @default false
   */
  allowOffByOne?: boolean;
}

export interface EventTimingOptions {
  /**
   * Allow events to be off by one day (for weekend/holiday adjustments)
   * @default false
   */
  allowOffByOne?: boolean;
  /**
   * Penalize extra unexpected events
   * @default true
   */
  penalizeExtraEvents?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create an event timing accuracy metric
 *
 * Measures whether income/expense events occur on correct dates.
 * Compares generated event occurrences against expected dates.
 *
 * Scoring:
 * - 1.0: All events occur on correct dates
 * - Proportional: Fraction of correctly timed events
 * - Penalty: Applied for missing expected events or extra unexpected events
 * - 0.0: No events correctly timed
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for event timing accuracy
 */
export function createEventTimingMetric(
  options: EventTimingOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const { allowOffByOne = false, penalizeExtraEvents = true, aggregators } = options;

  const base = defineBaseMetric({
    name: 'eventTimingAccuracy',
    valueType: 'number',
    description:
      'Measures whether income/expense events occur on correct dates according to schedules',
    metadata: {
      allowOffByOne,
      penalizeExtraEvents,
    },
  });

  const metric = defineSingleTurnCode<number, DatasetItem>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: DatasetItem) => {
      const item = selected;

      // Extract event timing data from metadata
      const metadata = item.metadata as EventTimingMetadata | undefined;

      const generatedEvents = metadata?.generatedEvents ?? [];
      const expectedEventDates = metadata?.expectedEventDates ?? {};
      const metadataAllowOffByOne = metadata?.allowOffByOne ?? allowOffByOne;

      return {
        generatedEvents,
        expectedEventDates,
        allowOffByOne: metadataAllowOffByOne,
        penalizeExtraEvents,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            generatedEvents: EventOccurrence[];
            expectedEventDates: ExpectedEventDates;
            allowOffByOne: boolean;
            penalizeExtraEvents: boolean;
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const {
        generatedEvents,
        expectedEventDates,
        allowOffByOne: offByOne,
        penalizeExtraEvents: penalizeExtra,
      } = payload;

      // Count total expected events
      const totalExpectedEvents = Object.values(expectedEventDates).reduce(
        (sum, dates) => sum + dates.length,
        0
      );

      if (totalExpectedEvents === 0) {
        return 1.0; // No events to evaluate
      }

      // Group generated events by entity name
      const generatedByName = new Map<string, EventOccurrence[]>();
      for (const event of generatedEvents) {
        const existing = generatedByName.get(event.name) ?? [];
        existing.push(event);
        generatedByName.set(event.name, existing);
      }

      let correctEvents = 0;
      const totalGenerated = generatedEvents.length;
      const totalExpected = totalExpectedEvents;

      // Check each expected entity and its dates
      for (const [entityName, expectedDates] of Object.entries(expectedEventDates)) {
        const generatedForEntity = generatedByName.get(entityName) ?? [];

        // Match each expected date
        const matchedGenerated = new Set<number>();

        for (const expectedDate of expectedDates) {
          let found = false;

          for (let j = 0; j < generatedForEntity.length; j++) {
            if (matchedGenerated.has(j)) continue;

            const generatedEvent = generatedForEntity[j];
            if (!generatedEvent) continue;

            if (datesMatch(expectedDate, generatedEvent.date, offByOne)) {
              correctEvents++;
              matchedGenerated.add(j);
              found = true;
              break;
            }
          }

          if (!found) {
            // Expected event not found - this is an error
          }
        }
      }

      // Calculate base accuracy
      const accuracy = totalExpected > 0 ? correctEvents / totalExpected : 0;

      // Apply penalty for extra events if configured
      if (penalizeExtra && totalGenerated > totalExpected) {
        const extraEvents = totalGenerated - totalExpected;
        const penalty = (extraEvents / totalGenerated) * 0.3; // Max 30% penalty
        return Math.max(0, accuracy - penalty);
      }

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
 * Check if two dates match (with optional off-by-one tolerance)
 */
function datesMatch(date1: string, date2: string, allowOffByOne: boolean): boolean {
  if (date1 === date2) {
    return true;
  }

  if (!allowOffByOne) {
    return false;
  }

  // Parse dates and check if they're within 1 day
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= 1;
}
