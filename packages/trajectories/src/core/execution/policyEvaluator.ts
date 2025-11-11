/**
 * Policy evaluation helper
 */

import { StrictPolicy, LoosePolicy } from '../../policies/index.js';
import type { PolicyContext, PolicyResult } from '../../policies/index.js';
import type { Trajectory, TrajectoryStep } from '../types.js';
import type { ModelMessage } from 'ai';

/**
 * Create policy instance based on trajectory mode
 */
export function createPolicy(mode: Trajectory['mode']) {
	return mode === 'strict' ? new StrictPolicy() : new LoosePolicy();
}

/**
 * Evaluate policy with given context
 */
export function evaluatePolicy(
	policy: ReturnType<typeof createPolicy>,
	context: PolicyContext,
	turnIndex: number
): PolicyResult {
	return policy.evaluate(context, turnIndex);
}

/**
 * Build policy context
 */
export function buildPolicyContext(
	trajectory: Trajectory,
	history: readonly ModelMessage[],
	currentStepIndex: number,
	stepToUse?: TrajectoryStep
): PolicyContext {
	const context: PolicyContext = {
		trajectory,
		history,
		currentStepIndex,
	};
	if (stepToUse !== undefined) {
		context.nextStep = stepToUse;
	}
	return context;
}

