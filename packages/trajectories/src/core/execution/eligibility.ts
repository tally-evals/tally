/**
 * Eligibility helper - determines which steps are eligible for selection
 */

import type { StepDefinition, StepsSnapshot, Precondition } from '../steps/types.js';
import type { ModelMessage } from 'ai';
import type { StepTrace } from '../types.js';

/**
 * Check if a precondition is satisfied.
 * Supports both synchronous and asynchronous preconditions.
 */
async function checkPrecondition(
	precondition: Precondition,
	context: {
		history: readonly ModelMessage[];
		snapshot: {
			satisfied: Set<string>;
			attemptsByStep: Map<string, number>;
		};
	}
): Promise<boolean> {
	if (precondition.type === 'stepSatisfied') {
		// Synchronous check - just verify step is in satisfied set
		return context.snapshot.satisfied.has(precondition.stepId);
	}

	if (precondition.type === 'custom') {
		// Custom precondition - can be sync or async, await handles both
		return await precondition.evaluate({
			history: context.history,
			snapshot: context.snapshot,
		});
	}

	return false;
}

/**
 * Build history from step traces for precondition evaluation
 */
function buildHistoryFromTraces(stepTraces: readonly StepTrace[]): readonly ModelMessage[] {
	const history: ModelMessage[] = [];
	for (const trace of stepTraces) {
		// Add user message
		history.push(trace.userMessage);
		// Add all agent messages (assistant + tool)
		history.push(...trace.agentMessages);
	}
	return history;
}

/**
 * Get all eligible steps (preconditions satisfied).
 * All preconditions are evaluated in parallel for performance.
 * Supports both synchronous and asynchronous preconditions.
 */
export async function getEligibleSteps(
	snapshot: StepsSnapshot,
	stepTraces: readonly StepTrace[]
): Promise<StepDefinition[]> {
	const eligible: StepDefinition[] = [];

	// Build history from step traces for custom preconditions
	const history = buildHistoryFromTraces(stepTraces);

	// Build snapshot context once for all precondition checks
	const snapshotContext = {
		satisfied: snapshot.steps
			.filter((s) => s.status === 'satisfied')
			.reduce((set, s) => {
				set.add(s.stepId);
				return set;
			}, new Set<string>()),
		attemptsByStep: snapshot.steps.reduce((map, s) => {
			map.set(s.stepId, s.attempts);
			return map;
		}, new Map<string, number>()),
	};

	for (const stepDef of snapshot.graph.steps) {
		// If no preconditions, step is always eligible
		if (!stepDef.preconditions || stepDef.preconditions.length === 0) {
			eligible.push(stepDef);
			continue;
		}

		// Check all preconditions in parallel (supports both sync and async)
		// All preconditions must be satisfied for the step to be eligible
		const preconditionsMet = await Promise.all(
			stepDef.preconditions.map((precondition) =>
				checkPrecondition(precondition, {
					history,
					snapshot: snapshotContext,
				})
			)
		);

		if (preconditionsMet.every((met) => met)) {
			eligible.push(stepDef);
		}
	}

	return eligible;
}

