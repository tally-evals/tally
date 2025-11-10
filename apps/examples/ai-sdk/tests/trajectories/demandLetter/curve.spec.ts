/**
 * Demand Letter Agent - Curve Ball Test
 */

import { describe, it, expect } from 'vitest';
import { demandLetterAgent } from '../../../src/agents/demandLetter';
import { demandLetterCurveTrajectory } from './definitions';
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

describe('Demand Letter Agent - Curve Ball', () => {
	it('should handle incomplete information and changing requirements', async () => {
		const { conversation } = await runCase({
			trajectory: demandLetterCurveTrajectory,
			agent: demandLetterAgent,
			recordedPath: '_fixtures/recorded/demandLetter/curve.jsonl',
			conversationId: 'demand-letter-curve',
		});

		expect(conversation.steps.length).toBeGreaterThan(0);

		const model = google('models/gemini-2.5-flash-lite');

		const answerRelevance = createAnswerRelevanceMetric({
			provider: model,
		});

		const completeness = createCompletenessMetric({
			provider: model,
		});

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

		const evaluator = createEvaluator({
			name: 'Demand Letter Agent Quality',
			metrics: [answerRelevance, completeness],
			scorer: qualityScorer,
			context: runAllTargets(),
		});

		const aggregators = [
			createMeanAggregator({ metric: overallQuality }),
			createPassRateAggregator(overallQuality, { threshold: 0.5 }),
		];

		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
			aggregators,
		});

		const report = await tally.run();

		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);

		const meanSummary = report.aggregateSummaries.find(
			(s) => s.metric.name === 'overallQuality' && 'average' in s
		);
		if (meanSummary && 'average' in meanSummary) {
			expect(meanSummary.average).toBeGreaterThan(0.4);
		}
	});
});

