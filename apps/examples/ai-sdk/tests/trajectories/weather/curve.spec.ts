/**
 * Weather Agent - Curve Ball Test
 * 
 * Tests the weather agent with edge cases and challenging scenarios.
 */

import { describe, it, expect } from 'bun:test';
import { weatherAgent } from '../../../src/agents/weather';
import { weatherCurveTrajectory } from './definitions';
import { runCase, saveTallyReportToStore } from '../../utils/harness';
import {
	createTally,
	createEvaluator,
	runAllTargets,
	defineBaseMetric,
	defineInput,
	defineSingleTurnEval,
	defineScorerEval,
	thresholdVerdict,
} from '@tally-evals/tally';
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';

describe('Weather Agent - Curve Ball', () => {
	it('should handle ambiguous and incomplete requests gracefully', async () => {
		// Run trajectory (record or playback)
		const { conversation } = await runCase({
			trajectory: weatherCurveTrajectory,
			agent: weatherAgent,
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
		const overallQuality = defineBaseMetric<number>({
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

		// Create evals
		const answerRelevanceEval = defineSingleTurnEval({
			name: 'Answer Relevance',
			metric: answerRelevance,
		});

		const completenessEval = defineSingleTurnEval({
			name: 'Completeness',
			metric: completeness,
		});

		const overallQualityEval = defineScorerEval({
			name: 'Overall Quality',
			inputs: [answerRelevance, completeness],
			scorer: qualityScorer,
			verdict: thresholdVerdict(0.5), // Lower threshold for curve ball
		});

		// Create evaluator
		const evaluator = createEvaluator({
			name: 'Weather Agent Quality',
			evals: [answerRelevanceEval, completenessEval, overallQualityEval],
			context: runAllTargets(),
		});

		// Run evaluation
		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
		});

		const report = await tally.run();
		await saveTallyReportToStore({ conversationId: 'weather-curve', report: report.toArtifact() });

		// Assertions
		expect(report).toBeDefined();
		expect(report.result.stepCount).toBeGreaterThan(0);
		expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

		// For curve ball, we're more lenient - just check that agent handled it
		// The agent should still respond appropriately even if the request is ambiguous
		const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
		if (overallQualitySummary) {
			const mean = (overallQualitySummary.aggregations?.score as any)?.mean;
			if (typeof mean === 'number') {
				expect(mean).toBeGreaterThan(0.4); // At least 0.4 average score
			}
		}
	});
});

