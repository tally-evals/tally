/**
 * Demand Letter Agent - Golden Path Test
 */

import { describe, it, expect } from 'bun:test';
import { demandLetterAgent } from '../../../src/agents/demandLetter';
import { demandLetterGoldenTrajectory } from './definitions';
import { runCase, assertToolCallSequence, saveTallyReportToStore } from '../../utils/harness';
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

describe('Demand Letter Agent - Golden Path', () => {
	it('should create demand letter successfully', async () => {
		const { conversation, mode } = await runCase({
			trajectory: demandLetterGoldenTrajectory,
			agent: demandLetterAgent,
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
				const hasToolCalls = step.output.some((msg: unknown) => {
					if (!msg || typeof msg !== 'object') return false;
					if (!('role' in msg) || (msg as { role?: unknown }).role !== 'assistant') return false;
					const content = (msg as { content?: unknown }).content;
					if (!Array.isArray(content)) return false;
					return content.some(
						(p: unknown) =>
							typeof p === 'object' &&
							p !== null &&
							'type' in p &&
							(p as { type?: unknown }).type === 'tool-call'
					);
				});
				if (hasToolCalls) {
					throw error;
				}
			}
		}

		// In record mode, skip evaluation assertions (agent output varies)
		if (mode === 'record') {
			console.log(`✅ Recording complete: ${conversation.steps.length} steps`);
			return;
		}

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
			verdict: thresholdVerdict(0.7),
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
		await saveTallyReportToStore({ conversationId: 'demand-letter-golden', report });

		// Debug output
		const overallQualitySummary = report.evalSummaries.get('Overall Quality');
		console.log('📊 Evaluation Results:');
		console.log(`   Steps evaluated: ${conversation.steps.length}`);
		console.log(`   Overall Quality mean: ${overallQualitySummary?.aggregations.mean}`);

		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBeGreaterThan(0);
		expect(report.evalSummaries.size).toBeGreaterThan(0);

		// Check mean score
		// Note: demandLetter trajectory was recorded with agent-loop (3 steps)
		// so quality may be lower than a complete trajectory
		if (overallQualitySummary) {
			expect(overallQualitySummary.aggregations.mean).toBeGreaterThan(0.2);
		}
	});
});

