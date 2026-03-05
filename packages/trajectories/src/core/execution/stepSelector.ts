/**
 * Step selection logic for trajectory execution
 */

import type { Trajectory, StepTrace } from '../types.js';
import type { LanguageModel } from 'ai';
import type {
	StepDefinition,
	StepsSnapshot,
	StepRuntimeState,
	StepId,
} from '../steps/types.js';
import type { StepSelectorResult } from '../steps/types.js';
import { getEligibleSteps } from './eligibility.js';
import { rankStepsWithLLM } from './ranker/llmRanker.js';

export interface StepSelectionResult {
	stepToUse: StepDefinition | undefined;
	chosenStepId?: StepId;
	candidates?: readonly { stepId: StepId; score: number; reasons?: string[] }[];
	method: StepTrace['selection']['method'];
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
	userModel: LanguageModel,
	runtimeStates?: Map<StepId, StepRuntimeState>,
	turnIndex?: number,
	stepTraces?: readonly StepTrace[]
): Promise<StepSelectionResult> {
	if (!trajectory.steps) {
		return {
			stepToUse: undefined,
			method: 'none',
		};
	}

	// Build snapshot
	const snapshot = buildSnapshot(trajectory.steps, currentStepId, runtimeStates || new Map());
	if (!snapshot) {
		return {
			stepToUse: undefined,
			method: 'none',
		};
	}

	// Turn 0 rule: if steps exist, pick the start step deterministically
	if (turnIndex === 0) {
		const startId = snapshot.graph.start;
		const startStep = snapshot.graph.steps.find((s) => s.id === startId);
		if (startStep) {
			return {
				stepToUse: startStep,
				chosenStepId: startId,
				method: 'start',
				candidates: [
					{
						stepId: startId,
						score: 1.0,
						reasons: ['Initial start step selected at turn 0'],
					},
				],
			};
		}
	}

	// Unified selection flow:
	// 1) Evaluate eligibility for all steps (preconditions evaluated in parallel)
	const eligible = await getEligibleSteps(snapshot, stepTraces || []);

	// 2) Prefer steps that have preconditions (and are eligible), deterministically by graph order
	const eligibleWithPreconditions = eligible.filter(
		(s) => Array.isArray(s.preconditions) && s.preconditions.length > 0
	);

	if (eligibleWithPreconditions.length > 0) {
		// Determine next in graph order relative to current
		const stepOrder = snapshot.graph.steps.map((s) => s.id);
		const currentIndex = snapshot.current
			? stepOrder.indexOf(snapshot.current)
			: stepOrder.indexOf(snapshot.graph.start);

		let nextStep: StepDefinition | undefined = undefined;
		for (let i = currentIndex + 1; i < stepOrder.length; i++) {
			const stepId = stepOrder[i];
			const step = eligibleWithPreconditions.find((s) => s.id === stepId);
			if (step) {
				nextStep = step;
				break;
			}
		}

		if (nextStep) {
			return {
				stepToUse: nextStep,
				chosenStepId: nextStep.id,
				method: 'preconditions-ordered',
				candidates: [
					{
						stepId: nextStep.id,
						score: 1.0,
						reasons: ['Next eligible step with preconditions in graph order'],
					},
				],
			};
		}
	}

	// 3) LLM fallback across all eligible steps (including those without preconditions)
	let selectorResult: StepSelectorResult = {
		candidates: [],
		chosen: null,
	};
	if (eligible.length > 0) {
		const ranked = await rankStepsWithLLM({
			model: userModel,
			stepTraces: stepTraces || [],
			lastNSteps: 2, // Hardcoded to 1 for now, can be made configurable in future
			goal: trajectory.goal,
			steps: eligible,
		});

		// Sort and pick top candidate if any
		if (ranked.length > 0) {
			ranked.sort((a, b) => b.score - a.score);
			selectorResult = {
				candidates: ranked,
				chosen: ranked[0]?.stepId ?? null,
			};
		}
	}

	// Find the chosen step definition
	let stepToUse: StepDefinition | undefined;
	if (selectorResult.chosen) {
		stepToUse = snapshot.graph.steps.find((s) => s.id === selectorResult.chosen);
	}

	return {
		stepToUse,
		...(selectorResult.chosen && { chosenStepId: selectorResult.chosen }),
		method: selectorResult.chosen ? 'llm-ranked' : 'none',
		candidates: selectorResult.candidates,
	};
}

