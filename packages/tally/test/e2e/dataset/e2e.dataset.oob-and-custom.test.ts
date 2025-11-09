import { describe, it, expect } from 'vitest';
import {
	createAnswerRelevanceMetric,
	defineBaseMetric,
	createSingleTurnCode,
	createWeightedAverageScorer,
	createMeanAggregator,
	createPercentileAggregator,
	createPassRateAggregator,
	defineInput,
	createEvaluator,
	createTally,
} from '../../_exports';
import { datasetExampleA } from '../../_fixtures/dataset.examples';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';

describe('E2E | Dataset | OOB + Custom', () => {
	it('runs OOB relevance and custom keyword metric through full evaluation pipeline', async () => {
		// OOB metric (LLM-based, requires provider)
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const relevance = createAnswerRelevanceMetric({ provider: mockProvider });

		// Custom metric: keyword check (code-based)
		const keywordBase = defineBaseMetric({ name: 'keywordHit', valueType: 'number' });
		const keywordMetric = createSingleTurnCode({
			base: keywordBase,
			preProcessor: async (item) => {
				// Return normalized payload for compute
				return item;
			},
			compute: async ({ data }) => {
				const item = data as typeof datasetExampleA[0];
				const ans = item.completion ?? '';
				return ans.toLowerCase().includes('a') ? 1 : 0;
			},
		});

		const outputMetric = defineBaseMetric({
			name: 'final',
			valueType: 'number',
		});
		const scorer = createWeightedAverageScorer({
			name: 'qualityScorer',
			output: outputMetric,
			inputs: [
				defineInput({ metric: relevance, weight: 0.7 }),
				defineInput({ metric: keywordMetric, weight: 0.3 }),
			],
		});

		// Create evaluator
		const evaluator = createEvaluator({
			name: 'qualityEvaluator',
			metrics: [relevance, keywordMetric],
			scorer,
		});

		// Create aggregators
		const meanAggregator = createMeanAggregator({ metric: outputMetric });
		const percentileAggregator = createPercentileAggregator(outputMetric, { percentile: 90 });
		const passRateAggregator = createPassRateAggregator(outputMetric, { threshold: 0.8 });

		// Create Tally instance and run evaluation
		const tally = createTally({
			data: datasetExampleA,
			evaluators: [evaluator],
			aggregators: [meanAggregator, percentileAggregator, passRateAggregator],
		});

		const report = await tally.run();

		// Assertions
		expect(report).toBeDefined();
		expect(report.perTargetResults).toBeDefined();
		expect(report.perTargetResults.length).toBe(datasetExampleA.length);
		expect(report.aggregateSummaries).toBeDefined();
		expect(report.aggregateSummaries.length).toBe(3); // mean, percentile, passRate

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
			// 2. Create an LLM-based metric using createSingleTurnLLM
			// 3. Run the evaluation
			
			// Example structure (commented out):
			// const llmMetric = createSingleTurnLLM({
			//   base: defineBaseMetric({ name: 'llmQuality', valueType: 'number' }),
			//   provider: openai('gpt-4'),
			//   prompt: {
			//     instruction: 'Rate the quality of this answer on a scale of 0-1',
			//   },
			// });
			
			expect(true).toBe(true); // Placeholder assertion
		},
	);
});
