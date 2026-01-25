/**
 * Integration Tests for Aggregation with Conversation Fixtures
 *
 * These tests verify aggregation behavior through the full pipeline
 * using real conversation fixtures and code-based metrics (no LLM required).
 */

import { describe, expect, it } from 'bun:test';
import {
  defineMultiTurnCode,
  defineSingleTurnCode,
  createTally,
  defineBaseMetric,
  type ConversationStep,
} from '../../_exports';
import {
  createIdentityNormalizer,
  createMeanAggregator,
  createPercentileAggregator,
  createThresholdAggregator,
} from '../../_exports';
import {
  defineSingleTurnEval,
  defineMultiTurnEval,
  thresholdVerdict,
  booleanVerdict,
} from '../../../src/evals';
import { conversationExampleA, conversationExampleB } from '../../_fixtures/conversation.examples';

/** Helper to extract assistant content from a ConversationStep */
function getAssistantContent(step: ConversationStep): string {
  const assistant = step.output?.find(
    (o) => o.role === 'assistant' && typeof o.content === 'string',
  );
  return (assistant?.content as string) ?? '';
}

describe('Integration | Conversation | Aggregation', () => {
  describe('Mean aggregation on single-turn metrics', () => {
    it('calculates mean score across conversation steps', async () => {
      const base = defineBaseMetric({ name: 'responsiveness', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Return normalized score based on content length (capped at 1)
          return Math.min(1, getAssistantContent(step).length / 50);
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createMeanAggregator()],
      });

      const eval_ = defineSingleTurnEval({
        name: 'Responsiveness',
        metric,
        verdict: thresholdVerdict(0.3),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();
      expect(report.result.stepCount).toBe(3);

      // Check aggregations in summary
      const summaries = report.result.summaries?.byEval ?? {};
      const responsivenessSummary = summaries['Responsiveness'];

      expect(responsivenessSummary).toBeDefined();
      expect(responsivenessSummary?.aggregations?.score?.Mean).toBeDefined();

      const meanScore = responsivenessSummary?.aggregations?.score?.Mean;
      expect(typeof meanScore).toBe('number');
      expect(meanScore).toBeGreaterThanOrEqual(0);
      expect(meanScore).toBeLessThanOrEqual(1);
    });

    it('calculates P50 and P90 percentiles across steps', async () => {
      const base = defineBaseMetric({ name: 'quality', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Return different scores for different steps
          return 0.3 + (step.stepIndex ?? 0) * 0.2;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [
          createPercentileAggregator({ percentile: 50 }),
          createPercentileAggregator({ percentile: 90 }),
        ],
      });

      const eval_ = defineSingleTurnEval({
        name: 'Quality',
        metric,
        verdict: thresholdVerdict(0.3),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const summaries = report.result.summaries?.byEval ?? {};
      const qualitySummary = summaries['Quality'];

      expect(qualitySummary).toBeDefined();
      expect(qualitySummary?.aggregations?.score?.P50).toBeDefined();
      expect(qualitySummary?.aggregations?.score?.P90).toBeDefined();

      // P50 should be the median, P90 should be higher
      const p50 = qualitySummary?.aggregations?.score?.P50 as number;
      const p90 = qualitySummary?.aggregations?.score?.P90 as number;

      expect(typeof p50).toBe('number');
      expect(typeof p90).toBe('number');
      expect(p90).toBeGreaterThanOrEqual(p50);
    });

    it('calculates threshold pass rate across steps', async () => {
      const base = defineBaseMetric({ name: 'threshold', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Step 0 and 2 pass threshold (>= 0.7), step 1 fails
          const scores = [0.8, 0.4, 0.9];
          return scores[step.stepIndex ?? 0] ?? 0.5;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createThresholdAggregator({ threshold: 0.7 })],
      });

      const eval_ = defineSingleTurnEval({
        name: 'ThresholdTest',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const summaries = report.result.summaries?.byEval ?? {};
      const thresholdSummary = summaries['ThresholdTest'];

      expect(thresholdSummary).toBeDefined();
      // Threshold aggregator creates `Threshold >= {threshold}` key
      const passRate = thresholdSummary?.aggregations?.score?.['Threshold >= 0.7'];

      expect(passRate).toBeDefined();
      // 2 out of 3 steps pass => ~0.667
      expect(passRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('Verdict summaries on conversation steps', () => {
    it('calculates pass/fail verdicts with threshold policy', async () => {
      const base = defineBaseMetric({ name: 'passTest', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Step 0: 0.9 (pass), Step 1: 0.4 (fail), Step 2: 0.6 (pass)
          const scores = [0.9, 0.4, 0.6];
          return scores[step.stepIndex ?? 0] ?? 0.5;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
      });

      const eval_ = defineSingleTurnEval({
        name: 'PassTest',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const summaries = report.result.summaries?.byEval ?? {};
      const passTestSummary = summaries['PassTest'];

      expect(passTestSummary).toBeDefined();
      expect(passTestSummary?.verdictSummary).toBeDefined();

      const verdictSummary = passTestSummary?.verdictSummary!;
      expect(verdictSummary.totalCount).toBe(3);
      expect(verdictSummary.passCount).toBe(2);
      expect(verdictSummary.failCount).toBe(1);
      expect(verdictSummary.passRate).toBeCloseTo(2 / 3, 2);
      expect(verdictSummary.failRate).toBeCloseTo(1 / 3, 2);
    });

    it('calculates verdicts on multi-turn metrics', async () => {
      const base = defineBaseMetric({ name: 'conversationQuality', valueType: 'number' });

      const metric = defineMultiTurnCode({
        base,
        runOnContainer: async (conversation) => conversation,
        compute: async ({ data }) => {
          const conversation = data as typeof conversationExampleB;
          // Return a score based on conversation properties
          return conversation.steps.length >= 2 ? 0.85 : 0.3;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
      });

      const eval_ = defineMultiTurnEval({
        name: 'ConversationQuality',
        metric,
        verdict: thresholdVerdict(0.7),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const multiTurn = report.result.multiTurn['ConversationQuality'];
      expect(multiTurn).toBeDefined();
      expect(multiTurn.measurement.score).toBe(0.85);
      expect(multiTurn.outcome?.verdict).toBe('pass');

      const summaries = report.result.summaries?.byEval ?? {};
      const qualitySummary = summaries['ConversationQuality'];
      expect(qualitySummary).toBeDefined();
      expect(qualitySummary?.verdictSummary?.passCount).toBe(1);
    });
  });

  describe('Multiple aggregators combined', () => {
    it('applies multiple aggregators to the same metric', async () => {
      const base = defineBaseMetric({ name: 'multiAgg', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Different scores per step: 0.3, 0.5, 0.7
          const scores = [0.3, 0.5, 0.7];
          return scores[step.stepIndex ?? 0] ?? 0.5;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [
          createMeanAggregator(),
          createPercentileAggregator({ percentile: 50 }),
          createThresholdAggregator({ threshold: 0.4 }),
        ],
      });

      const eval_ = defineSingleTurnEval({
        name: 'MultiAgg',
        metric,
        verdict: thresholdVerdict(0.3),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const summaries = report.result.summaries?.byEval ?? {};
      const multiAggSummary = summaries['MultiAgg'];

      expect(multiAggSummary).toBeDefined();
      expect(multiAggSummary?.aggregations?.score).toBeDefined();

      const aggs = multiAggSummary?.aggregations?.score;

      // Mean of [0.3, 0.5, 0.7] = 0.5
      expect(aggs?.Mean).toBeCloseTo(0.5, 2);

      // P50 (median) of [0.3, 0.5, 0.7] = 0.5
      expect(aggs?.P50).toBeCloseTo(0.5, 2);

      // Threshold >= 0.4: 2 out of 3 pass (0.5 and 0.7)
      expect(aggs?.['Threshold >= 0.4']).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('Aggregation on larger conversation', () => {
    it('aggregates results across all steps in a conversation', async () => {
      const base = defineBaseMetric({ name: 'stepQuality', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          // Normalize by content length
          return Math.min(1, getAssistantContent(step).length / 30);
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
        aggregators: [createMeanAggregator()],
      });

      const eval_ = defineSingleTurnEval({
        name: 'StepQuality',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      // Run on conversationExampleB (3 steps)
      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      // Total steps: 3 (convB)
      expect(report.result.stepCount).toBe(3);

      const summaries = report.result.summaries?.byEval ?? {};
      const stepQualitySummary = summaries['StepQuality'];

      expect(stepQualitySummary).toBeDefined();
      expect(stepQualitySummary?.aggregations?.score?.Mean).toBeDefined();

      // Verify verdict summary counts all steps
      expect(stepQualitySummary?.verdictSummary?.totalCount).toBe(3);
    });
  });
});
