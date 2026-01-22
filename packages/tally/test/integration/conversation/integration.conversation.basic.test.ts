import { describe, expect, it } from 'bun:test';
import {
  createMultiTurnCode,
  createWeightedAverageScorer,
  defineBaseMetric,
  defineInput,
} from '../../_exports';
import { conversationExampleA } from '../../_fixtures/conversation.examples';

describe('Integration | Conversation | Basic', () => {
  it('creates a simple multi-turn code metric and scorer (placeholder)', async () => {
    const base = defineBaseMetric({ name: 'friendliness', valueType: 'number' });
    const multi = createMultiTurnCode({
      base,
      runOnContainer: async (conversation) => {
        // Preprocess: return conversation for compute
        return conversation;
      },
      compute: async ({ data }) => {
        const conversation = data as typeof conversationExampleA;
        return conversation.steps.length >= 2 ? 0.9 : 0.5;
      },
    });

    const outputMetric = defineBaseMetric({
      name: 'quality',
      valueType: 'number',
    });
    const scorer = createWeightedAverageScorer({
      name: 'qualityScorer',
      output: outputMetric,
      inputs: [defineInput({ metric: multi, weight: 1 })],
    });
    expect(scorer).toBeDefined();
    expect(conversationExampleA.steps.length).toBe(2);
  });
});
