/**
 * Demand Letter Agent - Curve Ball Test
 */

import { describe, it, expect } from 'bun:test';
import { demandLetterAgent } from '../../../src/agents/demandLetter';
import { demandLetterCurveTrajectory } from './definitions';
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

describe('Demand Letter Agent - Curve Ball', () => {
	it('should handle incomplete information and changing requirements', async () => {
		const { conversation } = await runCase({
			trajectory: demandLetterCurveTrajectory,
			agent: demandLetterAgent,
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
			verdict: thresholdVerdict(0.5),
		});

		const evaluator = createEvaluator({
			name: 'Demand Letter Agent Quality',
			evals: [answerRelevanceEval, completenessEval, overallQualityEval],
			context: runAllTargets(),
		});

		const tally = createTally({
			data: [conversation],
			evaluators: [evaluator],
		});

		const report = await tally.run();
		await saveTallyReportToStore({ conversationId: 'demand-letter-curve', report: report.toArtifact() });

		expect(report).toBeDefined();
		expect(report.result.stepCount).toBeGreaterThan(0);
		expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

		const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
		if (overallQualitySummary) {
			const mean = (overallQualitySummary.aggregations?.score as any)?.mean;
			if (typeof mean === 'number') {
				expect(mean).toBeGreaterThan(0.4);
			}
		}
	});
});

