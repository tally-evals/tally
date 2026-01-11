/**
 * Policy implementation for trajectory execution (single default policy)
 */

import type { Trajectory, TrajectoryStopReason } from '../core/types.js';
import type { StepDefinition } from '../core/steps/types.js';
import type { StepTrace } from '../core/types.js';

export interface PolicyContext {
	trajectory: Trajectory;
	stepTraces: readonly StepTrace[];
	currentStepId?: string;
	nextStep?: StepDefinition;
}

export interface PolicyResult {
	shouldContinue: boolean;
	shouldStop: boolean;
	reason?: TrajectoryStopReason;
	message?: string;
}

export class DefaultPolicy {
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

// Backwards exports removed; use DefaultPolicy going forward
