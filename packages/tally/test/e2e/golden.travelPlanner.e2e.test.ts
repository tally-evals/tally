/**
 * E2E Tests for Metrics using Golden Travel Planner Conversation
 * 
 * These tests run metrics against recorded golden conversations.
 * Requires LLM_API_KEY environment variable to be set.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
	loadConversationStepsFromJSONL,
	createTally,
	createEvaluator,
	runAllTargets,
	defineBaseMetric,
	defineInput,
} from '../_exports';
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
	createRoleAdherenceMetric,
	createGoalCompletionMetric,
	createTopicAdherenceMetric,
} from '../_exports';
import { createWeightedAverageScorer } from '../_exports';
import {
	createMeanAggregator,
	createPassRateAggregator,
} from '../_exports';
import { google } from '@ai-sdk/google';

const GOLDEN_FIXTURE_PATH = resolve(
	__dirname,
	'../_fixtures/conversations/travelPlanner/golden.jsonl'
);
const CONVERSATION_ID = 'travel-planner-golden';

describe.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
	'E2E | Metrics | Golden Travel Planner',
	() => {
		it('runs all metrics on golden travel planner conversation', async () => {
			// Load conversation from golden fixture
			const conversation = await loadConversationStepsFromJSONL(
				GOLDEN_FIXTURE_PATH,
				CONVERSATION_ID
			);

			expect(conversation.steps.length).toBeGreaterThan(0);

			const model = google('models/gemini-2.5-flash-lite');

			// Create metrics
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

			const goalCompletion = createGoalCompletionMetric({
				goal: 'Help user plan a trip to San Francisco including flights and accommodations',
				provider: model,
			});

			const topicAdherence = createTopicAdherenceMetric({
				topics: ['travel', 'flights', 'hotels', 'accommodations', 'San Francisco'],
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
					defineInput({ metric: answerRelevance, weight: 0.2 }),
					defineInput({ metric: completeness, weight: 0.2 }),
					defineInput({ metric: roleAdherence, weight: 0.2 }),
					defineInput({ metric: goalCompletion, weight: 0.2 }),
					defineInput({ metric: topicAdherence, weight: 0.2 }),
				],
			});

			const evaluator = createEvaluator({
				name: 'Travel Planner Agent Quality',
				metrics: [
					answerRelevance,
					completeness,
					roleAdherence,
					goalCompletion,
					topicAdherence,
				],
				scorer: qualityScorer,
				context: runAllTargets(),
			});

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

			// Verify metrics were computed
			for (const result of report.perTargetResults) {
				expect(result.rawMetrics.length).toBeGreaterThan(0);
				expect(result.derivedMetrics.length).toBeGreaterThan(0);

				// Check that derived metrics have values in [0, 1] (normalized)
				for (const metric of result.derivedMetrics) {
					expect(metric.value).toBeGreaterThanOrEqual(0);
					expect(metric.value).toBeLessThanOrEqual(1);
				}
				
				// Raw metrics may be unnormalized (0-5 scale), so we just check they're numbers
				for (const metric of result.rawMetrics) {
					expect(typeof metric.value).toBe('number');
					expect(metric.value).toBeGreaterThanOrEqual(0);
				}
			}

			// Verify aggregate summaries
			expect(report.aggregateSummaries.length).toBeGreaterThan(0);
			for (const summary of report.aggregateSummaries) {
				expect(summary.average).toBeGreaterThanOrEqual(0);
				expect(summary.average).toBeLessThanOrEqual(1);
				expect(summary.count).toBeGreaterThan(0);
			}
		},
		180000 // 3 minute timeout for LLM calls
	);
}
);

