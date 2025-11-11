/**
 * Agent wrappers for different runtimes
 * 
 * These wrappers normalize agents from different ecosystems (AI SDK, Mastra)
 * to a consistent AgentHandle interface.
 */

import { generateText } from 'ai';
import type { Prompt, ModelMessage } from 'ai';
import type { AgentHandle } from '../core/types.js';
import { buildPromptFromHistory, historyToMessages } from '../utils/prompt.js';

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
			async respond(history: readonly ModelMessage[]) {
				// Use Prompt.messages for multi-turn support
				const promptInput = buildPromptFromHistory({ history, useMessages: true });
				const result = await agent.generate(promptInput);
				return { messages: result.response.messages };
			},
		};
	}

	// generateText config pattern
	const config = agentOrConfig as Omit<GenerateTextInput, 'messages' | 'prompt'>;
	return {
		async respond(history: readonly ModelMessage[]) {
			const result = await generateText({
				...config,
				messages: historyToMessages(history),
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
		generate: (input: {
			messages: ModelMessage[];
		}) => Promise<{
			messages: ModelMessage[];
		}>;
	}
): AgentHandle {
	return {
		async respond(history: readonly ModelMessage[]) {
			// Mastra agents use messages array
			const result = await agent.generate({
				messages: [...history],
			});

			// Mastra returns messages directly, not nested in response
			return {
				messages: result.messages,
			};
		},
	};
}

