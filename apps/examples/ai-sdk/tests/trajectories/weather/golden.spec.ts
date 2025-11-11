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
			verdict: thresholdVerdict(0.7),
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

		// Assertions
		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);
		expect(report.evalSummaries.size).toBeGreaterThan(0);

		// Check pass rate (should be high for golden path)
		const overallQualitySummary = report.evalSummaries.get('Overall Quality');
		if (overallQualitySummary?.verdictSummary) {
			expect(overallQualitySummary.verdictSummary.passRate).toBeGreaterThan(0.8); // At least 80% pass rate
		}

		// Check mean score (should be high for golden path)
		if (overallQualitySummary) {
			expect(overallQualitySummary.aggregations.mean).toBeGreaterThan(0.7); // At least 0.7 average score
		}
	});
});

