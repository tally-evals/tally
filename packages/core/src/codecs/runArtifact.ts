/**
 * Tally Run Artifact Codec
 *
 * Zod-based codec for serializing/deserializing TallyRunArtifact to/from JSON.
 * Intended for read-only tooling (TUI / viewer) and stable persisted schema.
 */

import { z } from 'zod';
import type { TallyRunArtifact } from '../types/runArtifact';

const MetricScalarOrNullSchema = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.null(),
]);

const MeasurementSchema = z
  .object({
    metricRef: z.string(),
    score: z.number().min(0).max(1).optional(),
    rawValue: MetricScalarOrNullSchema.optional(),
    confidence: z.number().optional(),
    reasoning: z.string().optional(),
    executionTimeMs: z.number().optional(),
    timestamp: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

// NOTE: We intentionally use a plain union here (not discriminatedUnion on `kind`)
// because `kind: "number"` has multiple shapes (threshold vs range).
const VerdictPolicyInfoSchema = z.union([
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('boolean'), passWhen: z.boolean() }),
  z.object({
    kind: z.literal('number'),
    type: z.literal('threshold'),
    passAt: z.number(),
    inclusive: z.literal(true).optional(),
  }),
  z.object({
    kind: z.literal('number'),
    type: z.literal('range'),
    min: z.number().optional(),
    max: z.number().optional(),
    inclusive: z.literal(true).optional(),
  }),
  z.object({
    kind: z.literal('ordinal'),
    passWhenIn: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('custom'),
    note: z.literal('not-serializable'),
  }),
]);

const EvalOutcomeSchema = z
  .object({
    verdict: z.enum(['pass', 'fail', 'unknown']),
    policy: VerdictPolicyInfoSchema,
    observed: z
      .object({
        rawValue: MetricScalarOrNullSchema.optional(),
        score: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .passthrough();

const StepEvalResultSchema = z
  .object({
    evalRef: z.string(),
    measurement: MeasurementSchema,
    outcome: EvalOutcomeSchema.optional(),
  })
  .passthrough();

const ConversationEvalResultSchema = z
  .object({
    evalRef: z.string(),
    measurement: MeasurementSchema,
    outcome: EvalOutcomeSchema.optional(),
  })
  .passthrough();

const SingleTurnEvalSeriesSchema = z
  .object({
    byStepIndex: z.array(StepEvalResultSchema.nullable()),
  })
  .passthrough();

const AggregationsSchema = z.record(
  z.string(),
  z.union([z.number(), z.record(z.string(), z.number())])
);

const VerdictSummarySchema = z
  .object({
    passRate: z.number().min(0).max(1),
    failRate: z.number().min(0).max(1),
    unknownRate: z.number().min(0).max(1),
    passCount: z.number(),
    failCount: z.number(),
    unknownCount: z.number(),
    totalCount: z.number(),
  })
  .passthrough();

const EvalSummarySnapSchema = z
  .object({
    eval: z.string(),
    kind: z.enum(['singleTurn', 'multiTurn', 'scorer']),
    count: z.number(),
    aggregations: z
      .object({
        score: AggregationsSchema,
        raw: AggregationsSchema.optional(),
      })
      .optional(),
    verdictSummary: VerdictSummarySchema.optional(),
  })
  .passthrough();

const SummariesSchema = z
  .object({
    byEval: z.record(z.string(), EvalSummarySnapSchema),
  })
  .passthrough();

const MetricDefSnapSchema = z
  .object({
    name: z.string(),
    scope: z.enum(['single', 'multi']),
    valueType: z.enum(['number', 'boolean', 'string', 'ordinal']),
    description: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    llm: z
      .object({
        provider: z.record(z.string(), z.unknown()).optional(),
        prompt: z
          .object({
            instruction: z.string(),
            variables: z.array(z.string()).optional(),
          })
          .optional(),
        rubric: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    aggregators: z
      .array(
        z.object({
          kind: z.string(),
          name: z.string(),
          description: z.string().optional(),
          config: z.unknown().optional(),
        })
      )
      .optional(),
    normalization: z.unknown().optional(),
  })
  .passthrough();

const EvalDefSnapSchema = z
  .object({
    name: z.string(),
    kind: z.enum(['singleTurn', 'multiTurn', 'scorer']),
    outputShape: z.enum(['seriesByStepIndex', 'scalar']),
    metric: z.string(),
    scorerRef: z.string().optional(),
    verdict: VerdictPolicyInfoSchema.optional(),
    description: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ScorerInputSnapSchema = z
  .object({
    metricRef: z.string(),
    weight: z.number(),
    required: z.boolean().optional(),
    hasNormalizerOverride: z.boolean().optional(),
  })
  .passthrough();

const ScorerDefSnapSchema = z
  .object({
    name: z.string(),
    inputs: z.array(ScorerInputSnapSchema),
    normalizeWeights: z.boolean().optional(),
    fallbackScore: z.number().min(0).max(1).optional(),
    combine: z
      .object({
        kind: z.enum(['weightedAverage', 'identity', 'custom', 'unknown']),
        note: z.string().optional(),
      })
      .optional(),
    description: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const RunDefsSchema = z
  .object({
    metrics: z.record(z.string(), MetricDefSnapSchema),
    evals: z.record(z.string(), EvalDefSnapSchema),
    scorers: z.record(z.string(), ScorerDefSnapSchema),
  })
  .passthrough();

const ConversationResultSchema = z
  .object({
    stepCount: z.number(),
    singleTurn: z.record(z.string(), SingleTurnEvalSeriesSchema),
    multiTurn: z.record(z.string(), ConversationEvalResultSchema),
    scorers: z.record(
      z.string(),
      z.union([
        z.object({
          shape: z.literal('seriesByStepIndex'),
          series: SingleTurnEvalSeriesSchema,
        }),
        z.object({
          shape: z.literal('scalar'),
          result: ConversationEvalResultSchema,
        }),
      ])
    ),
    summaries: SummariesSchema.optional(),
  })
  .passthrough();

const StoreLocatorSchema = z
  .object({
    backend: z.enum(['local', 's2', 'redis']),
    basePath: z.string(),
  })
  .passthrough();

const ArtifactsLocatorSchema = z
  .object({
    conversationId: z.string(),
    runPath: z.string().optional(),
    conversationJsonlPath: z.string().optional(),
    stepTracesPath: z.string().optional(),
  })
  .passthrough();

const TallyRunArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string(),
    createdAt: z.string(),
    store: StoreLocatorSchema.optional(),
    artifacts: ArtifactsLocatorSchema.optional(),
    defs: RunDefsSchema,
    result: ConversationResultSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export function decodeRunArtifact(content: string): TallyRunArtifact {
  const parsed = JSON.parse(content);
  return TallyRunArtifactSchema.parse(parsed) as TallyRunArtifact;
}

export function encodeRunArtifact(artifact: TallyRunArtifact): string {
  // Validate before encoding for deterministic stored artifacts
  const parsed = TallyRunArtifactSchema.parse(artifact);
  return JSON.stringify(parsed, null, 2);
}

