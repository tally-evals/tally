import type { Eval, EvaluationContext, TallyRunOptions } from '@tally-evals/tally';
import type { Trajectory } from '@tally-evals/trajectories';
import { type CreateCandidatePromptOptions, createCandidatePrompt } from './createCandidatePrompt';
import { evaluateCandidate } from './evaluateCandidate';
import {
  type CreateOptimizationJobOptions,
  analyzeFailures,
  createCycleOutput,
  createOptimizationJob,
  createTrajectorySet,
  evaluateStopCondition,
  selectFinalCandidate,
} from './optimizationJobPhases';
import type { AttachedTrajectorySet, OptimizationJobStore } from './optimizationJobStore';
import type {
  CandidateAgent,
  CandidatePrompt,
  CycleOutput,
  FinalCandidateDecision,
  OptimizationJob,
  OptimizationJobConfig,
  StopDecision,
  TrajectorySet,
} from './types';

/**
 * One cycle: run the **current** `candidatePrompt` on the job’s **fixed** trajectory set
 * (`attached`), producing **new** runs / conversations for Tally. The set of trajectories does
 * not change between cycles; only the candidate (prompt) and the resulting run ids do.
 */
// runs the candidate on the trajectory set 
export type RunCandidateOnTrajectorySet<T extends Trajectory = Trajectory> = (args: {
  optimizationJobId: string;
  attached: AttachedTrajectorySet<T>;
  candidatePrompt: CandidatePrompt;
}) => Promise<CandidateAgent<T>>;

/*
End-to-end optimisation job loop: create job and trajectory set, then for each cycle 
run the candidate on the trajectory set, evaluate the candidate, create a cycle output, 
evaluate the stop condition, create a new candidate prompt, and continue. 
*/
export type RunOptimizationJobInput<T extends Trajectory = Trajectory> = {
  store: OptimizationJobStore;
  config: OptimizationJobConfig;
  /** Fixed trajectory set for the job (same definitions for every candidate). */
  trajectories: readonly T[];
  /** First prompt; must already include a unique `candidateAgentId`. */
  initialCandidatePrompt: CandidatePrompt;
  evals: readonly Eval[];
  runCandidateOnTrajectorySet: RunCandidateOnTrajectorySet<T>;
  createCandidatePromptOptions: CreateCandidatePromptOptions;
  createJobOptions?: CreateOptimizationJobOptions;
  context?: EvaluationContext;      
  runOptions?: TallyRunOptions;
};

export type RunOptimizationJobResult = {
  job: OptimizationJob;
  trajectorySet: TrajectorySet;
  finalDecision: FinalCandidateDecision;
  cycleOutputs: readonly CycleOutput[];
  /** Stop decision for the last completed cycle (or the cycle that ended the job). */
  lastStop: StopDecision;
};

// asserts that the candidate agent matches the prompt and job id in the store
function assertAgentMatchesPrompt(
  agent: CandidateAgent,
  job: OptimizationJob,
  prompt: CandidatePrompt
): void {
  if (agent.optimizationJobId !== job.optimizationJobId) {
    throw new Error(
      `runOptimizationJob: CandidateAgent optimizationJobId ${agent.optimizationJobId} does not match job ${job.optimizationJobId}`
    );
  }
  if (agent.candidateAgentId !== prompt.candidateAgentId) {
    throw new Error(
      `runOptimizationJob: CandidateAgent candidateAgentId ${agent.candidateAgentId} does not match current prompt ${prompt.candidateAgentId}`
    );
  }
}

/**
 * End-to-end optimization job loop: create job and trajectory set, then for each cycle run the
 * candidate on the fixed set, `evaluateCandidate` with Tally, record `CycleOutput`, stop
 * or `createCandidatePrompt` and continue, then `selectFinalCandidate`.
 */
export async function runOptimizationJob<T extends Trajectory = Trajectory>(
  input: RunOptimizationJobInput<T>
): Promise<RunOptimizationJobResult> {
  const {
    store,
    config,
    trajectories,
    initialCandidatePrompt,
    evals,
    runCandidateOnTrajectorySet,
    createCandidatePromptOptions,
    createJobOptions,
    context,
    runOptions,
  } = input;

  // create the optimization job and trajectory set
  const job = await createOptimizationJob(store, config, createJobOptions);
  const trajectorySet = await createTrajectorySet(store, {
    optimizationJobId: job.optimizationJobId,
    trajectories,
  });
  // get the attached trajectory set from the store
  const attached = store.getAttachedTrajectorySet<T>(job.optimizationJobId);
  if (!attached) {
    throw new Error('runOptimizationJob: trajectory set missing after createTrajectorySet');
  }

  // register the initial candidate prompt in the store
  store.registerCandidate({
    optimizationJobId: job.optimizationJobId,
    candidateAgentId: initialCandidatePrompt.candidateAgentId,
    prompt: initialCandidatePrompt,
  });

  // initialize the current prompt and last stop decision
  let currentPrompt = initialCandidatePrompt;
  let lastStop: StopDecision = { stop: false, reason: 'continue' };
  let completedCycles = 0;

  // run the optimization job loop
  for (;;) {
    const candidateAgent = await runCandidateOnTrajectorySet({
      optimizationJobId: job.optimizationJobId,
      attached,
      candidatePrompt: currentPrompt,
    });
    assertAgentMatchesPrompt(candidateAgent, job, currentPrompt);

    const evaluation = await evaluateCandidate({
      candidateAgent,
      evals,
      evaluationPolicy: config.evaluationPolicy,
      store,
      ...(context !== undefined ? { context } : {}),
      ...(runOptions !== undefined ? { runOptions } : {}),
    });

    await createCycleOutput(store, {
      optimizationJobId: job.optimizationJobId,
      candidatePrompt: currentPrompt,
      evaluation,
    });
    completedCycles += 1;

    const cycleOutput = store.listCycleOutputs(job.optimizationJobId).at(-1);
    if (!cycleOutput) {
      throw new Error('runOptimizationJob: expected cycle output after createCycleOutput');
    }

    lastStop = evaluateStopCondition({
      cycle: completedCycles,
      cycleOutput,
      maxCycles: config.maxCycles,
      acceptanceThreshold: config.acceptanceThreshold,
    });
    if (lastStop.stop) {
      break;
    }

    const analysis = analyzeFailures({ cycleOutput });
    const nextPrompt = await createCandidatePrompt(
      store,
      {
        cycleOutput,
        analysis,
        generationConfig: currentPrompt.generationConfig,
      },
      createCandidatePromptOptions
    );
    store.registerCandidate({
      optimizationJobId: job.optimizationJobId,
      candidateAgentId: nextPrompt.candidateAgentId,
      prompt: nextPrompt,
    });
    currentPrompt = nextPrompt;
  }

  const cycleOutputs = store.listCycleOutputs(job.optimizationJobId);
  const finalDecision = await selectFinalCandidate(store, {
    optimizationJobId: job.optimizationJobId,
    cycleOutputs: [...cycleOutputs],
  });

  return {
    job,
    trajectorySet,
    finalDecision,
    cycleOutputs,
    lastStop,
  };
}
