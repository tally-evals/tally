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

import type {
  MetricDef,
  SingleTurnContainer,
  MetricContainer,
  Metric,
  MetricScalar,
  Score,
  PerTargetResult,
  AggregateSummary,
  Conversation,
  DatasetItem,
  SingleTargetFor,
  MetricDefFor,
  ScoringContext,
  BaseMetricDef,
  SingleTurnRunPolicy,
  TargetVerdict,
  BuiltInAggregations,
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
import { calculateBuiltInAggregations } from './evals/aggregations';

/**
 * Pipeline state - intermediate results between phases
 */
export interface PipelineState {
  // Phase 1: Raw metric results
  rawMetrics: Map<string, Metric<MetricScalar>[]>; // key: targetId, value: metrics for that target

  // Phase 2: Resolved contexts per metric
  contexts: Map<string, ScoringContext>; // key: metric name

  // Phase 3: Normalized scores per target
  normalizedScores: Map<string, Map<string, Score>>; // key: targetId, inner key: metric name

  // Phase 4: Derived metric scores per target
  // Maps targetId -> scorer name -> { score, outputMetric, evalName }
  derivedScores: Map<
    string,
    Map<
      string,
      {
        score: Score;
        outputMetric: BaseMetricDef<number>;
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
      aggregations: BuiltInAggregations;
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
      aggregations: BuiltInAggregations;
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
  phaseScore(internalEvaluators, state);

  // Phase 5: Compute Verdicts - Calculate pass/fail verdicts
  phaseComputeVerdicts(internalEvaluators, evalMetadata, state);

  // Phase 6: Aggregate - Compute built-in aggregations and eval summaries
  phaseAggregate(internalEvaluators, evalMetadata, state);

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

/**
 * Phase 1: Measure - Execute all metrics for all evaluators
 */
async function phaseMeasure<TContainer extends DatasetItem | Conversation>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
  options?: PipelineOptions,
): Promise<void> {
  const executionOptions: RunSingleTurnOptions = {};
  if (options?.cache !== undefined) {
    executionOptions.cache = options.cache;
  }
  if (options?.llmOptions !== undefined) {
    executionOptions.llmOptions = options.llmOptions;
  }
  if (options?.metadata !== undefined) {
    (executionOptions as unknown as ExecutorOptions).runMetadata =
      options.metadata;
  }

  // Process each container
  for (let i = 0; i < data.length; i++) {
    const container = data[i];
    if (container === undefined) continue;

    const targetId = getTargetId(container, i);
    const metrics: Metric<MetricScalar>[] = [];

    // Execute all evaluators' metrics for this container
    for (const evaluator of internalEvaluators) {
      for (const metricDef of evaluator.metrics) {
        if (metricDef.scope === 'single') {
          // Single-turn: select targets based on policy
          const policy = resolveRunPolicy(evaluator.context);
          const targets = selectTargets(container, policy);
          // Type assertion: we've checked scope === 'single', so this is a single-turn metric
          const singleTurnMetric = metricDef as unknown as MetricDef<
            MetricScalar,
            SingleTurnContainer
          >;
          const results = await runSingleTurnMetrics(
            singleTurnMetric,
            targets as unknown as SingleTargetFor<SingleTurnContainer>[],
            executionOptions,
          );
          metrics.push(...results);
        } else if (metricDef.scope === 'multi') {
          // Multi-turn: execute on entire conversation
          if (isConversation(container)) {
            const multiTurnOptions: RunMultiTurnOptions = {};
            if (options?.cache !== undefined) {
              multiTurnOptions.cache = options.cache;
            }
            if (options?.llmOptions !== undefined) {
              multiTurnOptions.llmOptions = options.llmOptions;
            }
            if (options?.metadata !== undefined) {
              multiTurnOptions.runMetadata = options.metadata;
            }
            const result = await runMultiTurnMetric(
              metricDef as MetricDef<MetricScalar, Conversation>,
              container,
              multiTurnOptions,
            );
            metrics.push(result);
          }
        }
      }
    }

    state.rawMetrics.set(targetId, metrics);
  }
}

/**
 * Phase 2: Resolve Context - Resolve normalization contexts for each unique metric
 */
async function phaseResolveContext<
  TContainer extends DatasetItem | Conversation,
>(
  data: readonly TContainer[],
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
): Promise<void> {
  // Collect all unique metric definitions
  const uniqueMetrics = new Map<string, MetricDef<MetricScalar, TContainer>>();
  for (const evaluator of internalEvaluators) {
    for (const metricDef of evaluator.metrics) {
      if (!uniqueMetrics.has(metricDef.name)) {
        uniqueMetrics.set(metricDef.name, metricDef);
      }
    }
  }

  // Resolve context for each metric
  for (const [metricName, metricDef] of uniqueMetrics) {
    // Collect raw values for this metric across all targets
    const rawValues: MetricScalar[] = [];
    for (const metrics of state.rawMetrics.values()) {
      for (const metric of metrics) {
        if (metric.metricDef.name === metricName) {
          rawValues.push(metric.value);
        }
      }
    }

    // Resolve context
    const context = await resolveContext(
      metricDef.normalization,
      data,
      rawValues,
      metricName,
    );
    state.contexts.set(metricName, context);
  }
}

/**
 * Phase 3: Normalize - Transform raw metric values to Scores
 */
function phaseNormalize<TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
): void {
  // Collect all unique metric definitions
  const uniqueMetrics = new Map<string, MetricDef<MetricScalar, TContainer>>();
  for (const evaluator of internalEvaluators) {
    for (const metricDef of evaluator.metrics) {
      if (!uniqueMetrics.has(metricDef.name)) {
        uniqueMetrics.set(metricDef.name, metricDef);
      }
    }
  }

  // Normalize metrics for each target
  for (const [targetId, metrics] of state.rawMetrics) {
    const scores = new Map<string, Score>();

    for (const metric of metrics) {
      const metricDef = metric.metricDef;
      const context = state.contexts.get(metricDef.name);
      if (!context) {
        throw new Error(`Missing context for metric: ${metricDef.name}`);
      }

      // Get normalizer spec (default to identity if not specified)
      const normalizerSpec = metricDef.normalization?.default ?? {
        type: 'identity',
      };

      // Apply normalization
      const score = applyNormalization(
        metric.value,
        normalizerSpec,
        context,
        metricDef as MetricDef<MetricScalar, MetricContainer>,
      );

      scores.set(metricDef.name, score);
    }

    state.normalizedScores.set(targetId, scores);
  }
}

/**
 * Phase 4: Score - Execute scorers to produce derived metrics
 */
function phaseScore<TContainer extends DatasetItem | Conversation>(
  internalEvaluators: readonly InternalEvaluator<TContainer>[],
  state: PipelineState,
): void {
  // Execute each evaluator's scorer
  for (const evaluator of internalEvaluators) {
    const scorer = evaluator.scorer;

    // For each target, compute derived score
    for (const [targetId, normalizedScores] of state.normalizedScores) {
      // Collect input scores for this scorer
      const inputScores: Record<string, Score> = {};
      for (const input of scorer.inputs) {
        const metricName = input.metric.name;
        const score = normalizedScores.get(metricName);

        if (score === undefined) {
          if (input.required !== false) {
            throw new Error(
              `Required metric "${metricName}" missing for scorer "${scorer.name}" on target "${targetId}"`,
            );
          }
          // Optional metric missing - skip or use fallback
          if (scorer.fallbackScore !== undefined) {
            inputScores[metricName] = scorer.fallbackScore;
          }
          continue;
        }

        inputScores[metricName] = score;
      }

      // Compute derived score
      let derivedScore: Score;
      if (scorer.combineScores) {
        derivedScore = scorer.combineScores(inputScores as never);
      } else {
        // Default: weighted average (should be provided by scorer builder)
        throw new Error(
          `Scorer "${scorer.name}" missing combineScores function`,
        );
      }

      // Store derived score with output metric definition and eval name
      let targetDerivedScores = state.derivedScores.get(targetId);
      if (!targetDerivedScores) {
        targetDerivedScores = new Map();
        state.derivedScores.set(targetId, targetDerivedScores);
      }
      targetDerivedScores.set(scorer.name, {
        score: derivedScore,
        outputMetric: scorer.output,
        evalName: evaluator.evalName,
      });
    }
  }
}

/**
 * Phase 5: Compute Verdicts - Calculate pass/fail verdicts for each eval
 */
function phaseComputeVerdicts<TContainer extends DatasetItem | Conversation>(
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
): void {
  // For each target, compute verdicts for each eval
  for (const [targetId, derivedScores] of state.derivedScores) {
    const targetVerdicts = new Map<string, TargetVerdict>();

    for (const [
      scorerName,
      { score, outputMetric, evalName },
    ] of derivedScores) {
      if (!evalName) continue;

      const metadata = evalMetadata.get(evalName);
      if (!metadata || !metadata.verdictPolicy) continue;

      const verdictPolicy = metadata.verdictPolicy;
      if (verdictPolicy.kind === 'none') continue;

      // Get raw value for this eval (from raw metrics)
      const rawMetrics = state.rawMetrics.get(targetId) ?? [];
      let rawValue: MetricScalar | undefined;

      // For single-turn/multi-turn evals, find the metric value
      // For scorer evals, we don't have a single raw value, so use undefined
      if (
        metadata.evalKind === 'singleTurn' ||
        metadata.evalKind === 'multiTurn'
      ) {
        // Find the metric that corresponds to this eval
        // The scorer name should match the eval name pattern
        for (const metric of rawMetrics) {
          if (
            metric.metricDef.name === outputMetric.name.replace('_score', '')
          ) {
            rawValue = metric.value;
            break;
          }
        }
      }

      const verdict = computeVerdict(
        score,
        rawValue ?? score, // Fallback to score if no raw value
        verdictPolicy,
      );

      targetVerdicts.set(evalName, {
        verdict,
        score,
        rawValue: rawValue as MetricScalar,
      } satisfies TargetVerdict);
    }

    if (targetVerdicts.size > 0) {
      state.verdicts.set(targetId, targetVerdicts);
    }
  }
}

/**
 * Phase 6: Aggregate - Compute built-in aggregations and eval summaries
 */
function phaseAggregate<TContainer extends DatasetItem | Conversation>(
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
): void {
  // Group derived scores by eval name, maintaining target order and pairing with raw values
  const scoresByEval = new Map<
    string,
    {
      targetIds: string[];
      scores: Score[];
      rawValues: MetricScalar[];
      outputMetric: BaseMetricDef<number>;
    }
  >();

  for (const [targetId, derivedScores] of state.derivedScores) {
    for (const [
      _scorerName,
      { score, outputMetric, evalName },
    ] of derivedScores) {
      if (!evalName) continue;

      const existing = scoresByEval.get(evalName);
      if (!existing) {
        scoresByEval.set(evalName, {
          targetIds: [targetId],
          scores: [score],
          rawValues: [],
          outputMetric,
        });
      } else {
        existing.targetIds.push(targetId);
        existing.scores.push(score);
      }
    }
  }

  // Collect raw values for each eval, using source metric names from evalMetadata
  for (const [evalName, data] of scoresByEval) {
    const metadata = evalMetadata.get(evalName);
    if (!metadata) continue;

    const sourceMetrics = metadata.sourceMetrics ?? [];
    const { targetIds } = data;

    for (let i = 0; i < targetIds.length; i++) {
      const targetId = targetIds[i] as string;
      const rawMetrics = state.rawMetrics.get(targetId) ?? [];

      let rawValue: MetricScalar | undefined;

      if (sourceMetrics.length > 0) {
        const sourceMetricName = sourceMetrics[0];
        for (const metric of rawMetrics) {
          if (metric.metricDef.name === sourceMetricName) {
            rawValue = metric.value;
            break;
          }
        }
      }

      if (rawValue !== undefined) {
        data.rawValues.push(rawValue);
      }
    }
  }

  // Compute aggregations for each eval
  for (const [evalName, { scores, rawValues, outputMetric }] of scoresByEval) {
    const metadata = evalMetadata.get(evalName);
    if (!metadata) continue;

    const verdictPolicy = metadata.verdictPolicy;
    const aggregations = calculateBuiltInAggregations(
      scores,
      rawValues.length > 0 ? rawValues : undefined,
      verdictPolicy,
    );

    // Build eval summary
    const evalSummary: {
      evalName: string;
      evalKind: 'singleTurn' | 'multiTurn' | 'scorer';
      aggregations: BuiltInAggregations;
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
      aggregations,
    };

    if (
      verdictPolicy &&
      verdictPolicy.kind !== 'none' &&
      aggregations.passRate !== undefined
    ) {
      evalSummary.verdictSummary = {
        passRate: aggregations.passRate,
        failRate: aggregations.failRate!,
        passCount: aggregations.passCount!,
        failCount: aggregations.failCount!,
        totalCount: scores.length,
      };
    }

    state.evalSummaries.set(evalName, evalSummary);

    // Also create aggregate summary for backward compatibility
    state.aggregateSummaries.push({
      metric: outputMetric,
      aggregations,
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
    for (const [, { score, outputMetric }] of derivedScores) {
      derivedMetrics.push({
        definition: outputMetric,
        value: score,
      });
    }

    results.push({
      targetId,
      rawMetrics,
      derivedMetrics,
      verdicts,
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
