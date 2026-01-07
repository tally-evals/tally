import { describe, it, expect } from 'vitest';
import {
	createTally,
	createEvaluator,
	defineBaseMetric,
	defineMultiTurnEval,
	defineScorerEval,
	createMultiTurnCode,
	runAllTargets,
} from '@tally-evals/tally';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { checkBranching, checkCompletion } from './metrics';
import { chatFixtures, runFixture } from './fixtures';

describe('Demand Letter - Tally evals', () => {
	it(
		'runs custom branching/completion evals on fixtures',
		{ timeout: 300_000 },
		async () => {
			process.env.SKIP_LLM_VERIFY = '1';
		// Run all fixtures and collect conversations
		const conversations = [];
		for (const fixture of chatFixtures) {
			const convo = await runFixture(fixture);
			conversations.push(convo);
		}

		// Define code-based metrics using factory helpers (multi-turn over conversation)
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

		// Scorer combining both
		const overallBase = defineBaseMetric({
			name: 'overallFlow',
			valueType: 'number',
		});
		const scorer = createWeightedAverageScorer({
			name: 'FlowQuality',
			output: overallBase,
			inputs: [
				{ metric: branchingEval.metric as any, weight: 0.5 },
				{ metric: completionEval.metric as any, weight: 0.5 },
			],
		});

		const flowEval = defineScorerEval({
			name: 'FlowQuality',
			inputs: [branchingEval.metric as any, completionEval.metric as any],
			scorer,
			verdict: { kind: 'number', type: 'threshold', passAt: 0.5 },
		});

		const evaluator = createEvaluator({
			name: 'DemandLetterFlow',
			evals: [branchingEval, completionEval, flowEval],
			context: runAllTargets(),
		});

		const tally = createTally({
			data: conversations,
			evaluators: [evaluator],
		});

		const report = await tally.run();

		expect(report).toBeDefined();
		expect(report.perTargetResults.length).toBe(conversations.length);
		// All fixtures should pass branching/completion
		for (const res of report.perTargetResults) {
			const branchingMetric = res.rawMetrics.find(
				(m) => m.metricDef.name === 'branchingScore',
			);
			const completionMetric = res.rawMetrics.find(
				(m) => m.metricDef.name === 'completionScore',
			);
			expect(branchingMetric?.value).toBe(1);
			expect(completionMetric?.value).toBe(1);
		}
		},
	);
});

