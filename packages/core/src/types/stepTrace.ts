/**
 * Step trace types for trajectory execution
 */

import type { ModelMessage } from './messages';

export type StepSelectionMethod =
  | 'start'
  | 'preconditions-ordered'
  | 'llm-ranked'
  | 'none';

export interface StepSelectionCandidate {
  stepId: string;
  score: number;
  reasons?: string[];
}

export interface StepSelectionInfo {
  method: StepSelectionMethod;
  candidates?: readonly StepSelectionCandidate[];
}

export interface StepTraceEnd {
  isFinal: true;
  reason: TrajectoryStopReason;
  completed: boolean;
  summary?: string;
}

/**
 * Raw trace from trajectory execution
 *
 * Represents a single turn in trajectory simulation before conversion
 * to ConversationStep format.
 */
export interface StepTrace {
  /** Turn index within trajectory */
  turnIndex: number;

  /** Generated user message */
  userMessage: ModelMessage;

  /** All agent response messages (assistant + tool) */
  agentMessages: readonly ModelMessage[];

  /** When this step occurred */
  timestamp: Date;

  /** Associated step ID from step graph */
  stepId: string | null;

  /** Step selection info */
  selection: StepSelectionInfo;

  /** Optional end marker (set on the final emitted step) */
  end?: StepTraceEnd;
}

/**
 * Why a trajectory ended
 */
export type TrajectoryStopReason =
  | 'goal-reached' // Terminal step reached
  | 'max-turns' // Maximum turns exceeded
  | 'policy-violation' // Policy determined violation
  | 'agent-loop' // Loop detected
  | 'no-step-match' // No step matches
  | 'error'; // Error occurred
