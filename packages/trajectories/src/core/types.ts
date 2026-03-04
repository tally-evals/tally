import type { ModelMessage, LanguageModel } from 'ai';
import type { StepGraph } from './steps/types.js';
import type { StepTrace, TrajectoryStopReason } from '@tally-evals/core';

// ============================================================================
// Trajectory Types
// ============================================================================

export interface Persona {
	name?: string;
	description: string;
	guardrails?: readonly string[];
}

export interface Trajectory {
	goal: string;
	persona: Persona;
	steps?: StepGraph;
	maxTurns?: number;
	/** Optional stable conversation id used for logs/export (defaults to generated id) */
	conversationId?: string;
	userModel?: LanguageModel; // AI SDK model function for user message generation
	metadata?: Record<string, unknown>;
	// Loop detection (mode-agnostic)
	loopDetection?: {
		/** Maximum consecutive times the same step can be selected (default: 3) */
		maxConsecutiveSameStep?: number;
	};
}

// ============================================================================
// Execution Types
// ============================================================================

export type { StepTrace, TrajectoryStopReason };

export interface TrajectoryResult {
	steps: readonly StepTrace[];
	completed: boolean;
	reason: TrajectoryStopReason;
	summary?: string;
	traces?: unknown;
}

// ============================================================================
// Agent Handle
// ============================================================================

/**
 * Agent wrapper handle returned by withAISdkAgent / withMastraAgent
 */
export interface AgentHandle {
	respond(
		history: readonly ModelMessage[]
	): Promise<{
		messages: readonly ModelMessage[];
	}>;
}

