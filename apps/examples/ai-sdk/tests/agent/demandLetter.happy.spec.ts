import { describe, it, expect } from 'vitest';

import {
	createSession,
	getNextQuestion,
	submitAnswer,
	type AnswerResult,
} from '../../src/agents/demandLetter/runtime';
import type { Conversation, ConversationStep } from '@tally-evals/tally';
import {
	createTally,
	createEvaluator,
	runAllTargets,
	defineBaseMetric,
	defineSingleTurnEval,
	defineScorerEval,
	defineInput,
	thresholdVerdict,
} from '@tally-evals/tally';
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';
import { checkBranching, checkCompletion } from '../evals/demandLetter/metrics';
import { createMultiTurnCode, defineMultiTurnEval } from '@tally-evals/tally';

/**
 * Happy-path smoke test that drives the demand letter flow with hardcoded answers,
 * builds a Conversation, and runs Tally evals (single-turn + custom code metrics).
 */
describe('Demand Letter Agent - Happy Path (manual harness + Tally evals)', () => {
	it(
		'collects answers, reaches preview, and passes Tally evals',
		{ timeout: 300_000 },
		async () => {
			const answers: Record<string, string> = {
				q1: 'Goods bought or sold',
				q2: 'Myself',
				q3: 'Alice Smith',
				q7: 'Acme Corp',
				q8: 'I purchased goods from Acme Corp.',
				q9: 'They delivered defective products and refused replacement.',
				q10: 'Delivery on Jan 5, 2025; refusal on Jan 12, 2025.',
				q11: 'Yes',
				q12: '$1,200',
				q13: 'Due on Jan 20, 2025',
				q14: 'Lost revenue and customer complaints.',
				q15: 'Refund plus shipping reimbursement.',
				q16: 'Yes',
				q17: 'Discussed by email on Jan 15; they declined a refund.',
				q18: 'I have receipts and email thread.',
				q19: 'Within 7 days',
				q20: 'alice@example.com',
				q21: 'legal@acme.com',
			};

			const sessionId = createSession();
			let question = getNextQuestion(sessionId);
			let lastResult: AnswerResult | undefined;
			const steps: ConversationStep[] = [];
			let stepIndex = 0;

			while (question) {
				const answer = answers[question.id];
				expect(answer, `Missing answer for ${question.id}`).toBeTruthy();

				// eslint-disable-next-line no-console
				console.log(`Q${question.order} (${question.id}): ${question.text}`);
				// eslint-disable-next-line no-console
				console.log(`A: ${answer}`);

				const result = await submitAnswer({
					sessionId,
					questionId: question.id,
					answer: answer as string,
				});
				lastResult = result;

				steps.push({
					stepIndex: stepIndex++,
					input: {
						role: 'assistant',
						content: question.text,
					},
					output: [
						{
							role: 'user',
							content: answer as string,
						},
					],
					metadata: {
						questionId: question.id,
						status: result.status,
						errors: result.errors,
					},
				});

				expect(result.status).toBe('ok');

				question = getNextQuestion(sessionId);
			}

			// Final preview should be present when the flow ends
			expect(lastResult?.preview).toBeDefined();

			// Build conversation for Tally
			const conversation: Conversation = {
				id: 'happy-path',
				steps: steps as unknown as readonly ConversationStep[],
			};

			// Tally evals (single-turn relevance/completeness/overall) similar to golden.spec
			const model = google('models/gemini-2.5-flash-lite');
			const answerRelevance = createAnswerRelevanceMetric({ provider: model });
			const completeness = createCompletenessMetric({ provider: model });

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

			const answerRelevanceEval = defineSingleTurnEval({
				name: 'Answer Relevance',
				metric: answerRelevance as unknown as any,
			});
			const completenessEval = defineSingleTurnEval({
				name: 'Completeness',
				metric: completeness as unknown as any,
			});
			const overallQualityEval = defineScorerEval({
				name: 'Overall Quality',
				inputs: [answerRelevance as any, completeness as any],
				scorer: qualityScorer,
				verdict: thresholdVerdict(0.7),
			});

			// Tally evals (custom code metrics) similar to evals.spec
			const branchingBase = defineBaseMetric({
				name: 'branchingScore',
				valueType: 'number',
			});
			const completionBase = defineBaseMetric({
				name: 'completionScore',
				valueType: 'number',
			});

			const branchingMetric = createMultiTurnCode({
				base: branchingBase,
				compute: ({ data }) => checkBranching(data as any),
				runOnContainer: (convo) => convo,
			});
			const completionMetric = createMultiTurnCode({
				base: completionBase,
				compute: ({ data }) => checkCompletion(data as any),
				runOnContainer: (convo) => convo,
			});

			const branchingEval = defineMultiTurnEval({
				name: 'Branching',
				metric: branchingMetric as any,
			});
			const completionEval = defineMultiTurnEval({
				name: 'Completion',
				metric: completionMetric as any,
			});

			const overallFlowBase = defineBaseMetric({
				name: 'overallFlow',
				valueType: 'number',
			});
			const flowScorer = createWeightedAverageScorer({
				name: 'FlowQuality',
				output: overallFlowBase,
				inputs: [
					{ metric: branchingEval.metric as any, weight: 0.5 },
					{ metric: completionEval.metric as any, weight: 0.5 },
				],
			});
			const flowEval = defineScorerEval({
				name: 'FlowQuality',
				inputs: [branchingEval.metric as any, completionEval.metric as any],
				scorer: flowScorer,
				verdict: { kind: 'number', type: 'threshold', passAt: 0.5 },
			});

			const evaluator = createEvaluator({
				name: 'HappyPathDemandLetter',
				evals: [
					answerRelevanceEval,
					completenessEval,
					overallQualityEval,
					branchingEval,
					completionEval,
					flowEval,
				],
				context: runAllTargets(),
			});

			const tally = createTally({
				data: [conversation],
				evaluators: [evaluator],
			});

			const report = await tally.run();

			// Minimal logging of eval summaries for visibility
			// eslint-disable-next-line no-console
			console.dir(
				{
					evalSummaries: [...report.evalSummaries.entries()].map(
						([name, summary]) => ({
							name,
							verdictSummary: summary.verdictSummary,
							aggregations: summary.aggregations,
						}),
					),
					perTarget: report.perTargetResults.map((r) => ({
						id: r.targetId,
						metrics: r.rawMetrics.map((m) => ({
							name: m.metricDef.name,
							value: m.value,
						})),
					})),
				},
				{ depth: null },
			);

			expect(report).toBeDefined();
			expect(report.perTargetResults.length).toBe(1);

			const overallQualitySummary = report.evalSummaries.get('Overall Quality');
			if (overallQualitySummary?.aggregations?.mean !== undefined) {
				expect(overallQualitySummary.aggregations.mean).toBeGreaterThan(0.7);
			}

			for (const res of report.perTargetResults) {
				const branchingMetricResult = res.rawMetrics.find(
					(m) => m.metricDef.name === 'branchingScore',
				);
				const completionMetricResult = res.rawMetrics.find(
					(m) => m.metricDef.name === 'completionScore',
				);
				expect(branchingMetricResult?.value).toBe(1);
				expect(completionMetricResult?.value).toBe(1);
			}
		},
	);
});

