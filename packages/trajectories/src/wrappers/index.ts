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
			case 'provide':
				// AI SDK approval is binary (approve/reject). For 'provide'
				// decisions, we approve and let the tool execute.
				approvalParts.push({
					type: 'tool-approval-response',
					approvalId,
					approved: true,
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
 * Wrapper for AI SDK Experimental_Agent or generateText
 * 
 * Supports two patterns:
 * 1. AI SDK Experimental_Agent instance (with tools support)
 * 2. generateText input config (without messages/prompt, which are added from history)
 * 
 * HIL detection: Looks for `tool-approval-request` parts in `result.content`
 * HIL resolution: Builds `tool-approval-response` messages and re-calls generateText
 * 
 * @param agent - AI SDK Experimental_Agent instance
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

		// Detect HIL via tool-approval-request parts in result.content
		const pendingToolCalls = extractAISdkPendingToolCalls(
			(result as unknown as { content?: unknown[] }).content ?? [],
		);

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
 * Wrapper for Mastra Agent
 * 
 * HIL detection: Checks for `finishReason: 'suspended'` and `suspendPayload`
 * HIL resolution: Calls `approveToolCallGenerate()` / `declineToolCallGenerate()`
 * 
 * 
 * @param agent - Mastra Agent instance
 * @returns AgentHandle that can be used with trajectories
 */
export function withMastraAgent(
	agent: {
		generate: Agent["generate"];
		/** Required for HIL: approve a suspended tool call */
		approveToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<{ text: string; steps?: Array<{ response?: { messages: ModelMessage[] } }> }>;
		/** Required for HIL: decline a suspended tool call */
		declineToolCallGenerate?: (opts: { runId: string; toolCallId?: string }) => Promise<{ text: string; steps?: Array<{ response?: { messages: ModelMessage[] } }> }>;
	}
): AgentHandle {
	// Hold the last runId so resolveHIL can reference it
	let lastRunId: string | undefined;
	let lastSuspendPayload: { toolCallId: string; toolName: string; args: unknown } | undefined;

	return {
		respond: async (history: readonly ModelMessage[]): Promise<AgentResponse> => {
			const result = await agent.generate(history) as {
				text?: string;
				steps?: Array<{ response?: { messages: ModelMessage[] } }>;
				finishReason?: string;
				runId?: string;
				suspendPayload?: { toolCallId: string; toolName: string; args: unknown };
			};
			
			let outMessages: ModelMessage[] = [];
			
			if (result.steps && result.steps.length > 0) {
				const lastStep = result.steps[result.steps.length - 1];
				if (lastStep && lastStep.response?.messages) {
					outMessages = lastStep.response.messages;
				}
			}
			
			if (outMessages.length === 0 && result.text) {
				outMessages = [{
					role: 'assistant',
					content: result.text,
				}];
			}

			// Detect HIL: Mastra signals via finishReason: 'suspended'
			const pendingToolCalls: HILToolCall[] = [];
			if (result.finishReason === 'suspended' && result.suspendPayload) {
				lastRunId = result.runId;
				lastSuspendPayload = result.suspendPayload;
				pendingToolCalls.push({
					toolCallId: result.suspendPayload.toolCallId,
					toolName: result.suspendPayload.toolName,
					args: result.suspendPayload.args,
				});
			} else {
				lastRunId = undefined;
				lastSuspendPayload = undefined;
			}

			return { messages: outMessages, pendingToolCalls };
		},

		resolveHIL: async (
			decisions: HILDecisionMap,
			_history: readonly ModelMessage[],
		): Promise<AgentResponse> => {
			if (!lastRunId) {
				return { messages: [], pendingToolCalls: [] };
			}

			// Mastra resolves one tool call at a time via its approval API
			const decision = lastSuspendPayload
				? decisions.get(lastSuspendPayload.toolCallId)
				: undefined;

			let rawResult: {
				text?: string;
				steps?: Array<{ response?: { messages: ModelMessage[] } }>;
				finishReason?: string;
				runId?: string;
				suspendPayload?: { toolCallId: string; toolName: string; args: unknown };
			};

			const shouldApprove = decision?.type === 'approve' || decision?.type === 'provide';

			if (shouldApprove && agent.approveToolCallGenerate) {
				rawResult = await agent.approveToolCallGenerate({
					runId: lastRunId,
					...(lastSuspendPayload?.toolCallId && { toolCallId: lastSuspendPayload.toolCallId }),
				}) as typeof rawResult;
			} else if (agent.declineToolCallGenerate) {
				rawResult = await agent.declineToolCallGenerate({
					runId: lastRunId,
					...(lastSuspendPayload?.toolCallId && { toolCallId: lastSuspendPayload.toolCallId }),
				}) as typeof rawResult;
			} else {
				// No approval methods available — can't resolve
				return { messages: [], pendingToolCalls: [] };
			}

			// Extract messages from result
			let outMessages: ModelMessage[] = [];
			if (rawResult.steps && rawResult.steps.length > 0) {
				const lastStep = rawResult.steps[rawResult.steps.length - 1];
				if (lastStep && lastStep.response?.messages) {
					outMessages = lastStep.response.messages;
				}
			}
			if (outMessages.length === 0 && rawResult.text) {
				outMessages = [{ role: 'assistant', content: rawResult.text }];
			}

			// Check if this response also has pending HIL
			const pendingToolCalls: HILToolCall[] = [];
			if (rawResult.finishReason === 'suspended' && rawResult.suspendPayload) {
				lastRunId = rawResult.runId;
				lastSuspendPayload = rawResult.suspendPayload;
				pendingToolCalls.push({
					toolCallId: rawResult.suspendPayload.toolCallId,
					toolName: rawResult.suspendPayload.toolName,
					args: rawResult.suspendPayload.args,
				});
			} else {
				lastRunId = undefined;
				lastSuspendPayload = undefined;
			}

			return { messages: outMessages, pendingToolCalls };
		},
	};
}

