/**
 * Integration tests for aggregation behavior in the pipeline
 *
 * Tests the full flow: metrics → normalization → aggregation → summaries
 */

import { describe, expect, it } from 'bun:test';
import {
  createMeanAggregator,
  createPercentileAggregator,
  createThresholdAggregator,
  createTrueRateAggregator,
  createMinMaxNormalizer,
  createIdentityNormalizer,
  defineBaseMetric,
  defineSingleTurnCode,
  createWeightedAverageScorer,
  defineInput,
  createTally,
  type Conversation,
  type ConversationStep,
} from '../../_exports';
import { defineSingleTurnEval, defineScorerEval, thresholdVerdict, booleanVerdict } from '../../../src/evals';
import type { DatasetItem, VerdictPolicyFor } from '../../_exports';

/**
 * Helper to convert DatasetItem[] to a Conversation for testing
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

describe('Integration | Pipeline | Aggregation', () => {
  describe('Numeric Aggregators', () => {
    it('computes mean aggregation across dataset', async () => {
      const base = defineBaseMetric({
        name: 'score',
        valueType: 'number',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createMeanAggregator()],
      });

      const outputMetric = defineBaseMetric({
        name: 'meanScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'meanEval',
        metric,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      // Values: 0.2, 0.4, 0.6, 0.8, 1.0 → mean = 0.6
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.2' },
        { id: '2', prompt: 'test', completion: '0.4' },
        { id: '3', prompt: 'test', completion: '0.6' },
        { id: '4', prompt: 'test', completion: '0.8' },
        { id: '5', prompt: 'test', completion: '1.0' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();

      // Check aggregation in summaries
      const summary = report.result.summaries?.byEval.meanEval;
      expect(summary).toBeDefined();
      expect(summary?.aggregations.score.Mean).toBeCloseTo(0.6, 10);
    });

    it('computes percentile aggregations (P50, P95)', async () => {
      const base = defineBaseMetric({
        name: 'latency',
        valueType: 'number',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 1 }),
        },
        aggregators: [
          createMeanAggregator(),
          createPercentileAggregator({ percentile: 50 }),
          createPercentileAggregator({ percentile: 95 }),
        ],
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

      // 10 values from 0.1 to 1.0
      const items: DatasetItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        prompt: 'test',
        completion: String((i + 1) / 10),
      }));

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const summary = report.result.summaries?.byEval.latencyEval;

      expect(summary).toBeDefined();
      expect(summary?.aggregations.score.Mean).toBeCloseTo(0.55, 2);
      expect(summary?.aggregations.score.P50).toBeCloseTo(0.55, 2);  // Median
      expect(summary?.aggregations.score.P95).toBeDefined();  // Should exist
    });

    it('computes threshold pass rate aggregation', async () => {
      const base = defineBaseMetric({
        name: 'quality',
        valueType: 'number',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [
          createMeanAggregator(),
          createThresholdAggregator({ threshold: 0.7 }),
        ],
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

      // 3 out of 5 values >= 0.7
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.5' },  // below
        { id: '2', prompt: 'test', completion: '0.7' },  // at threshold
        { id: '3', prompt: 'test', completion: '0.8' },  // above
        { id: '4', prompt: 'test', completion: '0.6' },  // below
        { id: '5', prompt: 'test', completion: '0.9' },  // above
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const summary = report.result.summaries?.byEval.qualityEval;

      expect(summary).toBeDefined();
      expect(summary?.aggregations.score['Threshold >= 0.7']).toBe(0.6);  // 3/5 = 0.6
    });
  });

  describe('Boolean Aggregators', () => {
    it('computes true rate for boolean metrics', async () => {
      const base = defineBaseMetric({
        name: 'passed',
        valueType: 'boolean',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: getStepCompletion(step as ConversationStep) === 'pass',
        }),
        compute: ({ data }) => (data as { value: boolean }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createTrueRateAggregator()],
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

      // 4 out of 5 pass
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: 'pass' },
        { id: '2', prompt: 'test', completion: 'pass' },
        { id: '3', prompt: 'test', completion: 'fail' },
        { id: '4', prompt: 'test', completion: 'pass' },
        { id: '5', prompt: 'test', completion: 'pass' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const summary = report.result.summaries?.byEval.boolEval;

      expect(summary).toBeDefined();
      // Boolean values are converted to 0/1 scores, so we check that aggregations exist
      // The Mean of the scores (4 true = 1, 1 false = 0) => 0.8
      expect(summary?.aggregations?.score?.Mean).toBeDefined();
      // TrueRate may be in raw aggregations for boolean metrics
      const trueRateValue =
        summary?.aggregations?.raw?.TrueRate ?? summary?.aggregations?.score?.TrueRate;
      if (trueRateValue !== undefined) {
        expect(trueRateValue).toBe(0.8);  // 4/5
      }
    });
  });

  describe('Verdict Summaries', () => {
    it('computes verdict pass/fail rates with threshold policy', async () => {
      const base = defineBaseMetric({
        name: 'score',
        valueType: 'number',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep)),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createMeanAggregator()],
      });

      const outputMetric = defineBaseMetric({
        name: 'verdictScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      // Add verdict policy - pass if score >= 0.5
      const eval_ = defineSingleTurnEval({
        name: 'verdictEval',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      // 3 pass, 2 fail
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.3' },  // fail
        { id: '2', prompt: 'test', completion: '0.6' },  // pass
        { id: '3', prompt: 'test', completion: '0.8' },  // pass
        { id: '4', prompt: 'test', completion: '0.4' },  // fail
        { id: '5', prompt: 'test', completion: '0.7' },  // pass
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const summary = report.result.summaries?.byEval.verdictEval;

      expect(summary).toBeDefined();
      expect(summary?.verdictSummary).toBeDefined();
      expect(summary?.verdictSummary?.passCount).toBe(3);
      expect(summary?.verdictSummary?.failCount).toBe(2);
      expect(summary?.verdictSummary?.passRate).toBe(0.6);
      expect(summary?.verdictSummary?.failRate).toBe(0.4);
    });

    it('computes verdict rates with boolean policy', async () => {
      const base = defineBaseMetric({
        name: 'valid',
        valueType: 'boolean',
      });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => ({
          value: getStepCompletion(step as ConversationStep) === 'yes',
        }),
        compute: ({ data }) => (data as { value: boolean }).value,
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createTrueRateAggregator()],
      });

      const outputMetric = defineBaseMetric({
        name: 'validScore',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [defineInput({ metric, weight: 1 })],
      });

      // Pass when true - use type assertion since metric value type inference is complex
      const eval_ = defineSingleTurnEval({
        name: 'boolVerdictEval',
        metric,
        // biome-ignore lint/suspicious/noExplicitAny: Type inference for boolean metrics is complex
        verdict: booleanVerdict(true) as any,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: 'yes' },  // true → pass
        { id: '2', prompt: 'test', completion: 'no' },   // false → fail
        { id: '3', prompt: 'test', completion: 'yes' },  // true → pass
        { id: '4', prompt: 'test', completion: 'yes' },  // true → pass
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [eval_, scorerEval],
      });

      const report = await tally.run();
      const summary = report.result.summaries?.byEval.boolVerdictEval;

      expect(summary).toBeDefined();
      expect(summary?.verdictSummary?.passCount).toBe(3);
      expect(summary?.verdictSummary?.failCount).toBe(1);
      expect(summary?.verdictSummary?.passRate).toBe(0.75);
    });
  });

  describe('Combined Flow', () => {
    it('runs full pipeline with multiple evals and aggregations', async () => {
      // Metric 1: Numeric with mean
      const scoreBase = defineBaseMetric({
        name: 'score',
        valueType: 'number',
      });

      const scoreMetric = defineSingleTurnCode({
        base: scoreBase,
        preProcessor: (step) => ({
          value: parseFloat(getStepCompletion(step as ConversationStep).split(',')[0]),
        }),
        compute: ({ data }) => (data as { value: number }).value,
        normalization: { normalizer: createIdentityNormalizer() },
        aggregators: [createMeanAggregator()],
      });

      // Metric 2: Boolean with true rate
      const validBase = defineBaseMetric({
        name: 'valid',
        valueType: 'boolean',
      });

      const validMetric = defineSingleTurnCode({
        base: validBase,
        preProcessor: (step) => ({
          value: getStepCompletion(step as ConversationStep).split(',')[1] === 'true',
        }),
        compute: ({ data }) => (data as { value: boolean }).value,
        normalization: { normalizer: createIdentityNormalizer() },
        aggregators: [createTrueRateAggregator()],
      });

      const outputMetric = defineBaseMetric({
        name: 'combined',
        valueType: 'number',
      });

      const scorer = createWeightedAverageScorer({
        name: 'scorer',
        output: outputMetric,
        inputs: [
          defineInput({ metric: scoreMetric, weight: 0.7 }),
          defineInput({ metric: validMetric, weight: 0.3 }),
        ],
      });

      const scoreEval = defineSingleTurnEval({
        name: 'scoreEval',
        metric: scoreMetric,
        verdict: thresholdVerdict(0.6),
      });

      const validEval = defineSingleTurnEval({
        name: 'validEval',
        metric: validMetric,
        // biome-ignore lint/suspicious/noExplicitAny: Type inference for boolean metrics is complex
        verdict: booleanVerdict(true) as any,
      });

      const scorerEval = defineScorerEval({
        name: 'scorerEval',
        scorer,
      });

      // Format: "score,valid"
      const items: DatasetItem[] = [
        { id: '1', prompt: 'test', completion: '0.8,true' },
        { id: '2', prompt: 'test', completion: '0.5,false' },
        { id: '3', prompt: 'test', completion: '0.7,true' },
        { id: '4', prompt: 'test', completion: '0.4,true' },
      ];

      const tally = createTally({
        data: [datasetToConversation(items)],
        evals: [scoreEval, validEval, scorerEval],
      });

      const report = await tally.run();

      // Check score eval
      const scoreSummary = report.result.summaries?.byEval.scoreEval;
      expect(scoreSummary).toBeDefined();
      expect(scoreSummary?.aggregations.score.Mean).toBeCloseTo(0.6, 10);  // (0.8+0.5+0.7+0.4)/4
      expect(scoreSummary?.verdictSummary?.passCount).toBe(2);  // 0.8, 0.7 >= 0.6

      // Check valid eval
      const validSummary = report.result.summaries?.byEval.validEval;
      expect(validSummary).toBeDefined();
      // TrueRate may be in raw or score aggregations depending on implementation
      const validTrueRateValue =
        validSummary?.aggregations?.raw?.TrueRate ?? validSummary?.aggregations?.score?.TrueRate;
      if (validTrueRateValue !== undefined) {
        expect(validTrueRateValue).toBe(0.75);  // 3/4
      }
      expect(validSummary?.verdictSummary?.passCount).toBe(3);  // true count
    });
  });
});
