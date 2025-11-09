/**
 * Trajectory orchestrator - main execution engine
 */

import type {
	Trajectory,
	TrajectoryResult,
	StepTrace,
	AgentHandle,
} from './types.js';
import { LocalMemory } from './memory/localMemory.js';
import { NoopMemory } from './memory/noopMemory.js';
import type { Memory } from './memory/interface.js';
import { StrictPolicy, LoosePolicy } from '../policies/index.js';
import type { PolicyContext } from '../policies/index.js';
import { generateUserMessage } from './userGenerator.js';
import type { UserMessageContext } from './userGenerator.js';

export interface RunTrajectoryOptions {
	memory?: Memory;
	userModel?: Parameters<typeof import('ai').generateText>[0]['model'];
}

/**
 * Create a trajectory instance (validation and defaults)
 */
export function createTrajectory(
	def: Trajectory,
	agent: AgentHandle
): Trajectory & { agent: AgentHandle } {
	// Set defaults
	const trajectory: Trajectory & { agent: AgentHandle } = {
		...def,
		memory: def.memory ?? { strategy: 'local' },
		agent,
	};

	return trajectory;
}

/**
 * Run a trajectory to completion
 */
export async function runTrajectory(
	trajectory: Trajectory & { agent: AgentHandle },
	options?: RunTrajectoryOptions
): Promise<TrajectoryResult> {
	const steps: StepTrace[] = [];
	let turnIndex = 0;
	const conversationId =
		trajectory.memory?.conversationId || `trajectory-${Date.now()}`;

	// Initialize memory
	let memory: Memory;
	if (options?.memory) {
		memory = options.memory;
	} else if (trajectory.memory?.strategy === 'none') {
		memory = new NoopMemory();
	} else {
		const memoryOptions: { ttlMs?: number; capacity?: number } = {};
		if (trajectory.memory?.ttlMs !== undefined) {
			memoryOptions.ttlMs = trajectory.memory.ttlMs;
		}
		if (trajectory.memory?.capacity !== undefined) {
			memoryOptions.capacity = trajectory.memory.capacity;
		}
		memory = new LocalMemory(memoryOptions);
	}

	// Initialize policy
	const policy =
		trajectory.mode === 'strict' ? new StrictPolicy() : new LoosePolicy();

	// Get user model (required for AI-as-user generation)
	// Can be provided in trajectory or options (options takes precedence)
	const userModel = options?.userModel || trajectory.userModel;
	if (!userModel) {
		throw new Error(
			'userModel is required for trajectory execution. Provide it either in the trajectory definition (trajectory.userModel) or via options.userModel.'
		);
	}

	// Main execution loop
	while (true) {
		// Get current history
		const history = memory.get(conversationId);

		// Determine current step
		const currentStepIndex = Math.floor(history.length / 2); // Rough estimate
		const nextStep =
			trajectory.steps && currentStepIndex < trajectory.steps.length
				? trajectory.steps[currentStepIndex]
				: undefined;

		// Evaluate policy
		const policyContext: PolicyContext = {
			trajectory,
			history,
			currentStepIndex,
		};
		if (nextStep !== undefined) {
			policyContext.nextStep = nextStep;
		}
		const policyResult = policy.evaluate(policyContext, turnIndex);

		if (policyResult.shouldStop) {
			const result: TrajectoryResult = {
				steps,
				completed: policyResult.reason === 'goal-reached',
				reason: policyResult.reason || 'max-turns',
			};
			if (policyResult.message !== undefined) {
				result.summary = policyResult.message;
			}
			return result;
		}

		// Generate user message
		const userContext: UserMessageContext = {
			trajectory,
			history,
			currentStepIndex,
		};
		if (nextStep !== undefined) {
			userContext.nextStep = nextStep;
		}
		const userMessage = await generateUserMessage(userContext, userModel);

		// Add user message to history
		const updatedHistory = [...history, userMessage];
		memory.set(conversationId, updatedHistory);

		// Call agent
		const agentResult = await trajectory.agent.respond(updatedHistory);

		// Extract tool calls if any
		const toolCalls: Array<{
			toolCallId: string;
			toolName: string;
			args: unknown;
			result?: unknown;
		}> = [];
		for (const msg of agentResult.messages) {
			if (msg.role === 'assistant' && typeof msg.content === 'object' && Array.isArray(msg.content)) {
				// Extract tool call info from structured content
				for (const part of msg.content) {
					if (part.type === 'tool-call' && 'id' in part && 'name' in part && 'args' in part) {
						toolCalls.push({
							toolCallId: part.id as string,
							toolName: part.name as string,
							args: part.args,
						});
					} else if (part.type === 'tool-result' && 'id' in part && 'result' in part) {
						const existing = toolCalls.find((tc) => tc.toolCallId === part.id as string);
						if (existing) {
							existing.result = part.result;
						}
					}
				}
			}
		}

		// Create step trace
		const stepTrace: StepTrace = {
			turnIndex,
			userMessage,
			agentMessages: agentResult.messages,
			...(toolCalls.length > 0 && { toolCalls }),
			timestamp: new Date(),
		};

		steps.push(stepTrace);

		// Update history with agent messages
		const finalHistory = [...updatedHistory, ...agentResult.messages];
		memory.set(conversationId, finalHistory);

		turnIndex++;

		// Safety check for infinite loops
		if (turnIndex > 100) {
			return {
				steps,
				completed: false,
				reason: 'max-turns',
				summary: 'Maximum safety limit reached (100 turns)',
			};
		}
	}
}

