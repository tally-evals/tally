/**
 * Tally Container
 *
 * Main evaluation container that orchestrates the entire evaluation flow.
 * Wraps data and evals, and provides a simple run() method.
 */

import type {
  Conversation,
  DatasetItem,
  Eval,
  EvaluationContext,
  MetricScalar,
  ScorerInput,
  ScorerCombineKind,
  ScorerInputSnap,
  TallyRunArtifact,
  TallyRunReport,
  RunDefs,
  MetricDefSnap,
  EvalDefSnap,
  ConversationResult,
  SingleTurnEvalSeries,
  StepEvalResult,
  ConversationEvalResult,
  Summaries,
  EvalOutcome,
  VerdictPolicyInfo,
  Tally,
  Score,
  MetricScalarOrNull,
  MetricNormalizationSnap,
  NormalizerSpecSnap,
} from '@tally/core/types';
import { match, P } from 'ts-pattern';
import { generateRunId } from '../utils/ids';
import { createTallyRunReport } from './runReport';
import { buildFromEvals } from './evals/builder';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { type DerivedScoreEntry, type PipelineOptions, type PipelineResult, type PipelineVerdict, executePipeline } from './pipeline';
import { resolveRunPolicy, selectConversationTargets, selectDatasetTargets } from './evaluators/context';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asScorerCombineKind(value: unknown): ScorerCombineKind | undefined {
  return value === 'weightedAverage' ||
    value === 'identity' ||
    value === 'custom' ||
    value === 'unknown'
    ? value
    : undefined;
}

function getScorerCombineKind(scorer: { metadata?: Record<string, unknown>; combineScores?: unknown }): ScorerCombineKind {
  const meta = scorer.metadata;
  if (isRecord(meta) && isRecord(meta.__tally)) {
    const tagged = asScorerCombineKind(meta.__tally.combineKind);
    if (tagged) return tagged;
  }
  return scorer.combineScores ? 'custom' : 'unknown';
}

function getTargetId(container: DatasetItem | Conversation, index: number): string {
  return match(container)
    .with({ id: P.string }, (c) => c.id)
    .otherwise(() => `target-${index}`);
}

function toPolicyInfo(policy: unknown): VerdictPolicyInfo {
  if (!policy || typeof policy !== 'object') return { kind: 'none' };
  const kind = isRecord(policy) ? policy.kind : undefined;
  if (kind === 'none') return { kind: 'none' };
  if (kind === 'boolean') {
    return { kind: 'boolean', passWhen: Boolean(isRecord(policy) ? policy.passWhen : false) };
  }
  if (kind === 'ordinal') {
    const passWhenIn = isRecord(policy) && Array.isArray(policy.passWhenIn) ? policy.passWhenIn : [];
    return { kind: 'ordinal', passWhenIn };
  }
  if (kind === 'number') {
    const type = isRecord(policy) ? policy.type : undefined;
    if (type === 'threshold') {
      const passAt = Number(isRecord(policy) ? policy.passAt : NaN);
      return { kind: 'number', type: 'threshold', passAt };
    }
    return {
      kind: 'number',
      type: 'range',
      ...(isRecord(policy) && policy.min !== undefined ? { min: Number(policy.min) } : {}),
      ...(isRecord(policy) && policy.max !== undefined ? { max: Number(policy.max) } : {}),
    };
  }
  if (kind === 'custom') return { kind: 'custom', note: 'not-serializable' };
  return { kind: 'custom', note: 'not-serializable' };
}

function asMetricScalarOrNull(value: unknown): MetricScalarOrNull | undefined {
  if (value === null) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
  return undefined;
}

/**
 * Extract normalization snapshot from a metric definition for inclusion in measurements.
 * Returns undefined if no normalization is configured.
 */
function toNormalizationSnap(
  metricDef: unknown
): import('@tally-evals/core').NormalizationInfo | undefined {
  const n = (metricDef as { normalization?: unknown })?.normalization as
    | { normalizer?: unknown; calibrate?: unknown }
    | undefined;
  if (!n || !n.normalizer) return undefined;

  const normalizer = n.normalizer;
  const normalizerSnap: NormalizerSpecSnap =
    typeof normalizer === 'function'
      ? { type: 'custom', note: 'not-serializable' }
      : (normalizer as { type?: unknown }).type === 'custom'
        ? { type: 'custom', note: 'not-serializable' }
        : (normalizer as NormalizerSpecSnap);

  // Calibration: if it's a function, mark as not-serializable; otherwise use the value
  const calibration =
    typeof n.calibrate === 'function' ? undefined : n.calibrate;

  return {
    normalizer: normalizerSnap,
    // biome-ignore lint/suspicious/noExplicitAny: Runtime serialization - context type is dynamic
    ...(calibration !== undefined ? { calibration: calibration as any } : {}),
  };
}

