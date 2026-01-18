/**
 * Evaluation Pipeline
 *
 * Orchestrates the evaluation process:
 * 1. Measure: Execute all metrics (single-turn + multi-turn)
 * 2. Resolve Context: Resolve normalization contexts for each metric
 * 3. Normalize: Transform raw values to Scores
 * 4. Score: Execute scorers to produce derived metrics
 * 5. Compute Verdicts: Calculate pass/fail verdicts for each eval
 * 6. Aggregate: Compute built-in aggregations and eval summaries
 */

import {
  type AggregatorDef,
  type BaseMetricDef,
  type BooleanAggregatorDef,
  type CategoricalAggregatorDef,
  type Conversation,
  type DatasetItem,
  type Metric,
  type MetricContainer,
  type MetricDef,
  type MetricScalar,
  type NumericAggregatorDef,
  type Score,
  type ScoringContext,
  type SingleTargetFor,
  type SingleTurnContainer,
  type SingleTurnRunPolicy,
  toScore,
} from '@tally/core/types';
import { P, match } from 'ts-pattern';
import type { EvalMetadataEntry, InternalEvaluator } from './evals/builder';
import { computeVerdict } from './evals/verdict';
import {
  resolveRunPolicy,
  selectConversationTargets,
  selectDatasetTargets,
} from './evaluators/context';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { ExecutorOptions } from './execution/executors';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { runMultiTurnMetric } from './execution/runMultiTurn';
import type { RunMultiTurnOptions } from './execution/runMultiTurn';
import { runSingleTurnMetrics } from './execution/runSingleTurn';
import type { RunSingleTurnOptions } from './execution/runSingleTurn';
import { applyNormalization } from './normalization/apply';
import { resolveContext } from './normalization/context';

// ============================================================================
// Types
// ============================================================================

/**
 * Pipeline state - immutable intermediate results between phases
 */
export interface PipelineState {
  readonly rawMetrics: ReadonlyMap<string, readonly Metric<MetricScalar>[]>;
  readonly contexts: ReadonlyMap<string, ScoringContext>;
  readonly normalizedScores: ReadonlyMap<string, ReadonlyMap<string, readonly Score[]>>;
  readonly derivedScores: ReadonlyMap<
    string,
    ReadonlyMap<
      string,
      Readonly<{
        scores: readonly Score[];
        rawValues: readonly MetricScalar[];
        outputMetric: BaseMetricDef<number>;
        inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[];
        evalName?: string;
      }>
    >
  >;
  readonly verdicts: ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>>;
  readonly evalSummaries: ReadonlyMap<string, PipelineEvalSummary>;
}

/**
 * Pipeline options
 */
export interface PipelineOptions {
  readonly cache?: MemoryCache<MetricScalar>;
  readonly llmOptions?: GenerateObjectOptions;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Internal verdict record used during pipeline execution.
 *
 * NOTE: This is intentionally an internal shape (not the persisted artifact schema).
 * The persisted schema uses `EvalOutcome` attached to `StepEvalResult` / `ConversationEvalResult`.
 */
export interface PipelineVerdict {
  verdict: 'pass' | 'fail' | 'unknown';
  score: Score;
  rawValue?: MetricScalar;
}

export type PipelineAggregations = Record<string, number | Record<string, number>>;

export interface PipelineVerdictSummary {
  passRate: Score;
  failRate: Score;
  unknownRate: Score;
  passCount: number;
  failCount: number;
  unknownCount: number;
  totalCount: number;
}

export interface PipelineEvalSummary {
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
  aggregations: {
    score: PipelineAggregations;
    raw?: PipelineAggregations;
  };
  verdictSummary?: PipelineVerdictSummary;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  readonly rawMetrics: ReadonlyMap<string, readonly Metric<MetricScalar>[]>;
  readonly derivedScores: ReadonlyMap<string, ReadonlyMap<string, DerivedScoreEntry>>;
  readonly verdicts: ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>>;
  readonly evalSummaries: ReadonlyMap<string, PipelineEvalSummary>;
}

// ============================================================================
// Type Guards using ts-pattern
// ============================================================================

/**
 * Type-safe container matching using ts-pattern
 */
const isConversation = (value: unknown): value is Conversation =>
  match(value)
    .with(
      {
        id: P.string,
        steps: P.array(P.any),
      },
      () => true
    )
    .otherwise(() => false);

const isDatasetItem = (value: unknown): value is DatasetItem =>
  match(value)
    .with(
      {
        id: P.string,
        prompt: P.string,
        completion: P.string,
      },
      () => true
    )
    .otherwise(() => false);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get target ID from container
 */
const getTargetId = (container: DatasetItem | Conversation, index: number): string =>
  match(container)
    .with({ id: P.string }, (c) => c.id)
    .otherwise(() => `target-${index}`);

/**
 * Get unique metrics from evaluators
 */
const getUniqueMetrics = <TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[]
): readonly { metricName: string; metricDef: MetricDef<MetricScalar, TContainer> }[] =>
  Array.from(
    internalEvaluators
      .flatMap(({ metrics }) => metrics)
      .reduce(
        (seen, metric) =>
          seen.has(metric.name)
            ? seen
            : seen.set(metric.name, metric as unknown as MetricDef<MetricScalar, TContainer>),
        new Map<string, MetricDef<MetricScalar, TContainer>>()
      ),
    ([metricName, metricDef]) => ({ metricName, metricDef })
  );

