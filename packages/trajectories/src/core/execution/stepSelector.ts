/**
 * Step selection logic for trajectory execution
 */

import type { Trajectory } from '../types.js';
import type { ModelMessage, LanguageModel } from 'ai';
import type {
	StepDefinition,
	StepsSnapshot,
	StepRuntimeState,
	StepId,
} from '../steps/types.js';
import { strictSelect } from './selectors/strictSelector.js';
import { looseSelect, type LooseSelectorConfig } from './selectors/looseSelector.js';
import type { StepSelectorResult } from '../steps/types.js';

export interface StepSelectionResult {
	stepToUse: StepDefinition | undefined;
	chosenStepId?: StepId;
	candidates?: readonly { stepId: StepId; score: number; reasons?: string[] }[];
}

/**
 * Build StepsSnapshot from current state
 */
function buildSnapshot(
	graph: Trajectory['steps'],
	currentStepId: StepId | undefined,
	runtimeStates: Map<StepId, StepRuntimeState>
): StepsSnapshot | null {
	if (!graph) {
		return null;
	}

	const states: StepRuntimeState[] = graph.steps.map((step) => {
		const existing = runtimeStates.get(step.id);
		if (existing) {
			return existing;
		}
		return {
			stepId: step.id,
			status: 'idle',
			attempts: 0,
			lastUpdatedAt: new Date(),
		};
	});

	return {
		graph,
		steps: states,
		...(currentStepId && { current: currentStepId }),
	};
}

/**
 * Determine which step to use for user message generation
 */
export async function determineStep(
	trajectory: Trajectory,
	currentStepId: StepId | undefined,
	history: readonly ModelMessage[],
	userModel: LanguageModel,
	runtimeStates?: Map<StepId, StepRuntimeState>
): Promise<StepSelectionResult> {
	if (!trajectory.steps) {
		return {
			stepToUse: undefined,
		};
	}

	// Build snapshot
	const snapshot = buildSnapshot(trajectory.steps, currentStepId, runtimeStates || new Map());
	if (!snapshot) {
		return {
			stepToUse: undefined,
		};
	}

	// Select step based on mode
	let selectorResult: StepSelectorResult;
	if (trajectory.mode === 'strict') {
		selectorResult = await strictSelect(snapshot, history);
	} else {
		// Loose mode
		const looseConfig: LooseSelectorConfig = {
			userModel,
			scoreThreshold: trajectory.loose?.scoreThreshold ?? 0.5,
			margin: trajectory.loose?.margin ?? 0.1,
			fallback: trajectory.loose?.fallback ?? 'sequential',
			...(trajectory.loose?.ranker && { ranker: trajectory.loose.ranker }),
		};

		selectorResult = await looseSelect(snapshot, history, trajectory.goal, looseConfig);
	}

	// Find the chosen step definition
	let stepToUse: StepDefinition | undefined;
	if (selectorResult.chosen) {
		stepToUse = snapshot.graph.steps.find((s) => s.id === selectorResult.chosen);
	}

	return {
		stepToUse,
		...(selectorResult.chosen && { chosenStepId: selectorResult.chosen }),
		candidates: selectorResult.candidates,
	};
}

