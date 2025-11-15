/**
 * Policy evaluation helper
 */

import { DefaultPolicy } from '../../policies/index.js';
import type { PolicyContext, PolicyResult } from '../../policies/index.js';
import type { Trajectory } from '../types.js';
import type { StepDefinition } from '../steps/types.js';
import type { ModelMessage } from 'ai';

/**
 * Create policy instance (single default policy)
 */
export function createPolicy() {
	return new DefaultPolicy();
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
	currentStepId: string | undefined,
	stepToUse?: StepDefinition
): PolicyContext {
	const context: PolicyContext = {
		trajectory,
		history,
		...(currentStepId !== undefined && { currentStepId }),
	};
	if (stepToUse !== undefined) {
		context.nextStep = stepToUse;
	}
	return context;
}

