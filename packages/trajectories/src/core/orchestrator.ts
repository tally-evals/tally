/**
 * Trajectory orchestrator - main execution engine
 */

import type {
	Trajectory,
	TrajectoryResult,
	StepTrace,
	AgentHandle,
} from './types.js';
import type { Storage } from './storage/interface.js';
import { generateUserMessage } from './userGenerator.js';
import type { UserMessageContext } from './userGenerator.js';
import { logStep, logTrajectoryStart, logTrajectoryEnd } from '../utils/logger.js';
import { initializeStorage } from './execution/storage.js';
import { createPolicy, evaluatePolicy, buildPolicyContext } from './execution/policyEvaluator.js';
import { determineStep } from './execution/stepSelector.js';
import { LoopDetector } from './execution/loopDetector.js';
import { invokeAgent } from './execution/agentInvoker.js';
import { advanceStepIndex } from './execution/stepAdvancement.js';

export interface RunTrajectoryOptions {
	storage?: Storage;
	userModel?: Parameters<typeof import('ai').generateText>[0]['model'];
	generateLogs?: boolean; // Default: false
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
		storage: def.storage ?? { strategy: 'local' },
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
	const generateLogs = options?.generateLogs ?? false;
	const steps: StepTrace[] = [];
	let turnIndex = 0;
	const conversationId =
		trajectory.storage?.conversationId || `trajectory-${Date.now()}`;

	// Log trajectory start if enabled
	if (generateLogs) {
		logTrajectoryStart(
			trajectory.goal,
			trajectory.persona,
			trajectory.mode,
			conversationId
		);
	}

	// Initialize storage
	const storage = initializeStorage(trajectory, options);

	// Initialize policy
	const policy = createPolicy(trajectory.mode);

	// Get user model (required for AI-as-user generation)
	const userModel = options?.userModel || trajectory.userModel;
	if (!userModel) {
		throw new Error(
			'userModel is required for trajectory execution. Provide it either in the trajectory definition (trajectory.userModel) or via options.userModel.'
		);
	}

	// Track the current step index (may differ from turnIndex in loose mode)
	let currentStepIndex = 0;

	// Initialize loop detector (for loose mode)
	const loopDetector = new LoopDetector(trajectory.loopDetection);

	// Main execution loop
	while (true) {
		// Get current history
		const history = storage.get(conversationId);

		// Determine step to use for user message generation
		const stepSelection = await determineStep(
			trajectory,
			turnIndex,
			currentStepIndex,
			history,
			userModel,
			generateLogs
		);

		const { stepToUse, stepIndexToUse, matchResult } = stepSelection;

		// Update loop detector based on match result (only in loose mode after first turn)
		if (trajectory.mode === 'loose' && turnIndex > 0 && matchResult) {
			if (matchResult.matchedStepIndex !== null) {
				const loopResult = loopDetector.recordMatch(matchResult.matchedStepIndex);
				if (generateLogs && loopResult.shouldStop) {
					console.log(
						`\n🔍 [DEBUG] Loop detection: Same step ${matchResult.matchedStepIndex} matched ${loopDetector.getState().consecutiveSameStepCount} times (limit: ${trajectory.loopDetection?.maxConsecutiveSameStep ?? 3})`
					);
				}
				if (loopResult.shouldStop && loopResult.reason && loopResult.summary) {
					const result: TrajectoryResult = {
						steps,
						completed: false,
						reason: loopResult.reason,
						summary: loopResult.summary,
					};
					if (generateLogs) {
						logTrajectoryEnd(
							result.completed,
							result.reason,
							steps.length,
							result.summary
						);
					}
					return result;
				}
			} else {
				const loopResult = loopDetector.recordNoMatch();
				if (generateLogs) {
					const state = loopDetector.getState();
					console.log(
						`\n🔍 [DEBUG] Loop detection: No match ${state.consecutiveNoMatchCount} times (limit: ${trajectory.loopDetection?.maxConsecutiveNoMatch ?? 3})`
					);
				}
				if (loopResult.shouldStop && loopResult.reason && loopResult.summary) {
					const result: TrajectoryResult = {
						steps,
						completed: false,
						reason: loopResult.reason,
						summary: loopResult.summary,
					};
					if (generateLogs) {
						logTrajectoryEnd(
							result.completed,
							result.reason,
							steps.length,
							result.summary
						);
					}
					return result;
				}
			}
		}

		// Evaluate policy
		const policyContext = buildPolicyContext(
			trajectory,
			history,
			stepIndexToUse,
			stepToUse
		);
		const policyResult = evaluatePolicy(policy, policyContext, turnIndex);

		if (policyResult.shouldStop) {
			const result: TrajectoryResult = {
				steps,
				completed: policyResult.reason === 'goal-reached',
				reason: policyResult.reason || 'max-turns',
			};
			if (policyResult.message !== undefined) {
				result.summary = policyResult.message;
			}

			if (generateLogs) {
				logTrajectoryEnd(
					result.completed,
					result.reason,
					steps.length,
					result.summary
				);
			}

			return result;
		}

		// Generate user message
		const userContext: UserMessageContext = {
			trajectory,
			history,
			currentStepIndex: stepIndexToUse,
		};
		if (stepToUse !== undefined) {
			userContext.nextStep = stepToUse;
		}
		const userMessage = await generateUserMessage(userContext, userModel);

		// Add user message to history
		const updatedHistory = [...history, userMessage];
		storage.set(conversationId, updatedHistory);

		// Invoke agent and parse response
		const agentResult = await invokeAgent(trajectory.agent, updatedHistory);

		// Create step trace
		const stepTrace: StepTrace = {
			turnIndex,
			userMessage,
			agentMessages: agentResult.allMessages,
			timestamp: new Date(),
		};

		steps.push(stepTrace);

		// Log step if enabled
		if (generateLogs) {
			logStep(stepTrace, turnIndex);
		}

		// Update history with all agent messages (assistant + tool) for full context
		const finalHistory = [...updatedHistory, ...agentResult.allMessages];
		storage.set(conversationId, finalHistory);

		// Advance step index
		currentStepIndex = advanceStepIndex(
			trajectory.mode,
			currentStepIndex,
			stepIndexToUse,
			stepToUse !== undefined,
			turnIndex
		);

		turnIndex++;

		// Safety check for infinite loops
		if (turnIndex > 30) {
			const result: TrajectoryResult = {
				steps,
				completed: false,
				reason: 'max-turns',
				summary: 'Maximum safety limit reached (30 turns)',
			};

			if (generateLogs) {
				logTrajectoryEnd(result.completed, result.reason, steps.length, result.summary);
			}

			return result;
		}
	}
}