function toOutcome(args: {
  verdict: { verdict: 'pass' | 'fail' | 'unknown'; score: Score; rawValue?: MetricScalarOrNull };
  policy: VerdictPolicyInfo;
}): EvalOutcome {
  const observedRaw = asMetricScalarOrNull(args.verdict.rawValue);
  return {
    verdict: args.verdict.verdict,
    policy: args.policy,
    observed: {
      ...(observedRaw !== undefined ? { rawValue: observedRaw } : {}),
      ...(args.verdict.score !== undefined ? { score: args.verdict.score } : {}),
    },
  };
}

function buildRunDefs(args: {
  internalEvaluators: ReturnType<typeof buildFromEvals>['internalEvaluators'];
  evalMetadata: ReturnType<typeof buildFromEvals>['evalMetadata'];
}): RunDefs {
  const metrics: Record<string, MetricDefSnap> = {};
  const evals: Record<string, EvalDefSnap> = {};
  const scorers: RunDefs['scorers'] = {};

  for (const ie of args.internalEvaluators) {
    const md = args.evalMetadata.get(ie.evalName);
    const primaryMetric = ie.metrics[0];
    if (primaryMetric) {
      const scope = 'scope' in primaryMetric ? primaryMetric.scope : 'single';

      const normalizationSnap: MetricNormalizationSnap | undefined = (() => {
        const n = (primaryMetric as { normalization?: unknown }).normalization as
          | {
              normalizer?: unknown;
              calibrate?: unknown;
            }
          | undefined;
        if (!n || !n.normalizer) return undefined;

        const normalizer = n.normalizer;
        const normalizerSnap: NormalizerSpecSnap =
          typeof normalizer === 'function'
            ? { type: 'custom', note: 'not-serializable' }
            : (normalizer as { type?: unknown }).type === 'custom'
              ? { type: 'custom', note: 'not-serializable' }
              : (normalizer as NormalizerSpecSnap);

        const calibrate =
          typeof n.calibrate === 'function' ? { note: 'not-serializable' } : n.calibrate;

        return {
          normalizer: normalizerSnap,
          ...(calibrate !== undefined ? { calibrate } : {}),
        };
      })();

      metrics[primaryMetric.name] = {
        name: primaryMetric.name,
        scope: scope === 'multi' ? 'multi' : 'single',
        valueType: primaryMetric.valueType,
        ...(primaryMetric.description ? { description: primaryMetric.description } : {}),
        ...(primaryMetric.metadata ? { metadata: primaryMetric.metadata } : {}),
        ...(normalizationSnap ? { normalization: normalizationSnap } : {}),
      };
    }

    if (ie.evalKind === 'scorer') {
      const combineKind = getScorerCombineKind(ie.scorer);

      scorers[ie.scorer.name] = {
        name: ie.scorer.name,
        inputs: (ie.scorer.inputs as readonly ScorerInput[]).map((input): ScorerInputSnap => ({
          metricRef: input.metric.name,
          weight: input.weight,
          ...(input.required !== undefined ? { required: input.required } : {}),
          ...(input.normalizerOverride !== undefined ? { hasNormalizerOverride: true } : {}),
        })),
        ...(ie.scorer.normalizeWeights !== undefined
          ? { normalizeWeights: ie.scorer.normalizeWeights }
          : {}),
        ...(ie.scorer.fallbackScore !== undefined
          ? { fallbackScore: ie.scorer.fallbackScore }
          : {}),
        combine: { kind: combineKind },
        ...(ie.scorer.description ? { description: ie.scorer.description } : {}),
        ...(ie.scorer.metadata ? { metadata: ie.scorer.metadata } : {}),
      };
    }

    evals[ie.evalName] = {
      name: ie.evalName,
      kind: ie.evalKind,
      outputShape: ie.evalKind === 'singleTurn' ? 'seriesByStepIndex' : 'scalar',
      metric: ie.evalKind === 'scorer' ? ie.scorer.name : (primaryMetric?.name ?? ie.evalName),
      ...(ie.evalKind === 'scorer' ? { scorerRef: ie.scorer.name } : {}),
      verdict: toPolicyInfo(md?.verdictPolicy),
      ...(ie.description ? { description: ie.description } : {}),
      ...(ie.metadata ? { metadata: ie.metadata } : {}),
    };
  }

  return { metrics, evals, scorers };
}

