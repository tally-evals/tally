/**
 * Evaluation Pipeline
 *
 * Orchestrates the evaluation process with evals:
 * 1. Measure: Execute all metrics (single-turn + multi-turn)
 * 2. Resolve Context: Resolve normalization contexts for each metric
 * 3. Normalize: Transform raw values to Scores
 * 4. Score: Execute scorers to produce derived metrics
 * 5. Compute Verdicts: Calculate pass/fail verdicts for each eval
 * 6. Aggregate: Compute built-in aggregations and eval summaries
 */

import {
  type MetricDef,
  type SingleTurnContainer,
  type MetricContainer,
  type Metric,
  type MetricScalar,
  type Score,
  type PerTargetResult,
  type AggregateSummary,
  type Conversation,
  type DatasetItem,
  type SingleTargetFor,
  type ScoringContext,
  type BaseMetricDef,
  type SingleTurnRunPolicy,
  type TargetVerdict,
  type Aggregations,
  type Aggregator,
  toScore,
} from '@tally/core/types';
import { runSingleTurnMetrics } from './execution/runSingleTurn';
import { runMultiTurnMetric } from './execution/runMultiTurn';
import type { RunSingleTurnOptions } from './execution/runSingleTurn';
import type { RunMultiTurnOptions } from './execution/runMultiTurn';
import type { ExecutorOptions } from './execution/executors';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { resolveContext } from './normalization/context';
import { applyNormalization } from './normalization/apply';
import {
  selectConversationTargets,
  selectDatasetTargets,
  resolveRunPolicy,
} from './evaluators/context';
import type { InternalEvaluator } from './evals/builder';
import type { VerdictPolicy } from './evals/types';
import { computeVerdict } from './evals/verdict';

/**
 * Pipeline state - intermediate results between phases
 */
export interface PipelineState {
  // Phase 1: Raw metric results
  rawMetrics: Map<string, Metric<MetricScalar>[]>; // key: targetId, value: metrics for that target

  // Phase 2: Resolved contexts per metric
  contexts: Map<string, ScoringContext>; // key: metric name

  // Phase 3: Normalized scores per target
  normalizedScores: Map<string, Map<string, Score[]>>; // key: targetId, inner key: metric name, value: array of scores (one per turn)

  // Phase 4: Derived metric scores per target
  // Maps targetId -> scorer name -> { scores, outputMetric, evalName }
  derivedScores: Map<
    string,
    Map<
      string,
      {
        scores: Score[];
        rawValues: MetricScalar[];
        outputMetric: BaseMetricDef<number>;
        inputMetrics: MetricDef<MetricScalar, MetricContainer>[];
        evalName?: string; // Track which eval this score belongs to
      }
    >
  >;

  // Phase 5: Verdicts per target per eval
  verdicts: Map<string, Map<string, TargetVerdict>>; // key: targetId, inner key: eval name

  // Phase 6: Aggregate summaries and eval summaries
  aggregateSummaries: AggregateSummary[];
  evalSummaries: Map<
    string,
    {
      evalName: string;
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      aggregations: {
        score: Aggregations;
        raw?: Aggregations;
      };
      verdictSummary?: {
        passRate: Score;
        failRate: Score;
        passCount: number;
        failCount: number;
        totalCount: number;
      };
    }
  >;
}

/**
 * Pipeline options
 */
export interface PipelineOptions {
  cache?: MemoryCache<MetricScalar>;
  llmOptions?: GenerateObjectOptions;
  metadata?: Record<string, unknown>;
}

/**
 * Execute the full evaluation pipeline
 */
export async function executePipeline<
  TContainer extends DatasetItem | Conversation,
