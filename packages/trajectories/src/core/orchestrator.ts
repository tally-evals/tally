/**
 * Trajectory orchestrator - main execution engine
 */

import type {
	Trajectory,
	TrajectoryResult,
	StepTrace,
	AgentHandle,
} from './types.js';
import { generateUserMessage } from './userGenerator.js';
import type { UserMessageContext } from './userGenerator.js';
import { logStep, logTrajectoryStart, logTrajectoryEnd } from '../utils/logger.js';
import { initializeAgentMemory } from './execution/storage.js';
import { createPolicy, evaluatePolicy, buildPolicyContext } from './execution/policyEvaluator.js';
import { determineStep } from './execution/stepSelector.js';
import { analyzeAgentLoopFromStepIds } from './execution/loopDetector.js';
import { invokeAgent } from './execution/agentInvoker.js';
import type { StepRuntimeState, StepId } from './steps/types.js';
import { evaluateSatisfaction } from './execution/satisfaction.js';
import { stepTracesToConversation } from '@tally-evals/core';
import type { TallyStore, TrajectoryMeta, HILInteractionTrace } from '@tally-evals/core';
import { resolveHILCalls } from './hil/handler.js';
import type { HILContext, HILInteraction } from './hil/types.js';

export interface RunTrajectoryOptions {
	userModel?: Parameters<typeof import('ai').generateText>[0]['model'];
	generateLogs?: boolean; // Default: false
	/**
	 * Optional persistence hook (core store).
	 *
	 * When provided, the trajectory run will persist:
	 * - TrajectoryMeta (declarative snapshot)
	 * - StepTrace[] (raw traces)
	 */
	store?: TallyStore;
	trajectoryId?: string;
}

function toDeclarativeStepGraph(trajectory: Trajectory): TrajectoryMeta['stepGraph'] {
	if (!trajectory.steps) return undefined;
	return {
		start: trajectory.steps.start,
		...(trajectory.steps.terminals && { terminals: trajectory.steps.terminals }),
		steps: trajectory.steps.steps.map((s) => ({
			id: s.id,
			instruction: s.instruction,
			...(s.hints && { hints: s.hints }),
			...(s.maxAttempts !== undefined && { maxAttempts: s.maxAttempts }),
			...(s.timeoutMs !== undefined && { timeoutMs: s.timeoutMs }),
			...(s.preconditions && {
				preconditions: s.preconditions.map((p) => {
					if (p.type === 'stepSatisfied') return p;
					// Declarative-only: drop function, keep a descriptor.
					return { type: 'custom', ...(p.name && { name: p.name }) };
				}),
			}),
		})),
	};
}

function buildTrajectoryMetaSnapshot(args: {
	trajectoryId: string;
	trajectory: Trajectory;
	createdAt: Date;
}): TrajectoryMeta {
	const { trajectoryId, trajectory, createdAt } = args;
	const stepGraph = toDeclarativeStepGraph(trajectory);
	return {
		version: 1,
		trajectoryId,
		createdAt,
		goal: trajectory.goal,
		persona: trajectory.persona,
		...(trajectory.maxTurns !== undefined && { maxTurns: trajectory.maxTurns }),
		...(trajectory.loopDetection && { loopDetection: trajectory.loopDetection }),
		...(trajectory.metadata && { metadata: trajectory.metadata }),
		...(stepGraph !== undefined && { stepGraph }),
	};
}

/**
 * Convert a trajectories-internal HILInteraction to the core HILInteractionTrace
 * (which lives on StepTrace and has no dependency on the trajectories package).
 */
function toHILInteractionTrace(interaction: HILInteraction): HILInteractionTrace {
	return {
		toolCall: {
			toolCallId: interaction.toolCall.toolCallId,
			toolName: interaction.toolCall.toolName,
			args: interaction.toolCall.args,
		},
		decision: interaction.decision,
		method: interaction.method,
		timestamp: interaction.timestamp,
	};
}

/**
 * Create a trajectory instance (validation and defaults)
 */