function findDerivedForEval(
  derived: ReadonlyMap<string, DerivedScoreEntry>,
  evalName: string
) {
  for (const entry of derived.values()) {
    if (entry.evalName === evalName) return entry;
  }
  return undefined;
}

function buildSingleTurnSeries(args: {
  evalName: string;
  stepCount: number;
  selectedIndices: readonly number[];
  metricName: string | undefined;
  metricRef: string;
  metricDef: unknown | undefined; // For normalization extraction
  rawMetrics: readonly import('@tally/core/types').Metric<MetricScalar>[];
  derivedEntry: DerivedScoreEntry | undefined;
  verdicts: readonly PipelineVerdict[] | undefined;
  policy: VerdictPolicyInfo;
}): SingleTurnEvalSeries {
  const byStepIndex: Array<StepEvalResult | null> = Array.from({ length: args.stepCount }, () => null);
  const metricResults = args.metricName
    ? args.rawMetrics.filter((m) => m.metricDef.name === args.metricName)
    : [];
  const scores = args.derivedEntry?.scores ?? [];
  const rawFallback = args.derivedEntry?.rawValues ?? [];

  // Extract normalization info once for all steps
  const normalization = args.metricDef ? toNormalizationSnap(args.metricDef) : undefined;

  for (let i = 0; i < args.selectedIndices.length; i++) {
    const stepIndex = args.selectedIndices[i];
    if (stepIndex === undefined) continue;
    const metric = metricResults[i];
    const score = scores[i];
    const fallbackRaw = rawFallback[i];
    const verdict = args.verdicts?.[i];
    const rawCandidate = metric?.value ?? fallbackRaw;
    const rawValue = asMetricScalarOrNull(rawCandidate);
    const measurement = {
      metricRef: args.metricRef,
      ...(score !== undefined ? { score } : {}),
      ...(rawValue !== undefined ? { rawValue } : {}),
      ...(metric?.confidence !== undefined ? { confidence: metric.confidence } : {}),
      ...(metric?.reasoning !== undefined ? { reasoning: metric.reasoning } : {}),
      ...(metric ? { executionTimeMs: metric.executionTime } : {}),
      ...(metric ? { timestamp: metric.timestamp.toISOString() } : {}),
      ...(normalization ? { normalization } : {}),
    };

    byStepIndex[stepIndex] = {
      evalRef: args.evalName,
      measurement,
      ...(verdict ? { outcome: toOutcome({ verdict, policy: args.policy }) } : {}),
    };
  }
  return { byStepIndex };
}

