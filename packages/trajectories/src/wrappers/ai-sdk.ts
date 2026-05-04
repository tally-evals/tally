/**
 * AI SDK agent wrapper
 *
 * Normalises AI SDK agents (ToolLoopAgent or generateText config) to the
 * AgentHandle interface, including HIL detection and resolution via the
 * `tool-approval-request` / `tool-approval-response` protocol.
 */

import { generateText } from 'ai';
import type { Prompt, ModelMessage } from 'ai';
import type { AgentHandle, AgentResponse, HILDecisionMap } from '../core/types.js';
import type { HILToolCall } from '../core/hil/types.js';
import { buildPromptFromMessages, messagesToMessages } from '../utils/prompt.js';

type GenerateTextInput = Parameters<typeof generateText>[0];

// ============================================================================
// HIL helpers
// ============================================================================

/**
 * Extract pending HIL tool calls from AI SDK result content.
 */
function extractPendingToolCalls(resultContent: unknown[]): HILToolCall[] {
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
				toolCall: { toolCallId: string; toolName: string; input: unknown };
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
 */
function buildApprovalMessages(decisions: HILDecisionMap): ModelMessage[] {
	const approvalParts: Array<{
		type: 'tool-approval-response';
		approvalId: string;
		approved: boolean;
		reason?: string;
	}> = [];

	for (const [approvalId, decision] of decisions) {
		switch (decision.type) {
			case 'approve':
				approvalParts.push({ type: 'tool-approval-response', approvalId, approved: true });
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
// withAISdkAgent
// ============================================================================

/**
 * Wrapper for an AI SDK ToolLoopAgent instance (has a `generate` method).
 *
 * HIL detection: `tool-approval-request` parts in `result.content`
 * HIL resolution: appends `tool-approval-response` messages and re-calls generate
 */
export function withAISdkAgent(
	agent: { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }> },
): AgentHandle;

/**
 * Wrapper for a plain `generateText` config object.
 * `messages` / `prompt` are injected from conversation history at call time.
 *
 * HIL detection: scans `result.response.messages` for `tool-approval-request` parts
 * HIL resolution: appends `tool-approval-response` messages and re-calls generateText
 */
export function withAISdkAgent(
	config: Omit<GenerateTextInput, 'messages' | 'prompt'>,
): AgentHandle;

export function withAISdkAgent(
	agentOrConfig:
		| { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }> }
		| Omit<GenerateTextInput, 'messages' | 'prompt'>,
): AgentHandle {
	// ── ToolLoopAgent path ────────────────────────────────────────────────────
	if (
		typeof agentOrConfig === 'object' &&
		agentOrConfig !== null &&
		'generate' in agentOrConfig &&
		typeof (agentOrConfig as { generate?: unknown }).generate === 'function'
	) {
		const agent = agentOrConfig as {
			generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] }; content: unknown[] }>;
		};

		async function callAgent(messages: readonly ModelMessage[]): Promise<AgentResponse> {
			const result = await agent.generate(buildPromptFromMessages({ messages, useMessages: true }));
			return {
				messages: result.response.messages,
				pendingToolCalls: extractPendingToolCalls(result.content ?? []),
			};
		}

		return {
			respond: callAgent,
			async resolveHIL(decisions: HILDecisionMap, history: readonly ModelMessage[]): Promise<AgentResponse> {
				return callAgent([...history, ...buildApprovalMessages(decisions)]);
			},
		};
	}

	// ── generateText config path ──────────────────────────────────────────────
	const config = agentOrConfig as Omit<GenerateTextInput, 'messages' | 'prompt'>;

	async function callGenerateText(agentMemoryMessages: readonly ModelMessage[]): Promise<AgentResponse> {
		const result = await generateText({
			...config,
			messages: messagesToMessages(agentMemoryMessages),
		});

		// Build message list from steps, deduplicating the final assistant text
		const messages: ModelMessage[] = [];

		if (result.steps && result.steps.length > 0) {
			for (const step of result.steps) {
				if (step.response?.messages) {
					for (const msg of step.response.messages) {
						if (
							msg.role === 'assistant' &&
							typeof msg.content === 'string' &&
							result.text &&
							msg.content === result.text
						) {
							continue;
						}
						messages.push(msg);
					}
				}
			}
		}

		if (messages.length === 0 && result.text) {
			messages.push({ role: 'assistant', content: result.text });
		}

		// Scan response messages for tool-approval-request parts
		const allContentParts: unknown[] = [];
		if (result.response?.messages) {
			for (const msg of result.response.messages) {
				if (
					msg &&
					typeof msg === 'object' &&
					'content' in msg &&
					Array.isArray((msg as { content: unknown }).content)
				) {
					allContentParts.push(...(msg as { content: unknown[] }).content);
				}
			}
		}

		return { messages, pendingToolCalls: extractPendingToolCalls(allContentParts) };
	}

	return {
		respond: callGenerateText,
		async resolveHIL(decisions: HILDecisionMap, history: readonly ModelMessage[]): Promise<AgentResponse> {
			return callGenerateText([...history, ...buildApprovalMessages(decisions)]);
		},
	};
}
