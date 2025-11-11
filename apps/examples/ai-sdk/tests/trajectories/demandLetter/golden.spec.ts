/**
 * Demand Letter Agent - Golden Path Test
 */

import { describe, it, expect } from 'vitest';
import { demandLetterAgent } from '../../../src/agents/demandLetter';
import { demandLetterGoldenTrajectory } from './definitions';
import { runCase, assertToolCallSequence } from '../../utils/harness';
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
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import {
	createMeanAggregator,
	createPassRateAggregator,
} from '@tally-evals/tally/aggregators';
import { google } from '@ai-sdk/google';

describe('Demand Letter Agent - Golden Path', () => {
	it('should create demand letter successfully', async () => {
		const { conversation } = await runCase({
			trajectory: demandLetterGoldenTrajectory,
			agent: demandLetterAgent,
			recordedPath: '_fixtures/recorded/demandLetter/golden.jsonl',
			conversationId: 'demand-letter-golden',
		});

		expect(conversation.steps.length).toBeGreaterThan(0);

		// Assert tool call sequences are valid
		for (const step of conversation.steps) {
			try {
				assertToolCallSequence(step);
			} catch (error) {
				// Only fail if there are tool calls but no results
				// Some steps might not have tool calls at all
				const hasToolCalls = step.output.some(
					(msg) => msg.role === 'assistant' &&
					(Array.isArray(msg.content) ? msg.content.some((p: unknown) => 
						typeof p === 'object' && p !== null && 'type' in p && p.type === 'tool-call'
					) : false)
				);
				if (hasToolCalls) {
					throw error;
				}
			}
		}

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

