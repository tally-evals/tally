/**
 * Step ranker interface for LLM-based step selection
 */

import type { StepDefinition, StepId } from '../steps/types.js';
import type { ModelMessage } from 'ai';

export interface StepRanker {
	/**
	 * Rank steps by relevance to the current conversation state
	 * @param args - Context for ranking
	 * @returns Array of ranked steps with scores and optional reasons
	 */
	rank(args: {
		history: readonly ModelMessage[];
		goal: string;
		steps: readonly StepDefinition[];
	}): Promise<Array<{ stepId: StepId; score: number; reasons?: string[] }>>;
}

