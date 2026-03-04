/**
 * Loop detection for loose mode trajectories
 * 
 * Detects various types of loops:
 * - Same step repeated consecutively
 * - Cycles between steps (e.g., A -> B -> A -> B)
 *
 * NOTE: This module is intentionally stateless. Callers should derive the
 * loop analysis from `StepTrace[]` (or step id history) each turn.
 */

import type { StepId } from '../steps/types.js';

export interface LoopDetectionConfig {
	/** Maximum consecutive times the same step can be selected (default: 3) */
	maxConsecutiveSameStep?: number;
	/** Maximum cycle length to detect (e.g., 2 = detect A->B->A patterns) (default: 3) */
	maxCycleLength?: number;
	/** Maximum number of times a cycle can repeat before stopping (default: 2) */
	maxCycleRepetitions?: number;
}

export interface LoopDetectionResult {
	shouldStop: boolean;
	reason?: 'agent-loop';
	summary?: string;
}

function arraysEqual(a: readonly StepId[], b: readonly StepId[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
		}

function detectCycleInHistory(
	stepHistory: readonly StepId[],
	maxCycleLength: number,
	maxCycleRepetitions: number
): LoopDetectionResult {
	if (stepHistory.length < maxCycleLength * 2) {
		return { shouldStop: false };
	}

	for (let cycleLen = 2; cycleLen <= maxCycleLength; cycleLen++) {
		const minHistoryLength = cycleLen * (maxCycleRepetitions + 1);
		if (stepHistory.length < minHistoryLength) continue;

		const recentSteps = stepHistory.slice(-minHistoryLength);
			const pattern = recentSteps.slice(0, cycleLen);
			let repetitions = 1;

			for (let i = cycleLen; i < recentSteps.length; i += cycleLen) {
				const nextPattern = recentSteps.slice(i, i + cycleLen);
			if (arraysEqual(pattern, nextPattern)) repetitions++;
			else break;
			}

		if (repetitions >= maxCycleRepetitions + 1) {
				return {
					shouldStop: true,
					reason: 'agent-loop',
					summary: `Cycle detected: pattern [${pattern.join(' -> ')}] repeated ${repetitions} times`,
				};
			}
		}

		return { shouldStop: false };
	}

	/**
 * Analyze step-id history and decide whether to stop due to an agent loop.
 *
 * - Ignores null/undefined step ids (treat "no step selected" as normal).
 * - Detects consecutive repeats and repeating cycles.
 */
export function analyzeAgentLoopFromStepIds(
	stepIds: readonly (StepId | null | undefined)[],
	config: LoopDetectionConfig = {}
): LoopDetectionResult {
	const maxConsecutiveSameStep = config.maxConsecutiveSameStep ?? 3;
	const maxCycleLength = config.maxCycleLength ?? 3;
	const maxCycleRepetitions = config.maxCycleRepetitions ?? 2;

	const history: StepId[] = stepIds.filter((s): s is StepId => typeof s === 'string');
	if (history.length === 0) return { shouldStop: false };

	// Consecutive same-step detection (walk backwards)
	const last = history[history.length - 1];
	let consecutive = 1;
	for (let i = history.length - 2; i >= 0; i--) {
		if (history[i] === last) consecutive++;
		else break;
	}

	if (consecutive >= maxConsecutiveSameStep) {
		return {
			shouldStop: true,
			reason: 'agent-loop',
			summary: `Agent loop detected: same step "${last}" selected ${consecutive} consecutive times`,
		};
	}

	return detectCycleInHistory(history, maxCycleLength, maxCycleRepetitions);
}

