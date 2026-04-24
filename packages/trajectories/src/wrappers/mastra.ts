/**
 * Mastra agent wrapper
 *
 * Normalises Mastra agents (real or mock) to the AgentHandle interface,
 * including HIL detection via stream suspension and resolution via
 * `approveToolCall` / `declineToolCall`.
 */

import type { ModelMessage } from 'ai';
import type { AgentHandle, AgentResponse, HILDecisionMap } from '../core/types.js';
import type { HILToolCall } from '../core/hil/types.js';
import { Agent } from '@mastra/core/agent';

// ============================================================================
// Internal types
// ============================================================================

/**
 * Normalised shape of a raw Mastra agent output.
 *
 * Compatible with both real `MastraModelOutput` proxies (lazy Promise getters,
 * returned by `agent.stream()`) and plain objects (returned by test mocks via
 * `agent.generate()`).
 */
interface MastraRawOutput {
	text?: string;
	steps?: Array<{ response?: { messages: ModelMessage[] } }>;
	finishReason?: string;
	runId?: string;
	/** Set to `{ toolCallId, toolName, args }` when the agent suspended for HIL. */
	suspendPayload?: { toolCallId: string; toolName: string; args: unknown };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Extract `ModelMessage[]` from a normalised Mastra output.
 *
 * Prefers `steps[last].response.messages`; falls back to a plain assistant
 * message built from the `text` field.
 */
function extractMessages(out: MastraRawOutput): ModelMessage[] {
	if (out.steps && out.steps.length > 0) {
		const lastStep = out.steps[out.steps.length - 1];
		if (lastStep?.response?.messages && lastStep.response.messages.length > 0) {
			return lastStep.response.messages;
		}
	}
	if (out.text) {
		return [{ role: 'assistant', content: out.text }];
	}
	return [];
}

/**
 * Consume a `MastraModelOutput` stream proxy (or plain mock object) and return
 * a normalised `MastraRawOutput`.
 *
 * **Why `consumeStream()` must be called first (Mastra v1.x):**
 * The workflow engine persists suspended-state snapshots as part of the stream
 * pipeline. Reading `suspendPayload` before the stream is consumed does NOT
 * guarantee the snapshot has been flushed to storage — meaning
 * `approveToolCall` / `declineToolCall` would fail to find the run.
 *
 * Suspension semantics:
 * - `suspendPayload` always resolves (never hangs):
 *     • suspended:     `{ toolCallId, toolName, args }`
 *     • normal finish: `undefined`
 * - When suspended, `text` / `steps` must NOT be awaited (they remain pending).
 * - When NOT suspended, `text` / `steps` are fully resolved after
 *   `suspendPayload` resolves to `undefined`.
 */
async function processStreamOutput(raw: unknown): Promise<MastraRawOutput> {
	const any = raw as Record<string, unknown>;
	const runId = any.runId as string | undefined;

	if (typeof any.consumeStream === 'function') {
		try {
			await (any.consumeStream as () => Promise<void>)();
		} catch {
			// Tolerate stream errors — still attempt to read resolved properties.
		}
	}

	let suspendPayload: MastraRawOutput['suspendPayload'];
	try {
		suspendPayload = (await Promise.resolve(any.suspendPayload)) as MastraRawOutput['suspendPayload'];
	} catch {
		suspendPayload = undefined;
	}

	if (suspendPayload && typeof suspendPayload === 'object' && 'toolCallId' in suspendPayload) {
		// Agent suspended — do NOT await text/steps (they won't resolve).
		return { ...(runId != null ? { runId } : {}), suspendPayload };
	}

	let text: string | undefined;
	let steps: MastraRawOutput['steps'];
	try {
		text = (await Promise.resolve(any.text)) as string | undefined;
		steps = (await Promise.resolve(any.steps)) as MastraRawOutput['steps'];
	} catch {
		// Treat errors as empty output.
	}

	return {
		...(runId != null ? { runId } : {}),
		...(text != null ? { text } : {}),
		...(steps != null ? { steps } : {}),
	};
}

// ============================================================================
// Public types
// ============================================================================

/**
 * Structural type for Mastra Agent instances (or compatible mocks).
 *
 * Using a structural interface rather than importing the concrete `Agent`
 * class keeps the wrapper testable with lightweight mocks.
 *
 * **Note (Mastra single-suspension):** Mastra agents suspend on the first
 * tool with `requireApproval: true`. Only one tool call is pending at a
 * time — unlike AI SDK, which can surface multiple `tool-approval-request`
 * parts in a single response.
 */
export interface MastraAgentLike {
	generate: Agent['generate'];
	/** HIL-aware streaming (real Mastra v0.24+ agents). */
	stream?: Agent['stream'];
	/** Approve a suspended tool call and resume execution (Mastra v0.24+). */
	approveToolCall?: (opts: { runId: string; toolCallId?: string; resumeData?: unknown }) => Promise<unknown>;
	/** Decline a suspended tool call and resume execution (Mastra v0.24+). */
	declineToolCall?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
	/** @deprecated Legacy names kept for backward compatibility with test mocks. */
	approveToolCallGenerate?: (opts: { runId: string; toolCallId?: string; resumeData?: unknown }) => Promise<unknown>;
	/** @deprecated Legacy names kept for backward compatibility with test mocks. */
	declineToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
}

// ============================================================================
// withMastraAgent
// ============================================================================

/**
 * Wrapper for Mastra Agent (real or mock).
 *
 * **HIL detection — real agents (`stream()` available)**
 * Calls `agent.stream()` with `{ requireToolApproval: true }`, then awaits
 * `output.suspendPayload` to detect suspension safely without risk of hanging.
 *
 * **HIL detection — mock agents (only `generate()` available)**
 * Calls `agent.generate()` and reads `result.finishReason === 'suspended'`.
 *
 * **HIL resolution**
 * Prefers `approveToolCall` / `declineToolCall` (Mastra v0.24+); falls back
 * to the legacy `approveToolCallGenerate` / `declineToolCallGenerate` names.
 *
 * **Storage requirement**
 * `approveToolCall` / `declineToolCall` require the agent to be registered
 * with a `Mastra` instance that has a storage backend so that workflow
 * snapshots can be persisted and resumed. For tests, init via:
 * ```ts
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   storage: new LibSQLStore({ url: ':memory:' }),
 * });
 * ```
 */
export function withMastraAgent(agent: MastraAgentLike): AgentHandle {
	// Carried across the HIL boundary so resolveHIL can reference them.
	let lastRunId: string | undefined;
	let lastSuspendPayload: { toolCallId: string; toolName: string; args: unknown } | undefined;

	function makeSuspendedResponse(payload: NonNullable<MastraRawOutput['suspendPayload']>): AgentResponse {
		return {
			messages: [],
			pendingToolCalls: [{
				toolCallId: payload.toolCallId,
				toolName: payload.toolName,
				args: payload.args,
			} satisfies HILToolCall],
		};
	}

	async function callAgent(history: readonly ModelMessage[]): Promise<AgentResponse> {
		// ── Real Mastra agent path (stream() available) ───────────────────────
		if (typeof agent.stream === 'function') {
			const streamOutput = await (agent as Agent).stream(
				history as Parameters<Agent['stream']>[0],
				{ requireToolApproval: true },
			);
			const out = await processStreamOutput(streamOutput);

			if (out.suspendPayload && 'toolCallId' in out.suspendPayload) {
				lastRunId = out.runId;
				lastSuspendPayload = out.suspendPayload;
				return makeSuspendedResponse(out.suspendPayload);
			}

			lastRunId = undefined;
			lastSuspendPayload = undefined;
			return { messages: extractMessages(out), pendingToolCalls: [] };
		}

		// ── Mock / legacy path (only generate() available) ────────────────────
		const result = (await agent.generate(
			history as Parameters<Agent['generate']>[0],
		)) as MastraRawOutput;

		if (result.finishReason === 'suspended' && result.suspendPayload) {
			lastRunId = result.runId;
			lastSuspendPayload = result.suspendPayload;
			return makeSuspendedResponse(result.suspendPayload);
		}

		lastRunId = undefined;
		lastSuspendPayload = undefined;
		return { messages: extractMessages(result), pendingToolCalls: [] };
	}

	/**
	 * Call a resume method (approve or decline), process its output, and return
	 * a normalised AgentResponse. A resume may itself trigger another suspension
	 * (chained approvals).
	 */
	async function callResume(
		method: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>,
		runId: string,
		toolCallId?: string,
	): Promise<AgentResponse> {
		const rawOutput = await method.call(agent, { runId, ...(toolCallId ? { toolCallId } : {}) });
		const out = await processStreamOutput(rawOutput);

		if (out.suspendPayload && 'toolCallId' in out.suspendPayload) {
			lastRunId = out.runId;
			lastSuspendPayload = out.suspendPayload;
			return makeSuspendedResponse(out.suspendPayload);
		}

		lastRunId = undefined;
		lastSuspendPayload = undefined;
		return { messages: extractMessages(out), pendingToolCalls: [] };
	}

	return {
		respond: callAgent,

		async resolveHIL(decisions: HILDecisionMap, _history: readonly ModelMessage[]): Promise<AgentResponse> {
			if (!lastRunId) {
				return { messages: [], pendingToolCalls: [] };
			}

			const decision = lastSuspendPayload ? decisions.get(lastSuspendPayload.toolCallId) : undefined;
			const runId = lastRunId;
			const toolCallId = lastSuspendPayload?.toolCallId;

			const approveMethod = agent.approveToolCall ?? agent.approveToolCallGenerate;
			const declineMethod = agent.declineToolCall ?? agent.declineToolCallGenerate;

			if (decision?.type === 'approve' && approveMethod) {
				// Wire through decision.result as resumeData when present.
				// Mastra steps can receive this value via their resumeSchema handler —
				// useful for multi-option confirmations. AI SDK does not support this.
				const resumeData = decision.result !== undefined ? decision.result : undefined;
				return callResume(
					(opts) => approveMethod.call(agent, { ...opts, ...(resumeData !== undefined && { resumeData }) }),
					runId,
					toolCallId,
				);
			}

			if (declineMethod) {
				return callResume(declineMethod, runId, toolCallId);
			}

			return { messages: [], pendingToolCalls: [] };
		},
	};
}