/**
 * Select targets based on run policy
 */
const selectTargets = <TContainer extends DatasetItem | Conversation>(
  container: TContainer,
  policy: SingleTurnRunPolicy | undefined
): readonly SingleTargetFor<TContainer>[] => {
  const effectivePolicy: SingleTurnRunPolicy = policy ?? { run: 'all' };

  return match(container)
    .when(isConversation, (conv) => {
      const result = selectConversationTargets(conv, effectivePolicy);
      return result.targets as readonly SingleTargetFor<TContainer>[];
    })
    .when(isDatasetItem, (item) => {
      const result = selectDatasetTargets([item], effectivePolicy);
      return result.targets as readonly SingleTargetFor<TContainer>[];
    })
    .otherwise(() => [] as readonly SingleTargetFor<TContainer>[]);
};

/**
 * Build executor options
 */
const buildExecutorOptions = (options?: PipelineOptions): ExecutorOptions => ({
  ...(options?.cache !== undefined ? { cache: options.cache } : {}),
  ...(options?.llmOptions !== undefined ? { llmOptions: options.llmOptions } : {}),
});

/**
 * Extract raw values from raw metrics
 */
const extractRawValues = (
  targetId: string,
  outputMetricName: string,
  expectedLength: number,
  rawMetricsMap: ReadonlyMap<string, readonly Metric<MetricScalar>[]>,
  sourceMetrics?: readonly string[]
): readonly MetricScalar[] => {
  const rawMetrics = rawMetricsMap.get(targetId) ?? [];

  // Try source metrics first (single source)
  if (sourceMetrics && sourceMetrics.length === 1) {
    const sourceMetricName = sourceMetrics[0];
    const values = rawMetrics
      .filter((m) => m.metricDef.name === sourceMetricName)
      .map((m) => m.value);
    if (values.length > 0) return values;
  }

  // Try base metric name (without _score suffix)
  const baseMetricName = outputMetricName.replace('_score', '');
  const baseValues = rawMetrics
    .filter((m) => m.metricDef.name === baseMetricName)
    .map((m) => m.value);
  if (baseValues.length > 0) return baseValues;

  // Try exact output metric name
  const exactValues = rawMetrics
    .filter((m) => m.metricDef.name === outputMetricName)
    .map((m) => m.value);
  if (exactValues.length > 0) return exactValues;

  // Return placeholder array
  return new Array(expectedLength).fill(undefined) as MetricScalar[];
};

// ============================================================================
// Phase 1: Measure
// ============================================================================

const phaseMeasure = async <TContainer extends DatasetItem | Conversation>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  options?: PipelineOptions
): Promise<ReadonlyMap<string, readonly Metric<MetricScalar>[]>> => {
  const executorOptions = buildExecutorOptions(options);

  const entries = await Promise.all(
    data.map(async (container, index) => {
      const targetId = getTargetId(container, index);
      const seenMetrics = new Set<string>();

      const metrics = (
        await Promise.all(
          internalEvaluators
            .flatMap(({ metrics, context }) => metrics.map((metricDef) => ({ metricDef, context })))
            .map(async ({ metricDef, context }) => {
              if (seenMetrics.has(metricDef.name)) return [];
              seenMetrics.add(metricDef.name);

              return match(metricDef.scope)
                .with('single', async () => {
                  const policy = resolveRunPolicy(context);
                  const targets = selectTargets(container, policy);
                  return runSingleTurnMetrics(
                    metricDef as MetricDef<MetricScalar, SingleTurnContainer>,
                    targets as unknown as SingleTargetFor<SingleTurnContainer>[],
                    executorOptions satisfies RunSingleTurnOptions
                  );
                })
                .with('multi', async () => {
                  if (!isConversation(container)) return [];
                  return runMultiTurnMetric(
                    metricDef as MetricDef<MetricScalar, Conversation>,
                    container,
                    {
                      ...executorOptions,
                      ...(options?.metadata !== undefined ? { runMetadata: options.metadata } : {}),
                    } satisfies RunMultiTurnOptions
                  );
                })
                .otherwise(() => {
                  throw new Error(`Invalid metric scope: ${metricDef.scope}`);
                });
            })
        )
      ).flat();

      return [targetId, metrics] as const;
    })
  );

  return new Map(entries);
};

