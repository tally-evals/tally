import type { ModelMessage, LanguageModel } from 'ai';
import type { StepRanker } from './execution/stepRanker.js';
import type { StepGraph } from './steps/types.js';

// ============================================================================
// Trajectory Types
// ============================================================================

export type TrajectoryMode = 'strict' | 'loose';

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

export interface LooseConfig {
	/** Custom step ranker (optional, uses default LLM ranker if not provided) */
	ranker?: StepRanker;
	/** Minimum confidence score to select a step (default: 0.5) */
	scoreThreshold?: number;
	/** Minimum score difference between top candidates (default: 0.1) */
	margin?: number;
	/** Fallback strategy when confidence is low (default: 'sequential') */
	fallback?: 'sequential' | 'stay';
}

export interface Trajectory {
	goal: string;
	persona: Persona;
	steps?: StepGraph;
	mode: TrajectoryMode;
	maxTurns?: number;
	storage?: StorageConfig; // built-in storage; defaults to 'local'
	userModel?: LanguageModel; // AI SDK model function for user message generation
	metadata?: Record<string, unknown>;
	// Loop detection for loose mode
	loopDetection?: {
		/** Maximum consecutive times the same step can be selected (default: 3) */
		maxConsecutiveSameStep?: number;
		/** Maximum consecutive turns with no step match (default: 3) */
		maxConsecutiveNoMatch?: number;
		/** Maximum cycle length to detect (e.g., 2 = detect A->B->A patterns) (default: 3) */
		maxCycleLength?: number;
		/** Maximum number of times a cycle can repeat before stopping (default: 2) */
		maxCycleRepetitions?: number;
	};
	// Loose mode configuration
	loose?: LooseConfig;
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