>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  evalMetadata: Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[];
    }
  >,
  options?: PipelineOptions,
): Promise<{
  perTargetResults: PerTargetResult[];
  aggregateSummaries: AggregateSummary[];
  evalSummaries: Map<
    string,
    {
      evalName: string;
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      aggregations: {
        score: Aggregations;
        raw?: Aggregations;
      };
      verdictSummary?: {
        passRate: Score;
        failRate: Score;
        passCount: number;
        failCount: number;
        totalCount: number;
      };
    }
  >;
  metricToEvalMap: Map<string, string>;
}> {
  const state: PipelineState = {
    rawMetrics: new Map(),
    contexts: new Map(),
    normalizedScores: new Map(),
    derivedScores: new Map(),
    verdicts: new Map(),
    aggregateSummaries: [],
    evalSummaries: new Map(),
  };

  // Phase 1: Measure - Execute all metrics
  await phaseMeasure(data, internalEvaluators, state, options);

  // Phase 2: Resolve Context - Resolve normalization contexts
  await phaseResolveContext(data, internalEvaluators, state);

  // Phase 3: Normalize - Transform raw values to Scores
  phaseNormalize(internalEvaluators, state);

  // Phase 4: Score - Execute scorers to produce derived metrics
  phaseScore(internalEvaluators, evalMetadata, state);

  // Phase 5: Compute Verdicts - Calculate pass/fail verdicts
  phaseComputeVerdicts(evalMetadata, state);

  // Phase 6: Aggregate - Compute built-in aggregations and eval summaries
  phaseAggregate(evalMetadata, state);

  // Build final results
  const perTargetResults = buildPerTargetResults(state, data);
  const aggregateSummaries = state.aggregateSummaries;
  const evalSummaries = state.evalSummaries;

  // Build metric to eval mapping for report
  const metricToEvalMap = new Map<string, string>();
  for (const [evalName, metadata] of evalMetadata) {
    if (metadata.sourceMetrics) {
      for (const metricName of metadata.sourceMetrics) {
        metricToEvalMap.set(metricName, evalName);
      }
    }
  }

  return {
    perTargetResults,
    aggregateSummaries,
    evalSummaries,
    metricToEvalMap,
  };
}

async function phaseMeasure<TContainer extends DatasetItem | Conversation>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
  options?: PipelineOptions,
): Promise<void> {
  for (let index = 0; index < data.length; index++) {
    const container = data[index] as TContainer;
    const targetId = getTargetId(container, index);

    const executorOptions: ExecutorOptions = {
      ...(options?.cache !== undefined ? { cache: options.cache } : {}),
      ...(options?.llmOptions !== undefined
        ? { llmOptions: options.llmOptions }
        : {}),
    };

    const seenMetrics = new Set<string>();

    const metrics = (
      await Promise.all(
        internalEvaluators
          .flatMap(({ metrics, context }) =>
            metrics.map((metricDef) => ({ metricDef, context })),
          )
          .map(async ({ metricDef, context }) => {
            if (seenMetrics.has(metricDef.name)) {
              return [];
            } else {
              seenMetrics.add(metricDef.name);
            }

            if (metricDef.scope === 'single') {
              const policy = resolveRunPolicy(context);
              const targets = selectTargets(container, policy);

              return runSingleTurnMetrics(
                metricDef as MetricDef<MetricScalar, SingleTurnContainer>,
                targets as unknown as SingleTargetFor<SingleTurnContainer>[],
                { ...executorOptions } satisfies RunSingleTurnOptions,
              );
            }

            if (metricDef.scope === 'multi' && isConversation(container)) {
              return runMultiTurnMetric(
                metricDef as MetricDef<MetricScalar, Conversation>,
                container,
                {
                  ...executorOptions,
                  ...(options?.metadata !== undefined
                    ? { runMetadata: options.metadata }
                    : {}),
                } satisfies RunMultiTurnOptions,
              );
            }

            throw new Error(`Invalid metric scope: ${metricDef.scope}`);
          }),
      )
    ).flat();

    state.rawMetrics.set(targetId, metrics);
  }
}

async function phaseResolveContext<
  TContainer extends DatasetItem | Conversation,
>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
): Promise<void> {
  const uniqueMetrics = getUniqueMetrics(internalEvaluators);

  for (const { metricName, metricDef } of uniqueMetrics) {
    const rawValues: MetricScalar[] = [];

    for (const metrics of state.rawMetrics.values()) {
      for (const metric of metrics) {
        if (metric.metricDef.name === metricName) {
          rawValues.push(metric.value);
        }
      }
    }

    const context = await resolveContext(
      metricDef.normalization,
      data,
      rawValues,
      metricName,
    );

    state.contexts.set(metricName, context);
  }
}

async function phaseNormalize<TContainer extends DatasetItem | Conversation>(
  _internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
): Promise<void> {
  for (const [targetId, metrics] of state.rawMetrics) {
    const scores = new Map<string, Score[]>();
    for (const metric of metrics) {
      const context = state.contexts.get(metric.metricDef.name);
      if (!context) {
        throw new Error(`Missing context for metric: ${metric.metricDef.name}`);
      }
      const score = applyNormalization(
        metric.value,
        metric.metricDef.normalization?.default ?? {
          type: 'identity',
        },
        context,
        metric.metricDef as MetricDef<MetricScalar, MetricContainer>,
      );
      scores.set(metric.metricDef.name, [
        ...(scores.get(metric.metricDef.name) ?? []),
        score,
      ]);
    }
    state.normalizedScores.set(targetId, scores);
  }
}