// ============================================================================
// Phase 2: Resolve Context
// ============================================================================

const phaseResolveContext = async <TContainer extends DatasetItem | Conversation>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  rawMetrics: ReadonlyMap<string, readonly Metric<MetricScalar>[]>
): Promise<ReadonlyMap<string, ScoringContext>> => {
  const uniqueMetrics = getUniqueMetrics(internalEvaluators);

  const entries = await Promise.all(
    uniqueMetrics.map(async ({ metricName, metricDef }) => {
      const rawValues = Array.from(rawMetrics.values())
        .flat()
        .filter((m) => m.metricDef.name === metricName)
        .map((m) => m.value);

      const context = await resolveContext(metricDef.normalization, data, rawValues, metricName);

      return [metricName, context] as const;
    })
  );

  return new Map(entries);
};

// ============================================================================
// Phase 3: Normalize
// ============================================================================

const phaseNormalize = (
  rawMetrics: ReadonlyMap<string, readonly Metric<MetricScalar>[]>,
  contexts: ReadonlyMap<string, ScoringContext>
): ReadonlyMap<string, ReadonlyMap<string, readonly Score[]>> =>
  new Map(
    Array.from(rawMetrics.entries()).map(([targetId, metrics]) => {
      const scoresByMetric = metrics.reduce((acc, metric) => {
        const context = contexts.get(metric.metricDef.name);
        if (!context) {
          throw new Error(`Missing context for metric: ${metric.metricDef.name}`);
        }

        const score = applyNormalization(
          metric.value,
          metric.metricDef.normalization?.default ?? { type: 'identity' },
          context,
          metric.metricDef as MetricDef<MetricScalar, MetricContainer>
        );

        const existing = acc.get(metric.metricDef.name) ?? [];
        return acc.set(metric.metricDef.name, [...existing, score]);
      }, new Map<string, Score[]>());

      return [targetId, scoresByMetric as ReadonlyMap<string, readonly Score[]>] as const;
    })
  );

// ============================================================================
// Phase 4: Score
// ============================================================================

export type DerivedScoreEntry = Readonly<{
  scores: readonly Score[];
  rawValues: readonly MetricScalar[];
  outputMetric: BaseMetricDef<number>;
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[];
  evalName?: string;
}>;

/**
 * Build input scores for a single index from scorer inputs
 */
const buildInputScoresForIndex = (
  inputs: readonly { metric: MetricDef<MetricScalar, MetricContainer>; required?: boolean }[],
  targetScores: ReadonlyMap<string, readonly Score[]>,
  index: number,
  fallbackScore: Score | undefined,
  scorerName: string,
  targetId: string
): Record<string, Score> =>
  inputs.reduce(
    (acc, input) => {
      const arr = targetScores.get(input.metric.name);
      const score = arr?.at(index) ?? arr?.at(-1) ?? fallbackScore;

      if (score !== undefined) {
        return { ...acc, [input.metric.name]: score };
      }
      if (input.required !== false) {
        throw new Error(
          `Required metric "${input.metric.name}" missing for scorer "${scorerName}" on target "${targetId}"`
        );
      }
      return acc;
    },
    {} as Record<string, Score>
  );

