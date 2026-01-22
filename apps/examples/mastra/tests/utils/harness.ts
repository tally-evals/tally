/**
 * Test Harness for Running Trajectories
 * 
 * Supports both realtime (record) and playback modes for trajectory-based tests.
 * Uses RECORD_TRAJECTORIES environment variable to toggle between modes.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { AgentHandle, Trajectory, TrajectoryResult } from '@tally-evals/trajectories';
import {
	createTrajectory,
	runTrajectory,
	toConversation,
} from '@tally-evals/trajectories';
import type { Conversation, ConversationStep } from '@tally-evals/tally';
import type { ModelMessage } from 'ai';
import type { Agent } from '@mastra/core/agent';

// Load .env.local if it exists
config({ path: resolve(process.cwd(), '.env.local') });

const RECORD_MODE = process.env.RECORD_TRAJECTORIES === '1';

console.log(process.env.RECORD_TRAJECTORIES);

/**
 * Options for running a test case
 */
export interface RunCaseOptions {
	/** Trajectory definition */
	trajectory: Trajectory;
	/** Mastra Agent instance */
	agent: {
		generate: Agent["generate"];
	};
	/** Path to recorded fixture file (relative to tests directory) */
	recordedPath: string;
	/** Conversation ID for the trajectory */
	conversationId: string;
	/** Whether to generate logs (default: false) */
	generateLogs?: boolean;
}

/**
 * Result of running a test case
 */
export interface RunCaseResult {
	/** The conversation data */
	conversation: Conversation;
	/** Whether this was recorded or played back */
	mode: 'record' | 'playback';
}

/**
 * Run a trajectory test case
 * 
 * In record mode: runs the trajectory and saves to recordedPath
 * In playback mode: loads conversation from recordedPath
 */
export async function runCase(
	options: RunCaseOptions
): Promise<RunCaseResult> {
	const { trajectory, agent, recordedPath, conversationId, generateLogs = false } = options;

	// Resolve absolute path to fixture
	const fixturePath = resolve(process.cwd(), 'tests', recordedPath);

	if (RECORD_MODE) {
		// Record mode: run trajectory and save
		console.log(`📹 Recording trajectory: ${conversationId}`);

		// TODO: should use the withMastraAgent wrapper instead
		const agentHandle: AgentHandle = {
			respond: async (history: readonly ModelMessage[]) => {
				const _history = structuredClone(history) as ModelMessage[];
				const result = await agent.generate(_history, { format: 'mastra' });
				const messages: ModelMessage[] = [];
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
			}
		}
		const trajectoryInstance = createTrajectory(trajectory, agentHandle);

		const result: TrajectoryResult = await runTrajectory(trajectoryInstance, { generateLogs });
		const conversation = toConversation(result, conversationId);

		// Save conversation steps to JSONL
		const dir = dirname(fixturePath);
		mkdirSync(dir, { recursive: true });

		// Save as JSONL with one step per line
		const stepsJsonl = `${conversation.steps
			.map((step: Conversation['steps'][0]) => {
				return JSON.stringify({
					conversationId: conversation.id,
					stepIndex: step.stepIndex,
					input: step.input,
					output: step.output,
					timestamp: step.timestamp,
					metadata: {
						...(conversation.metadata || {}),
						...(step.metadata || {}),
					},
				});
			})
			.join('\n')}\n`;

		writeFileSync(fixturePath, stepsJsonl, 'utf-8');
		console.log(`✅ Saved ${conversation.steps.length} steps to ${recordedPath}`);

		return { conversation, mode: 'record' };
	}

	// Playback mode: load from fixture
	console.log(`📖 Playing back from fixture: ${recordedPath}`);

	// Load conversation steps from JSONL (each line is a step)
	const conversation = await loadConversationSteps(fixturePath, conversationId);

	return { conversation, mode: 'playback' };
}

/**
 * Load conversation steps from JSONL file
 * 
 * Helper for loading recorded conversations that were saved step-by-step
 * Each line in the JSONL file is a step with conversationId
 */