async function phaseScore<TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  evalMetadata: Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[];
    }
  >,
  state: PipelineState,
): Promise<void> {
  for (const { scorer, evalName } of internalEvaluators) {
    for (const [targetId, normalizedScores] of state.normalizedScores) {
      const maxLen = Math.max(
        ...scorer.inputs.map(
          (input) => normalizedScores.get(input.metric.name)?.length ?? 0,
        ),
      );

      const derivedScores: Score[] = Array.from({ length: maxLen }, (_, i) => {
        const inputScores: Record<string, Score> = {};

        for (const input of scorer.inputs) {
          const arr = normalizedScores.get(input.metric.name);
          const score = arr?.at(i) ?? arr?.at(-1) ?? scorer.fallbackScore;

          if (score !== undefined) {
            inputScores[input.metric.name] = score;
          } else if (input.required !== false) {
            throw new Error(
              `Required metric "${input.metric.name}" missing for scorer "${scorer.name}" on target "${targetId}"`,
            );
          }
        }

        if (!scorer.combineScores) {
          throw new Error(
            `Scorer "${scorer.name}" missing combineScores function`,
          );
        }

        return scorer.combineScores(inputScores);
      });

      const metadata = evalMetadata.get(evalName);
      const sourceMetrics = metadata?.sourceMetrics;

      const rawValues: MetricScalar[] = extractRawValues(
        targetId,
        scorer.output.name,
        derivedScores.length,
        state.rawMetrics,
        sourceMetrics,
      );

      let targetDerivedScores = state.derivedScores.get(targetId);
      if (!targetDerivedScores) {
        targetDerivedScores = new Map();
        state.derivedScores.set(targetId, targetDerivedScores);
      }
      targetDerivedScores.set(scorer.name, {
        scores: derivedScores,
        rawValues,
        outputMetric: scorer.output,
        inputMetrics: scorer.inputs.map((input) => input.metric),
        evalName,
      });
    }
  }
}

function phaseComputeVerdicts(
  evalMetadata: Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[];
    }
  >,
  state: PipelineState,
): void {
  for (const [targetId, derivedScores] of state.derivedScores) {
    const targetVerdicts = new Map<string, TargetVerdict[]>();

    for (const [
      _scorerName,
      { scores, rawValues, evalName },
    ] of derivedScores) {
      if (!evalName) continue;

      const metadata = evalMetadata.get(evalName);
      if (!metadata || !metadata.verdictPolicy) continue;

      const verdictPolicy = metadata.verdictPolicy;
      if (verdictPolicy.kind === 'none') continue;

      const verdicts: TargetVerdict[] = [];
      for (let i = 0; i < scores.length; i++) {
        const verdict = computeVerdict(
          scores[i] as Score,
          rawValues[i] ?? (scores[i] as Score),
          verdictPolicy,
        );

        verdicts.push({
          verdict,
          score: scores[i] as Score,
          rawValue: rawValues[i] as MetricScalar,
        } satisfies TargetVerdict);
      }

      if (verdicts.length > 0) {
        targetVerdicts.set(evalName, verdicts);
      }
    }

    if (targetVerdicts.size > 0) {
      state.verdicts.set(targetId, targetVerdicts as any);
    }
  }
}