function buildConversationResult(args: {
  container: DatasetItem | Conversation;
  internalEvaluators: ReturnType<typeof buildFromEvals>['internalEvaluators'];
  evalMetadata: ReturnType<typeof buildFromEvals>['evalMetadata'];
  pipeline: PipelineResult;
}): ConversationResult {
  const targetId = getTargetId(args.container, 0);
  const targetRawMetrics = args.pipeline.rawMetrics.get(targetId) ?? [];
  const targetDerived: ReadonlyMap<string, DerivedScoreEntry> =
    args.pipeline.derivedScores.get(targetId) ?? new Map<string, DerivedScoreEntry>();
  const targetVerdicts: ReadonlyMap<string, readonly PipelineVerdict[]> =
    args.pipeline.verdicts.get(targetId) ?? new Map<string, readonly PipelineVerdict[]>();

  const stepCount =
    'steps' in args.container && Array.isArray(args.container.steps)
      ? args.container.steps.length
      : 1;

  const evaluatorByEval = new Map(args.internalEvaluators.map((ie) => [ie.evalName, ie]));

  // Use Record types for building, will be cast to typed result
  const singleTurn: Record<string, SingleTurnEvalSeries> = {};
  const multiTurn: Record<string, ConversationEvalResult> = {};
  const scorers: Record<
    string,
    | { shape: 'seriesByStepIndex'; series: SingleTurnEvalSeries }
    | { shape: 'scalar'; result: ConversationEvalResult }
  > = {};

  for (const [evalName, md] of args.evalMetadata.entries()) {
    const ie = evaluatorByEval.get(evalName);
    const policy = toPolicyInfo(md.verdictPolicy);
    const derivedEntry = findDerivedForEval(targetDerived, evalName);
    const verdictList = targetVerdicts.get(evalName);

    if (md.evalKind === 'singleTurn') {
      const selectedIndices =
        'steps' in args.container
          ? selectConversationTargets(
              args.container as Conversation,
              resolveRunPolicy(ie?.context) ?? { run: 'all' }
            ).targets.map((s) => s.stepIndex)
          : selectDatasetTargets(
              [args.container as DatasetItem],
              resolveRunPolicy(ie?.context) ?? { run: 'all' }
            ).targets.map((_it, idx) => idx);

      singleTurn[evalName] = buildSingleTurnSeries({
        evalName,
        stepCount,
        selectedIndices,
        metricName: ie?.metrics[0]?.name,
        metricRef: ie?.metrics[0]?.name ?? evalName,
        metricDef: ie?.metrics[0],
        rawMetrics: targetRawMetrics,
        derivedEntry,
        verdicts: verdictList,
        policy,
      });
      continue;
    }

    if (md.evalKind === 'multiTurn') {
      const metricName = ie?.metrics[0]?.name;
      const metricDef = ie?.metrics[0];
      const metric = metricName
        ? targetRawMetrics.find((m) => m.metricDef.name === metricName)
        : undefined;
      const score = derivedEntry?.scores?.[0];
      const rawFallback = derivedEntry?.rawValues?.[0];
      const verdict = verdictList?.[0];

      const rawCandidate = metric?.value ?? rawFallback;
      const rawValue = asMetricScalarOrNull(rawCandidate);
      const normalization = metricDef ? toNormalizationSnap(metricDef) : undefined;

      multiTurn[evalName] = {
        evalRef: evalName,
        measurement: {
          metricRef: metricName ?? evalName,
          ...(score !== undefined ? { score } : {}),
          ...(rawValue !== undefined ? { rawValue } : {}),
          ...(metric?.confidence !== undefined ? { confidence: metric.confidence } : {}),
          ...(metric?.reasoning !== undefined ? { reasoning: metric.reasoning } : {}),
          ...(metric?.executionTime !== undefined ? { executionTimeMs: metric.executionTime } : {}),
          ...(metric?.timestamp ? { timestamp: new Date(metric.timestamp).toISOString() } : {}),
          ...(normalization ? { normalization } : {}),
        },
        ...(verdict ? { outcome: toOutcome({ verdict, policy }) } : {}),
      };
      continue;
    }

    // scorer
    const scores = derivedEntry?.scores ?? [];
    // Scorer output normalization comes from the scorer's output metric
    const scorerOutputDef = ie?.scorer.output;
    const scorerNormalization = scorerOutputDef ? toNormalizationSnap(scorerOutputDef) : undefined;

    if (scores.length <= 1) {
      const verdict = verdictList?.[0];
      const rawCandidate = derivedEntry?.rawValues?.[0];
      const rawValue = asMetricScalarOrNull(rawCandidate);
      scorers[evalName] = {
        shape: 'scalar',
        result: {
          evalRef: evalName,
          measurement: {
            metricRef: ie?.scorer.name ?? evalName,
            ...(scores[0] !== undefined ? { score: scores[0] } : {}),
            ...(rawValue !== undefined ? { rawValue } : {}),
            ...(scorerNormalization ? { normalization: scorerNormalization } : {}),
          },
          ...(verdict ? { outcome: toOutcome({ verdict, policy }) } : {}),
        },
      };
    } else {
      const selectedIndices =
        'steps' in args.container
          ? selectConversationTargets(
              args.container as Conversation,
              resolveRunPolicy(ie?.context) ?? { run: 'all' }
            ).targets.map((s) => s.stepIndex)
          : Array.from({ length: scores.length }, (_, i) => i);

      const series = buildSingleTurnSeries({
        evalName,
        stepCount,
        selectedIndices,
        metricName: undefined,
        metricRef: ie?.scorer.name ?? evalName,
        metricDef: scorerOutputDef,
        rawMetrics: [],
        derivedEntry,
        verdicts: verdictList,
        policy,
      });
      scorers[evalName] = { shape: 'seriesByStepIndex', series };
    }
  }

  // summaries.byEval from pipeline evalSummaries
  // Use Record type for dynamic construction, cast to Summaries when returning
  const byEval: Record<string, {
    eval: string;
    kind: 'singleTurn' | 'multiTurn' | 'scorer';
    count: number;
    aggregations?: { score: Record<string, number>; raw?: Record<string, number | Record<string, number>> };
    verdictSummary?: import('@tally-evals/core').VerdictSummary;
  }> = {};
  for (const [evalName, summary] of args.pipeline.evalSummaries.entries()) {
    const derivedEntryForCount = findDerivedForEval(targetDerived, evalName);
    const count = derivedEntryForCount?.scores.length ?? 0;
    byEval[evalName] = {
      eval: evalName,
      kind: summary.evalKind,
      count,
      // Cast aggregations - pipeline type is more general but values match expected structure
      // biome-ignore lint/suspicious/noExplicitAny: Runtime compatible
      ...(summary.aggregations ? { aggregations: summary.aggregations as any } : {}),
      ...(summary.verdictSummary
        ? { verdictSummary: summary.verdictSummary }
        : {}),
    };
  }
  // Cast to Summaries - runtime structure matches, types are compatible via defaults
  const summaries: Summaries | undefined = Object.keys(byEval).length
    // biome-ignore lint/suspicious/noExplicitAny: Runtime serialization - types are compatible
    ? ({ byEval } as any as Summaries)
    : undefined;

  // Cast to ConversationResult - runtime structure is compatible
  // Type params are resolved when TEvals is specified at call site
  return {
    stepCount,
    singleTurn,
    multiTurn,
    scorers,
    ...(summaries ? { summaries } : {}),
  } as unknown as ConversationResult;
}


