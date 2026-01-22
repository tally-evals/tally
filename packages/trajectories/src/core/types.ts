import type { ModelMessage, LanguageModel } from 'ai';
import type { StepGraph } from './steps/types.js';

// ============================================================================
// Trajectory Types
// ============================================================================

export interface Persona {
	name?: string;
	description: string;
	guardrails?: readonly string[];
}

export interface StorageConfig {
	strategy: 'local' | 'none';
	ttlMs?: number;
	capacity?: number;
	conversationId?: string;
}

export interface Trajectory {
	goal: string;
	persona: Persona;
	steps?: StepGraph;
	maxTurns?: number;
	storage?: StorageConfig; // built-in storage; defaults to 'local'
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

export interface StepTrace {
	turnIndex: number;
	userMessage: ModelMessage;
	agentMessages: readonly ModelMessage[];
	timestamp: Date;
}

export type TrajectoryStopReason =
	| 'goal-reached'
	| 'max-turns'
	| 'policy-violation'
	| 'agent-loop'
	| 'no-step-match'
	| 'error';

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

