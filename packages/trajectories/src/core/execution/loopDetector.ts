/**
 * Loop detection for loose mode trajectories
 */

import type { TrajectoryStopReason } from '../types.js';

export interface LoopDetectionConfig {
	maxConsecutiveSameStep?: number;
	maxConsecutiveNoMatch?: number;
}

export interface LoopDetectionResult {
	shouldStop: boolean;
	reason?: TrajectoryStopReason;
	summary?: string;
}

/**
 * Loop detector for tracking consecutive step matches and no-matches
 */
export class LoopDetector {
	private lastMatchedStepIndex: number | null = null;
	private consecutiveSameStepCount = 0;
	private consecutiveNoMatchCount = 0;
	private readonly maxConsecutiveSameStep: number;
	private readonly maxConsecutiveNoMatch: number;

	constructor(config: LoopDetectionConfig = {}) {
		this.maxConsecutiveSameStep = config.maxConsecutiveSameStep ?? 3;
		this.maxConsecutiveNoMatch = config.maxConsecutiveNoMatch ?? 3;
	}

	/**
	 * Record a step match and check for loops
	 */
	recordMatch(stepIndex: number): LoopDetectionResult {
		if (stepIndex === this.lastMatchedStepIndex) {
			this.consecutiveSameStepCount++;
		} else {
			this.consecutiveSameStepCount = 1;
			this.lastMatchedStepIndex = stepIndex;
		}
		this.consecutiveNoMatchCount = 0; // Reset no-match counter

		if (this.consecutiveSameStepCount >= this.maxConsecutiveSameStep) {
			return {
				shouldStop: true,
				reason: 'agent-loop',
				summary: `Agent loop detected: same step (${this.lastMatchedStepIndex}) matched ${this.consecutiveSameStepCount} consecutive times`,
			};
		}

		return { shouldStop: false };
	}

	/**
	 * Record a no-match and check for loops
	 */
	recordNoMatch(): LoopDetectionResult {
		this.consecutiveNoMatchCount++;
		this.consecutiveSameStepCount = 0; // Reset same-step counter
		this.lastMatchedStepIndex = null;

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
	 * Get current state for debugging
	 */
	getState() {
		return {
			lastMatchedStepIndex: this.lastMatchedStepIndex,
			consecutiveSameStepCount: this.consecutiveSameStepCount,
			consecutiveNoMatchCount: this.consecutiveNoMatchCount,
		};
	}
}

