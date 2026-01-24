/**
 * Integration tests for normalization behavior in the pipeline
 *
 * Tests the full flow: raw values → normalization → scores
 */

import { describe, expect, it } from 'bun:test';
import {
  createMinMaxNormalizer,
  createThresholdNormalizer,
  createLinearNormalizer,
  createOrdinalMapNormalizer,
  createIdentityNormalizer,
  defineBaseMetric,
  createSingleTurnCode,
  createWeightedAverageScorer,
  defineInput,
  createTally,
  type Conversation,
  type ConversationStep,
} from '../../_exports';
import { defineSingleTurnEval, defineScorerEval } from '../../../src/evals';
import type { DatasetItem } from '../../_exports';

/**
 * Helper to convert DatasetItem[] to a Conversation for testing
 * Each DatasetItem becomes a step where the completion is in the assistant output
 */
function datasetToConversation(items: DatasetItem[]): Conversation {
  return {
    id: 'test-conversation',
    steps: items.map((item, index) => ({
      stepIndex: index,
      input: { role: 'user' as const, content: item.prompt },
      output: [{ role: 'assistant' as const, content: item.completion }],
      metadata: { datasetItemId: item.id },
    })),
  };
}

/**
 * Helper to extract completion from a ConversationStep
 */
function getStepCompletion(step: ConversationStep): string {
  const output = step.output;
  if (!output) return '';

  // Output is always an array of ModelMessage
  const messages = Array.isArray(output) ? output : [output];
  const assistant = messages.find((o) => o.role === 'assistant');
  if (assistant && typeof assistant.content === 'string') {
    return assistant.content;
  }
  return '';
}

