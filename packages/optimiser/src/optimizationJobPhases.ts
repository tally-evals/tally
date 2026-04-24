import type { EvalSummary } from '@tally-evals/tally';
import type { Trajectory } from '@tally-evals/trajectories';
import {
  EmptyCandidatePoolError,
  JobNotFoundError,
  MismatchedCandidateIdError,
  NoCycleOutputsError,
  assertValidOptimizationJobConfig,
} from './errors';
import {
  allEvalSummariesList,
  computeAggregatedPassRate,
  evalSummaryIsPassing,
} from './evalSummaries';
import type { OptimizationJobStore } from './optimizationJobStore';
import type {
  AnalyzeCycleFailuresInput,
  CreateCycleOutputInput,
  CreateTrajectorySetInput,
  CycleOutput,
  EvalSummaries,
  EvaluationPolicy,
  FailureAnalysis,
  FailureDetail,
  FinalCandidateDecision,
  OptimizationJob,
  OptimizationJobConfig,
  SelectFinalCandidateInput,
  StopConditionInput,
  StopDecision,
  TrajectorySet,
} from './types';

function stopContinue(): StopDecision {
  return { stop: false, reason: 'continue' };
}

function allEvalsPassingInSummaries(evalSummaries: EvalSummaries): boolean {
  const list = allEvalSummariesList(evalSummaries);
  if (list.length === 0) {
    return true;
  }
  return list.every(evalSummaryIsPassing);
}

function failureLevelForKind(kind: EvalSummary['kind']): FailureDetail['level'] {
  if (kind === 'singleTurn') {
    return 'step';
  }
  if (kind === 'scorer') {
    return 'summary';
  }
  return 'conversation';
}

function requiredEvalsSatisfied(
  evalSummaries: EvalSummaries,
  required: string[] | undefined
): boolean {
  if (!required?.length) {
    return true;
  }
  for (const name of required) {
    const s = evalSummaries.singleTurn[name] ?? evalSummaries.multiTurn[name];
    if (!s || !evalSummaryIsPassing(s)) {
      return false;
    }
  }
  return true;
}

function pickFinalFromPool(
  pool: readonly CycleOutput[],
  policy: EvaluationPolicy
): { selected: CycleOutput; score: number } {
  if (pool.length === 0) {
    throw new EmptyCandidatePoolError();
  }
  const first = pool[0];
  if (first === undefined) {
    throw new EmptyCandidatePoolError();
  }
  let best = first;
  let bestScore = computeAggregatedPassRate(best.evalSummaries, policy);
  for (const co of pool.slice(1)) {
    const score = computeAggregatedPassRate(co.evalSummaries, policy);
    if (score > bestScore) {
      best = co;
      bestScore = score;
    } else if (score === bestScore) {
      if (co.createdAt > best.createdAt) {
        best = co;
        bestScore = score;
      }
    }
  }
  return { selected: best, score: bestScore };
}

// ── Phase 5 APIs ───────────────────────────────────────────────────────────

export type CreateOptimizationJobOptions = {
  /** When the eval suite is known, pass its eval `name`s so keys are validated. */
  evalNames?: ReadonlySet<string> | readonly string[];
};

/**
 * Creates a job in the store after validating config (and policy keys if `evalNames` is set).
 */
export async function createOptimizationJob(
  store: OptimizationJobStore,
  config: OptimizationJobConfig,
  options?: CreateOptimizationJobOptions
): Promise<OptimizationJob> {
  const names =
    options?.evalNames === undefined
      ? undefined
      : options.evalNames instanceof Set
        ? options.evalNames
        : new Set(options.evalNames);
  assertValidOptimizationJobConfig(config, names);
  return store.createJob(config);
}

/**
 * Attaches the single fixed trajectory set for a job. Delegates to the store.
 */
export async function createTrajectorySet<T extends Trajectory = Trajectory>(
  store: OptimizationJobStore,
  input: CreateTrajectorySetInput<T>
): Promise<TrajectorySet> {
  const attached = store.attachTrajectorySet(input);
  return attached.trajectorySet;
}

/**
 * Persists a cycle snapshot: evaluation evidence, prompt linkage, and Tally ref paths from the store.
 */
export async function createCycleOutput(
  store: OptimizationJobStore,
  input: CreateCycleOutputInput
): Promise<CycleOutput> {
  const job = store.getJob(input.optimizationJobId);
  if (!job) {
    throw new JobNotFoundError(input.optimizationJobId);
  }
  if (input.candidatePrompt.candidateAgentId !== input.evaluation.candidateAgentId) {
    throw new MismatchedCandidateIdError();
  }
  const tallyArtifacts = store.listTallyArtifactRefsForCandidate(
    input.optimizationJobId,
    input.evaluation.candidateAgentId
  );
  const cycleOutput: CycleOutput = {
    cycleOutputId: crypto.randomUUID(),
    optimizationJobId: input.optimizationJobId,
    candidateAgentId: input.evaluation.candidateAgentId,
    tallyArtifacts: [...tallyArtifacts],
    evalSummaries: input.evaluation.evalSummaries,
    aggregatedPassRate: input.evaluation.aggregatedPassRate,
    createdAt: new Date().toISOString(),
  };
  store.putCycleOutput(cycleOutput);
  return cycleOutput;
}

