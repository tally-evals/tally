/**
 * Loop detection for loose mode trajectories
 * 
 * Detects various types of loops:
 * - Same step repeated consecutively
 * - Cycles between steps (e.g., A -> B -> A -> B)
 * - No progress toward terminal steps
 * - No step matches (agent asking questions that don't match any step)
 */

import type { TrajectoryStopReason } from '../types.js';
import type { StepId } from '../steps/types.js';

export interface LoopDetectionConfig {
	/** Maximum consecutive times the same step can be selected (default: 3) */
	maxConsecutiveSameStep?: number;
	/** Maximum consecutive turns with no step match (default: 3) */
	maxConsecutiveNoMatch?: number;
	/** Maximum cycle length to detect (e.g., 2 = detect A->B->A patterns) (default: 3) */
	maxCycleLength?: number;
	/** Maximum number of times a cycle can repeat before stopping (default: 2) */
	maxCycleRepetitions?: number;
}

export interface LoopDetectionResult {
	shouldStop: boolean;
	reason?: TrajectoryStopReason;
	summary?: string;
}

/**
 * Loop detector for tracking step selection patterns and detecting loops
 */
export class LoopDetector {
	private lastMatchedStepId: StepId | null = null;
	private consecutiveSameStepCount = 0;
	private consecutiveNoMatchCount = 0;
	private stepHistory: StepId[] = []; // Recent step selection history
	private readonly maxConsecutiveSameStep: number;
	private readonly maxConsecutiveNoMatch: number;
	private readonly maxCycleLength: number;
	private readonly maxCycleRepetitions: number;

	constructor(config: LoopDetectionConfig = {}) {
		this.maxConsecutiveSameStep = config.maxConsecutiveSameStep ?? 3;
		this.maxConsecutiveNoMatch = config.maxConsecutiveNoMatch ?? 3;
		this.maxCycleLength = config.maxCycleLength ?? 3;
		this.maxCycleRepetitions = config.maxCycleRepetitions ?? 2;
	}

	/**
	 * Record a step match and check for loops
	 * @param stepId - The step ID that was selected
	 * @returns Result indicating if we should stop due to a detected loop
	 */
	recordMatch(stepId: StepId): LoopDetectionResult {
		// Check for consecutive same step
		if (stepId === this.lastMatchedStepId) {
			this.consecutiveSameStepCount++;
		} else {
			this.consecutiveSameStepCount = 1;
			this.lastMatchedStepId = stepId;
		}
		this.consecutiveNoMatchCount = 0; // Reset no-match counter

		// Add to history for cycle detection
		this.stepHistory.push(stepId);
		// Keep only recent history (2x max cycle length for detection)
		const maxHistoryLength = this.maxCycleLength * 2;
		if (this.stepHistory.length > maxHistoryLength) {
			this.stepHistory.shift();
		}

		// Check for consecutive same step
		if (this.consecutiveSameStepCount >= this.maxConsecutiveSameStep) {
			return {
				shouldStop: true,
				reason: 'agent-loop',
				summary: `Agent loop detected: same step "${stepId}" selected ${this.consecutiveSameStepCount} consecutive times`,
			};
		}

		// Check for cycles (repeating patterns)
		const cycleResult = this.detectCycle();
		if (cycleResult.shouldStop) {
			return cycleResult;
		}

		return { shouldStop: false };
	}

	/**
	 * Record a no-match and check for loops
	 * @returns Result indicating if we should stop due to no matches
	 */
	recordNoMatch(): LoopDetectionResult {
		this.consecutiveNoMatchCount++;
		this.consecutiveSameStepCount = 0; // Reset same-step counter
		this.lastMatchedStepId = null;

		if (this.consecutiveNoMatchCount >= this.maxConsecutiveNoMatch) {
			return {
				shouldStop: true,
				reason: 'no-step-match',
				summary: `No step match detected: ${this.consecutiveNoMatchCount} consecutive turns with no matching step`,
			};
		}

		return { shouldStop: false };
	}

	/**
	 * Detect cycles in step selection history
	 * Looks for repeating patterns like A->B->A->B or A->B->C->A->B->C
	 */
	private detectCycle(): LoopDetectionResult {
		if (this.stepHistory.length < this.maxCycleLength * 2) {
			return { shouldStop: false };
		}

		// Try different cycle lengths from 2 to maxCycleLength
		for (let cycleLen = 2; cycleLen <= this.maxCycleLength; cycleLen++) {
			// Need at least cycleLen * (maxCycleRepetitions + 1) steps to detect a cycle
			const minHistoryLength = cycleLen * (this.maxCycleRepetitions + 1);
			if (this.stepHistory.length < minHistoryLength) {
				continue;
			}

			// Extract the last cycleLen * (maxCycleRepetitions + 1) steps
			const recentSteps = this.stepHistory.slice(-minHistoryLength);

			// Check if there's a repeating pattern
			const pattern = recentSteps.slice(0, cycleLen);
			let repetitions = 1;

			// Check if the pattern repeats
			for (let i = cycleLen; i < recentSteps.length; i += cycleLen) {
				const nextPattern = recentSteps.slice(i, i + cycleLen);
				if (this.arraysEqual(pattern, nextPattern)) {
					repetitions++;
				} else {
					break;
				}
			}

			if (repetitions >= this.maxCycleRepetitions + 1) {
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
	 * Check if two arrays are equal
	 */
	private arraysEqual(a: StepId[], b: StepId[]): boolean {
		if (a.length !== b.length) {
			return false;
		}
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get current state for debugging
	 */
	getState() {
		return {
			lastMatchedStepId: this.lastMatchedStepId,
			consecutiveSameStepCount: this.consecutiveSameStepCount,
			consecutiveNoMatchCount: this.consecutiveNoMatchCount,
			recentStepHistory: [...this.stepHistory],
		};
	}

	/**
	 * Reset the detector (useful for testing or restarting)
	 */
	reset(): void {
		this.lastMatchedStepId = null;
		this.consecutiveSameStepCount = 0;
		this.consecutiveNoMatchCount = 0;
		this.stepHistory = [];
	}
}

