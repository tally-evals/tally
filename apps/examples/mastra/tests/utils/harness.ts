/**
 * Test Harness for Running Trajectories
 * 
 * Supports both realtime (record) and playback modes for trajectory-based tests.
 * Uses RECORD_TRAJECTORIES environment variable to toggle between modes.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import type { AgentHandle, Trajectory, TrajectoryResult } from '@tally-evals/trajectories';
import {
	createTrajectory,
	runTrajectory,
} from '@tally-evals/trajectories';
import type { Conversation, ConversationStep, TallyRunArtifact } from '@tally-evals/tally';
import type { ModelMessage } from 'ai';
import type { Agent } from '@mastra/core/agent';
import { stepTracesToConversation, TallyStore } from '@tally-evals/core';
import { rm } from 'node:fs/promises';

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

export async function saveTallyReportToStore(args: {
	conversationId: string;
	report: TallyRunArtifact;
	/**
	 * Optional override for the run id used as the report filename.
	 * Defaults to `report.runId` (if present).
	 */
	runId?: string;
}): Promise<{ runId: string }> {
	// Resolve app root (stable cwd for config discovery)
	const appRoot = resolve(__dirname, '..', '..');
	const store = await TallyStore.open({ cwd: appRoot });

	const inferredRunId = typeof args.report?.runId === 'string' ? args.report.runId : undefined;
	const runId = args.runId ?? inferredRunId;
	if (!runId) {
		throw new Error('saveTallyReportToStore: runId is required (either pass args.runId or provide a report with runId:string)');
	}

	const convRef = (await store.getConversation(args.conversationId)) ?? (await store.createConversation(args.conversationId));
	const runRef = await convRef.createRun({ type: 'tally', runId });
	await runRef.save(args.report as never);

	return { runId };
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
	const { trajectory, agent, conversationId, generateLogs = false } = options;

	// Resolve app root (stable cwd for config discovery)
	const appRoot = resolve(__dirname, '..', '..');
	const store = await TallyStore.open({ cwd: appRoot });

	if (RECORD_MODE) {
		// Overwrite semantics: if we're re-recording a trajectory, remove stale runs.
		// (Trajectories will overwrite step traces/meta, but runs are appended and must be cleared explicitly.)
		await rm(resolve(appRoot, '.tally', 'conversations', conversationId, 'runs'), {
			recursive: true,
			force: true,
		});


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

		const result: TrajectoryResult = await runTrajectory(trajectoryInstance, { generateLogs, store, trajectoryId: conversationId });

		// Save conversation steps to JSONL
		const conversation = stepTracesToConversation(result.steps, conversationId);
		console.log(`✅ Persisted ${result.steps.length} steps to store for ${conversationId}`);

		return { conversation, mode: 'record' };
	}

	// Playback mode: load from store
	console.log(`📖 Playing back from store: ${conversationId}`);
	
	// Try loading conversation.jsonl first (preferred format)
	const convRef = await store.getConversation(conversationId);
	if (convRef) {
		try {
			const conversation = await convRef.load();
			return { conversation, mode: 'playback' };
		} catch {
			// conversation.jsonl doesn't exist or is invalid, fall back to stepTraces
		}
	}
	
	// Fall back to stepTraces.json
	const traces = await store.loadTrajectoryStepTraces(conversationId);
	if (traces) {
		const conversation = stepTracesToConversation(traces, conversationId);
		return { conversation, mode: 'playback' };
	}
	
	throw new Error(
		`No stored conversation or StepTrace[] found for '${conversationId}'. Run with RECORD_TRAJECTORIES=1 to record it.`
	);
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