/**
 * Derives a deterministic failure view from pooled `EvalSummaries` (no per-trajectory breakdown at this level).
 */
export function analyzeFailures(input: AnalyzeCycleFailuresInput): FailureAnalysis {
  const { singleTurn, multiTurn } = input.cycleOutput.evalSummaries;
  const failures: FailureDetail[] = [];
  const pooledId = 'pooled';

  for (const [name, summary] of Object.entries(singleTurn) as [string, EvalSummary][]) {
    if (!evalSummaryIsPassing(summary)) {
      const verdict = summary.verdictSummary;
      failures.push({
        trajectoryId: pooledId,
        eval: name,
        level: failureLevelForKind(summary.kind),
        reason: verdict
          ? `${verdict.failCount} fail / ${verdict.totalCount} total`
          : 'failing or missing verdict',
      });
    }
  }
  for (const [name, summary] of Object.entries(multiTurn) as [string, EvalSummary][]) {
    if (!evalSummaryIsPassing(summary)) {
      const verdict = summary.verdictSummary;
      failures.push({
        trajectoryId: pooledId,
        eval: name,
        level: failureLevelForKind(summary.kind),
        reason: verdict
          ? `${verdict.failCount} fail / ${verdict.totalCount} total`
          : 'failing or missing verdict',
      });
    }
  }

  const targetBlocks: string[] = [];
  if (failures.length > 0) {
    const blocks = new Set<string>(['full-prompt']);
    for (const f of failures) {
      if (f.level === 'conversation') {
        blocks.add('multi-turn');
      }
      if (f.level === 'summary') {
        blocks.add('summary-scorers');
      }
    }
    targetBlocks.push(...blocks);
  }

  return {
    failures,
    targetBlocks,
  };
}

/**
 * Stops on: all evals passing, acceptance threshold, or max cycles (in that order of precedence when multiple apply).
 */
export function evaluateStopCondition(input: StopConditionInput): StopDecision {
  if (allEvalsPassingInSummaries(input.cycleOutput.evalSummaries)) {
    return { stop: true, reason: 'allEvalsPassing' };
  }
  const thr = input.acceptanceThreshold;
  if (thr !== undefined && input.cycleOutput.aggregatedPassRate >= thr) {
    return { stop: true, reason: 'thresholdReached' };
  }
  if (input.cycle >= input.maxCycles) {
    return { stop: true, reason: 'maxCycles' };
  }
  return stopContinue();
}

/**
 * Picks the best candidate by weighted `aggregatedPassRate` (recomputed with the job’s policy);
 * prefers runs that satisfy `requiredEvals` when any do.
 */
export async function selectFinalCandidate(
  store: OptimizationJobStore,
  input: SelectFinalCandidateInput
): Promise<FinalCandidateDecision> {
  const job = store.getJob(input.optimizationJobId);
  if (!job) {
    throw new JobNotFoundError(input.optimizationJobId);
  }
  const list = input.cycleOutputs.filter((c) => c.optimizationJobId === input.optimizationJobId);
  if (list.length === 0) {
    throw new NoCycleOutputsError(input.optimizationJobId);
  }
  const policy = job.config.evaluationPolicy;
  const requiredOk = list.filter((c) =>
    requiredEvalsSatisfied(c.evalSummaries, policy.requiredEvals)
  );
  const pool = requiredOk.length > 0 ? requiredOk : list;
  const { selected, score } = pickFinalFromPool(pool, policy);
  return {
    acceptedCandidateAgentId: selected.candidateAgentId,
    selectedCycleOutputId: selected.cycleOutputId,
    reason: buildSelectionReason(selected, score, policy, requiredOk.length > 0, list.length),
  };
}

function buildSelectionReason(
  selected: CycleOutput,
  score: number,
  policy: EvaluationPolicy,
  anyRequiredSatisfied: boolean,
  totalCount: number
): string {
  const req = policy.requiredEvals?.length
    ? anyRequiredSatisfied
      ? 'Required evals satisfied among compared cycles; '
      : 'No cycle satisfied all required evals; chose best weighted aggregate. '
    : '';
  return (
    `${req}Selected candidate ${selected.candidateAgentId} (cycle output ${selected.cycleOutputId}) ` +
    `with weighted score ${score.toFixed(4)}. Compared ${totalCount} cycle(s).`
  );
}
