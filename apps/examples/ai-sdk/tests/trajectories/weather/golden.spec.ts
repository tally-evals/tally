/**
 * Weather Agent - Golden Path Test
 * 
 * Tests the weather agent with straightforward, well-formed requests.
 */

import { describe, it, expect } from 'vitest';
import { weatherAgent } from '../../../src/agents/weather';
import { weatherGoldenTrajectory } from './definitions';
import { runCase } from '../../utils/harness';
import {
	createTally,
	createEvaluator,
	runAllTargets,
	createAnswerRelevanceMetric,
	createCompletenessMetric,
	createWeightedAverageScorer,
	createMeanAggregator,
	createPassRateAggregator,
	defineBaseMetric,
	defineInput,
} from '@tally-evals/tally';
import { google } from '@ai-sdk/google';

describe('Weather Agent - Golden Path', () => {
	it('should handle weather queries successfully', async () => {
		// Run trajectory (record or playback)
		const { conversation } = await runCase({
			trajectory: weatherGoldenTrajectory,
			agent: weatherAgent,
			recordedPath: '_fixtures/recorded/weather/golden.jsonl',
			conversationId: 'weather-golden',
		});

		// Verify conversation has steps
		expect(conversation.steps.length).toBeGreaterThan(0);

		// Set up evaluation metrics
		const model = google('models/gemini-2.5-flash-lite');

		const answerRelevance = createAnswerRelevanceMetric({
			provider: model,
		});

		const completeness = createCompletenessMetric({
			provider: model,
		});

		// Create overall quality scorer
		const overallQuality = defineBaseMetric({
			name: 'overallQuality',
			valueType: 'number',
		});

		const qualityScorer = createWeightedAverageScorer({
			name: 'OverallQuality',
			output: overallQuality,
			inputs: [
				defineInput({ metric: answerRelevance , weight: 0.5 }),
				defineInput({ metric: completeness, weight: 0.5 }),
			],
		});

		// Create evaluator
		const evaluator = createEvaluator({
			name: 'Weather Agent Quality',
			metrics: [answerRelevance, completeness],
			scorer: qualityScorer,
			context: runAllTargets(),
		});

		// Create aggregators
		const aggregators = [
			createMeanAggregator({ metric: overallQuality }),
			createPassRateAggregator(overallQuality, { threshold: 0.7 }),
		];

		// Run evaluation
		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
			aggregators,
		});

		const report = await tally.run();

		// Assertions
		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);
		expect(report.aggregateSummaries.length).toBe(2);

		// Check pass rate (should be high for golden path)
		const passRateSummary = report.aggregateSummaries.find(
			(s) => s.metric.name === 'overallQuality' && 'passRate' in s
		);
		if (passRateSummary && 'passRate' in passRateSummary) {
			expect(passRateSummary.passRate).toBeGreaterThan(0.8); // At least 80% pass rate
		}

		// Check mean score (should be high for golden path)
		const meanSummary = report.aggregateSummaries.find(
			(s) => s.metric.name === 'overallQuality' && 'average' in s
		);
		if (meanSummary && 'average' in meanSummary) {
			expect(meanSummary.average).toBeGreaterThan(0.7); // At least 0.7 average score
		}
	});
});