function phaseAggregate(
  evalMetadata: Map<
    string,
    {
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      verdictPolicy?: VerdictPolicy;
      sourceMetrics?: string[];
    }
  >,
  state: PipelineState,
): void {
  const scoresByEval = new Map<
    string,
    {
      scores: Score[];
      rawValues: MetricScalar[];
      outputMetric: BaseMetricDef<number>;
      inputMetrics: MetricDef<MetricScalar, MetricContainer>[];
    }
  >();

  for (const [_targetId, derivedScores] of state.derivedScores) {
    for (const [
      _scorerName,
      { scores, rawValues, outputMetric, evalName, inputMetrics },
    ] of derivedScores) {
      if (!evalName) continue;

      const existing = scoresByEval.get(evalName);
      if (!existing) {
        scoresByEval.set(evalName, {
          scores,
          rawValues,
          outputMetric,
          inputMetrics,
        });
      } else {
        existing.scores.push(...scores);
        existing.rawValues.push(...rawValues);
      }
    }
  }

  for (const [
    evalName,
    { scores, rawValues, outputMetric, inputMetrics },
  ] of scoresByEval) {
    const metadata = evalMetadata.get(evalName);
    if (!metadata) continue;

    const verdictPolicy = metadata.verdictPolicy;

    const scoreAggregations = calculateAggregations(
      scores,
      metadata.evalKind,
      inputMetrics,
    );

    let rawValueAggregations: Aggregations | undefined;
    const validRawValues = rawValues.filter((v) => v !== undefined);

    if (validRawValues.length > 0 && metadata.evalKind !== 'scorer') {
      rawValueAggregations = calculateAggregations(
        validRawValues,
        metadata.evalKind,
        inputMetrics,
      );
    }

    const evalSummary: {
      evalName: string;
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      aggregations: {
        score: Aggregations;
        raw?: Aggregations;
      };
      verdictSummary?: {
        passRate: Score;
        failRate: Score;
        passCount: number;
        failCount: number;
        totalCount: number;
      };
    } = {
      evalName,
      evalKind: metadata.evalKind,
      aggregations: {
        score: scoreAggregations,
        raw: rawValueAggregations as Aggregations,
      },
    };

    if (
      verdictPolicy &&
      verdictPolicy.kind !== 'none' &&
      scoreAggregations.passRate !== undefined
    ) {
      evalSummary.verdictSummary = {
        passRate: toScore(
          rawValueAggregations?.passRate ?? scoreAggregations.passRate,
        ),
        failRate: toScore(
          rawValueAggregations?.failRate ?? scoreAggregations.failRate!,
        ),
        passCount:
          rawValueAggregations?.passCount ?? scoreAggregations.passCount!,
        failCount:
          rawValueAggregations?.failCount ?? scoreAggregations.failCount!,
        totalCount: rawValues.length ?? scores.length,
      };
    }

    state.evalSummaries.set(evalName, evalSummary);

    state.aggregateSummaries.push({
      metric: outputMetric,
      aggregations: {
        score: scoreAggregations,
        ...(rawValueAggregations ? { raw: rawValueAggregations } : {}),
      },
      count: scores.length,
    });
  }
}

/**
 * Build per-target results from pipeline state
 */
function buildPerTargetResults<TContainer extends DatasetItem | Conversation>(
  state: PipelineState,
  data: readonly TContainer[],
): PerTargetResult[] {
  const results: PerTargetResult[] = [];

  for (let i = 0; i < data.length; i++) {
    const container = data[i];
    if (container === undefined) continue;

    const targetId = getTargetId(container as DatasetItem | Conversation, i);
    const rawMetrics = state.rawMetrics.get(targetId) ?? [];
    const derivedScores = state.derivedScores.get(targetId) ?? new Map();
    const verdicts = state.verdicts.get(targetId) ?? new Map();

    const derivedMetrics: Array<{
      definition: BaseMetricDef<number>;
      value: Score;
    }> = [];

    for (const [, { scores, outputMetric }] of derivedScores) {
      // For each score in the array, add a derived metric entry
      for (const score of scores) {
        derivedMetrics.push({
          definition: outputMetric,
          value: score,
        });
      }
    }

    // Convert verdicts map - each eval now has an array of verdicts (one per score)
    const verdictsMap = new Map<string, TargetVerdict>();
    for (const [evalName, verdictList] of verdicts.entries()) {
      // For backward compatibility, store the array as-is
      // The downstream consumer can access individual verdicts if needed
      verdictsMap.set(evalName, verdictList);
    }

    results.push({
      targetId,
      rawMetrics,
      derivedMetrics,
      verdicts: verdictsMap,
    });
  }

  return results;
}

/**
 * Get target ID from container
 */
function getTargetId(
  container: DatasetItem | Conversation,
  index: number,
): string {
  if ('id' in container && typeof container.id === 'string') {
    return container.id;
  }
  return `target-${index}`;
}

function getUniqueMetrics<TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
) {
  const map = new Map<string, MetricDef<MetricScalar, TContainer>>();
  for (const { metrics } of internalEvaluators) {
    for (const metric of metrics) {
      map.set(
        metric.name,
        map.get(metric.name) ??
          (metric as unknown as MetricDef<MetricScalar, TContainer>),
      );
    }
  }
  return Array.from(map, ([metricName, metricDef]) => ({
    metricName,
    metricDef,
  }));
}