/**
 * Tally container implementation.
 *
 * @typeParam TContainer - DatasetItem or Conversation
 * @typeParam TEvals - Tuple of eval definitions for type-safe report access
 */
export class TallyContainer<
  TContainer extends DatasetItem | Conversation,
  TEvals extends readonly Eval[] = readonly Eval[],
> implements Tally<TContainer, TEvals>
{
  public readonly data: readonly TContainer[];
  public readonly evals: TEvals;
  public readonly context?: EvaluationContext;

  constructor(
    data: readonly TContainer[],
    evals: TEvals,
    context?: EvaluationContext,
  ) {
    if (!Array.isArray(data)) {
      throw new Error('Tally: data must be an array');
    }
    if (!Array.isArray(evals) || evals.length === 0) {
      throw new Error('Tally: at least one eval is required');
    }

    this.data = data;
    this.evals = evals;
    if (context !== undefined) {
      this.context = context;
    }
  }

  /**
   * Run the full evaluation pipeline
   *
   * @param options - Optional pipeline options (cache, LLM options, metadata)
   * @returns Type-safe evaluation report with per-target results and aggregate summaries
   */
  async run(options?: {
    cache?: MemoryCache<MetricScalar>;
    llmOptions?: GenerateObjectOptions;
    metadata?: Record<string, unknown>;
  }): Promise<TallyRunReport<TEvals>> {
    const runId = generateRunId();
    const createdAt = new Date();

    // Build internal evaluators from evals
    const { internalEvaluators, evalMetadata } = buildFromEvals([...this.evals]);

    // Execute pipeline
    const pipelineOptions: PipelineOptions = {
      ...(options?.cache !== undefined && { cache: options.cache }),
      ...(options?.llmOptions !== undefined && { llmOptions: options.llmOptions }),
      ...(options?.metadata !== undefined && { metadata: options.metadata }),
    };

    const pipelineResult = await executePipeline(
      this.data,
      internalEvaluators,
      evalMetadata,
      pipelineOptions
    );

    if (this.data.length !== 1) {
      throw new Error(
        `Tally.run(): expected a single container when producing a run artifact; got ${this.data.length}`
      );
    }

    const container = this.data[0] as unknown as DatasetItem | Conversation;
    const defs = buildRunDefs({ internalEvaluators, evalMetadata });
    const result = buildConversationResult({
      container,
      internalEvaluators,
      evalMetadata,
      pipeline: pipelineResult,
    });

    const artifact: TallyRunArtifact = {
      schemaVersion: 1,
      runId,
      createdAt: createdAt.toISOString(),
      defs,
      result,
      metadata: {
        ...(options?.metadata ?? {}),
        dataCount: this.data.length,
        evalCount: this.evals.length,
      },
    };

    return createTallyRunReport<TEvals>(artifact, this.evals);
  }
}

/**
 * Create a Tally container with type-safe report.
 *
 * Uses `const` type parameter to preserve eval name literals.
 * No `as const` needed at call site.
 *
 * @example
 * ```typescript
 * const tally = createTally({
 *   data: [conversation],
 *   evals: [relevanceEval, toxicityEval],
 * });
 *
 * const report = await tally.run();
 * report.result.singleTurn.relevance; // ✅ autocomplete
 * report.result.singleTurn.typo;      // ❌ compile error
 * ```
 *
 * @param args.data - Array of containers (DatasetItem[] or Conversation[])
 * @param args.evals - Array of eval definitions
 * @param args.context - Optional shared context for all evals
 * @returns Type-safe Tally container instance
 */
export function createTally<
  TContainer extends DatasetItem | Conversation,
  const TEvals extends readonly Eval[],
>(args: {
  data: readonly TContainer[];
  evals: TEvals;
  context?: EvaluationContext;
}): Tally<TContainer, TEvals> {
  return new TallyContainer(args.data, args.evals, args.context);
}
