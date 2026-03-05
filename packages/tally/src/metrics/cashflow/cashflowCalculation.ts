/**
 * Cashflow Calculation Accuracy Metric
 *
 * A code-based single-turn metric that measures arithmetic correctness of
 * day-by-day (or period-by-period) cashflow calculations.
 *
 * Evaluates whether generated cashflow schedules match expected values by comparing
 * balances, transactions, and running totals.
 *
 * Requires DatasetItem with metadata containing both generated and expected cashflow data.
 */

import type { DatasetItem, NumericAggregatorDef, SingleTurnMetricDef } from '@tally/core/types';
import { defineBaseMetric, defineSingleTurnCode } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';

/**
 * Cashflow entry for a specific date/period
 */
export interface CashflowEntry {
  date: string; // ISO date string
  balance: number;
  events?: Array<{
    type: 'income' | 'expense' | 'bill' | 'transfer';
    name?: string;
    amount: number;
  }>;
}

/**
 * Metadata structure for cashflow calculation evaluation
 */
export interface CashflowCalculationMetadata {
  /**
   * Generated cashflow schedule from the system
   */
  generatedCashflow: CashflowEntry[];
  /**
   * Expected cashflow schedule (ground truth)
   */
  expectedCashflow: CashflowEntry[];
  /**
   * Tolerance for balance comparison
   * @default 0.01
   */
  tolerance?: number;
  /**
   * Whether to check event details or just balances
   * @default false (check balances only)
   */
  checkEventDetails?: boolean;
}

export interface CashflowCalculationOptions {
  /**
   * Tolerance for numeric comparison of balances
   * @default 0.01
   */
  tolerance?: number;
  /**
   * Verify event details in addition to balances
   * @default false
   */
  checkEventDetails?: boolean;
  /**
   * Aggregators to apply to the metric
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a cashflow calculation accuracy metric
 *
 * Measures arithmetic correctness of cashflow calculations.
 * Compares generated cashflow schedule against expected values.
 *
 * Scoring:
 * - 1.0: All balances match expected values (within tolerance)
 * - Proportional: Fraction of correctly calculated balances
 * - 0.0: No balances match expected values
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for cashflow calculation accuracy
 */
export function createCashflowCalculationMetric(
  options: CashflowCalculationOptions = {}
): SingleTurnMetricDef<number, DatasetItem> {
  const { tolerance = 0.01, checkEventDetails = false, aggregators } = options;

  const base = defineBaseMetric({
    name: 'cashflowCalculationAccuracy',
    valueType: 'number',
    description: 'Measures arithmetic correctness of day-by-day cashflow balance calculations',
    metadata: {
      tolerance,
      checkEventDetails,
    },
  });

  const metric = defineSingleTurnCode<number, DatasetItem>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected: DatasetItem) => {
      const item = selected;

      // Extract cashflow data from metadata
      const metadata = item.metadata as CashflowCalculationMetadata | undefined;

      const generatedCashflow = metadata?.generatedCashflow ?? [];
      const expectedCashflow = metadata?.expectedCashflow ?? [];
      const metadataTolerance = metadata?.tolerance ?? tolerance;
      const metadataCheckEvents = metadata?.checkEventDetails ?? checkEventDetails;

      return {
        generatedCashflow,
        expectedCashflow,
        tolerance: metadataTolerance,
        checkEventDetails: metadataCheckEvents,
      };
    },
    compute: ({ data }: { data: unknown }) => {
      const payload = data as
        | {
            generatedCashflow: CashflowEntry[];
            expectedCashflow: CashflowEntry[];
            tolerance: number;
            checkEventDetails: boolean;
          }
        | undefined;

      if (!payload) {
        return 0;
      }

      const {
        generatedCashflow,
        expectedCashflow,
        tolerance: tol,
        checkEventDetails: checkEvents,
      } = payload;

      if (expectedCashflow.length === 0) {
        return 1.0; // No cashflow to evaluate
      }

      if (generatedCashflow.length === 0) {
        return 0; // No cashflow generated
      }

      // Match entries by date
      const expectedByDate = new Map<string, CashflowEntry>();
      for (const entry of expectedCashflow) {
        expectedByDate.set(entry.date, entry);
      }

      const generatedByDate = new Map<string, CashflowEntry>();
      for (const entry of generatedCashflow) {
        generatedByDate.set(entry.date, entry);
      }

      let correctBalances = 0;
      let correctEvents = 0;
      const totalExpectedDates = expectedCashflow.length;
      let totalExpectedEvents = 0;

      // Check each expected date
      for (const [date, expectedEntry] of expectedByDate) {
        const generatedEntry = generatedByDate.get(date);

        if (!generatedEntry) {
          continue; // Date not found in generated cashflow
        }

        // Check balance accuracy
        const balanceMatch = Math.abs(expectedEntry.balance - generatedEntry.balance) <= tol;
        if (balanceMatch) {
          correctBalances++;
        }

        // Check event details if requested
        if (checkEvents && expectedEntry.events && generatedEntry.events) {
          const expectedEvents = expectedEntry.events;
          const generatedEvents = generatedEntry.events;

          totalExpectedEvents += expectedEvents.length;

          // Match events by type and amount
          const matchedGenerated = new Set<number>();

          for (const expectedEvent of expectedEvents) {
            for (let j = 0; j < generatedEvents.length; j++) {
              if (matchedGenerated.has(j)) continue;

              const generatedEvent = generatedEvents[j];
              if (!generatedEvent) continue;

              const typeMatch = expectedEvent.type === generatedEvent.type;
              const amountMatch = Math.abs(expectedEvent.amount - generatedEvent.amount) <= tol;
              const nameMatch =
                !expectedEvent.name ||
                !generatedEvent.name ||
                expectedEvent.name === generatedEvent.name;

              if (typeMatch && amountMatch && nameMatch) {
                correctEvents++;
                matchedGenerated.add(j);
                break;
              }
            }
          }
        }
      }

      // Calculate accuracy score
      const balanceAccuracy = correctBalances / totalExpectedDates;

      if (checkEvents && totalExpectedEvents > 0) {
        const eventAccuracy = correctEvents / totalExpectedEvents;
        // Weighted: 70% balance, 30% events
        return Math.min(1, Math.max(0, balanceAccuracy * 0.7 + eventAccuracy * 0.3));
      }

      return Math.min(1, Math.max(0, balanceAccuracy));
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
