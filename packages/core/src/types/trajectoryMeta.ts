/**
 * Trajectory meta (declarative JSON snapshot) for debugging/replay.
 *
 * This type is intended to be JSON-serializable. Do not add functions.
 */
export interface TrajectoryPersonaMeta {
  name?: string;
  description: string;
  guardrails?: readonly string[];
}

export interface TrajectoryLoopDetectionMeta {
  maxConsecutiveSameStep?: number;
  maxCycleLength?: number;
  maxCycleRepetitions?: number;
}

/**
 * Declarative step graph snapshot.
 *
 * Intentionally loose to avoid tight coupling to the trajectories package's
 * richer runtime types. This is meant for debugging/replay UI, not execution.
 */
export interface TrajectoryStepGraphMeta {
  start: string;
  terminals?: readonly string[];
  steps: readonly Record<string, unknown>[];
}

export interface TrajectoryMetaV1 {
  version: 1;
  trajectoryId: string;
  createdAt: Date;

  goal: string;
  persona: TrajectoryPersonaMeta;

  maxTurns?: number;
  loopDetection?: TrajectoryLoopDetectionMeta;

  /** Declarative snapshot of the step graph */
  stepGraph?: TrajectoryStepGraphMeta;

  /** Free-form metadata from caller */
  metadata?: Record<string, unknown>;
}

export type TrajectoryMeta = TrajectoryMetaV1;

