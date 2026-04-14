/**
 * Agent wrappers for different runtimes
 * 
 * These wrappers normalize agents from different ecosystems (AI SDK, Mastra)
 * to a consistent AgentHandle interface, including framework-specific
 * HIL (human-in-the-loop) detection and resolution.
 */

import { generateText } from 'ai';
import type { Prompt, ModelMessage } from 'ai';
import type { AgentHandle, AgentResponse, HILDecisionMap } from '../core/types.js';
import type { HILToolCall } from '../core/hil/types.js';
import { buildPromptFromMessages, messagesToMessages } from '../utils/prompt.js';
import { Agent } from '@mastra/core/agent';

type GenerateTextInput = Parameters<typeof generateText>[0];

// ============================================================================
// AI SDK — HIL helpers
// ============================================================================

/**
 * Extract pending HIL tool calls from AI SDK result content.
 */
function extractAISdkPendingToolCalls(
	resultContent: unknown[],
): HILToolCall[] {
	const pending: HILToolCall[] = [];
	for (const part of resultContent) {
		if (
			part &&
			typeof part === 'object' &&
			'type' in part &&
			(part as { type: string }).type === 'tool-approval-request'
		) {
			const approval = part as {
				type: 'tool-approval-request';
				approvalId: string;
				toolCall: {
					toolCallId: string;
					toolName: string;
					input: unknown;
				};
			};
			pending.push({
				toolCallId: approval.approvalId,
				toolName: approval.toolCall.toolName,
				args: approval.toolCall.input,
			});
		}
	}
	return pending;
}

/**
 * Build AI SDK `tool-approval-response` messages from HIL decisions.
 *
 */
function buildAISdkApprovalMessages(
	decisions: HILDecisionMap,
): ModelMessage[] {
	const approvalParts: Array<{
		type: 'tool-approval-response';
		approvalId: string;
		approved: boolean;
		reason?: string;
	}> = [];

	for (const [approvalId, decision] of decisions) {
		switch (decision.type) {
			case 'approve':
				approvalParts.push({
					type: 'tool-approval-response',
					approvalId,
					approved: true,
				});
				break;
			case 'reject':
				approvalParts.push({
					type: 'tool-approval-response',
					approvalId,
					approved: false,
					...(decision.reason && { reason: decision.reason }),
				});
				break;
	
		}
	}

	if (approvalParts.length === 0) return [];

	// AI SDK expects tool-approval-response parts in a tool-role message
	return [{ role: 'tool', content: approvalParts } as unknown as ModelMessage];
}

// ============================================================================
// AI SDK Wrapper
// ============================================================================

/**
 * Wrapper for AI SDK ToolLoopAgent or generateText
 * 
 * Supports two patterns:
 * 1. AI SDK ToolLoopAgent instance (with tools support)
 * 2. generateText input config (without messages/prompt, which are added from history)
 * 
 * HIL detection: Looks for `tool-approval-request` parts in `result.content`
 * HIL resolution: Builds `tool-approval-response` messages and re-calls generateText
 * 
 * @param agent - AI SDK ToolLoopAgent instance
 * @returns AgentHandle that can be used with trajectories
 */
export function withAISdkAgent(
	agent: { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }> }
): AgentHandle;

/**
 * Wrapper for generateText with full input type support
 * 
 * @param config - generateText input config (without messages/prompt, which are added from history)
 * @returns AgentHandle that can be used with trajectories
 */
export function withAISdkAgent(
	config: Omit<GenerateTextInput, 'messages' | 'prompt'>
): AgentHandle;

