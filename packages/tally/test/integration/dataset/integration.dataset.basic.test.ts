import { describe, expect, it } from 'bun:test';
import {
  createAnswerRelevanceMetric,
  createWeightedAverageScorer,
  defineBaseMetric,
  defineInput,
} from '../../_exports';
import { datasetExampleA } from '../../_fixtures/dataset.examples';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';

describe('Integration | Dataset | Basic', () => {
  it('sets up OOB metric with mocked LLM and scorer wiring', async () => {
    // OOB metric (LLM-based, requires provider)
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
    const metric = createAnswerRelevanceMetric({ provider: mockProvider });
    expect(metric).toBeDefined();

    // Create scorer with proper API
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

    expect(datasetExampleA.length).toBe(2);
  });
});
