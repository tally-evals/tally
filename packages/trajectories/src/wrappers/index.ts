/**
 * Agent wrappers for different runtimes
 * 
 * These wrappers normalize agents from different ecosystems (AI SDK, Mastra)
 * to a consistent AgentHandle interface.
 */

import { generateText } from 'ai';
import type { Experimental_Agent as AISdkAgent, Prompt, ModelMessage, LanguageModel, ToolSet } from 'ai';
import type { AgentHandle } from '../core/types.js';

/**
 * Wrapper for AI SDK Experimental_Agent or generateText
 * 
 * Supports two patterns:
 * 1. AI SDK Experimental_Agent instance (with tools support)
 * 2. Model + optional config for generateText (simple text generation)
 * 
 * @param agentOrModel - AI SDK Experimental_Agent instance or LanguageModel
 * @param options - Optional config for generateText (only used when first param is a model)
 * @returns AgentHandle that can be used with trajectories
 */
export function withAISdkAgent<TOOLS extends ToolSet = ToolSet, OUTPUT = unknown>(
	agent: AISdkAgent<TOOLS, OUTPUT, unknown>
): AgentHandle;
export function withAISdkAgent(
	model: LanguageModel,
	options?: Omit<Parameters<typeof generateText>[0], 'model' | 'messages' | 'prompt'>
): AgentHandle;
export function withAISdkAgent(
	agentOrModel: AISdkAgent<ToolSet, unknown, unknown> | LanguageModel,
	options?: Omit<Parameters<typeof generateText>[0], 'model' | 'messages' | 'prompt'>
): AgentHandle {
	// Check if it's an AI SDK Agent instance (has generate method)
	if (
		typeof agentOrModel === 'object' &&
		agentOrModel !== null &&
		'generate' in agentOrModel
	) {
		const agent = agentOrModel as AISdkAgent<ToolSet, unknown, unknown>;
		return {
			async respond(history: readonly ModelMessage[]) {
				// Use Prompt.messages for multi-turn support
				const promptInput: Prompt = { messages: [...history] };
				const result = await agent.generate(promptInput);
				return { messages: result.response.messages };
			},
		};
	}

	// Model + generateText pattern
	const model = agentOrModel as LanguageModel;
	return {
		async respond(history: readonly ModelMessage[]) {
			const result = await generateText({
				model,
				messages: [...history],
				...options,
			});
			return {
				messages: [
					{
						role: 'assistant',
						content: result.text,
					},
				],
			};
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

