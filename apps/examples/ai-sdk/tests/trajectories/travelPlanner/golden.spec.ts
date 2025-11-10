/**
 * Travel Planner Agent - Golden Path Test
 */

import { describe, it, expect } from 'vitest';
import { travelPlannerAgent } from '../../../src/agents/travelPlanner';
import { travelPlannerGoldenTrajectory } from './definitions';
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

describe('Travel Planner Agent - Golden Path', () => {
	it('should plan trip successfully', async () => {
		const { conversation } = await runCase({
			trajectory: travelPlannerGoldenTrajectory,
			agent: travelPlannerAgent,
			recordedPath: '_fixtures/recorded/travelPlanner/golden.jsonl',
			conversationId: 'travel-planner-golden',
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

		// Create aggregators
		const aggregators = [
			createMeanAggregator({ metric: overallQuality }),
			createPassRateAggregator(overallQuality, { threshold: 0.7 }),
		];

		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
			aggregators,
		});

		const report = await tally.run();

		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);

		const passRateSummary = report.aggregateSummaries.find(
			(s) => s.metric.name === 'overallQuality' && 'passRate' in s
		);
		if (passRateSummary && 'passRate' in passRateSummary) {
			expect(passRateSummary.passRate).toBeGreaterThan(0.8);
		}
	});
});

