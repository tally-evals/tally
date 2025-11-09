import type { ModelMessage, LanguageModel } from 'ai';

// ============================================================================
// Trajectory Types
// ============================================================================

export type TrajectoryMode = 'strict' | 'loose';

export interface Persona {
	name?: string;
	description: string;
	guardrails?: readonly string[];
}

export interface TrajectoryStep {
	instruction: string;
	expectedOutcome?: string;
	requiredInfo?: readonly string[];
	hardStopIfMissing?: boolean;
}

export interface MemoryConfig {
	strategy: 'local' | 'none';
	ttlMs?: number;
	capacity?: number;
	conversationId?: string;
}

export interface Trajectory {
	goal: string;
	persona: Persona;
	steps?: readonly TrajectoryStep[];
	mode: TrajectoryMode;
	maxTurns?: number;
	memory?: MemoryConfig; // built-in memory; defaults to 'local'
	userModel?: LanguageModel; // AI SDK model function for user message generation
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface StepTrace {
	turnIndex: number;
	userMessage: ModelMessage;
	agentMessages: readonly ModelMessage[];
	toolCalls?: readonly {
		toolCallId: string;
		toolName: string;
		args: unknown;
		result?: unknown;
	}[];
	timestamp: Date;
}

export type TrajectoryStopReason =
	| 'goal-reached'
	| 'max-turns'
	| 'policy-violation'
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

