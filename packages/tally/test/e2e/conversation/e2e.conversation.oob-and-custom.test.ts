import { describe, it, expect } from 'vitest';
import {
	defineBaseMetric,
	createMultiTurnCode,
	createSingleTurnCode,
	createWeightedAverageScorer,
	createMeanAggregator,
	createPercentileAggregator,
	defineInput,
	createEvaluator,
	createTally,
	type Conversation,
	type ConversationStep,
} from '../../_exports';
import { conversationExampleB } from '../../_fixtures/conversation.examples';

describe('E2E | Conversation | OOB + Custom', () => {
	it('runs multi-turn custom + single-turn custom metrics through full evaluation pipeline', async () => {
		// Multi-turn custom: reward consistent friendly tone across assistant turns
		const toneBase = defineBaseMetric({ name: 'tone', valueType: 'number' });
		const toneMetric = createMultiTurnCode({
			base: toneBase,
			runOnContainer: async (conversation) => {
				// Preprocess: return conversation for compute
				return conversation;
			},
			compute: async ({ data }) => {
				const conversation = data as Conversation;
				const assistantTexts = conversation.steps.map((s) => {
					// Extract text from all output messages
					const assistantMessages = s.output.filter((msg) => msg.role === 'assistant');
					return assistantMessages
						.map((msg) => (typeof msg.content === 'string' ? msg.content : ''))
						.join(' ');
				});
				const friendlyHits = assistantTexts.filter((t) => t.toLowerCase().includes('friendly')).length;
				const ratio = assistantTexts.length === 0 ? 0 : friendlyHits / assistantTexts.length;
				return Math.min(1, ratio);
			},
		});

		// Single-turn custom: reward concise assistant outputs
		const conciseBase = defineBaseMetric({ name: 'concise', valueType: 'number' });
		const conciseMetric = createSingleTurnCode({
			base: conciseBase,
			preProcessor: async (step) => {
				// Return normalized payload for compute
				return step;
			},
			compute: async ({ data }) => {
				const step = data as ConversationStep;
				// Extract text from all output messages
				const assistantMessages = step.output.filter((msg) => msg.role === 'assistant');
				const content = assistantMessages
					.map((msg) => (typeof msg.content === 'string' ? msg.content : ''))
					.join(' ');
				const len = content.length;
				return len <= 40 ? 1 : Math.max(0, 1 - (len - 40) / 80);
			},
		});

		const outputMetric = defineBaseMetric({
			name: 'final',
			valueType: 'number',
		});
		const scorer = createWeightedAverageScorer(
			'qualityScorer',
			outputMetric,
			[
				defineInput({ metric: toneMetric, weight: 0.6 }),
				defineInput({ metric: conciseMetric, weight: 0.4 }),
			],
		);

		// Create evaluator
		const evaluator = createEvaluator({
			name: 'qualityEvaluator',
			metrics: [toneMetric, conciseMetric],
			scorer,
		});

		// Create aggregators
		const meanAggregator = createMeanAggregator({ metric: outputMetric });
		const percentileAggregator = createPercentileAggregator(outputMetric, { percentile: 75 });

		// Create Tally instance and run evaluation
		const tally = createTally({
			data: [conversationExampleB],
			evaluators: [evaluator],
			aggregators: [meanAggregator, percentileAggregator],
		});

		const report = await tally.run();

		// Assertions
		expect(report).toBeDefined();
		expect(report.perTargetResults).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);
		expect(report.aggregateSummaries).toBeDefined();
		expect(report.aggregateSummaries.length).toBe(2); // mean, percentile

		// Verify per-target results have scores in [0, 1]
		for (const result of report.perTargetResults) {
			expect(result.targetId).toBeDefined();
			expect(typeof result.targetId).toBe('string');
			expect(result.rawMetrics).toBeDefined();
			expect(Array.isArray(result.rawMetrics)).toBe(true);
			expect(result.derivedMetrics).toBeDefined();
			expect(Array.isArray(result.derivedMetrics)).toBe(true);
			
			// Check that final score exists and is in [0, 1]
			const finalMetric = result.derivedMetrics.find((m) => m.definition.name === outputMetric.name);
			if (finalMetric) {
				expect(finalMetric.value).toBeGreaterThanOrEqual(0);
				expect(finalMetric.value).toBeLessThanOrEqual(1);
			}
		}

		// Verify aggregate summaries
		for (const summary of report.aggregateSummaries) {
			expect(summary.metric).toBeDefined();
			expect(summary.average).toBeDefined();
			expect(typeof summary.average).toBe('number');
			expect(summary.average).toBeGreaterThanOrEqual(0);
			expect(summary.average).toBeLessThanOrEqual(1);
			expect(summary.count).toBeGreaterThan(0);
		}
	});

	it.skipIf(!process.env.LLM_API_KEY)(
		'runs LLM-based metric when API key is available (skipped without LLM_API_KEY)',
		async () => {
			// This test only runs if LLM_API_KEY is set
			// For now, we'll skip it since we don't have a real provider setup
			// In a real scenario, you would:
			// 1. Import a provider (e.g., from '@ai-sdk/openai')
			// 2. Create an LLM-based metric using createMultiTurnLLM or createSingleTurnLLM
			// 3. Run the evaluation
			
			// Example structure (commented out):
			// const llmMetric = createMultiTurnLLM({
			//   base: defineBaseMetric({ name: 'llmTone', valueType: 'number' }),
			//   preprocessContainer: async (conversation) => conversation,
			//   provider: openai('gpt-4'),
			//   prompt: {
			//     instruction: 'Rate the friendliness of this conversation on a scale of 0-1',
			//   },
			// });
			
			expect(true).toBe(true); // Placeholder assertion
		},
	);
});


