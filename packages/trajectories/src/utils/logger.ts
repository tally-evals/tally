/**
 * Pretty logger for conversation trajectories
 */

import type { StepTrace } from '../core/types.js';
import type { ModelMessage } from 'ai';

/**
 * Format a message content for display
 */
function formatMessageContent(content: ModelMessage['content']): string {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		const parts: string[] = [];
		for (const part of content) {
			if (part.type === 'text' && 'text' in part) {
				parts.push(part.text);
			} else if (part.type === 'tool-call' && 'toolCallId' in part && 'toolName' in part) {
				parts.push(`[Tool Call: ${part.toolName}]`);
			} else if (part.type === 'tool-result' && 'toolCallId' in part) {
				parts.push(`[Tool Result: ${part.toolCallId}]`);
			} else {
				parts.push(`[${part.type}]`);
			}
		}
		return parts.join('\n');
	}

	return '[Complex content]';
}

/**
 * Format a single message for display
 */
function formatMessage(message: ModelMessage, roleColor: (text: string) => string): string {
	const content = formatMessageContent(message.content);
	const roleLabel = message.role.toUpperCase().padEnd(10);
	return `${roleColor(roleLabel)} ${content}`;
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	gray: '\x1b[90m',
};

/**
 * Get color for a message role
 */
function getRoleColor(role: ModelMessage['role']): (text: string) => string {
	const colorMap: Record<ModelMessage['role'], string> = {
		user: colors.cyan,
		assistant: colors.green,
		system: colors.yellow,
		tool: colors.magenta,
	};

	const color = colorMap[role] || colors.white;
	return (text: string) => `${color}${text}${colors.reset}`;
}

/**
 * Extract tool calls from messages
 */
function extractToolCalls(messages: readonly ModelMessage[]): Array<{
	toolCallId: string;
	toolName: string;
	args: unknown;
	result?: unknown;
}> {
	const toolCalls: Array<{
		toolCallId: string;
		toolName: string;
		args: unknown;
		result?: unknown;
	}> = [];

	// Extract tool calls from assistant messages with structured content
	for (const msg of messages) {
		if (msg.role === 'assistant' && typeof msg.content === 'object' && Array.isArray(msg.content)) {
			for (const part of msg.content) {
				if (
					part.type === 'tool-call' &&
					'id' in part &&
					'name' in part &&
					'args' in part
				) {
					toolCalls.push({
						toolCallId: part.id as string,
						toolName: part.name as string,
						args: part.args,
					});
				}
			}
		}
	}

	// Match tool results to tool calls
	for (const msg of messages) {
		if (msg.role === 'tool' && 'toolCallId' in msg && 'content' in msg) {
			const toolCallId = msg.toolCallId as string;
			const existing = toolCalls.find((tc) => tc.toolCallId === toolCallId);
			if (existing) {
				existing.result = msg.content;
			}
		}
	}

	return toolCalls;
}

/**
 * Log a conversation step
 */
export function logStep(step: StepTrace, turnIndex: number): void {
	console.log(`\n${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
	console.log(`${colors.bright}${colors.blue}Turn ${turnIndex}${colors.reset} ${colors.dim}(${step.timestamp.toISOString()})${colors.reset}`);
	console.log(
		`${colors.dim}${colors.gray}Step:${colors.reset} ${step.stepId ?? '(none)'}  ${colors.dim}${colors.gray}Selection:${colors.reset} ${step.selection.method}`
	);
	console.log(`${colors.bright}${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

	// Log user message
	console.log(formatMessage(step.userMessage, getRoleColor('user')));
	console.log();

	// Extract and log tool calls if present
	const toolCalls = extractToolCalls(step.agentMessages);
	if (toolCalls.length > 0) {
		console.log(`${colors.dim}${colors.gray}Tools called:${colors.reset}`);
		for (const toolCall of toolCalls) {
			const argsStr =
				typeof toolCall.args === 'object' && toolCall.args !== null
					? JSON.stringify(toolCall.args, null, 2)
					: String(toolCall.args);
			console.log(
				`  ${colors.magenta}→${colors.reset} ${colors.bright}${toolCall.toolName}${colors.reset} ${colors.dim}(${toolCall.toolCallId})${colors.reset}`
			);
			if (argsStr.length < 100) {
				console.log(`    ${colors.dim}${argsStr}${colors.reset}`);
			}
			if (toolCall.result !== undefined) {
				const resultStr =
					typeof toolCall.result === 'object' && toolCall.result !== null
						? JSON.stringify(toolCall.result, null, 2)
						: String(toolCall.result);
				if (resultStr.length < 200) {
					console.log(`    ${colors.dim}Result: ${resultStr}${colors.reset}`);
				} else {
					console.log(`    ${colors.dim}Result: [truncated]${colors.reset}`);
				}
			}
		}
		console.log();
	}

	// Log agent messages (includes assistant and tool messages)
	for (const msg of step.agentMessages) {
		console.log(formatMessage(msg, getRoleColor(msg.role)));
		console.log();
	}

	if (step.end) {
		console.log(
			`${colors.bright}${colors.yellow}END${colors.reset} ${colors.dim}(${step.end.reason}${step.end.completed ? ', completed' : ''})${colors.reset}${
				step.end.summary ? ` ${colors.dim}${step.end.summary}${colors.reset}` : ''
			}`
		);
	}
}

/**
 * Log trajectory start
 */
export function logTrajectoryStart(
	goal: string,
	persona: { name?: string; description: string },
	conversationId: string
): void {
	console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
	console.log(`${colors.bright}${colors.blue}  TRAJECTORY START${colors.reset}`);
	console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
	console.log(`${colors.bright}Goal:${colors.reset} ${goal}`);
	if (persona.name) {
		console.log(`${colors.bright}Persona:${colors.reset} ${persona.name}`);
	}
	console.log(`${colors.bright}Description:${colors.reset} ${persona.description}`);
	console.log(`${colors.bright}Conversation ID:${colors.reset} ${conversationId}`);
	console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * Log trajectory end
 */
export function logTrajectoryEnd(
	completed: boolean,
	reason: string,
	stepsCount: number,
	summary?: string
): void {
	console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
	console.log(`${colors.bright}${colors.blue}  TRAJECTORY END${colors.reset}`);
	console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}`);
	console.log(
		`${colors.bright}Status:${colors.reset} ${completed ? `${colors.green}COMPLETED${colors.reset}` : `${colors.red}INCOMPLETE${colors.reset}`}`
	);
	console.log(`${colors.bright}Reason:${colors.reset} ${reason}`);
	console.log(`${colors.bright}Total Turns:${colors.reset} ${stepsCount}`);
	if (summary) {
		console.log(`${colors.bright}Summary:${colors.reset} ${summary}`);
	}
	console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