const phaseScore = <TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  evalMetadata: ReadonlyMap<string, EvalMetadataEntry>,
  normalizedScores: ReadonlyMap<string, ReadonlyMap<string, readonly Score[]>>,
  rawMetrics: ReadonlyMap<string, readonly Metric<MetricScalar>[]>
): ReadonlyMap<string, ReadonlyMap<string, DerivedScoreEntry>> =>
  internalEvaluators.reduce((resultMap, { scorer, evalName }) => {
    Array.from(normalizedScores.entries()).forEach(([targetId, targetScores]) => {
      const maxLen = Math.max(
        ...scorer.inputs.map((input) => targetScores.get(input.metric.name)?.length ?? 0)
      );

      const derivedScores: Score[] = Array.from({ length: maxLen }, (_, i) => {
        const inputScores = buildInputScoresForIndex(
          scorer.inputs,
          targetScores,
          i,
          scorer.fallbackScore,
          scorer.name,
          targetId
        );

        if (!scorer.combineScores) {
          throw new Error(`Scorer "${scorer.name}" missing combineScores function`);
        }

        return scorer.combineScores(inputScores);
      });

      const metadata = evalMetadata.get(evalName);
      const sourceMetrics = metadata?.sourceMetrics;

      const rawValues = extractRawValues(
        targetId,
        scorer.output.name,
        derivedScores.length,
        rawMetrics,
        sourceMetrics
      );

      const existing = resultMap.get(targetId) ?? new Map<string, DerivedScoreEntry>();
      existing.set(scorer.name, {
        scores: derivedScores,
        rawValues,
        outputMetric: scorer.output,
        inputMetrics: scorer.inputs.map((input) => input.metric),
        evalName,
      });
      resultMap.set(targetId, existing);
    });

    return resultMap;
  }, new Map<string, Map<string, DerivedScoreEntry>>()) as ReadonlyMap<
    string,
    ReadonlyMap<string, DerivedScoreEntry>
  >;

// ============================================================================
// Phase 5: Compute Verdicts
// ============================================================================

/**
 * Build verdict from score and raw value
 */
const buildVerdict = (
  score: Score,
  rawValue: MetricScalar,
  verdictPolicy: NonNullable<EvalMetadataEntry['verdictPolicy']>
): PipelineVerdict => ({
  verdict: computeVerdict(score, rawValue, verdictPolicy),
  score,
  rawValue,
});

