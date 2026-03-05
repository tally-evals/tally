/**
 * Tool Call Utilities for E2E Tests
 * 
 * Utilities to extract and analyze tool calls from conversation steps.
 * Handles both formats:
 * 1. Tool calls inside assistant message content array
 * 2. Tool calls as separate tool messages
 */

import type { ModelMessage } from 'ai';
import type { ConversationStep } from '@tally-evals/tally';

/**
 * Extracted tool call information
 */
export interface ExtractedToolCall {
	toolCallId: string;
	toolName: string;
	input?: unknown;
	output?: unknown;
}

/**
 * Extract all tool calls from a conversation step
 * Handles both formats:
 * - Tool calls in assistant message content array
 * - Tool calls as separate tool messages
 */
export function extractToolCallsFromStep(step: ConversationStep): ExtractedToolCall[] {
	const toolCalls: ExtractedToolCall[] = [];
	const toolResults = new Map<string, unknown>();

	// First pass: Extract tool calls and tool results
	for (const message of step.output) {
		if (message.role === 'assistant') {
			// Check content array for tool call parts
			if (Array.isArray(message.content)) {
				for (const part of message.content) {
					if (
						typeof part === 'object' &&
						part !== null &&
						'type' in part &&
						part.type === 'tool-call' &&
						'toolCallId' in part &&
						'toolName' in part
					) {
						const partObj = part as Record<string, unknown>;
						toolCalls.push({
							toolCallId: String(part.toolCallId),
							toolName: String(part.toolName),
							input: 'input' in partObj ? partObj.input : 'args' in partObj ? partObj.args : undefined,
						});
					}
				}
			}

			// Also check toolCalls property (AI SDK format)
			if ('toolCalls' in message && Array.isArray(message.toolCalls)) {
				for (const toolCall of message.toolCalls) {
					if (
						typeof toolCall === 'object' &&
						toolCall !== null &&
						'toolCallId' in toolCall &&
						'toolName' in toolCall
					) {
						toolCalls.push({
							toolCallId: String(toolCall.toolCallId),
							toolName: String(toolCall.toolName),
							input: 'args' in toolCall ? toolCall.args : undefined,
						});
					}
				}
			}
		}

		// Extract tool results from tool messages
		if (message.role === 'tool' && 'toolCallId' in message) {
			const toolCallId = String(message.toolCallId);
			const toolName = 'toolName' in message ? String(message.toolName) : undefined;
			
			// Get output from content
			let output: unknown = undefined;
			if (Array.isArray(message.content)) {
				for (const part of message.content) {
					if (
						typeof part === 'object' &&
						part !== null &&
						'type' in part &&
						part.type === 'tool-result'
					) {
						const partObj = part as Record<string, unknown>;
						output = 'output' in partObj ? partObj.output : 'content' in partObj ? partObj.content : undefined;
						break;
					}
				}
			} else {
				output = message.content;
			}

			toolResults.set(toolCallId, output);
		}
	}

	// Second pass: Match tool results to tool calls
	for (const toolCall of toolCalls) {
		const result = toolResults.get(toolCall.toolCallId);
		if (result !== undefined) {
			toolCall.output = result;
		}
	}

	return toolCalls;
}

/**
 * Extract tool calls from an array of ModelMessages
 */
export function extractToolCallsFromMessages(messages: readonly ModelMessage[]): ExtractedToolCall[] {
	const toolCalls: ExtractedToolCall[] = [];
	const toolResults = new Map<string, unknown>();

	// First pass: Extract tool calls and tool results
	for (const message of messages) {
		if (message.role === 'assistant') {
			// Check content array for tool call parts
			if (Array.isArray(message.content)) {
				for (const part of message.content) {
					if (
						typeof part === 'object' &&
						part !== null &&
						'type' in part &&
						part.type === 'tool-call' &&
						'toolCallId' in part &&
						'toolName' in part
					) {
						const partObj = part as Record<string, unknown>;
						toolCalls.push({
							toolCallId: String(part.toolCallId),
							toolName: String(part.toolName),
							input: 'input' in partObj ? partObj.input : 'args' in partObj ? partObj.args : undefined,
						});
					}
				}
			}

			// Also check toolCalls property (AI SDK format)
			if ('toolCalls' in message && Array.isArray(message.toolCalls)) {
				for (const toolCall of message.toolCalls) {
					if (
						typeof toolCall === 'object' &&
						toolCall !== null &&
						'toolCallId' in toolCall &&
						'toolName' in toolCall
					) {
						toolCalls.push({
							toolCallId: String(toolCall.toolCallId),
							toolName: String(toolCall.toolName),
							input: 'args' in toolCall ? toolCall.args : undefined,
						});
					}
				}
			}
		}

		// Extract tool results from tool messages
		if (message.role === 'tool' && 'toolCallId' in message) {
			const toolCallId = String(message.toolCallId);
			
			// Get output from content
			let output: unknown = undefined;
			if (Array.isArray(message.content)) {
				for (const part of message.content) {
					if (
						typeof part === 'object' &&
						part !== null &&
						'type' in part &&
						part.type === 'tool-result'
					) {
						const partObj = part as Record<string, unknown>;
						output = 'output' in partObj ? partObj.output : 'content' in partObj ? partObj.content : undefined;
						break;
					}
				}
			} else {
				output = message.content;
			}

			toolResults.set(toolCallId, output);
		}
	}

	// Second pass: Match tool results to tool calls
	for (const toolCall of toolCalls) {
		const result = toolResults.get(toolCall.toolCallId);
		if (result !== undefined) {
			toolCall.output = result;
		}
	}

	return toolCalls;
}

/**
 * Check if a step contains tool calls
 */
export function hasToolCalls(step: ConversationStep): boolean {
	return extractToolCallsFromStep(step).length > 0;
}

/**
 * Check if a step contains a specific tool call
 */
export function hasToolCall(step: ConversationStep, toolName: string): boolean {
	return extractToolCallsFromStep(step).some((tc) => tc.toolName === toolName);
}

/**
 * Get all tool names used in a step
 */
export function getToolNames(step: ConversationStep): string[] {
	return extractToolCallsFromStep(step).map((tc) => tc.toolName);
}

/**
 * Assert that all tool calls have matching tool results
 */
export function assertToolCallSequence(step: ConversationStep): void {
	const toolCalls = extractToolCallsFromStep(step);
	
	for (const toolCall of toolCalls) {
		if (toolCall.output === undefined) {
			throw new Error(
				`Tool call ${toolCall.toolCallId} (${toolCall.toolName}) at step ${step.stepIndex} has no matching tool result`
			);
		}
	}
}

/**
 * Assert that a step contains expected tool calls
 */
export function assertExpectedToolCalls(
	step: ConversationStep,
	expectedToolNames: string[]
): void {
	const actualToolNames = getToolNames(step);

	for (const expectedName of expectedToolNames) {
		if (!actualToolNames.includes(expectedName)) {
			throw new Error(
				`Expected tool call "${expectedName}" not found at step ${step.stepIndex}. Found: ${actualToolNames.join(', ')}`
			);
		}
	}
}

/**
 * Count tool calls by tool name across all steps
 */
export function countToolCallsByType(conversation: { steps: readonly ConversationStep[] }): Map<string, number> {
	const counts = new Map<string, number>();

	for (const step of conversation.steps) {
		const toolCalls = extractToolCallsFromStep(step);
		for (const toolCall of toolCalls) {
			const current = counts.get(toolCall.toolName) ?? 0;
			counts.set(toolCall.toolName, current + 1);
		}
	}

	return counts;
}

