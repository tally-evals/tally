/**
 * Utilities for building AI SDK prompts from messages
 */

import type { ModelMessage, Prompt } from 'ai';

/**
 * Convert messages to a new array of ModelMessage
 */
export function messagesToMessages(
	messages: readonly ModelMessage[]
): ModelMessage[] {
	return [...messages];
}

/**
 * Build a Prompt object from messages
 * 
 * @param options - Options for building the prompt
 * @param options.messages - Conversation messages (AgentMemory snapshot)
 * @param options.system - Optional system message
 * @param options.useMessages - If true, uses messages format; if false, uses prompt string format
 * @returns A Prompt object compatible with AI SDK
 */
export function buildPromptFromMessages(options: {
	messages: readonly ModelMessage[];
	system?: string;
	useMessages?: boolean;
}): Prompt {
	const { messages, system, useMessages = true } = options;

	if (useMessages) {
		const prompt: Prompt = {
			messages: messagesToMessages(messages),
		};
		if (system !== undefined) {
			prompt.system = system;
		}
		return prompt;
	}

	// Convert messages to a string prompt
	const promptText = messages
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