/**
 * Extract raw values from raw metrics
 */
function extractRawValues(
  targetId: string,
  outputMetricName: string,
  expectedLength: number,
  rawMetricsMap: Map<string, Metric<MetricScalar>[]>,
  sourceMetrics?: string[],
): MetricScalar[] {
  const rawMetrics = rawMetricsMap.get(targetId) ?? [];
  const rawValues: MetricScalar[] = [];

  if (sourceMetrics && sourceMetrics.length === 1) {
    for (const sourceMetricName of sourceMetrics) {
      for (const metric of rawMetrics) {
        if (metric.metricDef.name === sourceMetricName) {
          rawValues.push(metric.value);
        }
      }
    }
  }

  if (rawValues.length === 0) {
    const baseMetricName = outputMetricName.replace('_score', '');
    for (const metric of rawMetrics) {
      if (metric.metricDef.name === baseMetricName) {
        rawValues.push(metric.value);
      }
    }
  }

  if (rawValues.length === 0) {
    for (const metric of rawMetrics) {
      if (metric.metricDef.name === outputMetricName) {
        rawValues.push(metric.value);
      }
    }
  }

  if (rawValues.length === 0) {
    return Array(expectedLength).fill(undefined as any);
  }

  return rawValues;
}

/**
 * Calculate aggregations for a set of values
 */
function calculateAggregations(
  values: (Score | MetricScalar)[],
  evalKind: 'singleTurn' | 'multiTurn' | 'scorer',
  inputMetrics: MetricDef<MetricScalar, MetricContainer>[],
): Aggregations {
  const aggregations: Aggregations = {};

  if (evalKind === 'singleTurn') {
    const aggregators = inputMetrics.flatMap((m) =>
      'aggregators' in m ? m.aggregators : [],
    );
    for (const aggregator of aggregators) {
      aggregations[aggregator.name] = aggregator.aggregate(values as number[]);
    }
  } else if (evalKind === 'multiTurn') {
    if (values.length === 1) {
      aggregations['value'] = values[0] as Score;
    }
  } else if (evalKind === 'scorer') {
    const aggregators = resolveCommonAggregators(inputMetrics);
    for (const aggregator of aggregators) {
      aggregations[aggregator.name] = aggregator.aggregate(values as number[]);
    }
  }

  return aggregations;
}

function resolveCommonAggregators(
  inputMetrics: MetricDef<MetricScalar, MetricContainer>[],
): Aggregator<MetricScalar, SingleTurnContainer>[] {
  const aggregatorCounts = new Map<
    string,
    { count: number; aggregator: Aggregator<MetricScalar, SingleTurnContainer> }
  >();

  inputMetrics.forEach((m) => {
    if ('aggregators' in m) {
      m.aggregators.forEach((agg) => {
        const existing = aggregatorCounts.get(agg.name);
        if (existing) {
          existing.count++;
        } else {
          aggregatorCounts.set(agg.name, { count: 1, aggregator: agg });
        }
      });
    }
  });

  const metricsWithAggregators = inputMetrics.filter((m) => 'aggregators' in m);
  return Array.from(aggregatorCounts.values())
    .filter((entry) => entry.count === metricsWithAggregators.length)
    .map((entry) => entry.aggregator);
}

/**
 * Select targets based on run policy
 */
function selectTargets<TContainer extends DatasetItem | Conversation>(
  container: TContainer,
  policy: SingleTurnRunPolicy | undefined,
): readonly SingleTargetFor<TContainer>[] {
  const defaultPolicy: SingleTurnRunPolicy = { run: 'all' };
  const effectivePolicy = policy ?? defaultPolicy;

  if (isConversation(container)) {
    const result = selectConversationTargets(container, effectivePolicy);
    return result.targets as readonly SingleTargetFor<TContainer>[];
  }
  if (isDatasetItem(container)) {
    const result = selectDatasetTargets([container], effectivePolicy);
    return result.targets as readonly SingleTargetFor<TContainer>[];
  }

  return [];
}

/**
 * Type guard for Conversation
 */
function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'steps' in value &&
    Array.isArray((value as Conversation).steps)
  );
}

/**
 * Type guard for DatasetItem
 */
function isDatasetItem(value: unknown): value is DatasetItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'prompt' in value &&
    'completion' in value
  );
}