export async function loadConversationSteps(
	filePath: string,
	conversationId: string
): Promise<Conversation> {
	// Read file line by line
	const { readFileSync } = await import('node:fs');
	const lines = readFileSync(filePath, 'utf-8')
		.split('\n')
		.filter((line) => line.trim() !== '');

	// Collect steps for the requested conversation
	const steps: ConversationStep[] = [];
	let metadata: Record<string, unknown> = {};

	for (const line of lines) {
		const stepData = JSON.parse(line) as {
			conversationId: string;
			stepIndex: number;
			input: unknown;
			output: unknown;
			timestamp?: string;
			metadata?: Record<string, unknown>;
		};

		// Only collect steps for the requested conversation
		if (stepData.conversationId === conversationId) {
			steps.push({
				stepIndex: stepData.stepIndex,
				input: stepData.input as ConversationStep['input'],
				output: stepData.output as ConversationStep['output'],
				...(stepData.timestamp && { timestamp: new Date(stepData.timestamp) }),
				metadata: stepData.metadata || {},
			});

			// Merge metadata from steps
			if (stepData.metadata) {
				metadata = { ...metadata, ...stepData.metadata };
			}
		}
	}

	if (steps.length === 0) {
		throw new Error(
			`No steps found for conversation ${conversationId} in fixture: ${filePath}. Run with RECORD_TRAJECTORIES=1 to create it.`
		);
	}

	// Sort steps by stepIndex
	steps.sort((a, b) => a.stepIndex - b.stepIndex);

	return {
		id: conversationId,
		steps,
		metadata,
	};
}

/**
 * Extract tool calls from a ModelMessage
 */
function extractToolCallsFromMessage(message: ModelMessage): Array<{
	toolCallId: string;
	toolName: string;
	input: unknown;
}> {
	const toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];

	if (message.role !== 'assistant') {
		return toolCalls;
	}

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
				const partObj = part as unknown as Record<string, unknown>;
				toolCalls.push({
					toolCallId: String(part.toolCallId),
					toolName: String(part.toolName),
					input: 'input' in partObj ? partObj.input : 'args' in partObj ? partObj.args : {},
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
					input: 'args' in toolCall ? toolCall.args : {},
				});
			}
		}
	}

	return toolCalls;
}

/**
 * Extract tool results from ModelMessage array
 */
function extractToolResults(messages: readonly ModelMessage[]): Map<string, {
	toolCallId: string;
	toolName: string;
	output: unknown;
}> {
	const results = new Map<string, { toolCallId: string; toolName: string; output: unknown }>();

	for (const message of messages) {
		if (message.role === 'tool' && 'toolCallId' in message) {
			const toolCallId = String(message.toolCallId);
			const toolName = 'toolName' in message ? String(message.toolName) : 'unknown';
			const output = message.content;

			results.set(toolCallId, { toolCallId, toolName, output });
		}

		// Also check content array for tool-result parts
		if (Array.isArray(message.content)) {
			for (const part of message.content) {
				if (
					typeof part === 'object' &&
					part !== null &&
					'type' in part &&
					part.type === 'tool-result' &&
					'toolCallId' in part
				) {
					const partObj = part as unknown as Record<string, unknown>;
					const toolCallId = String(part.toolCallId);
					const toolName = 'toolName' in partObj ? String(partObj.toolName) : 'unknown';
					const output = 'output' in partObj ? partObj.output : 'content' in partObj ? partObj.content : undefined;

					if (output !== undefined) {
						results.set(toolCallId, { toolCallId, toolName, output });
					}
				}
			}
		}
	}

	return results;
}

/**
 * Assert that tool calls in a step are properly paired with tool results
 */
export function assertToolCallSequence(step: ConversationStep): void {
	const toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];
	const toolResults = extractToolResults(step.output);

	// Extract all tool calls from assistant messages
	for (const message of step.output) {
		if (message.role === 'assistant') {
			toolCalls.push(...extractToolCallsFromMessage(message));
		}
	}

	// Assert every tool call has a matching result
	for (const toolCall of toolCalls) {
		if (!toolResults.has(toolCall.toolCallId)) {
			throw new Error(
				`Tool call ${toolCall.toolCallId} (${toolCall.toolName}) at step ${step.stepIndex} has no matching tool result`
			);
		}
	}

	// Assert every tool result has a matching call (optional - some results might be from previous steps)
	// This is a softer check since results might span multiple steps
}

/**
 * Assert that a step contains expected tool calls
 */
export function assertExpectedToolCalls(
	step: ConversationStep,
	expectedToolNames: string[]
): void {
	const toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> = [];

	for (const message of step.output) {
		if (message.role === 'assistant') {
			toolCalls.push(...extractToolCallsFromMessage(message));
		}
	}

	const actualToolNames = toolCalls.map((tc) => tc.toolName);

	for (const expectedName of expectedToolNames) {
		if (!actualToolNames.includes(expectedName)) {
			throw new Error(
				`Expected tool call "${expectedName}" not found at step ${step.stepIndex}. Found: ${actualToolNames.join(', ')}`
			);
		}
	}
}

