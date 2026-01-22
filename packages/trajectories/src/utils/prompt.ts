/**
 * Utilities for building prompts and messages from conversation history
 */

import type { ModelMessage, Prompt } from 'ai';

/**
 * Convert history to an array of ModelMessage
 */
export function historyToMessages(
	history: readonly ModelMessage[]
): ModelMessage[] {
	return [...history];
}

/**
 * Build a Prompt object from conversation history
 * 
 * @param options - Options for building the prompt
 * @param options.history - Conversation history
 * @param options.system - Optional system message
 * @param options.useMessages - If true, uses messages format; if false, uses prompt string format
 * @returns A Prompt object compatible with AI SDK
 */
export function buildPromptFromHistory(options: {
	history: readonly ModelMessage[];
	system?: string;
	useMessages?: boolean;
}): Prompt {
	const { history, system, useMessages = true } = options;

	if (useMessages) {
		const prompt: Prompt = {
			messages: historyToMessages(history),
		};
		if (system !== undefined) {
			prompt.system = system;
		}
		return prompt;
	}

	// Convert messages to a string prompt
	const promptText = history
		.map((msg) => {
			if (typeof msg.content === 'string') {
				return `${msg.role}: ${msg.content}`;
			}
			// Handle structured content
			return `${msg.role}: [complex content]`;
		})
		.join('\n\n');

	const prompt: Prompt = {
		prompt: promptText,
	};
	if (system !== undefined) {
		prompt.system = system;
	}
	return prompt;
}