export function withAISdkAgent(
	agentOrConfig: 
		| { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }> }
		| Omit<GenerateTextInput, 'messages' | 'prompt'>
): AgentHandle {
	// Check if it's an AI SDK Agent instance (has generate method)
	if (
		typeof agentOrConfig === 'object' &&
		agentOrConfig !== null &&
		'generate' in agentOrConfig &&
		typeof (agentOrConfig as { generate?: unknown }).generate === 'function'
	) {
		const agent = agentOrConfig as { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }> };

		/** Shared logic for calling agent.generate and extracting HIL info */
		async function callAgent(messages: readonly ModelMessage[]): Promise<AgentResponse> {
			const promptInput = buildPromptFromMessages({
				messages,
				useMessages: true,
			});
			const result = await agent.generate(promptInput);

			// result.response.messages are already ModelMessage[] in AI SDK v6
			const outMessages: ModelMessage[] = result.response.messages;

			// Detect HIL via tool-approval-request parts
			const pendingToolCalls = extractAISdkPendingToolCalls(
				result.content ?? [],
			);

			return { messages: outMessages, pendingToolCalls };
		}

		return {
			respond: callAgent,

			async resolveHIL(
				decisions: HILDecisionMap,
				history: readonly ModelMessage[],
			): Promise<AgentResponse> {
				// Build approval messages and append to history
				const approvalMessages = buildAISdkApprovalMessages(decisions);
				const updatedHistory = [...history, ...approvalMessages];
				return callAgent(updatedHistory);
			},
		};
	}

	// generateText config pattern
	const config = agentOrConfig as Omit<GenerateTextInput, 'messages' | 'prompt'>;

	/** Shared logic for calling generateText and extracting HIL info */
	async function callGenerateText(agentMemoryMessages: readonly ModelMessage[]): Promise<AgentResponse> {
		const result = await generateText({
			...config,
			messages: messagesToMessages(agentMemoryMessages),
		});
		
		// Convert result to messages format
		const messages: ModelMessage[] = [];
		
		if (result.text) {
			messages.push({
				role: 'assistant',
				content: result.text,
			});
		}
		
		if (result.steps && result.steps.length > 0) {
			for (const step of result.steps) {
				if (step.response?.messages) {
					for (const msg of step.response.messages) {
						if (msg.role === 'assistant' && typeof msg.content === 'string' && result.text && msg.content === result.text) {
							continue;
						}
						messages.push(msg);
					}
				}
			}
		}
		
		if (messages.length === 0 && result.text) {
			messages.push({
				role: 'assistant',
				content: result.text,
			});
		}

		// Detect HIL via tool-approval-request parts in response messages.
		// generateText doesn't surface a top-level `content` array like
		// Agent.generate() does — scan step response messages instead.
		const allContentParts: unknown[] = [];
		if (result.response?.messages) {
			for (const msg of result.response.messages) {
				if (msg && typeof msg === 'object' && 'content' in msg && Array.isArray((msg as { content: unknown }).content)) {
					allContentParts.push(...(msg as { content: unknown[] }).content);
				}
			}
		}
		const pendingToolCalls = extractAISdkPendingToolCalls(allContentParts);

		return { messages, pendingToolCalls };
	}

	return {
		respond: callGenerateText,

		async resolveHIL(
			decisions: HILDecisionMap,
			history: readonly ModelMessage[],
		): Promise<AgentResponse> {
			const approvalMessages = buildAISdkApprovalMessages(decisions);
			const updatedHistory = [...history, ...approvalMessages];
			return callGenerateText(updatedHistory);
		},
	};
}

// ============================================================================
// Mastra Wrapper
// ============================================================================

/**
 * Normalised shape of a raw Mastra agent output.
 *
 * Compatible with both:
 * - Real `MastraModelOutput` proxies where property values are lazy Promise
 *   getters (returned by `agent.stream()`).
 * - Plain objects with synchronous values (returned by unit-test mocks via
 *   `agent.generate()`).
 */
interface MastraRawOutput {
	text?: string;
	steps?: Array<{ response?: { messages: ModelMessage[] } }>;
	finishReason?: string;
	runId?: string;
	/** Set to `{ toolCallId, toolName, args }` when the agent suspended for HIL. */
	suspendPayload?: { toolCallId: string; toolName: string; args: unknown };
}

/**
 * Extract `ModelMessage[]` from a normalised Mastra output.
 *
 * Prefers `steps[last].response.messages`; falls back to a plain assistant
 * message built from the `text` field.
 */