export function createTrajectory(
	def: Trajectory,
	agent: AgentHandle
): Trajectory & { agent: AgentHandle } {
	const trajectory: Trajectory & { agent: AgentHandle } = {
		...def,
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
	const conversationId = trajectory.conversationId || `trajectory-${Date.now()}`;
	const trajectoryId = options?.trajectoryId ?? conversationId;
	const createdAt = new Date();

	async function persistDebugArtifacts(result: TrajectoryResult): Promise<void> {
		if (!options?.store) return;
		
		// 1. Convert StepTrace[] to Conversation and save as JSONL
		const conversation = stepTracesToConversation(result.steps, trajectoryId);
		await options.store.saveConversation(trajectoryId, conversation);
		
		// 2. Save trajectory-specific debug artifacts (in same folder)
		const meta = buildTrajectoryMetaSnapshot({
			trajectoryId,
			trajectory,
			createdAt,
		});
		await options.store.saveTrajectoryMeta(trajectoryId, meta);
		await options.store.saveTrajectoryStepTraces(trajectoryId, result.steps);
	}

	// Log trajectory start if enabled
	if (generateLogs) {
		logTrajectoryStart(
			trajectory.goal,
			trajectory.persona,
			conversationId
		);
	}

	// Internal AgentMemory (ephemeral message buffer)
	const agentMemory = initializeAgentMemory();

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

	// Main execution loop
	while (true) {
		// Get current history
		const history = agentMemory.get(conversationId);

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

		const { stepToUse, chosenStepId, candidates, method } = stepSelection;

		// Derived loop detection based on step trace history (always-on)
		if (turnIndex > 0) {
			const loopResult = analyzeAgentLoopFromStepIds(
				[...steps.map((s) => s.stepId), chosenStepId],
				trajectory.loopDetection
			);
			if (loopResult.shouldStop && loopResult.reason && loopResult.summary) {
				const lastStep = steps[steps.length - 1];
				if (lastStep) {
					lastStep.end = {
						isFinal: true,
						reason: loopResult.reason,
						completed: false,
						summary: loopResult.summary,
					};
				}
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
				await persistDebugArtifacts(result);
				return result;
			}
		}

		// Evaluate policy
		const policyContext = buildPolicyContext(
			trajectory,
			steps,
			currentStepId,
			stepToUse
		);
		const policyResult = evaluatePolicy(policy, policyContext, turnIndex);


		if (policyResult.shouldStop) {
			const completed = policyResult.reason === 'goal-reached';
			const reason = policyResult.reason || 'max-turns';
			const summary =
				policyResult.message !== undefined ? policyResult.message : undefined;

			const lastStep = steps[steps.length - 1];
			if (lastStep) {
				lastStep.end = {
					isFinal: true,
					reason,
					completed,
					...(summary !== undefined && { summary }),
				};
			}

			const result: TrajectoryResult = {
				steps,
				completed,
				reason,
			};
			if (summary !== undefined) result.summary = summary;

			if (generateLogs) {
				logTrajectoryEnd(
					result.completed,
					result.reason,
					steps.length,
					result.summary
				);
			}

			await persistDebugArtifacts(result);
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
		let updatedHistory = [...history, userMessage];
		agentMemory.set(conversationId, updatedHistory);

		// Invoke agent and parse response
		let agentResult = await invokeAgent(trajectory.agent, updatedHistory);

		// ================================================================
		// HIL loop: detect pending tool calls and resolve them
		// ================================================================
		const hilInteractions: HILInteractionTrace[] = [];

		if (trajectory.hil) {
			// Fail fast: the agent handle must support resolveHIL when hil is configured
			if (!trajectory.agent.resolveHIL) {
				throw new Error(
					'Trajectory has `hil` configured but the agent handle does not implement `resolveHIL`. ' +
					'Use `withAISdkAgent()` or `withMastraAgent()` to wrap your agent.',
				);
			}

			const maxRoundtrips = trajectory.hil.maxRoundtripsPerTurn ?? 5;
			let roundtrip = 0;
			let currentHistory = [...updatedHistory];

			while (roundtrip < maxRoundtrips) {
				// Framework wrappers surface pending tool calls via AgentResponse
				const pending = agentResult.pendingToolCalls;
				if (pending.length === 0) break;

				if (generateLogs) {
					console.log(
						` HIL round ${roundtrip + 1}: ${pending.length} pending tool call(s) — ${pending.map((p) => p.toolName).join(', ')}`,
					);

					// Warn about tool calls that have no matching hil.tools entry
					if (trajectory.hil.tools) {
						for (const p of pending) {
							if (!(p.toolName in trajectory.hil.tools)) {
								console.warn(
									`  ⚠ Tool "${p.toolName}" triggered HIL but has no entry in hil.tools — falling back to defaultPolicy ("${trajectory.hil.defaultPolicy ?? 'llm'}")`,
								);
							}
						}
					}
				}

				const hilContext: HILContext = Object.assign(
					{
						goal: trajectory.goal,
						persona: trajectory.persona,
						history: currentHistory,
						stepTraces: steps,
						turnIndex,
					},
					stepToUse ? { currentStep: stepToUse } : {},
				);

				let resolved = false;
				try {
					// Handler determines approve/reject for each call
					const { decisions, interactions } =
						await resolveHILCalls(
							pending,
							trajectory.hil,
							hilContext,
							userModel,
						);

					// Record interactions for tracing
					for (const interaction of interactions) {
						hilInteractions.push(toHILInteractionTrace(interaction));
						if (generateLogs) {
							console.log(
								`    ↳ ${interaction.toolCall.toolName}: ${interaction.decision.type} (${interaction.method})`,
							);
						}
					}

					// Include agent messages in the history before resolution
					currentHistory = [
						...currentHistory,
						...agentResult.allMessages,
					];

					// Delegate resolution to the framework wrapper
					if (trajectory.agent.resolveHIL) {
						const response = await trajectory.agent.resolveHIL(
							decisions,
							currentHistory,
						);
						const assistantMessages = response.messages.filter(
							(m) => m.role === 'assistant',
						);
						agentResult = {
							assistantMessages,
							allMessages: [...response.messages],
							pendingToolCalls: response.pendingToolCalls,
						};
						resolved = true;
					}
				} catch (err) {
					if (generateLogs) {
						console.warn(
							` HIL round ${roundtrip + 1} failed:`,
							err instanceof Error ? err.message : err,
						);
					}
				}

				if (!resolved) {
					// Resolution failed or no resolveHIL on wrapper — stop loop
					break;
				}

				agentMemory.set(conversationId, currentHistory);
				roundtrip++;
			}

			// Update the base history reference so subsequent code uses
			// the history that includes all HIL roundtrips
			updatedHistory = currentHistory;
		}

		// Create step trace
		const stepTrace: StepTrace = {
			turnIndex,
			userMessage,
			agentMessages: agentResult.allMessages,
			timestamp: new Date(),
			stepId: chosenStepId ?? null,
			selection: {
				method,
				...(candidates && { candidates }),
			},
			...(hilInteractions.length > 0 && {
				hilInteractions,
			}),
		};

		steps.push(stepTrace);

		// Log step if enabled
		if (generateLogs) {
			logStep(stepTrace, turnIndex);
		}

		// Update history with all agent messages (assistant + tool) for full context
		const finalHistory = [...updatedHistory, ...agentResult.allMessages];
		agentMemory.set(conversationId, finalHistory);

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
				steps,
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


			if (satisfied) {
				newState.status = 'satisfied';
				runtimeStates.set(chosenStepId, newState);
				if (generateLogs) {
					console.log('  ✅ Step marked as satisfied');
				}
			}
		}

		// Update current step ID only when a step is satisfied
		if (chosenStepId && stepToUse) {
			const state = runtimeStates.get(chosenStepId);
			if (state?.status === 'satisfied') {
				currentStepId = chosenStepId;
			}
		}
		

		turnIndex++;

		// Safety check for infinite loops
		if (turnIndex > 30) {
			const lastStep = steps[steps.length - 1];
			if (lastStep) {
				lastStep.end = {
					isFinal: true,
					reason: 'max-turns',
					completed: false,
					summary: 'Maximum safety limit reached (30 turns)',
				};
			}
			const result: TrajectoryResult = {
				steps,
				completed: false,
				reason: 'max-turns',
				summary: 'Maximum safety limit reached (30 turns)',
			};

			if (generateLogs) {
				logTrajectoryEnd(result.completed, result.reason, steps.length, result.summary);
			}

			await persistDebugArtifacts(result);
			return result;
		}
	}
}

