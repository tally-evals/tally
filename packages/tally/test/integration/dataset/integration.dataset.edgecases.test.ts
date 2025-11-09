import { describe, it, expect } from 'vitest';
import {
	createThresholdNormalizer,
	createWeightedAverageScorer,
	createAnswerRelevanceMetric,
	defineBaseMetric,
	defineInput,
} from '../../_exports';
import { datasetExampleB } from '../../_fixtures/dataset.examples';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';

describe('Integration | Dataset | Edge Cases', () => {
	it('applies threshold normalization and selection policies (placeholder)', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createAnswerRelevanceMetric({ provider: mockProvider });
		const threshold = createThresholdNormalizer({ threshold: 0.5 });
		void threshold; // will be used in next edits

		const outputMetric = defineBaseMetric({
			name: 'quality',
			valueType: 'number',
		});
		const scorer = createWeightedAverageScorer({
			name: 'qualityScorer',
			output: outputMetric,
			inputs: [defineInput({ metric, weight: 1 })],
		});
		expect(scorer).toBeDefined();
		expect(datasetExampleB.length).toBe(2);
	});
});


