/**
 * Integration Tests for Normalization with Conversation Fixtures
 *
 * These tests verify normalization behavior through the full pipeline
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
  createLinearNormalizer,
  createMinMaxNormalizer,
  createThresholdNormalizer,
} from '../../_exports';
import { defineSingleTurnEval, defineMultiTurnEval, thresholdVerdict } from '../../../src/evals';
import { conversationExampleA, conversationExampleB } from '../../_fixtures/conversation.examples';

/** Helper to extract assistant content from a ConversationStep */
function getAssistantContent(step: ConversationStep): string {
  const assistant = step.output?.find(
    (o) => o.role === 'assistant' && typeof o.content === 'string',
  );
  return (assistant?.content as string) ?? '';
}

describe('Integration | Conversation | Normalization', () => {
  describe('Single-turn metrics with normalization', () => {
    it('applies MinMax normalization to response length scores', async () => {
      const base = defineBaseMetric({ name: 'responseLength', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          return getAssistantContent(step).length;
        },
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 50 }),
        },
      });

      const eval_ = defineSingleTurnEval({
        name: 'ResponseLength',
        metric,
        verdict: thresholdVerdict(0.1),
      });

      const tally = createTally({
        data: [conversationExampleA],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();
      expect(report.result.stepCount).toBe(2);

      // Check single-turn results
      const singleTurn = report.result.singleTurn['ResponseLength'];
      expect(singleTurn).toBeDefined();
      expect(singleTurn.byStepIndex).toHaveLength(2);

      // Verify scores are normalized (0-1 range, capped)
      for (const stepResult of singleTurn.byStepIndex) {
        expect(stepResult).toBeDefined();
        expect(stepResult!.measurement.score).toBeGreaterThanOrEqual(0);
        expect(stepResult!.measurement.score).toBeLessThanOrEqual(1);
      }
    });

    it('applies Threshold normalization for content presence', async () => {
      const base = defineBaseMetric({ name: 'hasContent', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          return getAssistantContent(step).length;
        },
        normalization: {
          normalizer: createThresholdNormalizer({ threshold: 5 }),
        },
      });

      const eval_ = defineSingleTurnEval({
        name: 'HasContent',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      const tally = createTally({
        data: [conversationExampleA],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const singleTurn = report.result.singleTurn['HasContent'];
      expect(singleTurn).toBeDefined();

      // Both responses have content > 5 chars, so scores should be 1
      for (const stepResult of singleTurn.byStepIndex) {
        expect(stepResult).toBeDefined();
        expect(stepResult!.measurement.score).toBe(1);
      }
    });

    it('applies Linear normalization to word count scores', async () => {
      const base = defineBaseMetric({ name: 'wordCount', valueType: 'number' });

      const metric = defineSingleTurnCode({
        base,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          const words = getAssistantContent(step).trim().split(/\s+/);
          return words.length;
        },
        normalization: {
          normalizer: createLinearNormalizer({ slope: 0.1, intercept: 0 }),
        },
      });

      const eval_ = defineSingleTurnEval({
        name: 'WordCount',
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

      const singleTurn = report.result.singleTurn['WordCount'];
      expect(singleTurn).toBeDefined();
      expect(singleTurn.byStepIndex).toHaveLength(3);

      // Verify linear normalization was applied
      for (const stepResult of singleTurn.byStepIndex) {
        expect(stepResult).toBeDefined();
        expect(stepResult!.measurement.score).toBeGreaterThanOrEqual(0);
        // Score = wordCount * 0.1, capped at 1
        expect(stepResult!.measurement.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Multi-turn metrics with normalization', () => {
    it('applies MinMax normalization to conversation length score', async () => {
      const base = defineBaseMetric({ name: 'conversationLength', valueType: 'number' });

      const metric = defineMultiTurnCode({
        base,
        runOnContainer: async (conversation) => conversation,
        compute: async ({ data }) => {
          const conversation = data as typeof conversationExampleA;
          return conversation.steps.length;
        },
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 5 }),
        },
      });

      const eval_ = defineMultiTurnEval({
        name: 'ConversationLength',
        metric,
        verdict: thresholdVerdict(0.3),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const multiTurn = report.result.multiTurn['ConversationLength'];
      expect(multiTurn).toBeDefined();

      // conversationExampleB has 3 steps, normalized with min=0, max=5 => 3/5 = 0.6
      expect(multiTurn.measurement.score).toBe(0.6);
    });

    it('applies Identity normalization (passthrough) to raw scores', async () => {
      const base = defineBaseMetric({ name: 'rawStepCount', valueType: 'number' });

      const metric = defineMultiTurnCode({
        base,
        runOnContainer: async (conversation) => conversation,
        compute: async ({ data }) => {
          const conversation = data as typeof conversationExampleA;
          // Return a value already in 0-1 range
          return conversation.steps.length >= 2 ? 0.9 : 0.5;
        },
        normalization: {
          normalizer: createIdentityNormalizer(),
        },
      });

      const eval_ = defineMultiTurnEval({
        name: 'RawStepCount',
        metric,
        verdict: thresholdVerdict(0.5),
      });

      const tally = createTally({
        data: [conversationExampleA],
        evals: [eval_],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      const multiTurn = report.result.multiTurn['RawStepCount'];
      expect(multiTurn).toBeDefined();

      // Identity normalizer: score should equal raw value
      expect(multiTurn.measurement.score).toBe(0.9);
      expect(multiTurn.measurement.rawValue).toBe(0.9);
    });
  });

  describe('Combined normalization with summaries', () => {
    it('normalizes multiple metrics and computes aggregated summaries', async () => {
      // Metric 1: Response length with MinMax
      const lengthBase = defineBaseMetric({ name: 'responseLength', valueType: 'number' });
      const lengthMetric = defineSingleTurnCode({
        base: lengthBase,
        preProcessor: (step) => step,
        compute: ({ data }) => {
          const step = data as ConversationStep;
          return getAssistantContent(step).length;
        },
        normalization: {
          normalizer: createMinMaxNormalizer({ min: 0, max: 100 }),
        },
      });

      // Metric 2: Conversation progress with Linear
      const progressBase = defineBaseMetric({ name: 'progress', valueType: 'number' });
      const progressMetric = defineMultiTurnCode({
        base: progressBase,
        runOnContainer: async (conversation) => conversation,
        compute: async ({ data }) => {
          const conversation = data as typeof conversationExampleB;
          // Return step completion progress
          return conversation.steps.length;
        },
        normalization: {
          normalizer: createLinearNormalizer({ slope: 0.25, intercept: 0 }),
        },
      });

      const lengthEval = defineSingleTurnEval({
        name: 'ResponseLength',
        metric: lengthMetric,
        verdict: thresholdVerdict(0.2),
      });

      const progressEval = defineMultiTurnEval({
        name: 'Progress',
        metric: progressMetric,
        verdict: thresholdVerdict(0.5),
      });

      const tally = createTally({
        data: [conversationExampleB],
        evals: [lengthEval, progressEval],
      });

      const report = await tally.run();

      expect(report).toBeDefined();

      // Verify summaries exist
      const summaries = report.result.summaries?.byEval ?? {};
      expect(summaries['ResponseLength']).toBeDefined();
      expect(summaries['Progress']).toBeDefined();

      // Check aggregations exist
      const lengthSummary = summaries['ResponseLength'];
      expect(lengthSummary?.aggregations?.score).toBeDefined();

      const progressSummary = summaries['Progress'];
      expect(progressSummary?.aggregations?.score).toBeDefined();
    });
  });
});
