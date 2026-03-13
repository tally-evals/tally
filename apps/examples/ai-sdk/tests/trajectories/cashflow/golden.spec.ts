/**
 * Cashflow Agent - Golden Path Test
 */

import { describe, expect, it } from 'bun:test';
import { google } from '@ai-sdk/google';
import {
  createTally,
  defineBaseMetric,
  defineInput,
  defineMultiTurnEval,
  defineScorerEval,
  defineSingleTurnEval,
  runAllTargets,
  thresholdVerdict,
} from '@tally-evals/tally';
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { cashflowAgent } from '../../../src/agents/cashflow';
import { assertToolCallSequence, runCase, saveTallyReportToStore } from '../../utils/harness';
import { cashflowGoldenTrajectory } from './definitions';
import {
  createAffordabilityDecisionMetric,
  createClarificationPrecisionMetric,
  createOverClarificationMetric,
} from './metrics';

describe('Cashflow Agent - Golden Path', () => {
  it('should set up and project cashflow successfully', async () => {
    const { conversation, mode } = await runCase({
      trajectory: cashflowGoldenTrajectory,
      agent: cashflowAgent,
      conversationId: 'cashflow-golden',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    for (const step of conversation.steps) {
      try {
        assertToolCallSequence(step);
      } catch (error) {
        const hasToolCalls = step.output.some((msg: unknown) => {
          if (!msg || typeof msg !== 'object') return false;
          if (!('role' in msg) || (msg as { role?: unknown }).role !== 'assistant') return false;
          const content = (msg as { content?: unknown }).content;
          if (!Array.isArray(content)) return false;
          return content.some(
            (p: unknown) =>
              typeof p === 'object' &&
              p !== null &&
              'type' in p &&
              (p as { type?: unknown }).type === 'tool-call'
          );
        });
        if (hasToolCalls) {
          throw error;
        }
      }
    }

    if (mode === 'record') {
      console.log(`Recording complete: ${conversation.steps.length} steps`);
      return;
    }

    const model = google('models/gemini-3.1-flash-lite-preview');
    const answerRelevance = createAnswerRelevanceMetric({ provider: model });
    const completeness = createCompletenessMetric({ provider: model });
    const roleAdherence = createRoleAdherenceMetric({
      expectedRole: 'cashflow planning assistant',
      provider: model,
    });
    const affordabilityDecision = createAffordabilityDecisionMetric({
      provider: model,
    });
    const clarificationPrecision = createClarificationPrecisionMetric({
      provider: model,
    });
    const overClarification = createOverClarificationMetric({
      provider: model,
    });
    const overallQuality = defineBaseMetric<number>({
      name: 'overallQuality',
      valueType: 'number',
    });

    const qualityScorer = createWeightedAverageScorer({
      name: 'OverallQuality',
      output: overallQuality,
      inputs: [
        defineInput({ metric: answerRelevance, weight: 0.2 }),
        defineInput({ metric: roleAdherence, weight: 0.15 }),
        defineInput({ metric: affordabilityDecision, weight: 0.2 }),
        defineInput({ metric: clarificationPrecision, weight: 0.1 }),
        defineInput({ metric: overClarification, weight: 0.1 }),
        defineInput({ metric: completeness, weight: 0.05 }),
      ],
    });

    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.5),
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(2),
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3),
    });

    const affordabilityDecisionEval = defineSingleTurnEval({
      name: 'Affordability Decision',
      metric: affordabilityDecision,
      verdict: thresholdVerdict(3.5),
    });

    const clarificationPrecisionEval = defineSingleTurnEval({
      name: 'Clarification Precision',
      metric: clarificationPrecision,
      verdict: thresholdVerdict(3.5),
    });

    const overClarificationEval = defineSingleTurnEval({
      name: 'Over Clarification',
      metric: overClarification,
      verdict: thresholdVerdict(3.5),
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5),
    });

    const tally = createTally({
      data: [conversation],
      evals: [
        answerRelevanceEval,
        completenessEval,
        roleAdherenceEval,
        affordabilityDecisionEval,
        clarificationPrecisionEval,
        overClarificationEval,
        overallQualityEval,
      ],
      context: runAllTargets(),
    });

    const report = await tally.run();
    await saveTallyReportToStore({
      conversationId: 'cashflow-golden',
      report: report.toArtifact(),
    });

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    if (overallQualitySummary) {
      const mean = (overallQualitySummary.aggregations?.score as { mean?: unknown }).mean;
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.3);
      }
    }
  });
});