const phaseComputeVerdicts = (
  evalMetadata: ReadonlyMap<string, EvalMetadataEntry>,
  derivedScores: ReadonlyMap<string, ReadonlyMap<string, DerivedScoreEntry>>
): ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>> =>
  new Map(
    Array.from(derivedScores.entries())
      .map(([targetId, scorerMap]) => {
        const verdictEntries = Array.from(scorerMap.entries()).flatMap(
          ([_scorerName, { scores, rawValues, evalName }]) => {
            if (!evalName) return [];

            const metadata = evalMetadata.get(evalName);
            if (!metadata?.verdictPolicy || metadata.verdictPolicy.kind === 'none') return [];

            const verdicts: PipelineVerdict[] = scores
              .map((score, i): PipelineVerdict | null =>
                score !== undefined
                  ? buildVerdict(score, rawValues[i] ?? score, metadata.verdictPolicy!)
                  : null
              )
              .filter((v): v is PipelineVerdict => v !== null);

            return verdicts.length > 0 ? ([[evalName, verdicts]] as const) : [];
          }
        );

        return verdictEntries.length > 0 ? ([targetId, new Map(verdictEntries)] as const) : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  );

// ============================================================================
// Phase 6: Aggregate
// ============================================================================

/**
 * Extract aggregators from metrics as AggregatorDef array
 */
const extractAggregators = (
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[]
): AggregatorDef[] =>
  inputMetrics.flatMap((m) =>
    'aggregators' in m ? (m.aggregators as unknown as AggregatorDef[]) : []
  );

/**
 * Calculate score aggregations (always numeric)
 */
const calculateScoreAggregations = (
  scores: readonly Score[],
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer',
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[]
): PipelineAggregations =>
  match(evalKind)
    .with('singleTurn', () => {
      const entries = extractAggregators(inputMetrics)
        .filter((a): a is NumericAggregatorDef => a.kind === 'numeric')
        .map((a) => [a.name, a.aggregate(scores as readonly number[])] as [string, number]);
      return Object.fromEntries(entries);
    })
    .with('multiTurn', () => (scores.length === 1 ? { value: scores[0] as number } : {}))
    .with('scorer', () => {
      const entries = resolveCommonAggregators(inputMetrics)
        .filter((a): a is NumericAggregatorDef => a.kind === 'numeric')
        .map((a) => [a.name, a.aggregate(scores as readonly number[])] as [string, number]);
      return Object.fromEntries(entries);
    })
    .exhaustive();

/**
 * Calculate raw value aggregations based on value type
 */
const calculateRawValueAggregations = (
  rawValues: readonly MetricScalar[],
  valueType: 'number' | 'boolean' | 'string' | 'ordinal',
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer',
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[]
): PipelineAggregations => {
  if (evalKind !== 'singleTurn' && evalKind !== 'scorer') return {};

  const allAggregators: AggregatorDef[] =
    evalKind === 'singleTurn'
      ? extractAggregators(inputMetrics)
      : resolveCommonAggregators(inputMetrics);

  return match(valueType)
    .with('number', () =>
      Object.fromEntries(
        allAggregators
          .filter((a): a is NumericAggregatorDef => a.kind === 'numeric')
          .map((a) => [a.name, a.aggregate(rawValues as readonly number[])] as [string, number])
      )
    )
    .with('boolean', () =>
      Object.fromEntries(
        allAggregators
          .filter((a): a is BooleanAggregatorDef => a.kind === 'boolean')
          .map((a) => [a.name, a.aggregate(rawValues as readonly boolean[])] as [string, number])
      )
    )
    .with(P.union('string', 'ordinal'), () =>
      Object.fromEntries(
        allAggregators
          .filter((a): a is CategoricalAggregatorDef => a.kind === 'categorical')
          .map(
            (a) =>
              [a.name, a.aggregate(rawValues as readonly string[])] as [
                string,
                Record<string, number>,
              ]
          )
      )
    )
    .exhaustive();
};

/**
 * Resolve common aggregators across metrics
 * Returns AggregatorDef[] for simplified type handling
 */
const resolveCommonAggregators = (
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[]
): AggregatorDef[] => {
  const metricsWithAggregators = inputMetrics.filter((m) => 'aggregators' in m);

  const aggregatorCounts = inputMetrics
    .filter(
      (m): m is MetricDef<MetricScalar, MetricContainer> & { aggregators: AggregatorDef[] } =>
        'aggregators' in m
    )
    .flatMap((m) => m.aggregators)
    .reduce((acc, agg) => {
      const existing = acc.get(agg.name);
      return existing
        ? acc.set(agg.name, { count: existing.count + 1, aggregator: existing.aggregator })
        : acc.set(agg.name, { count: 1, aggregator: agg });
    }, new Map<string, { count: number; aggregator: AggregatorDef }>());

  return Array.from(aggregatorCounts.values())
    .filter((entry) => entry.count === metricsWithAggregators.length)
    .map((entry) => entry.aggregator);
};

/**
 * Count verdict by type using ts-pattern
 */
const countVerdict = (
  verdict: 'pass' | 'fail' | 'unknown',
  acc: { pass: number; fail: number; unknown: number }
): { pass: number; fail: number; unknown: number } =>
  match(verdict)
    .with('pass', () => ({ ...acc, pass: acc.pass + 1 }))
    .with('fail', () => ({ ...acc, fail: acc.fail + 1 }))
    .with('unknown', () => ({ ...acc, unknown: acc.unknown + 1 }))
    .exhaustive();

/**
 * Calculate verdict summary from verdicts
 */
const calculateVerdictSummaryFromVerdicts = (
  evalName: string,
  verdictsMap: ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>>,
  totalCount: number
): PipelineVerdictSummary | undefined => {
  const counts = Array.from(verdictsMap.values())
    .flatMap((targetVerdicts) => targetVerdicts.get(evalName) ?? [])
    .reduce((acc, v) => countVerdict(v.verdict, acc), { pass: 0, fail: 0, unknown: 0 });

  const computedTotal = counts.pass + counts.fail + counts.unknown;
  if (computedTotal === 0) return undefined;

  const actualTotal = computedTotal > 0 ? computedTotal : totalCount;

  return {
    passRate: toScore(counts.pass / actualTotal),
    failRate: toScore(counts.fail / actualTotal),
    unknownRate: toScore(counts.unknown / actualTotal),
    passCount: counts.pass,
    failCount: counts.fail,
    unknownCount: counts.unknown,
    totalCount: actualTotal,
  };
};

/**
 * Collected scores entry type for aggregation
 */
type CollectedScoresEntry = {
  scores: Score[];
  rawValues: MetricScalar[];
  outputMetric: BaseMetricDef<number>;
  inputMetrics: readonly MetricDef<MetricScalar, MetricContainer>[];
};

/**
 * Collect scores by eval name from derived scores
 */
const collectScoresByEval = (
  derivedScores: ReadonlyMap<string, ReadonlyMap<string, DerivedScoreEntry>>
): Map<string, CollectedScoresEntry> =>
  Array.from(derivedScores.values())
    .flatMap((scorerMap) => Array.from(scorerMap.values()))
    .filter((entry) => entry.evalName !== undefined)
    .reduce((acc, { scores, rawValues, outputMetric, evalName, inputMetrics }) => {
      const existing = acc.get(evalName!);
      return existing
        ? acc.set(evalName!, {
            ...existing,
            scores: [...existing.scores, ...scores],
            rawValues: [...existing.rawValues, ...rawValues],
          })
        : acc.set(evalName!, {
            scores: [...scores],
            rawValues: [...rawValues],
            outputMetric,
            inputMetrics,
          });
    }, new Map<string, CollectedScoresEntry>());

/**
 * Build eval summary from collected scores
 */
const buildEvalSummary = (
  evalName: string,
  entry: CollectedScoresEntry,
  metadata: EvalMetadataEntry,
  verdicts: ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>>
): PipelineEvalSummary => {
  const { scores, rawValues, outputMetric, inputMetrics } = entry;

  const scoreAggregations = calculateScoreAggregations(scores, metadata.evalKind, inputMetrics);

  const validRawValues = rawValues.filter((v) => v !== undefined);
  const rawValueAggregations =
    validRawValues.length > 0 && metadata.evalKind !== 'scorer'
      ? calculateRawValueAggregations(
          validRawValues,
          (outputMetric?.valueType ?? inputMetrics[0]?.valueType ?? 'number') as
            | 'number'
            | 'boolean'
            | 'string'
            | 'ordinal',
          metadata.evalKind,
          inputMetrics
        )
      : undefined;

  const verdictSummary =
    metadata.verdictPolicy && metadata.verdictPolicy.kind !== 'none'
      ? calculateVerdictSummaryFromVerdicts(evalName, verdicts, scores.length)
      : undefined;

  return {
    evalKind: metadata.evalKind,
    aggregations: {
      score: scoreAggregations,
      ...(rawValueAggregations ? { raw: rawValueAggregations as PipelineAggregations } : {}),
    },
    ...(verdictSummary ? { verdictSummary } : {}),
  };
};

/**
 * Phase 6: Aggregate
 */
const phaseAggregate = (
  evalMetadata: ReadonlyMap<string, EvalMetadataEntry>,
  derivedScores: ReadonlyMap<string, ReadonlyMap<string, DerivedScoreEntry>>,
  verdicts: ReadonlyMap<string, ReadonlyMap<string, readonly PipelineVerdict[]>>
): {
  evalSummaries: ReadonlyMap<string, PipelineEvalSummary>;
} => {
  const scoresByEval = collectScoresByEval(derivedScores);

  const results = Array.from(scoresByEval.entries())
    .map(([evalName, entry]) => {
      const metadata = evalMetadata.get(evalName);
      if (!metadata) return null;

      const evalSummary = buildEvalSummary(evalName, entry, metadata, verdicts);
      return { evalName, evalSummary };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    evalSummaries: new Map(results.map((r) => [r.evalName, r.evalSummary])),
  };
};

// NOTE: The legacy “report flattening” helpers (`buildPerTargetResults`, metricToEvalMap)
// are intentionally removed as we migrate to the artifact schema (defs + series-by-stepIndex).

// ============================================================================
// Main Pipeline Execution
// ============================================================================

/**
 * Execute the full evaluation pipeline
 */
export async function executePipeline<TContainer extends DatasetItem | Conversation>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  evalMetadata: Map<string, EvalMetadataEntry>,
  options?: PipelineOptions
): Promise<PipelineResult> {
  // Phase 1: Measure
  const rawMetrics = await phaseMeasure(data, internalEvaluators, options);

  // Phase 2: Resolve Context
  const contexts = await phaseResolveContext(data, internalEvaluators, rawMetrics);

  // Phase 3: Normalize
  const normalizedScores = phaseNormalize(rawMetrics, contexts);

  // Phase 4: Score
  const derivedScores = phaseScore(internalEvaluators, evalMetadata, normalizedScores, rawMetrics);

  // Phase 5: Compute Verdicts
  const verdicts = phaseComputeVerdicts(evalMetadata, derivedScores);

  // Phase 6: Aggregate
  const { evalSummaries } = phaseAggregate(evalMetadata, derivedScores, verdicts);

  return {
    rawMetrics,
    derivedScores,
    verdicts,
    evalSummaries,
  };
}
