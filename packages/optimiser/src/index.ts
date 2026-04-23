/**
 * @tally-evals/hrpo — Human-in-the-loop prompt optimization on a fixed trajectory set (v4).
 * Phase 1: API-aligned types; Phase 2: in-memory job store.
 */

export * from './types';
export {
  JobNotFoundError,
  TallyArtifactRefKeyCollisionError,
  TrajectorySetAlreadyAttachedError,
} from './errors';
export {
  InMemoryOptimizationJobStore,
  createInMemoryOptimizationJobStore,
} from './optimizationJobStore';
export type { AttachedTrajectorySet, OptimizationJobStore } from './optimizationJobStore';

export { createTally } from '@tally-evals/tally';
export type { Conversation, Eval, TallyRunArtifact } from '@tally-evals/tally';

export { createTrajectory } from '@tally-evals/trajectories';
export type { Trajectory } from '@tally-evals/trajectories';
