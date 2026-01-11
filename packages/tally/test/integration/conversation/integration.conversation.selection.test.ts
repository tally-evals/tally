import { describe, it, expect } from 'bun:test';
import {
	runAllTargets,
	runSpecificSteps,
	createWeightedAverageScorer,
	defineBaseMetric,
	createSingleTurnCode,
	defineInput,
	type ConversationStep,
} from '../../_exports';
import { conversationExampleB } from '../../_fixtures/conversation.examples';

describe('Integration | Conversation | Selection', () => {
	it('validates selection helpers for single-turn metrics on conversations (placeholder)', async () => {
		const base = defineBaseMetric({ name: 'lengthScore', valueType: 'number' });
		const single = createSingleTurnCode({
			base,
			preProcessor: async (step) => {
				// Return normalized payload for compute
				return step;
			},
			compute: async ({ data }) => {
				const step = data as ConversationStep;
				const content =
					step.output?.role === 'assistant' && typeof step.output.content === 'string'
						? step.output.content
						: '';
				const len = content.length;
				return Math.min(1, len / 50);
			},
		});

		const outputMetric = defineBaseMetric({
			name: 'quality',
			valueType: 'number',
		});
		const scorer = createWeightedAverageScorer({
			name: 'qualityScorer',
			output: outputMetric,
			inputs: [defineInput({ metric: single, weight: 1 })],
		});
		expect(scorer).toBeDefined();

		// Placeholders to be used in evaluator wiring
		expect(runAllTargets()).toBeDefined();
		expect(runSpecificSteps([0, 2])).toBeDefined();

		expect(conversationExampleB.steps.length).toBeGreaterThan(2);
	});
});


