/**
 * Agent wrappers for different runtimes
 * 
 * These wrappers normalize agents from different ecosystems (AI SDK, Mastra)
 * to a consistent AgentHandle interface.
 */

import { generateText, convertToModelMessages } from 'ai';
import type { Prompt, ModelMessage } from 'ai';
import type { AgentHandle } from '../core/types.js';
import { buildPromptFromMessages, messagesToMessages } from '../utils/prompt.js';
import { Agent } from '@mastra/core/agent';

type GenerateTextInput = Parameters<typeof generateText>[0];

/**
 * Wrapper for AI SDK Experimental_Agent or generateText
 * 
 * Supports two patterns:
 * 1. AI SDK Experimental_Agent instance (with tools support)
 * 2. generateText input config (without messages/prompt, which are added from history)
 * 
 * @param agent - AI SDK Experimental_Agent instance
 * @returns AgentHandle that can be used with trajectories
 */
export function withAISdkAgent(
	agent: { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] } }> }
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
		| { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] } }> }
		| Omit<GenerateTextInput, 'messages' | 'prompt'>
): AgentHandle {
	// Check if it's an AI SDK Agent instance (has generate method)
	if (
		typeof agentOrConfig === 'object' &&
		agentOrConfig !== null &&
		'generate' in agentOrConfig &&
		typeof (agentOrConfig as { generate?: unknown }).generate === 'function'
	) {
		const agent = agentOrConfig as { generate: (input: Prompt) => Promise<{ response: { messages: ModelMessage[] } }> };
		return {
			async respond(agentMemoryMessages: readonly ModelMessage[]) {
				let modelMessages: readonly ModelMessage[] = agentMemoryMessages;
				try {
					modelMessages = convertToModelMessages(agentMemoryMessages as unknown as never) as unknown as ModelMessage[];
				} catch {
					// If conversion fails, fall back to the provided messages.
				}

				// Use Prompt.messages for multi-turn support
				const promptInput = buildPromptFromMessages({
					messages: modelMessages,
					useMessages: true,
				});
				const result = await agent.generate(promptInput);
				// Some agent implementations may return UIMessage-like messages; normalize to ModelMessage[] for trajectories memory.
				// IMPORTANT: Do NOT run convertToModelMessages on already-valid ModelMessage[]; it can drop messages.
				const rawOut = result.response.messages as unknown as Array<{ role?: unknown; content?: unknown }>;
				const hasPartsContent = rawOut.some((m) => Array.isArray(m?.content));

				let outMessages: ModelMessage[] = result.response.messages;
				if (hasPartsContent) {
					try {
						const converted = convertToModelMessages(result.response.messages as unknown as never) as unknown as ModelMessage[];
						if (Array.isArray(converted) && converted.length > 0) {
							outMessages = converted;
						}
					} catch {
						// keep original
					}
				}

				return { messages: outMessages };
			},
		};
	}

	// generateText config pattern
	const config = agentOrConfig as Omit<GenerateTextInput, 'messages' | 'prompt'>;
	return {
		async respond(agentMemoryMessages: readonly ModelMessage[]) {
			const result = await generateText({
				...config,
				messages: messagesToMessages(agentMemoryMessages),
			});
			
			// Convert result to messages format
			// generateText returns text and steps, we need to convert to ModelMessage format
			const messages: ModelMessage[] = [];
			
			// Add assistant message with text
			if (result.text) {
				messages.push({
					role: 'assistant',
					content: result.text,
				});
			}
			
			// If there are steps with tool calls/results, convert them to messages
			// The steps array contains the full conversation including tool calls
			// We'll extract the relevant messages from the steps
			if (result.steps && result.steps.length > 0) {
				// The last step contains the final response
				// Earlier steps may contain tool calls and results
				// We'll use the response messages from the steps if available
				for (const step of result.steps) {
					if (step.response?.messages) {
						// Add messages from the step response
						for (const msg of step.response.messages) {
							// Avoid duplicates - if we already added a text message, skip it
							if (msg.role === 'assistant' && typeof msg.content === 'string' && result.text && msg.content === result.text) {
								continue;
							}
							messages.push(msg);
						}
					}
				}
			}
			
			// If no messages were added, ensure we have at least the text response
			if (messages.length === 0 && result.text) {
				messages.push({
					role: 'assistant',
					content: result.text,
				});
			}
			
			return { messages };
		},
	};
}

/**
 * Wrapper for Mastra Agent
 * 
 * @param agent - Mastra Agent instance
 * @returns AgentHandle that can be used with trajectories
 */
export function withMastraAgent(
	agent: {
		generate: Agent["generate"]
	}
): AgentHandle {
	return {
		respond: async (history: readonly ModelMessage[]) => {
			const result = await agent.generate(history);
			
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

			return { messages: outMessages };
		}
	};
}

