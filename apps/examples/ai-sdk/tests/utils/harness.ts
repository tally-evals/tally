/**
 * Test Harness for Running Trajectories
 * 
 * Supports both realtime (record) and playback modes for trajectory-based tests.
 * Uses RECORD_TRAJECTORIES environment variable to toggle between modes.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Trajectory, TrajectoryResult } from '@tally-evals/trajectories';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toConversation,
} from '@tally-evals/trajectories';
import type { Conversation, ConversationStep } from '@tally-evals/tally';
import type { Prompt } from 'ai';

// Load .env.local if it exists
config({ path: resolve(process.cwd(), '.env.local') });

const RECORD_MODE = process.env.RECORD_TRAJECTORIES === '1';

/**
 * Options for running a test case
 */
export interface RunCaseOptions {
	/** Trajectory definition */
	trajectory: Trajectory;
	/** AI SDK Agent instance (Experimental_Agent) */
	agent: { generate: (input: Prompt) => Promise<{ response: { messages: readonly import('ai').ModelMessage[] } }> };
	/** Path to recorded fixture file (relative to tests directory) */
	recordedPath: string;
	/** Conversation ID for the trajectory */
	conversationId: string;
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
	const { trajectory, agent, recordedPath, conversationId } = options;

		// Resolve absolute path to fixture
		const fixturePath = resolve(process.cwd(), 'tests', recordedPath);

	if (RECORD_MODE) {
		// Record mode: run trajectory and save
		console.log(`📹 Recording trajectory: ${conversationId}`);
		
		// Cast to remove readonly - withAISdkAgent accepts mutable arrays internally
		const wrappedAgent = withAISdkAgent(agent as { generate: (input: Prompt) => Promise<{ response: { messages: import('ai').ModelMessage[] } }> });
		const trajectoryInstance = createTrajectory(trajectory, wrappedAgent);
		
		const result: TrajectoryResult = await runTrajectory(trajectoryInstance);
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

