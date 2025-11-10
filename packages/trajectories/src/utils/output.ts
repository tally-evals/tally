/**
 * Output helpers for converting trajectory results to various formats
 */

import type { TrajectoryResult } from '../core/types.js';
import type { Conversation, ConversationStep } from '@tally-evals/tally';

/**
 * Convert trajectory result to JSONL format (one step per line)
 */
export function toJSONL(result: TrajectoryResult): string[] {
	return result.steps.map((step, index) => {
		const jsonlEntry = {
			conversationId: `trajectory-${step.timestamp.getTime()}`,
			stepIndex: index,
			turnIndex: step.turnIndex,
			input: step.userMessage,
			output: step.agentMessages,
			toolCalls: step.toolCalls,
			timestamp: step.timestamp.toISOString(),
			metadata: {
				completed: result.completed,
				reason: result.reason,
			},
		};
		return JSON.stringify(jsonlEntry);
	});
}

/**
 * Convert trajectory result to Tally Conversation format
 */
export function toConversation(
	result: TrajectoryResult,
	conversationId?: string
): Conversation {
	const steps: ConversationStep[] = result.steps.map((step, index) => ({
		stepIndex: index,
		input: step.userMessage,
		output: step.agentMessages,
		timestamp: step.timestamp,
		metadata: {
			turnIndex: step.turnIndex,
			toolCalls: step.toolCalls,
		},
	}));

	return {
		id: conversationId || `trajectory-${result.steps[0]?.timestamp.getTime() || Date.now()}`,
		steps,
		metadata: {
			completed: result.completed,
			reason: result.reason,
			summary: result.summary,
		},
	};
}

/**
 * Generate a human-readable summary of the trajectory result
 */
export function summarize(result: TrajectoryResult): string {
	const lines: string[] = [];

	lines.push(`Trajectory ${result.completed ? 'completed' : 'incomplete'}`);
	lines.push(`Reason: ${result.reason}`);
	lines.push(`Total turns: ${result.steps.length}`);

	if (result.summary) {
		lines.push(`Summary: ${result.summary}`);
	}

	// Add step summaries
	if (result.steps.length > 0) {
		lines.push('\nSteps:');
		result.steps.forEach((step, index) => {
			const userContent =
				typeof step.userMessage.content === 'string'
					? step.userMessage.content.substring(0, 50)
					: '[complex content]';
			lines.push(`  ${index + 1}. User: ${userContent}...`);
			if (step.toolCalls && step.toolCalls.length > 0) {
				lines.push(`     Tools called: ${step.toolCalls.map((tc) => tc.toolName).join(', ')}`);
			}
		});
	}

	return lines.join('\n');
}