function extractMastraMessages(out: MastraRawOutput): ModelMessage[] {
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
 * Consume a `MastraModelOutput` stream proxy returned by `agent.stream()` or
 * by the resume methods (`approveToolCall` / `declineToolCall`).
 *
 * The proxy exposes lazy Promise getters for every field.  The underlying
 * ReadableStream auto-flows while the agent loop produces chunks.
 *
 * **Important (Mastra v1.x):** We must call `consumeStream()` before reading
 * resolved properties.  The workflow engine persists suspended-state snapshots
 * as part of the stream pipeline; reading `suspendPayload` alone does NOT
 * guarantee the snapshot has been flushed to storage.  Without a flushed
 * snapshot, `approveToolCall` / `declineToolCall` cannot resume the run.
 *
 * Suspension semantics:
 * - `suspendPayload` always resolves (never hangs):
 *     • suspended:      `{ toolCallId, toolName, args }`
 *     • normal finish:  `undefined`
 * - When suspended, `text` / `steps` are NOT awaited — they remain pending
 *   and would throw if consumed.
 * - When NOT suspended, both `text` and `steps` are fully resolved after
 *   `suspendPayload` resolves to `undefined`.
 *
 * For plain mock objects (unit tests), `Promise.resolve(x)` is idempotent and
 * works regardless of whether `x` is already a value or a Promise.
 */
async function processMastraStreamOutput(raw: unknown): Promise<MastraRawOutput> {
	const any = raw as Record<string, unknown>;

	// runId is a direct (non-Promise) property on MastraModelOutput.
	const runId = any.runId as string | undefined;

	// Fully consume the stream before reading resolved properties.
	// In Mastra v1.x the workflow engine persists suspended-state snapshots
	// asynchronously as part of the stream pipeline.  Calling `consumeStream()`
	// guarantees the snapshot is flushed to storage before we attempt to
	// approve / decline the tool call in a subsequent step.
	if (typeof any.consumeStream === 'function') {
		try {
			await (any.consumeStream as () => Promise<void>)();
		} catch {
			// Tolerate stream errors — we'll still try to read resolvedproperties.
		}
	}

	// Await suspendPayload — always resolves whether suspended or not.
	let suspendPayload: MastraRawOutput['suspendPayload'];
	try {
		suspendPayload = await Promise.resolve(any.suspendPayload) as MastraRawOutput['suspendPayload'];
	} catch {
		suspendPayload = undefined;
	}

	if (suspendPayload && typeof suspendPayload === 'object' && 'toolCallId' in suspendPayload) {
		// Agent suspended — do NOT await text/steps (they won't resolve).
		return { ...(runId != null ? { runId } : {}), suspendPayload };
	}

	// Normal finish — text/steps are now fully resolved.
	let text: string | undefined;
	let steps: MastraRawOutput['steps'];
	try {
		text  = await Promise.resolve(any.text)  as string | undefined;
		steps = await Promise.resolve(any.steps) as MastraRawOutput['steps'];
	} catch {
		// Treat errors as empty output.
	}

	return {
		...(runId != null ? { runId } : {}),
		...(text != null ? { text } : {}),
		...(steps != null ? { steps } : {}),
	};
}

/**
 * Wrapper for Mastra Agent
 *
 * **HIL detection — real agents (`stream()` available)**
 * When the wrapped agent has a `stream` method, `withMastraAgent` calls
 * `agent.stream(history)`, which returns a `MastraModelOutput` proxy.
 * Tools with `requireApproval: true` cause the agent to suspend automatically.
 * Awaiting `output.suspendPayload` safely detects whether the agent suspended
 * without risk of hanging.
 *
 * **HIL detection — mock agents (only `generate()` available)**
 * For unit-test mocks that only implement `generate()`, the wrapper calls
 * `agent.generate(history)` and reads `result.finishReason === 'suspended'`
 * on the plain returned object.
 *
 * **HIL resolution**
 * Prefers `approveToolCall` / `declineToolCall` (Mastra v0.24+), falls back
 * to the legacy `approveToolCallGenerate` / `declineToolCallGenerate` names.
 *
 * **Storage requirement**
 * `approveToolCall` / `declineToolCall` require the agent to be registered
 * with a `Mastra` instance that has a storage backend, so workflow snapshots
 * can be persisted and resumed.  For tests, init via:
 * ```ts
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   storage: new LibSQLStore({ url: ':memory:' }),
 * });
 * ```
 *
 * @param agent - Mastra Agent instance (or compatible mock)
 * @returns AgentHandle that can be used with trajectories
 */
export function withMastraAgent(
	agent: {
		generate: Agent["generate"];
		/**
		 * If present, used for HIL-aware responses (real Mastra v0.24+ agents).
		 * When `stream` exists the wrapper calls `stream()` instead of `generate()`
		 * so it can detect suspension safely via `output.suspendPayload`.
		 */
		stream?: Agent["stream"];
		/**
		 * Mastra v0.24+ HIL: approve a suspended tool call and resume execution.
		 * Requires the agent to be registered with a Mastra instance with storage.
		 */
		approveToolCall?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
		/**
		 * Mastra v0.24+ HIL: decline a suspended tool call and resume execution.
		 */
		declineToolCall?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
		/**
		 * Legacy / mock names — kept for backward compatibility with unit-test mocks
		 * that were written against an earlier wrapper contract.
		 */
		approveToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
		declineToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>;
	}
): AgentHandle {
	// Carry the runId and suspendPayload across the HIL boundary so resolveHIL
	// can reference them without needing the caller to thread them through.
	let lastRunId: string | undefined;
	let lastSuspendPayload: { toolCallId: string; toolName: string; args: unknown } | undefined;

	/**
	 * Call the agent and return a normalised AgentResponse.
	 *
	 * Chooses `stream()` for real Mastra agents (safe HIL detection) and
	 * falls back to plain `generate()` for mock objects.
	 */
	async function callAgent(history: readonly ModelMessage[]): Promise<AgentResponse> {

		// ── Real Mastra agent path (stream() available) ──────────────────────────
		if (typeof agent.stream === 'function') {
			const streamOutput = await (agent as Agent).stream(
				history as Parameters<Agent['stream']>[0],
				// Tell Mastra to suspend on tools that have requireApproval: true
				// instead of executing them automatically.
				{ requireToolApproval: true },
			);

			const out = await processMastraStreamOutput(streamOutput);

			if (out.suspendPayload && 'toolCallId' in out.suspendPayload) {
				lastRunId = out.runId;
				lastSuspendPayload = out.suspendPayload;
				return {
					messages: [],
					pendingToolCalls: [{
						toolCallId: out.suspendPayload.toolCallId,
						toolName:   out.suspendPayload.toolName,
						args:       out.suspendPayload.args,
					}],
				};
			}

			lastRunId = undefined;
			lastSuspendPayload = undefined;
			return { messages: extractMastraMessages(out), pendingToolCalls: [] };
		}

		// ── Mock / legacy path (only generate() available) ───────────────────────
		const result = await agent.generate(
			history as Parameters<Agent['generate']>[0],
		) as MastraRawOutput;

		const pendingToolCalls: HILToolCall[] = [];

		if (result.finishReason === 'suspended' && result.suspendPayload) {
			lastRunId = result.runId;
			lastSuspendPayload = result.suspendPayload;
			pendingToolCalls.push({
				toolCallId: result.suspendPayload.toolCallId,
				toolName:   result.suspendPayload.toolName,
				args:       result.suspendPayload.args,
			});
			return { messages: [], pendingToolCalls };
		}

		lastRunId = undefined;
		lastSuspendPayload = undefined;
		return { messages: extractMastraMessages(result), pendingToolCalls };
	}

	/**
	 * Call one of the resume methods (approve or decline), process its output,
	 * and return an `AgentResponse`.
	 *
	 * Resume methods on real Mastra agents return a `MastraModelOutput` proxy
	 * (same shape as `stream()` output), so `processMastraStreamOutput` applies.
	 * Mock resume methods return plain objects — `Promise.resolve` handles both.
	 */
	async function callResume(
		method: (opts: { runId: string; toolCallId?: string }) => Promise<unknown>,
		runId: string,
		toolCallId?: string,
	): Promise<AgentResponse> {
		const rawOutput = await method.call(agent, { runId, ...(toolCallId ? { toolCallId } : {}) });
		const out = await processMastraStreamOutput(rawOutput);

		// A resume may itself trigger another suspension (chained approvals).
		if (out.suspendPayload && 'toolCallId' in out.suspendPayload) {
			lastRunId = out.runId;
			lastSuspendPayload = out.suspendPayload;
			return {
				messages: [],
				pendingToolCalls: [{
					toolCallId: out.suspendPayload.toolCallId,
					toolName:   out.suspendPayload.toolName,
					args:       out.suspendPayload.args,
				}],
			};
		}

		lastRunId = undefined;
		lastSuspendPayload = undefined;
		return { messages: extractMastraMessages(out), pendingToolCalls: [] };
	}

	return {
		respond: callAgent,

		resolveHIL: async (
			decisions: HILDecisionMap,
			_history: readonly ModelMessage[],
		): Promise<AgentResponse> => {
			if (!lastRunId) {
				return { messages: [], pendingToolCalls: [] };
			}

			const decision = lastSuspendPayload
				? decisions.get(lastSuspendPayload.toolCallId)
				: undefined;

			const shouldApprove = decision?.type === 'approve';

			const runId = lastRunId;
			const toolCallId = lastSuspendPayload?.toolCallId;

			// Prefer current Mastra v0.24+ names; fall back to legacy mock names.
			const approveMethod = agent.approveToolCall ?? agent.approveToolCallGenerate;
			const declineMethod = agent.declineToolCall ?? agent.declineToolCallGenerate;

			if (shouldApprove && approveMethod) {
				return callResume(approveMethod, runId, toolCallId);
			}

			if (declineMethod) {
				return callResume(declineMethod, runId, toolCallId);
			}

			// No approval methods available — cannot resolve.
			return { messages: [], pendingToolCalls: [] };
		},
	};
}

