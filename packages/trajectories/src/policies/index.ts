/**
 * Policy implementations for trajectory execution
 */

import type { ModelMessage } from 'ai';
import type { Trajectory, TrajectoryStep, TrajectoryStopReason } from '../core/types.js';

export interface PolicyContext {
	trajectory: Trajectory;
	history: readonly ModelMessage[];
	currentStepIndex: number;
	nextStep?: TrajectoryStep;
}

export interface PolicyResult {
	shouldContinue: boolean;
	shouldStop: boolean;
	reason?: TrajectoryStopReason;
	message?: string;
}

/**
 * Strict policy: Execute steps in order; deviations are violations
 */
export class StrictPolicy {
	evaluate(context: PolicyContext, turnIndex: number): PolicyResult {
		const { trajectory, currentStepIndex, nextStep } = context;

		// Check max turns
		if (trajectory.maxTurns !== undefined && turnIndex >= trajectory.maxTurns) {
			return {
				shouldContinue: false,
				shouldStop: true,
				reason: 'max-turns',
				message: `Maximum turns (${trajectory.maxTurns}) reached`,
			};
		}

		// If no steps defined, allow continuation
		if (!trajectory.steps || trajectory.steps.length === 0) {
			return {
				shouldContinue: true,
				shouldStop: false,
			};
		}

		// If we've completed all steps
		if (currentStepIndex >= trajectory.steps.length) {
			return {
				shouldContinue: false,
				shouldStop: true,
				reason: 'goal-reached',
				message: 'All steps completed',
			};
		}

		// Check if current step has required info
		if (nextStep?.requiredInfo && nextStep.requiredInfo.length > 0) {
			// In strict mode, we'd need to check if info is present
			// For now, we'll let the step proceed and check hardStopIfMissing later
			if (nextStep.hardStopIfMissing) {
				// This would need more sophisticated checking
				// For now, we'll continue and let the orchestrator handle it
			}
		}

		return {
			shouldContinue: true,
			shouldStop: false,
		};
	}
}

/**
 * Loose policy: Steps act as guidance; allow reasonable deviations
 */
export class LoosePolicy {
	evaluate(context: PolicyContext, turnIndex: number): PolicyResult {
		const { trajectory } = context;

		// Check max turns
		if (trajectory.maxTurns !== undefined && turnIndex >= trajectory.maxTurns) {
			return {
				shouldContinue: false,
				shouldStop: true,
				reason: 'max-turns',
				message: `Maximum turns (${trajectory.maxTurns}) reached`,
			};
		}

		// In loose mode, we're more permissive
		// Steps are guidance, not strict requirements
		return {
			shouldContinue: true,
			shouldStop: false,
		};
	}
}

