/**
 * Type Issue Reproduction Test
 * 
 * This test demonstrates the type error that occurs when SingleTurnMetricDef<number, ConversationStep | DatasetItem>
 * is used with defineInput, which expects MetricDef<MetricScalar, unknown>.
 * 
 * IMPORTANT: This test imports from source files (../../_exports), so TypeScript may not show the error
 * due to path alias resolution and more flexible type inference. The error DOES appear when importing
 * from the distributed package (@tally-evals/tally) because the compiled .d.ts types are stricter.
 * 
 * To see the actual error, check: apps/examples/ai-sdk/tests/trajectories/demandLetter/golden.spec.ts
 * 
 * Error (when importing from @tally-evals/tally):
 * Type 'SingleTurnMetricDef<number, ConversationStep | DatasetItem>' is not assignable to type 'MetricDef<MetricScalar, unknown>'.
 *   Type 'SingleTurnMetricDef<number, ConversationStep | DatasetItem>' is not assignable to type 'SingleTurnMetricDef<MetricScalar, unknown> & CodeMetricFields<MetricScalar>'.
 *     Type 'SingleTurnMetricDef<number, ConversationStep | DatasetItem>' is not assignable to type 'SingleTurnMetricDef<MetricScalar, unknown>'.
 *       Type 'MetricScalar' is not assignable to type 'number'.
 *         Type 'string' is not assignable to type 'number'.
 */

import { describe, it, expect } from 'vitest';
// NOTE: Importing from source files - the type error appears when importing from @tally-evals/tally package
// This is because compiled .d.ts types are stricter than source types with path aliases
import {
	createAnswerRelevanceMetric,
	createCompletenessMetric,
	defineBaseMetric,
	defineInput,
	createWeightedAverageScorer,
	type MetricDef,
	type MetricScalar,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';

describe('Type Issue Reproduction', () => {
	it('should reproduce type error when using SingleTurnMetricDef with defineInput', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');

		// Create metrics that return SingleTurnMetricDef<number, ConversationStep | DatasetItem>
		const answerRelevance = createAnswerRelevanceMetric({
			provider: mockProvider,
		});

		const completeness = createCompletenessMetric({
			provider: mockProvider,
		});

		// Create a base metric for the scorer output
		const overallQuality = defineBaseMetric({
			name: 'overallQuality',
			valueType: 'number',
		});

		
		const metricAsScalar = answerRelevance;

		// This should also trigger the type error in defineInput:
		// SingleTurnMetricDef<number, ConversationStep | DatasetItem> is not assignable to MetricDef<MetricScalar, unknown>
		const qualityScorer = createWeightedAverageScorer({
			name: 'OverallQuality',
			output: overallQuality,
			inputs: [
				
				defineInput({ metric: answerRelevance, weight: 0.5 }),
				
				defineInput({ metric: completeness, weight: 0.5 }),
			],
		});

		// This test is just to reproduce the type error, not to test functionality
		expect(qualityScorer).toBeDefined();
		expect(metricAsScalar).toBeDefined();
	});
});

