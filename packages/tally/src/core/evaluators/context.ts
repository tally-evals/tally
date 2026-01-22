/**
 * Evaluation Context - Target Selection & Validation
 *
 * Provides utilities for resolving evaluation context and selecting targets
 * based on single-turn run policies. Handles validation of indices and
 * ensures runtime safety for both DatasetItem and Conversation containers.
 */

import type {
	EvaluationContext,
	SingleTurnRunPolicy,
	Conversation,
	DatasetItem,
	ConversationStep,
} from '@tally/core/types';

/**
 * Result of target selection
 * Contains the selected targets and metadata about the selection
 */
export interface TargetSelectionResult<T> {
	targets: readonly T[];
	policy: SingleTurnRunPolicy;
	metadata?: {
		totalAvailable: number;
		selectedCount: number;
		skippedIndices?: readonly number[];
	};
}

/**
 * Select targets from a Conversation based on run policy
 *
 * @param conversation - The conversation container
 * @param policy - Single-turn run policy
 * @returns Selected conversation steps
 */
export function selectConversationTargets(
	conversation: Conversation,
	policy: SingleTurnRunPolicy
): TargetSelectionResult<ConversationStep> {
	const allSteps = conversation.steps;
	const totalAvailable = allSteps.length;

	switch (policy.run) {
		case 'all': {
			return {
				targets: allSteps,
				policy,
				metadata: {
					totalAvailable,
					selectedCount: totalAvailable,
				},
			};
		}

		case 'selectedSteps': {
			const { stepIndices } = policy;
			const validIndices = validateStepIndices(stepIndices, totalAvailable);
			const selectedSteps = validIndices.valid
				.map((idx) => allSteps[idx])
				.filter((step): step is ConversationStep => step !== undefined);

			return {
				targets: selectedSteps,
				policy,
				metadata: {
					totalAvailable,
					selectedCount: selectedSteps.length,
					skippedIndices: validIndices.invalid,
				},
			};
		}

		case 'selectedItems': {
			// For conversations, 'selectedItems' policy doesn't apply
			// Return empty selection with metadata indicating mismatch
			return {
				targets: [],
				policy,
				metadata: {
					totalAvailable,
					selectedCount: 0,
					skippedIndices: policy.itemIndices,
				},
			};
		}

		default: {
			const _exhaustive: never = policy;
			throw new Error(`Unknown run policy: ${(_exhaustive as { run: string }).run}`);
		}
	}
}

/**
 * Select targets from a DatasetItem array based on run policy
 *
 * @param dataset - Array of dataset items
 * @param policy - Single-turn run policy
 * @returns Selected dataset items
 */
export function selectDatasetTargets(
	dataset: readonly DatasetItem[],
	policy: SingleTurnRunPolicy
): TargetSelectionResult<DatasetItem> {
	const totalAvailable = dataset.length;

	switch (policy.run) {
		case 'all': {
			return {
				targets: dataset,
				policy,
				metadata: {
					totalAvailable,
					selectedCount: totalAvailable,
				},
			};
		}

		case 'selectedItems': {
			const { itemIndices } = policy;
			const validIndices = validateItemIndices(itemIndices, totalAvailable);
			const selectedItems = validIndices.valid
				.map((idx) => dataset[idx])
				.filter((item): item is DatasetItem => item !== undefined);

			return {
				targets: selectedItems,
				policy,
				metadata: {
					totalAvailable,
					selectedCount: selectedItems.length,
					skippedIndices: validIndices.invalid,
				},
			};
		}

		case 'selectedSteps': {
			// For datasets, 'selectedSteps' policy doesn't apply
			// Return empty selection with metadata indicating mismatch
			return {
				targets: [],
				policy,
				metadata: {
					totalAvailable,
					selectedCount: 0,
					skippedIndices: policy.stepIndices,
				},
			};
		}

		default: {
			const _exhaustive: never = policy;
			throw new Error(`Unknown run policy: ${(_exhaustive as { run: string }).run}`);
		}
	}
}

/**
 * Validation result for indices
 */
interface IndexValidationResult {
	valid: readonly number[];
	invalid: readonly number[];
}

/**
 * Validate step indices against conversation bounds
 *
 * @param stepIndices - Indices to validate
 * @param maxSteps - Maximum number of steps (exclusive)
 * @returns Validation result with valid and invalid indices
 */
export function validateStepIndices(
	stepIndices: readonly number[],
	maxSteps: number
): IndexValidationResult {
	if (stepIndices.length === 0) {
		return { valid: [], invalid: [] };
	}

	const valid: number[] = [];
	const invalid: number[] = [];

	for (const idx of stepIndices) {
		if (typeof idx !== 'number' || Number.isNaN(idx) || !Number.isFinite(idx)) {
			invalid.push(idx);
			continue;
		}

		if (idx >= 0 && idx < maxSteps) {
			valid.push(idx);
		} else {
			invalid.push(idx);
		}
	}

	return { valid, invalid };
}

/**
 * Validate item indices against dataset bounds
 *
 * @param itemIndices - Indices to validate
 * @param maxItems - Maximum number of items (exclusive)
 * @returns Validation result with valid and invalid indices
 */
export function validateItemIndices(
	itemIndices: readonly number[],
	maxItems: number
): IndexValidationResult {
	if (itemIndices.length === 0) {
		return { valid: [], invalid: [] };
	}

	const valid: number[] = [];
	const invalid: number[] = [];

	for (const idx of itemIndices) {
		if (typeof idx !== 'number' || Number.isNaN(idx) || !Number.isFinite(idx)) {
			invalid.push(idx);
			continue;
		}

		if (idx >= 0 && idx < maxItems) {
			valid.push(idx);
		} else {
			invalid.push(idx);
		}
	}

	return { valid, invalid };
}

/**
 * Resolve evaluation context for a container type
 * Returns the single-turn run policy if present, or undefined
 *
 * @param context - Evaluation context (may be undefined)
 * @returns Single-turn run policy or undefined
 */
export function resolveRunPolicy(
	context?: EvaluationContext
): SingleTurnRunPolicy | undefined {
	return context?.singleTurn;
}

