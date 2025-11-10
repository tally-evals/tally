/**
 * Weather Agent - Curve Ball Test
 * 
 * Tests the weather agent with edge cases and challenging scenarios.
 */

import { describe, it, expect } from 'vitest';
import { weatherAgent } from '../../../src/agents/weather';
import { weatherCurveTrajectory } from './definitions';
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

describe('Weather Agent - Curve Ball', () => {
	it('should handle ambiguous and incomplete requests gracefully', async () => {
		// Run trajectory (record or playback)
		const { conversation } = await runCase({
			trajectory: weatherCurveTrajectory,
			agent: weatherAgent,
			recordedPath: '_fixtures/recorded/weather/curve.jsonl',
			conversationId: 'weather-curve',
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
				defineInput({ metric: answerRelevance, weight: 0.5 }),
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

		// Create aggregators (more lenient thresholds for curve ball)
		const aggregators = [
			createMeanAggregator({ metric: overallQuality }),
			createPassRateAggregator(overallQuality, { threshold: 0.5 }), // Lower threshold
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

		// For curve ball, we're more lenient - just check that agent handled it
		// The agent should still respond appropriately even if the request is ambiguous
		const meanSummary = report.aggregateSummaries.find(
			(s) => s.metric.name === 'overallQuality' && 'average' in s
		);
		if (meanSummary && 'average' in meanSummary) {
			expect(meanSummary.average).toBeGreaterThan(0.4); // At least 0.4 average score
		}
	});
});

