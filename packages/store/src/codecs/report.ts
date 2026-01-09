import { ZodIssueCode } from 'zod/v3';
import z from 'zod/v4';

const BaseMetricDefSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    valueType: z.enum(['number', 'ordinal', 'boolean', 'string']),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());

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
  .catchall(z.unknown());

const TargetVerdictSchema = z
  .object({
    verdict: z.enum(['pass', 'fail', 'unknown']),
    score: z.number().min(0).max(1),
    rawValue: z
      .union([z.number(), z.boolean(), z.string(), z.null()])
      .optional(),
  })
  .catchall(z.unknown());

const DerivedMetricSchema = z
  .object({
    definition: BaseMetricDefSchema,
    value: z.number().min(0).max(1),
  })
  .catchall(z.unknown());

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
  .catchall(z.unknown());

const PercentilesSchema = z
  .object({
    p50: z.number().min(0).max(1),
    p75: z.number().min(0).max(1),
    p90: z.number().min(0).max(1),
    p95: z.number().min(0).max(1),
    p99: z.number().min(0).max(1),
  })
  .catchall(z.unknown());

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
  .catchall(z.unknown());

const AggregateSummarySchema = z
  .object({
    metric: BaseMetricDefSchema,
    aggregations: BuiltInAggregationsSchema,
    count: z.number(),
    average: z.number().min(0).max(1).optional(),
    percentile: z.record(z.number(), z.number()).optional(),
  })
  .catchall(z.unknown());

const VerdictSummarySchema = z
  .object({
    passRate: z.number().min(0).max(1),
    failRate: z.number().min(0).max(1),
    passCount: z.number(),
    failCount: z.number(),
    totalCount: z.number(),
  })
  .catchall(z.unknown());

const EvalSummaryEntrySchema = z
  .object({
    evalName: z.string(),
    evalKind: z.enum(['singleTurn', 'multiTurn', 'scorer']),
    aggregations: BuiltInAggregationsSchema,
    verdictSummary: VerdictSummarySchema.optional(),
  })
  .catchall(z.unknown());

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
    metricToEvalMap: z.union([
      z.record(z.string(), z.string()).optional(),
      z.map(z.string(), z.string()).optional(),
    ]),
    metadata: z.record(z.string(), z.unknown()),
  })
  .catchall(z.unknown());

export const EvaluationReportCodec = z.codec(
  z.string(),
  EvaluationReportSchema,
  {
    decode: (content, ctx) => {
      try {
        const parsed = JSON.parse(content);

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

        const result = EvaluationReportSchema.safeParse(parsed);
        if (!result.success) {
          result.error.issues.forEach((issue) =>
            ctx.issues.push({
              ...issue,
              message: `Report validation error: ${issue.message}`,
              input: parsed,
            }),
          );
          return z.NEVER;
        }

        return result.data;
      } catch (err) {
        ctx.issues.push({
          code: ZodIssueCode.custom,
          message: `Invalid JSON: ${(err as Error).message}`,
          input: content,
        });
        return z.NEVER;
      }
    },

    encode: (report: any) => {
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
        perTargetResults: report.perTargetResults.map((result: any) => ({
          ...result,
          verdicts:
            result.verdicts instanceof Map
              ? Object.fromEntries(result.verdicts)
              : result.verdicts,
        })),
      };

      return JSON.stringify(serializable, null, 2);
    },
  },
);
