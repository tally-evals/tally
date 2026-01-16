/**
 * Evaluation Report Codec
 *
 * Zod-based codec for serializing/deserializing EvaluationReport to/from JSON.
 * Handles Map serialization and Date parsing.
 */

import { z } from 'zod';

// Schema definitions for report structure
const BaseMetricDefSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    valueType: z.enum(['number', 'ordinal', 'boolean', 'string']),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const MetricSchema = z
  .object({
    metricDef: BaseMetricDefSchema,
    value: z.union([z.number(), z.boolean(), z.string()]),
    confidence: z.number().optional(),
    reasoning: z.string().optional(),
    executionTime: z.number(),
    timestamp: z.union([z.string(), z.date()]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const TargetVerdictSchema = z
  .object({
    verdict: z.enum(['pass', 'fail', 'unknown']),
    score: z.number().min(0).max(1),
    rawValue: z
      .union([z.number(), z.boolean(), z.string(), z.null()])
      .optional(),
  })
  .passthrough();

const DerivedMetricSchema = z
  .object({
    definition: BaseMetricDefSchema,
    value: z.number().min(0).max(1),
  })
  .passthrough();

const PerTargetResultSchema = z
  .object({
    targetId: z.string(),
    rawMetrics: z.array(MetricSchema),
    derivedMetrics: z.array(DerivedMetricSchema),
    verdicts: z.union([
      z.record(z.string(), TargetVerdictSchema),
      z.map(z.string(), TargetVerdictSchema),
    ]),
  })
  .passthrough();

const PercentilesSchema = z
  .object({
    p50: z.number().min(0).max(1),
    p75: z.number().min(0).max(1),
    p90: z.number().min(0).max(1),
    p95: z.number().min(0).max(1),
    p99: z.number().min(0).max(1),
  })
  .passthrough();

const BuiltInAggregationsSchema = z
  .object({
    mean: z.number().min(0).max(1),
    percentiles: z.union([PercentilesSchema, z.array(z.unknown())]),
    passRate: z.number().min(0).max(1).optional(),
    failRate: z.number().min(0).max(1).optional(),
    passCount: z.number().optional(),
    failCount: z.number().optional(),
    distribution: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

const AggregateSummarySchema = z
  .object({
    metric: BaseMetricDefSchema,
    aggregations: z.object({
      score: BuiltInAggregationsSchema,
      raw: BuiltInAggregationsSchema.optional(),
    }),
    count: z.number(),
    average: z.number().min(0).max(1).optional(),
    percentile: z.record(z.number(), z.number()).optional(),
  })
  .passthrough();

const VerdictSummarySchema = z
  .object({
    passRate: z.number().min(0).max(1),
    failRate: z.number().min(0).max(1),
    passCount: z.number(),
    failCount: z.number(),
    totalCount: z.number(),
  })
  .passthrough();

const EvalSummaryEntrySchema = z
  .object({
    evalName: z.string(),
    evalKind: z.enum(['singleTurn', 'multiTurn', 'scorer']),
    aggregations: z.object({
      score: BuiltInAggregationsSchema,
      raw: BuiltInAggregationsSchema.optional(),
    }),
    verdictSummary: VerdictSummarySchema.optional(),
  })
  .passthrough();

const EvaluationReportSchema = z
  .object({
    runId: z.string(),
    timestamp: z.union([z.string(), z.date()]),
    perTargetResults: z.array(PerTargetResultSchema),
    aggregateSummaries: z.array(AggregateSummarySchema),
    evalSummaries: z.union([
      z.record(z.string(), EvalSummaryEntrySchema),
      z.map(z.string(), EvalSummaryEntrySchema),
    ]),
    metricToEvalMap: z
      .union([
        z.record(z.string(), z.string()).optional(),
        z.map(z.string(), z.string()).optional(),
      ])
      .optional(),
    metadata: z.record(z.string(), z.unknown()),
  })
  .passthrough();

// Import the canonical EvaluationReport type from types
import type { EvaluationReport } from '../types/report';

// Re-export for backwards compatibility
export type { EvaluationReport };

/**
 * Decode JSON content to EvaluationReport
 * Converts plain objects to Maps where appropriate
 */
export function decodeReport(content: string): EvaluationReport {
  const parsed = JSON.parse(content);

  // Convert evalSummaries object to Map
  if (
    parsed.evalSummaries &&
    typeof parsed.evalSummaries === 'object' &&
    !(parsed.evalSummaries instanceof Map)
  ) {
    const evalSummariesMap = new Map();
    for (const [key, value] of Object.entries(parsed.evalSummaries)) {
      evalSummariesMap.set(key, value);
    }
    parsed.evalSummaries = evalSummariesMap;
  }

  // Convert metricToEvalMap object to Map
  if (
    parsed.metricToEvalMap &&
    typeof parsed.metricToEvalMap === 'object' &&
    !(parsed.metricToEvalMap instanceof Map)
  ) {
    const metricToEvalMap = new Map();
    for (const [key, value] of Object.entries(parsed.metricToEvalMap)) {
      if (typeof value === 'string') {
        metricToEvalMap.set(key, value);
      }
    }
    parsed.metricToEvalMap = metricToEvalMap;
  }

  // Convert verdicts in perTargetResults to Maps
  if (Array.isArray(parsed.perTargetResults)) {
    for (const result of parsed.perTargetResults) {
      if (
        result.verdicts &&
        typeof result.verdicts === 'object' &&
        !(result.verdicts instanceof Map)
      ) {
        const verdictsMap = new Map();
        for (const [key, value] of Object.entries(result.verdicts)) {
          verdictsMap.set(key, value);
        }
        result.verdicts = verdictsMap;
      }
    }
  }

  // Parse timestamps
  if (typeof parsed.timestamp === 'string') {
    parsed.timestamp = new Date(parsed.timestamp);
  }

  if (Array.isArray(parsed.perTargetResults)) {
    for (const result of parsed.perTargetResults) {
      if (Array.isArray(result.rawMetrics)) {
        for (const metric of result.rawMetrics) {
          if (typeof metric.timestamp === 'string') {
            metric.timestamp = new Date(metric.timestamp);
          }
        }
      }
    }
  }

  const validateResult = EvaluationReportSchema.safeParse(parsed);
  if (!validateResult.success) {
    throw new Error(`Report validation error: ${validateResult.error.message}`);
  }

  return validateResult.data;
}

/**
 * Encode EvaluationReport to JSON content
 * Converts Maps to plain objects for JSON serialization
 */
export function encodeReport(report: EvaluationReport): string {
  const serializable = {
    ...report,
    evalSummaries:
      report.evalSummaries instanceof Map
        ? Object.fromEntries(report.evalSummaries)
        : report.evalSummaries,
    metricToEvalMap: report.metricToEvalMap
      ? report.metricToEvalMap instanceof Map
        ? Object.fromEntries(report.metricToEvalMap)
        : report.metricToEvalMap
      : undefined,
    perTargetResults: report.perTargetResults.map((result) => ({
      ...result,
      verdicts:
        result.verdicts instanceof Map
          ? Object.fromEntries(result.verdicts)
          : result.verdicts,
    })),
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Evaluation Report codec with safe decode/encode methods
 */
export const EvaluationReportCodec = {
  /**
   * Safely decode JSON to EvaluationReport
   */
  safeDecode(
    content: string,
  ):
    | { success: true; data: EvaluationReport }
    | { success: false; error: Error } {
    try {
      const data = decodeReport(content);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  },

  /**
   * Safely encode EvaluationReport to JSON
   */
  safeEncode(
    report: EvaluationReport,
  ): { success: true; data: string } | { success: false; error: Error } {
    try {
      const data = encodeReport(report);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  },

  /**
   * Decode JSON to EvaluationReport (throws on error)
   */
  decode: decodeReport,

  /**
   * Encode EvaluationReport to JSON (throws on error)
   */
  encode: encodeReport,
};