describe('Integration | Pipeline | Normalization', () => {
  describe('MinMax Normalization', () => {
    it('normalizes numeric values to [0, 1] range across dataset', async () => {
      const base = defineBaseMetric({
        name: 'rawScore',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 100 }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'normalizedScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'test',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      // Test data with values in 0-100 range
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0' },    // → 0.0
        { id: '2', prompt: 'test', completion: '50' },   // → 0.5
        { id: '3', prompt: 'test', completion: '100' },  // → 1.0
        { id: '4', prompt: 'test', completion: '25' },   // → 0.25
        { id: '5', prompt: 'test', completion: '75' },   // → 0.75
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();

      // Check that results exist
      expect(report.result.singleTurn.test).toBeDefined();
      const series = report.result.singleTurn.test;
      expect(series.byStepIndex).toHaveLength(5);

      // Verify normalized scores
      expect(series.byStepIndex[0]?.measurement.score).toBe(0.0);
      expect(series.byStepIndex[1]?.measurement.score).toBe(0.5);
      expect(series.byStepIndex[2]?.measurement.score).toBe(1.0);
      expect(series.byStepIndex[3]?.measurement.score).toBe(0.25);
      expect(series.byStepIndex[4]?.measurement.score).toBe(0.75);
    });

    it('applies direction=lower to invert scores', async () => {
      const base = defineBaseMetric({
        name: 'latency',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 1000, direction: 'lower' }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'latencyScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'latencyEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0' },     // low latency → high score (1.0)
        { id: '2', prompt: 'test', completion: '1000' },  // high latency → low score (0.0)
        { id: '3', prompt: 'test', completion: '500' },   // mid latency → mid score (0.5)
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.latencyEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(1.0);  // 0 latency → 1.0 score
      expect(series.byStepIndex[1]?.measurement.score).toBe(0.0);  // 1000 latency → 0.0 score
      expect(series.byStepIndex[2]?.measurement.score).toBe(0.5);  // 500 latency → 0.5 score
    });
  });

  describe('Threshold Normalization', () => {
    it('converts values to binary scores based on threshold', async () => {
      const base = defineBaseMetric({
        name: 'quality',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createThresholdNormalizer({ threshold: 0.7 }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'qualityScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'qualityEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.5' },  // below → 0
        { id: '2', prompt: 'test', completion: '0.7' },  // at threshold → 1
        { id: '3', prompt: 'test', completion: '0.9' },  // above → 1
        { id: '4', prompt: 'test', completion: '0.69' }, // just below → 0
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.qualityEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(0);
      expect(series.byStepIndex[1]?.measurement.score).toBe(1);
      expect(series.byStepIndex[2]?.measurement.score).toBe(1);
      expect(series.byStepIndex[3]?.measurement.score).toBe(0);
    });

    it('uses custom above/below scores', async () => {
      const base = defineBaseMetric({
        name: 'rating',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createThresholdNormalizer({ threshold: 0.5, above: 0.8, below: 0.2 }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'ratingScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'ratingEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.3' },  // below → 0.2
        { id: '2', prompt: 'test', completion: '0.7' },  // above → 0.8
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.ratingEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(0.2);
      expect(series.byStepIndex[1]?.measurement.score).toBe(0.8);
    });
  });

  describe('Linear Normalization', () => {
    it('applies linear transformation with slope and intercept', async () => {
      const base = defineBaseMetric({
        name: 'rawMetric',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createLinearNormalizer({ slope: 0.5, intercept: 0.25 }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'linearScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'linearEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0' },
        { id: '2', prompt: 'test', completion: '0.5' },
        { id: '3', prompt: 'test', completion: '1' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.linearEval;

      expect(series.byStepIndex[0]?.measurement.score).toBeCloseTo(0.25, 10);
      expect(series.byStepIndex[1]?.measurement.score).toBeCloseTo(0.5, 10);
      expect(series.byStepIndex[2]?.measurement.score).toBeCloseTo(0.75, 10);
    });
  });

  describe('Ordinal Map Normalization', () => {
    it('maps string values to scores', async () => {
      const base = defineBaseMetric({
        name: 'grade',
        valueType: 'string',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: getStepCompletion(step as ConversationStep),
        }),
        compute: ({ data }) => (data as { value: string }).value,
        normalization: {
          normalizer: createOrdinalMapNormalizer({
            map: { excellent: 1.0, good: 0.75, fair: 0.5, poor: 0.25, bad: 0.0 },
          }),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'gradeScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'gradeEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: 'excellent' },
        { id: '2', prompt: 'test', completion: 'good' },
        { id: '3', prompt: 'test', completion: 'fair' },
        { id: '4', prompt: 'test', completion: 'poor' },
        { id: '5', prompt: 'test', completion: 'bad' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.gradeEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(1.0);
      expect(series.byStepIndex[1]?.measurement.score).toBe(0.75);
      expect(series.byStepIndex[2]?.measurement.score).toBe(0.5);
      expect(series.byStepIndex[3]?.measurement.score).toBe(0.25);
      expect(series.byStepIndex[4]?.measurement.score).toBe(0.0);
    });
  });

  describe('Identity Normalization', () => {
    it('passes through values already in [0, 1] range', async () => {
      const base = defineBaseMetric({
        name: 'score',
        valueType: 'number',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'identityScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'identityEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0' },
        { id: '2', prompt: 'test', completion: '0.5' },
        { id: '3', prompt: 'test', completion: '1' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.identityEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(0);
      expect(series.byStepIndex[1]?.measurement.score).toBe(0.5);
      expect(series.byStepIndex[2]?.measurement.score).toBe(1);
    });

    it('converts boolean values to 0/1', async () => {
      const base = defineBaseMetric({
        name: 'passed',
        valueType: 'boolean',
      });

      const metric = createSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: getStepCompletion(step as ConversationStep) === 'true',
        }),
        compute: ({ data }) => (data as { value: boolean }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
      });

      const outputMetric = defineBaseMetric({
        name: 'passedScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'boolEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: 'true' },
        { id: '2', prompt: 'test', completion: 'false' },
        { id: '3', prompt: 'test', completion: 'true' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const series = report.result.singleTurn.boolEval;

      expect(series.byStepIndex[0]?.measurement.score).toBe(1);
      expect(series.byStepIndex[1]?.measurement.score).toBe(0);
      expect(series.byStepIndex[2]?.measurement.score).toBe(1);
    });
  });
});
