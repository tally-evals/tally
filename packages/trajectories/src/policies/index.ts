/**
 * Policy implementations for trajectory execution
 */

import type { ModelMessage } from 'ai';
import type { Trajectory, TrajectoryStopReason } from '../core/types.js';
import type { StepDefinition } from '../core/steps/types.js';

export interface PolicyContext {
	trajectory: Trajectory;
	history: readonly ModelMessage[];
	currentStepId?: string;
	nextStep?: StepDefinition;
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

		// If no steps defined, allow continuation
		if (!trajectory.steps || trajectory.steps.steps.length === 0) {
			return {
				shouldContinue: true,
				shouldStop: false,
			};
		}

		// Check if we've reached a terminal step (only after at least one turn)
		// This prevents stopping immediately if start step is also a terminal
		const currentStepId = context.currentStepId;
		if (turnIndex > 0 && currentStepId && trajectory.steps.terminals?.includes(currentStepId)) {
			return {
				shouldContinue: false,
				shouldStop: true,
				reason: 'goal-reached',
				message: 'Terminal step reached',
			};
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

		// Check if we've reached a terminal step (only after at least one turn)
		// This prevents stopping immediately if start step is also a terminal
		const currentStepId = context.currentStepId;
		if (turnIndex > 0 && currentStepId && trajectory.steps?.terminals?.includes(currentStepId)) {
			return {
				shouldContinue: false,
				shouldStop: true,
				reason: 'goal-reached',
				message: 'Terminal step reached',
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

