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
	defineSingleTurnEval,
	defineMultiTurnEval,
	defineScorerEval,
	thresholdVerdict,
} from '@tally-evals/tally';
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
	createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
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

		// Create evals
		const answerRelevanceEval = defineSingleTurnEval({
			name: 'Answer Relevance',
			metric: answerRelevance,
		});

		const completenessEval = defineSingleTurnEval({
			name: 'Completeness',
			metric: completeness,
		});

	const roleAdherenceEval = defineMultiTurnEval({
		name: 'Role Adherence',
		metric: roleAdherence,
	});

		const overallQualityEval = defineScorerEval({
			name: 'Overall Quality',
			inputs: [answerRelevance, completeness, roleAdherence],
			scorer: qualityScorer,
			verdict: thresholdVerdict(0.5),
		});

		const evaluator = createEvaluator({
			name: 'Travel Planner Agent Quality',
			evals: [answerRelevanceEval, completenessEval, roleAdherenceEval, overallQualityEval],
			context: runAllTargets(),
		});

		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
		});

		const report = await tally.run();

		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);
		expect(report.evalSummaries.size).toBeGreaterThan(0);

		const overallQualitySummary = report.evalSummaries.get('Overall Quality');
		if (overallQualitySummary) {
			expect(overallQualitySummary.aggregations.mean).toBeGreaterThan(0.4);
		}
	});
});

