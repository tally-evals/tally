import type { Conversation, EvalSummary } from '@tally-evals/tally';
import type { Trajectory } from '@tally-evals/trajectories';

// ── Job & policy (Phase 1 API) ───────────────────────────────────────────────

export type EvaluationPolicy = {
  /** Relative importance of each eval when computing the optimization job score. */
  evalWeights: Record<string, number>;
  /** Evals that must be present and explicitly considered. */
  requiredEvals?: string[];
};

export type OptimizationJobConfig = {
  maxCycles: number;
  acceptanceThreshold: number;
  evaluationPolicy: EvaluationPolicy;
};

export type OptimizationJob = {
  optimizationJobId: string;
  config: OptimizationJobConfig;
  createdAt: string;
};

// ── Trajectory set (Phase 2 API) ──────────────────────────────────────────────

export type CreateTrajectorySetInput<TrajectoryItem = Trajectory> = {
  optimizationJobId: string;
  trajectories: readonly TrajectoryItem[];
};
// output type for the createTrajectorySetInput function
export type TrajectorySet = {
  trajectoryIds: string[];
  createdAt: string;
};

/** One trajectory row executed for a candidate agent; `conversation` is Tally input. */
export type CandidateAgentTrajectoryRun<T = Trajectory> = {
  trajectoryId: string;
  trajectory: T;
  conversation: Conversation;
  runId: string;
};

/** Completed candidate-agent execution batch for the job’s fixed trajectory*/
export type CandidateAgent<T = Trajectory> = {
  optimizationJobId: string;
  candidateAgentId: string;
  runs: readonly CandidateAgentTrajectoryRun<T>[];
};

export type EvaluateCandidateAgentInput<T = Trajectory> = {
  candidateAgent: CandidateAgent<T>;
};

export type CandidateAgentEvaluation = {
  optimizationJobId: string;
  candidateAgentId: string;
  evalSummaries: EvalSummaries;
  aggregatedPassRate: number;
};

// ── Eval evidence (shared types) ────────────────────────────────────────────

export type ScopeIssue<EvalName extends string = string> = {
  eval: EvalName;
  reason: string;
  passRate: number;
};

export type ScopeOverview<EvalName extends string = string> = {
  summary: string;
  issues: ScopeIssue<EvalName>[];
  failingEvals: EvalName[];
  passingEvals: EvalName[];
};

export type EvalSummaries<
  SingleTurnEvalName extends string = string,
  MultiTurnEvalName extends string = string,
> = {
  singleTurn: Record<SingleTurnEvalName, EvalSummary>;
  multiTurn: Record<MultiTurnEvalName, EvalSummary>;
  singleTurnOverview: ScopeOverview<SingleTurnEvalName>;
  multiTurnOverview: ScopeOverview<MultiTurnEvalName>;
};

// Re-export Tally’s summary cell type for consumers defining custom `EvalSummaries`.
export type { EvalSummary } from '@tally-evals/tally';

// ── Failure analysis (Phase 4) ──────────────────────────────────────────────

export type AnalyzeCycleFailuresInput = {
  cycleOutput: CycleOutput;
};

export type FailureDetail = {
  trajectoryId: string;
  eval: string;
  level: 'step' | 'conversation' | 'summary';
  reason?: string;
};

export type FailureAnalysis = {
  failures: FailureDetail[];
  targetBlocks: string[];
};

// ── Stop condition (Phase 5) ─────────────────────────────────────────────────

export type StopConditionInput = {
  cycle: number;
  cycleOutput: CycleOutput;
  maxCycles: number;
  acceptanceThreshold?: number;
};

export type StopReason =
  | 'allEvalsPassing'
  | 'thresholdReached'
  | 'maxCycles';

export type StopDecision = {
  stop: boolean;
  reason: StopReason;
};

// ── Next candidate prompt (Phase 6) ───────────────────────────────────────────

export type CandidateGenerationConfig = {
  model: string;
  temperature?: number;
};

export type CandidatePromptInput = {
  cycleOutput: CycleOutput;
  analysis: FailureAnalysis;
  generationConfig: CandidateGenerationConfig;
};

export type CandidatePrompt = {
  candidateAgentId: string;
  generationConfig: CandidateGenerationConfig;
  createdAt: string;
};

// ── Candidate agent / execution batch metadata (Phase 7) ─────────────────────

export type CandidateAgentInput = {
  optimizationJobId: string;
  candidatePrompt: CandidatePrompt;
};

export type ActiveCandidateAgent<T = Trajectory> = {
  optimizationJobId: string;
  candidateAgentId: string;
  trajectories: readonly T[];
  startedAt: string;
  completedAt?: string;
};

// ── Cycle record (Phase 8) ───────────────────────────────────────────────────

export type TallyArtifactRef = {
  trajectoryId: string;
  runId: string;
  artifactPath: string;
};

export type CreateCycleOutputInput = {
  optimizationJobId: string;
  candidatePrompt: CandidatePrompt;
  evaluation: CandidateAgentEvaluation;
};

export type CycleOutput = {
  cycleOutputId: string;
  optimizationJobId: string;
  candidateAgentId: string;
  tallyArtifacts: TallyArtifactRef[];
  evalSummaries: EvalSummaries;
  aggregatedPassRate: number;
  createdAt: string;
};

// ── Final selection (Phase 9) ────────────────────────────────────────────────

export type FinalCandidateSelectionOptions = {
  evaluationPolicyOverride?: EvaluationPolicy;
};

export type SelectFinalCandidateInput = {
  optimizationJobId: string;
  cycleOutputs: CycleOutput[];
  options?: FinalCandidateSelectionOptions;
};

export type FinalCandidateDecision = {
  acceptedCandidateAgentId: string;
  selectedCycleOutputId: string;
  reason: string;
};
