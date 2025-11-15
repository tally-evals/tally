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
import type { StepRuntimeState, StepId } from './steps/types.js';
import { evaluateSatisfaction } from './execution/satisfaction.js';

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
			conversationId
		);
	}

	// Initialize storage
	const storage = initializeStorage(trajectory, options);

	// Initialize policy
	const policy = createPolicy();

	// Get user model (required for AI-as-user generation)
	const userModel = options?.userModel || trajectory.userModel;
	if (!userModel) {
		throw new Error(
			'userModel is required for trajectory execution. Provide it either in the trajectory definition (trajectory.userModel) or via options.userModel.'
		);
	}

	// Track the current step ID
	let currentStepId: StepId | undefined = trajectory.steps?.start;

	// Track runtime states for steps
	const runtimeStates = new Map<StepId, StepRuntimeState>();

	// Initialize loop detector (for loose mode)
	const loopDetector = new LoopDetector(trajectory.loopDetection);

	// Main execution loop
	while (true) {
		// Get current history
		const history = storage.get(conversationId);

		// Determine step to use for user message generation
		// Pass all step traces for eligibility and LLM ranking context
		const stepSelection = await determineStep(
			trajectory,
			currentStepId,
			userModel,
			runtimeStates,
			turnIndex,
			steps
		);

		const { stepToUse, chosenStepId, candidates } = stepSelection;

		// Debug logging for step selection
		if (generateLogs) {
			console.log(`\n🔍 [STEP SELECTION] Turn ${turnIndex}`);
			console.log(`  Current step ID: ${currentStepId || 'none'}`);
			console.log(`  Chosen step ID: ${chosenStepId || 'none'}`);
			if (chosenStepId && stepToUse) {
				console.log(`  Chosen step instruction: "${stepToUse.instruction}"`);
			}
			if (candidates && candidates.length > 0) {
				console.log(`  Candidates (${candidates.length}):`);
				for (const candidate of candidates.slice(0, 5)) {
					const step = trajectory.steps?.steps.find((s) => s.id === candidate.stepId);
					const score = 'score' in candidate ? candidate.score : 'N/A';
					const reasons = 'reasons' in candidate ? candidate.reasons : [];
					console.log(
						`    - ${candidate.stepId}: score=${score}${reasons.length > 0 ? `, reasons=[${reasons.join(', ')}]` : ''}`
					);
					if (step) {
						console.log(`      instruction: "${step.instruction}"`);
					}
				}
			} else {
				console.log('  No candidates found');
			}
		}

		// Update loop detector based on chosen step (always-on)
		if (turnIndex > 0 && chosenStepId) {
			const loopResult = loopDetector.recordMatch(chosenStepId);
			if (generateLogs && loopResult.shouldStop) {
				const state = loopDetector.getState();
				console.log(
					`\n🔍 [DEBUG] Loop detection: ${loopResult.summary} (State: ${JSON.stringify(state)})`
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

		// Evaluate policy
		const policyContext = buildPolicyContext(
			trajectory,
			history,
			currentStepId,
			stepToUse
		);
		const policyResult = evaluatePolicy(policy, policyContext, turnIndex);

		// Debug logging for policy evaluation
		if (generateLogs) {
			console.log(`\n🔍 [POLICY EVALUATION] Turn ${turnIndex}`);
			console.log(`  Current step ID: ${currentStepId || 'none'}`);
			console.log(`  Should continue: ${policyResult.shouldContinue}`);
			console.log(`  Should stop: ${policyResult.shouldStop}`);
			if (policyResult.reason) {
				console.log(`  Reason: ${policyResult.reason}`);
			}
			if (policyResult.message) {
				console.log(`  Message: ${policyResult.message}`);
			}
			if (trajectory.steps?.terminals && currentStepId) {
				const isTerminal = trajectory.steps.terminals.includes(currentStepId);
				console.log(`  Is terminal step: ${isTerminal}`);
			}
		}

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
			stepTraces: steps,
			lastNSteps: 2, // Default to last 2 steps for user generation context
			...(stepToUse && { nextStep: stepToUse }),
		};
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

		// Update runtime state for the step we just used
		if (chosenStepId && stepToUse) {
			const existingState = runtimeStates.get(chosenStepId);
			const newState: StepRuntimeState = {
				stepId: chosenStepId,
				status: 'in_progress',
				attempts: (existingState?.attempts || 0) + 1,
				lastUpdatedAt: new Date(),
			};
			runtimeStates.set(chosenStepId, newState);

			// Evaluate satisfaction (use history up to the user's message for default heuristic)
			const satisfied = await evaluateSatisfaction(
				stepToUse,
				newState,
				updatedHistory,
				{
					satisfied: new Set(
						Array.from(runtimeStates.values())
						.filter((s) => s.status === 'satisfied')
						.map((s) => s.stepId)
					),
					attemptsByStep: new Map(
						Array.from(runtimeStates.entries()).map(([id, state]) => [id, state.attempts])
					),
				}
			);

			// Debug logging for satisfaction
			if (generateLogs) {
				console.log(`\n🔍 [SATISFACTION] Turn ${turnIndex}`);
				console.log(`  Step ID: ${chosenStepId}`);
				console.log(`  Step instruction: "${stepToUse.instruction}"`);
				console.log(`  Attempts: ${newState.attempts}`);
				console.log(`  Satisfied: ${satisfied}`);
			}

			if (satisfied) {
				newState.status = 'satisfied';
				runtimeStates.set(chosenStepId, newState);
				if (generateLogs) {
					console.log('  ✅ Step marked as satisfied');
				}
			}
		}

		// Update current step ID only when a step is satisfied
		const previousStepId = currentStepId;
		if (chosenStepId && stepToUse) {
			const state = runtimeStates.get(chosenStepId);
			if (state?.status === 'satisfied') {
				currentStepId = chosenStepId;
			}
		}
		
		// Debug logging for step ID update
		if (generateLogs && previousStepId !== currentStepId) {
			console.log(`\n🔍 [STEP ID UPDATE] Turn ${turnIndex}`);
			console.log(`  Previous: ${previousStepId || 'none'} → Current: ${currentStepId || 'none'}`);
		}

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

