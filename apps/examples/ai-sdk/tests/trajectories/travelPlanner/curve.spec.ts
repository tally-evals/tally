/**
 * Travel Planner Agent - Curve Ball Test
 */

import { describe, it, expect } from 'vitest';
import { travelPlannerAgent } from '../../../src/agents/travelPlanner';
import { travelPlannerCurveTrajectory } from './definitions';
import { runCase } from '../../utils/harness';
import {
	createTally,
	createEvaluator,
	runAllTargets,
	defineBaseMetric,
	defineInput,
} from '@tally-evals/tally';
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
	createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import {
	createMeanAggregator,
	createPassRateAggregator,
} from '@tally-evals/tally/aggregators';
import { google } from '@ai-sdk/google';

describe('Travel Planner Agent - Curve Ball', () => {
	it('should handle ambiguous requests and changing plans', async () => {
		const { conversation } = await runCase({
			trajectory: travelPlannerCurveTrajectory,
			agent: travelPlannerAgent,
			recordedPath: '_fixtures/recorded/travelPlanner/curve.jsonl',
			conversationId: 'travel-planner-curve',
		});

		expect(conversation.steps.length).toBeGreaterThan(0);

		const model = google('models/gemini-2.5-flash-lite');

		const answerRelevance = createAnswerRelevanceMetric({
			provider: model,
		});

		const completeness = createCompletenessMetric({
			provider: model,
		});

		const roleAdherence = createRoleAdherenceMetric({
			expectedRole: 'travel planning assistant',
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
				defineInput({ metric: answerRelevance, weight: 0.33 }),
				defineInput({ metric: completeness, weight: 0.33 }),
				defineInput({ metric: roleAdherence, weight: 0.34 }),
			],
		});

		const evaluator = createEvaluator({
			name: 'Travel Planner Agent Quality',
			metrics: [answerRelevance, completeness, roleAdherence],
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

