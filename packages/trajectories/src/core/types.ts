import type { ModelMessage, LanguageModel } from 'ai';
import type { StepGraph } from './steps/types.js';
import type { StepTrace, TrajectoryStopReason } from '@tally-evals/core';
import type { HILConfig, HILToolCall, HILDecision } from './hil/types.js';

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
	/**
	 * Human-in-the-Loop configuration.
	 *
	 * When set, the orchestrator detects pending tool calls in the agent
	 * response (using framework-specific detection via the wrapper) and
	 * resolves them using the configured strategy before re-invoking.
	 */
	hil?: HILConfig;
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
 * Response from an agent invocation.
 */
export interface AgentResponse {
	/** All messages returned by the agent (assistant + tool) */
	messages: readonly ModelMessage[];

	/**
	 * Tool calls that require human-in-the-loop resolution.
	 *
	 * Empty array when there are no pending HIL calls.
	 */
	pendingToolCalls: readonly HILToolCall[];
}

/**
 * A map of tool-call ID → decision, returned to the wrapper to resolve
 * pending HIL calls using the framework's native approval protocol.
 */
export type HILDecisionMap = ReadonlyMap<string, HILDecision>;

/**
 * Agent wrapper handle returned by withAISdkAgent / withMastraAgent.
 *
 * Each wrapper implements framework-specific detection and resolution
 * of HIL (human-in-the-loop) tool calls:
 *
 * - `respond()` detects pending tool calls and returns them in
 *   `AgentResponse.pendingToolCalls`
 * - `resolveHIL()` applies decisions using the framework's native
 *   approval protocol and re-invokes the agent
 */
export interface AgentHandle {
	/**
	 * Send messages to the agent and get a response.
	 *
	 * If the agent's response contains pending HIL tool calls, they
	 * are reported in `AgentResponse.pendingToolCalls`. The caller
	 * should resolve them via `resolveHIL()`.
	 */
	respond(
		history: readonly ModelMessage[]
	): Promise<AgentResponse>;

	/**
	 * Resolve pending HIL tool calls using the framework's native
	 * approval protocol and re-invoke the agent.
	 *
	 * @param decisions  Map of toolCallId → HILDecision
	 * @param history    Current full conversation history
	 * @returns          New agent response (may contain further HIL calls)
	 */
	resolveHIL?(
		decisions: HILDecisionMap,
		history: readonly ModelMessage[],
	): Promise<AgentResponse>;
}

