/**
 * Human-in-the-Loop (HIL) types for trajectory execution
 *
 * These types define the configuration and runtime data structures for
 * simulating HIL interactions during trajectory generation.
 *
 * In real-world agent frameworks (AI SDK, Mastra), HIL occurs when an agent
 * issues a tool call that requires human approval, input supplementation,
 * or plan confirmation before proceeding. The agent's response contains
 * tool-call parts without matching tool-result parts.
 *
 * During trajectory generation the orchestrator detects these pending tool
 * calls and resolves them via the configured HIL strategy (callback,
 * deterministic policy, or LLM-as-user).
 */

import type { ModelMessage } from 'ai';
import type { StepTrace } from '../types.js';
import type { Persona } from '../types.js';
import type { StepDefinition } from '../steps/types.js';

// ============================================================================
// Tool Call Representation
// ============================================================================

/**
 * A pending tool call detected in an agent response that has no matching
 * tool-result — i.e. it requires human intervention.
 */
export interface HILToolCall {
	/** The tool-call ID assigned by the agent runtime */
	toolCallId: string;

	/** The name of the tool the agent wants to invoke */
	toolName: string;

	/** The arguments the agent supplied for the tool call */
	args: unknown;
}

// ============================================================================
// Decision Types (discriminated union)
// ============================================================================

/**
 * An approval decision — the simulated user approves the tool call.
 * An optional `result` can supply a concrete tool-result value; when
 * omitted the orchestrator synthesises `{ approved: true }`.
 */
export interface HILApproveDecision {
	type: 'approve';
	/** Optional concrete result to return to the agent */
	result?: unknown;
}

/**
 * A rejection decision — the simulated user rejects the tool call.
 */
export interface HILRejectDecision {
	type: 'reject';
	/** Optional human-readable reason for rejection */
	reason?: string;
}

/**
 * The decision made for a single HIL tool call.
 */
export type HILDecision = HILApproveDecision | HILRejectDecision;

// ============================================================================
// Context provided to handlers / LLM
// ============================================================================

/**
 * Rich context passed to HIL handlers and LLM prompt builders,
 * giving them full visibility into the trajectory state.
 */
export interface HILContext {
	/** The current trajectory goal */
	goal: string;

	/** The persona driving the simulated user */
	persona: Persona;

	/** Conversation history (full agent-memory snapshot) */
	history: readonly ModelMessage[];

	/** Step traces accumulated so far */
	stepTraces: readonly StepTrace[];

	/** The step currently being executed (if any) */
	currentStep?: StepDefinition;

	/** Turn index within the trajectory */
	turnIndex: number;
}

// ============================================================================
// Handler callback types
// ============================================================================

/**
 * A callback that resolves a single HIL tool call.
 * Returned decision controls what tool-result is sent back to the agent.
 */
export type HILHandler = (
	call: HILToolCall,
	context: HILContext,
) => Promise<HILDecision>;

// ============================================================================
// Per-tool policy
// ============================================================================

/**
 * Policy configuration for a specific tool.
 */
export interface HILToolPolicy {
	/**
	 * Strategy for resolving HIL calls to this tool.
	 *
	 * - `'approve'` — automatically approve (optionally with a fixed result)
	 * - `'reject'`  — automatically reject (optionally with a reason)
	 * - `'llm'`     — delegate to the LLM-as-user generator
	 *
	 * Optional when `handler` is provided (the handler takes precedence).
	 * When neither `behavior` nor `handler` is set, falls back to `defaultPolicy`.
	 */
	behavior?: 'approve' | 'reject' | 'llm';

	/**
	 * Natural-language guidance injected into the LLM prompt when
	 * `behavior` is `'llm'`. Helps steer the LLM's decision.
	 *
	 * @example "Always approve flight bookings under $500"
	 */
	guidance?: string;

	/**
	 * Per-tool callback override. When provided this takes precedence
	 * over `behavior`.
	 */
	handler?: HILHandler;

	/**
	 * Fixed result to return when `behavior` is `'approve'`.
	 * If omitted, `{ approved: true }` is synthesised.
	 *
	 * **Note:** This value is only used by the deterministic handler.
	 * AI SDK and Mastra wrappers execute the actual tool after approval;
	 * they do not inject `approveResult` as the tool result.
	 */
	approveResult?: unknown;

	/**
	 * Fixed reason to return when `behavior` is `'reject'`.
	 * If omitted, `"Rejected by HIL policy"` is used.
	 */
	rejectReason?: string;
}

// ============================================================================
// Top-level HIL configuration (lives on Trajectory.hil)
// ============================================================================

/**
 * Human-in-the-Loop configuration for a trajectory.
 *
 * @example
 * ```ts
 * const trajectory: Trajectory = {
 *   goal: 'Book a flight',
 *   persona: { description: 'A cautious traveller' },
 *   hil: {
 *     defaultPolicy: 'llm',
 *     maxRoundtripsPerTurn: 3,
 *     tools: {
 *       bookFlight:  { behavior: 'approve' },
 *       deleteFlight: { behavior: 'reject', rejectReason: 'User never cancels' },
 *       askForConfirmation: { behavior: 'llm', guidance: 'Approve if price < $500' },
 *     },
 *   },
 * };
 * ```
 */
export interface HILConfig {
	/**
	 * Per-tool policies keyed by tool name.
	 * Tools not listed here fall back to `defaultPolicy`.
	 */
	tools?: Record<string, HILToolPolicy>;

	/**
	 * Fallback strategy for tools detected as HIL calls but not listed
	 * in `tools`. Defaults to `'llm'`.
	 */
	defaultPolicy?: 'approve' | 'reject' | 'llm';

	/**
	 * Maximum number of HIL round-trips (detect → resolve → re-invoke)
	 * allowed per orchestrator turn. Prevents runaway loops when an
	 * agent keeps issuing HIL calls. Defaults to `5`.
	 */
	maxRoundtripsPerTurn?: number;

	/**
	 * Global callback override for all HIL events.
	 * When provided, this takes precedence over `tools` and
	 * `defaultPolicy` for every tool call.
	 */
	handler?: HILHandler;
}

// ============================================================================
// Interaction trace record (recorded in StepTrace)
// ============================================================================

/**
 * A single recorded HIL interaction for tracing and evaluation.
 */
export interface HILInteraction {
	/** The tool call that triggered the HIL interaction */
	toolCall: HILToolCall;

	/** The decision that was made */
	decision: HILDecision;

	/** How the decision was made */
	method: 'callback' | 'llm' | 'default';

	/** When the interaction occurred */
	timestamp: Date;
}
