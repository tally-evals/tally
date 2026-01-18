/**
 * Tally Container
 *
 * Main evaluation container that orchestrates the entire evaluation flow.
 * Wraps data and evaluators (which contain evals), and provides a simple run() method.
 */

import type {
  Conversation,
  DatasetItem,
  Evaluator,
  MetricContainer,
  MetricScalar,
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
} from '@tally/core/types';
import { match, P } from 'ts-pattern';
import { generateRunId } from '../utils/ids';
import { createTallyRunReport } from './runReport';
import { buildFromEvals } from './evals/builder';
import type { MemoryCache } from './execution/cache/memoryCache';
import type { GenerateObjectOptions } from './execution/llm/generateObject';
import { type DerivedScoreEntry, type PipelineOptions, type PipelineResult, type PipelineVerdict, executePipeline } from './pipeline';
import { resolveRunPolicy, selectConversationTargets, selectDatasetTargets } from './evaluators/context';

function getTargetId(container: DatasetItem | Conversation, index: number): string {
  return match(container)
    .with({ id: P.string }, (c) => c.id)
    .otherwise(() => `target-${index}`);
}

function toPolicyInfo(policy: unknown): VerdictPolicyInfo {
  if (!policy || typeof policy !== 'object') return { kind: 'none' };
  const kind = (policy as any).kind;
  if (kind === 'none') return { kind: 'none' };
  if (kind === 'boolean') return { kind: 'boolean', passWhen: Boolean((policy as any).passWhen) };
  if (kind === 'ordinal') return { kind: 'ordinal', passWhenIn: (policy as any).passWhenIn ?? [] };
  if (kind === 'number') {
    const type = (policy as any).type;
    if (type === 'threshold') return { kind: 'number', type: 'threshold', passAt: Number((policy as any).passAt) };
    return {
      kind: 'number',
      type: 'range',
      ...(((policy as any).min !== undefined) ? { min: Number((policy as any).min) } : {}),
      ...(((policy as any).max !== undefined) ? { max: Number((policy as any).max) } : {}),
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

  for (const ie of args.internalEvaluators) {
    const md = args.evalMetadata.get(ie.evalName);
    const primaryMetric = ie.metrics[0];
    if (primaryMetric) {
      const scope = 'scope' in primaryMetric ? primaryMetric.scope : 'single';
      metrics[primaryMetric.name] = {
        name: primaryMetric.name,
        scope: scope === 'multi' ? 'multi' : 'single',
        valueType: primaryMetric.valueType,
        ...(primaryMetric.description ? { description: primaryMetric.description } : {}),
        ...(primaryMetric.metadata ? { metadata: primaryMetric.metadata } : {}),
      };
    }

    evals[ie.evalName] = {
      name: ie.evalName,
      kind: ie.evalKind,
      outputShape: ie.evalKind === 'singleTurn' ? 'seriesByStepIndex' : 'scalar',
      metric: primaryMetric?.name ?? ie.evalName,
      ...(ie.evalKind === 'scorer'
        ? {
            scorer: {
              name: ie.scorer.name,
              inputs: ie.scorer.inputs.map((i) => i.metric.name),
              weights: ie.scorer.inputs.map((i) => i.weight),
            },
          }
        : {}),
      verdict: toPolicyInfo(md?.verdictPolicy),
      ...(ie.description ? { description: ie.description } : {}),
      ...(ie.metadata ? { metadata: ie.metadata } : {}),
    };
  }

  return { metrics, evals };
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
      ...(score !== undefined ? { score } : {}),
      ...(rawValue !== undefined ? { rawValue } : {}),
      ...(metric?.confidence !== undefined ? { confidence: metric.confidence } : {}),
      ...(metric?.reasoning !== undefined ? { reasoning: metric.reasoning } : {}),
      ...(metric ? { executionTimeMs: metric.executionTime } : {}),
      ...(metric ? { timestamp: metric.timestamp.toISOString() } : {}),
    };

    byStepIndex[stepIndex] = {
      eval: args.evalName,
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
    'steps' in args.container && Array.isArray((args.container as any).steps)
      ? (args.container as Conversation).steps.length
      : 1;

  const evaluatorByEval = new Map(args.internalEvaluators.map((ie) => [ie.evalName, ie]));

  const singleTurn: Record<string, SingleTurnEvalSeries> = {};
  const multiTurn: Record<string, ConversationEvalResult> = {};
  const scorers: ConversationResult['scorers'] = {};

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
        rawMetrics: targetRawMetrics,
        derivedEntry,
        verdicts: verdictList,
        policy,
      });
      continue;
    }

    if (md.evalKind === 'multiTurn') {
      const metricName = ie?.metrics[0]?.name;
      const metric = metricName
        ? targetRawMetrics.find((m) => m.metricDef.name === metricName)
        : undefined;
      const score = derivedEntry?.scores?.[0];
      const rawFallback = derivedEntry?.rawValues?.[0];
      const verdict = verdictList?.[0];

      const rawCandidate = metric?.value ?? rawFallback;
      const rawValue = asMetricScalarOrNull(rawCandidate);

      multiTurn[evalName] = {
        eval: evalName,
        measurement: {
          ...(score !== undefined ? { score } : {}),
          ...(rawValue !== undefined ? { rawValue } : {}),
          ...(metric?.confidence !== undefined ? { confidence: metric.confidence } : {}),
          ...(metric?.reasoning !== undefined ? { reasoning: metric.reasoning } : {}),
          ...(metric?.executionTime !== undefined ? { executionTimeMs: metric.executionTime } : {}),
          ...(metric?.timestamp ? { timestamp: new Date(metric.timestamp).toISOString() } : {}),
        },
        ...(verdict ? { outcome: toOutcome({ verdict, policy }) } : {}),
      };
      continue;
    }

    // scorer
    const scores = derivedEntry?.scores ?? [];
    if (scores.length <= 1) {
      const verdict = verdictList?.[0];
      const rawCandidate = derivedEntry?.rawValues?.[0];
      const rawValue = asMetricScalarOrNull(rawCandidate);
      scorers[evalName] = {
        shape: 'scalar',
        result: {
          eval: evalName,
          measurement: {
            ...(scores[0] !== undefined ? { score: scores[0] } : {}),
            ...(rawValue !== undefined ? { rawValue } : {}),
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
        rawMetrics: [],
        derivedEntry,
        verdicts: verdictList,
        policy,
      });
      scorers[evalName] = { shape: 'seriesByStepIndex', series };
    }
  }

  // summaries.byEval from pipeline evalSummaries
  const byEval: Record<string, import('@tally/core/types').EvalSummarySnap> = {};
  for (const [evalName, summary] of args.pipeline.evalSummaries.entries()) {
    const derivedEntryForCount = findDerivedForEval(targetDerived, evalName);
    const count = derivedEntryForCount?.scores.length ?? 0;
    byEval[evalName] = {
      eval: evalName,
      kind: summary.evalKind,
      count,
      aggregations: summary.aggregations,
      ...(summary.verdictSummary
        ? { verdictSummary: summary.verdictSummary }
        : {}),
    };
  }
  const summaries: Summaries | undefined = Object.keys(byEval).length ? ({ byEval } as Summaries) : undefined;

  return {
    stepCount,
    singleTurn,
    multiTurn,
    scorers,
    ...(summaries ? { summaries } : {}),
  };
}

