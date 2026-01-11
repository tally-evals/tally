/**
 * Run metadata types for trajectory and tally executions
 */

import type { TrajectoryStopReason } from './stepTrace';

/**
 * Metadata for a trajectory execution run
 */
export interface TrajectoryRunMeta {
  /** Unique run identifier */
  runId: string;

  /** Associated conversation ID */
  conversationId: string;

  /** When the run occurred */
  timestamp: Date;

  /** Trajectory goal */
  goal: string;

  /** Persona used */
  persona: {
    name?: string;
    description: string;
  };

  /** Whether goal was reached */
  completed: boolean;

  /** Why the trajectory ended */
  reason: TrajectoryStopReason;

  /** Number of turns executed */
  totalTurns: number;

  /** Number of steps in graph */
  stepCount?: number;

  /** Number of steps completed */
  stepsCompleted?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metadata for a tally evaluation run
 */
export interface TallyRunMeta {
  /** Unique run identifier */
  runId: string;

  /** Associated conversation ID */
  conversationId: string;

  /** When the run occurred */
  timestamp: Date;

  /** Evaluator names used */
  evaluatorNames: string[];

  /** Eval names used */
  evalNames: string[];

  /** Number of targets evaluated */
  targetCount: number;

  /** Quick summary for listings */
  summary: {
    /** Overall pass rate across all evals */
    overallPassRate?: number;

    /** Mean score per eval */
    evalMeans: Record<string, number>;

    /** Verdict counts */
    verdicts?: {
      pass: number;
      fail: number;
      unknown: number;
      total: number;
    };
  };

  /** Tags for filtering */
  tags?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
