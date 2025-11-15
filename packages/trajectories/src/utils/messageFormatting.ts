/**
 * Utilities for formatting messages from step traces
 */

import type { ModelMessage } from 'ai';
import type { StepTrace } from '../core/types.js';

/**
 * Extract text content from a ModelMessage, handling both string and array formats
 */
export function extractMessageContent(msg: ModelMessage | undefined): string {
	if (!msg) return '';
	const content = msg.content;
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const part of content) {
			if (part && typeof part === 'object' && 'type' in part) {
				if (part.type === 'text' && 'text' in part) {
					parts.push(String(part.text));
				} else if (part.type === 'tool-call' && 'toolName' in part) {
					parts.push(`[tool-call:${String(part.toolName)}]`);
				}
			}
		}
		return parts.join('\n');
	}
	return '';
}

/**
 * Extract tool result content from a tool message
 */
function extractToolResultContent(msg: ModelMessage): string {
	if (msg.role !== 'tool') return '';
	const content = msg.content;
	if (!Array.isArray(content)) return '';
	
	const toolResults: string[] = [];
	for (const part of content) {
		if (part && typeof part === 'object' && 'type' in part && part.type === 'tool-result') {
			const toolName = 'toolName' in part ? String(part.toolName) : 'unknown';
			const output = 'output' in part ? part.output : null;
			
			if (output && typeof output === 'object' && 'type' in output) {
				let resultText = '';
				if (output.type === 'text' && 'value' in output) {
					resultText = String(output.value);
				} else if (output.type === 'json' && 'value' in output) {
					resultText = JSON.stringify(output.value, null, 2);
				} else if (output.type === 'error-text' && 'value' in output) {
					resultText = `Error: ${String(output.value)}`;
				} else if (output.type === 'error-json' && 'value' in output) {
					resultText = `Error: ${JSON.stringify(output.value, null, 2)}`;
				} else if (output.type === 'content' && 'value' in output && Array.isArray(output.value)) {
					const contentParts = output.value
						.map((item) => {
							if (item && typeof item === 'object' && 'type' in item) {
								if (item.type === 'text' && 'text' in item) {
									return String(item.text);
								}
								if (item.type === 'media' && 'data' in item) {
									return '[media content]';
								}
							}
							return '';
						})
						.filter(Boolean);
					resultText = contentParts.join('\n');
				}
				
				if (resultText) {
					toolResults.push(`[tool-result:${toolName}]\n${resultText}`);
				}
			}
		}
	}
	return toolResults.join('\n\n');
}

/**
 * Format conversation exchanges from step traces
 * @param stepTraces - Array of step traces to format
 * @param lastNSteps - Number of recent steps to include (default: all)
 * @returns Object with formatted conversation context and last assistant message
 */
export function formatConversationFromTraces(
	stepTraces: readonly StepTrace[],
	lastNSteps?: number
): {
	conversationContext: string;
	lastAssistantMessage: string | null;
} {
	// Extract the last N step traces (most recent first)
	const recentTraces = lastNSteps
		? stepTraces.slice(-lastNSteps)
		: stepTraces;

	// Format messages from recent step traces
	const conversationExchanges: string[] = [];
	let lastAssistantMessage: string | null = null;

	// Process traces in order, tracking the most recent assistant message
	for (let i = 0; i < recentTraces.length; i++) {
		const trace = recentTraces[i];
		if (!trace) continue;
		
		const isMostRecentTrace = i === recentTraces.length - 1;
		
		// Extract user message from step trace
		const userMsg = extractMessageContent(trace.userMessage);

		// Extract all agent messages in chronological order (assistant + tool messages)
		const agentMessageParts: string[] = [];
		const assistantMessagesInTrace: string[] = [];
		
		for (const msg of trace.agentMessages) {
			if (msg.role === 'assistant') {
				const content = extractMessageContent(msg);
				if (content) {
					agentMessageParts.push(content);
					assistantMessagesInTrace.push(content);
				}
			} else if (msg.role === 'tool') {
				const toolResult = extractToolResultContent(msg);
				if (toolResult) {
					agentMessageParts.push(toolResult);
				}
			}
		}
		
		// Track the last assistant message from the most recent trace
		if (isMostRecentTrace && assistantMessagesInTrace.length > 0) {
			const lastMsg = assistantMessagesInTrace[assistantMessagesInTrace.length - 1];
			if (lastMsg) {
				lastAssistantMessage = lastMsg;
			}
		}
		
		const agentMsg = agentMessageParts.length > 0
			? agentMessageParts.join('\n\n---\n\n')
			: '';

		if (userMsg || agentMsg) {
			conversationExchanges.push(
				`User: "${userMsg || '(none)'}"\nAssistant: "${agentMsg || '(none)'}"`
			);
		}
	}

	// Format the conversation context (most recent last)
	const conversationContext = conversationExchanges.length > 0
		? conversationExchanges.join('\n\n---\n\n')
		: '(no conversation history)';

	return {
		conversationContext,
		lastAssistantMessage,
	};
}

