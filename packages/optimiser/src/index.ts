/**
 * `@tally-evals/hrpo` — optimization job orchestration over a fixed trajectory set,
 * Tally evaluation, weighted aggregates, and candidate prompt iteration.
 *
 * **Phase-style entry points**
 * - Job / trajectories: `createOptimizationJob`, `createTrajectorySet`, `OptimizationJobStore`
 * - Execution + Tally: `evaluateCandidate` (per-trajectory runs → pooled `EvalSummaries`)
 * - Cycle record (Phase 8): `createCycleOutput` — durable snapshot with artifact refs + evidence
 * - Loop: `runOptimizationJob` — run → evaluate → `createCycleOutput` → stop / next prompt → `selectFinalCandidate`
 * - Evidence helpers: `buildEvalSummariesFromArtifact`, `poolEvalSummaries`, `computeAggregatedPassRate`
 */
export * from './types';
export {
  assertValidOptimizationJobConfig,
  EmptyCandidatePoolError,
  InvalidOptimizationConfigError,
  JobNotFoundError,
  MismatchedCandidateIdError,
  NoCycleOutputsError,
  PreviousCandidatePromptNotFoundError,
  TallyArtifactRefKeyCollisionError,
  TrajectorySetAlreadyAttachedError,
} from './errors';
export {
  InMemoryOptimizationJobStore,
  createInMemoryOptimizationJobStore,
} from './optimizationJobStore';
export type { AttachedTrajectorySet, OptimizationJobStore } from './optimizationJobStore';
export {
  allEvalSummariesList,
  buildEvalSummariesFromArtifact,
  computeAggregatedPassRate,
  evalSummaryIsPassing,
  poolEvalSummaries,
} from './evalSummaries';
export { evaluateCandidate } from './evaluateCandidate';
export type { EvaluateCandidateInput } from './evaluateCandidate';
export { createCandidatePrompt } from './createCandidatePrompt';
export type {
  CreateCandidatePromptOptions,
  GenerateNextCandidatePromptText,
} from './createCandidatePrompt';
export {
  analyzeFailures,
  createCycleOutput,
  createOptimizationJob,
  createTrajectorySet,
  evaluateStopCondition,
  selectFinalCandidate,
} from './optimizationJobPhases';
export type { CreateOptimizationJobOptions } from './optimizationJobPhases';
export { runOptimizationJob } from './runOptimizationJob';
export type {
  RunOptimizationJobInput,
  RunOptimizationJobResult,
  RunCandidateOnTrajectorySet,
} from './runOptimizationJob';

export { createTally } from '@tally-evals/tally';
export type { Conversation, Eval, TallyRunArtifact, VerdictSummary } from '@tally-evals/tally';

export { createTrajectory } from '@tally-evals/trajectories';
export type { Trajectory } from '@tally-evals/trajectories';