/**
 * Validate evaluator has required fields
 */
const validateEvaluator = (evaluator: Evaluator<MetricContainer>): void =>
  match(evaluator)
    .with({ evals: P.when((e) => !e || e.length === 0) }, ({ name }) => {
      throw new Error(`Tally: evaluator "${name}" must have at least one eval`);
    })
    .with({ context: P.nullish }, ({ name }) => {
      throw new Error(`Tally: evaluator "${name}" must have a context`);
    })
    .otherwise(() => undefined);

/**
 * Validate constructor inputs
 */
const validateInputs = (data: unknown, evaluators: unknown): void => {
  match({ data, evaluators })
    .with({ data: P.when((d) => !Array.isArray(d)) }, () => {
      throw new Error('Tally: data must be an array');
    })
    .with({ evaluators: P.when((e) => !Array.isArray(e)) }, () => {
      throw new Error('Tally: evaluators must be an array');
    })
    .with({ evaluators: P.when((e) => Array.isArray(e) && e.length === 0) }, () => {
      throw new Error('Tally: at least one evaluator is required');
    })
    .otherwise(() => undefined);
};

/**
 * Tally container implementation
 */
export class TallyContainer<TContainer extends DatasetItem | Conversation>
  implements Tally<TContainer>
{
  public readonly data: readonly TContainer[];
  public readonly evaluators: readonly Evaluator<MetricContainer>[];

  constructor(data: readonly TContainer[], evaluators: readonly Evaluator<MetricContainer>[]) {
    validateInputs(data, evaluators);
    evaluators.forEach(validateEvaluator);

    this.data = data;
    this.evaluators = evaluators;
  }

  /**
   * Run the full evaluation pipeline
   *
   * @param options - Optional pipeline options (cache, LLM options, metadata)
   * @returns Evaluation report with per-target results and aggregate summaries
   */
  async run(options?: {
    cache?: MemoryCache<MetricScalar>;
    llmOptions?: GenerateObjectOptions;
    metadata?: Record<string, unknown>;
  }): Promise<TallyRunReport> {
    const runId = generateRunId();
    const createdAt = new Date();

    // Convert evals to internal evaluators
    // Collect all evals from all evaluators
    const allEvals = this.evaluators.flatMap((evaluator) => evaluator.evals);
    const { internalEvaluators, evalMetadata } = buildFromEvals(allEvals);

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
        evaluatorCount: this.evaluators.length,
      },
    };

    return createTallyRunReport(artifact);
  }
}

/**
 * Create a Tally container
 *
 * Convenience factory function for creating a Tally instance.
 *
 * @param data - Array of containers (DatasetItem[] or Conversation[])
 * @param evaluators - Array of evaluators (with evals)
 * @returns Tally container instance
 */
export function createTally<TContainer extends DatasetItem | Conversation>(args: {
  data: readonly TContainer[];
  evaluators: readonly Evaluator<MetricContainer>[];
}): Tally<TContainer> {
  return new TallyContainer(args.data, args.evaluators);
}
