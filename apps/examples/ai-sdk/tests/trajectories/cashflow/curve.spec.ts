/**
 * Cashflow Agent - Curve Ball Test
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
import { runCase, saveTallyReportToStore } from '../../utils/harness';
import { cashflowCurveTrajectory } from './definitions';
import {
  createClarificationPrecisionMetric,
  createOverClarificationMetric,
} from './metrics';

describe('Cashflow Agent - Curve Ball', () => {
  it('should handle incomplete and changing cashflow details', async () => {
    const { conversation } = await runCase({
      trajectory: cashflowCurveTrajectory,
      agent: cashflowAgent,
      conversationId: 'cashflow-curve',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    const model = google('models/gemini-3.1-flash-lite-preview');
    const answerRelevance = createAnswerRelevanceMetric({ provider: model });
    const completeness = createCompletenessMetric({ provider: model });
    const roleAdherence = createRoleAdherenceMetric({
      expectedRole: 'cashflow planning assistant',
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
        defineInput({ metric: roleAdherence, weight: 0.2 }),
        defineInput({ metric: clarificationPrecision, weight: 0.2 }),
        defineInput({ metric: overClarification, weight: 0.2 }),
      ],
    });

    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.3),
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(1.8),
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(2.8),
    });

    const clarificationPrecisionEval = defineSingleTurnEval({
      name: 'Clarification Precision',
      metric: clarificationPrecision,
      verdict: thresholdVerdict(3),
    });

    const overClarificationEval = defineSingleTurnEval({
      name: 'Over Clarification',
      metric: overClarification,
      verdict: thresholdVerdict(3),
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.45),
    });

    const tally = createTally({
      data: [conversation],
      evals: [
        answerRelevanceEval,
        completenessEval,
        roleAdherenceEval,
        clarificationPrecisionEval,
        overClarificationEval,
        overallQualityEval,
      ],
      context: runAllTargets(),
    });

    const report = await tally.run();
    await saveTallyReportToStore({
      conversationId: 'cashflow-curve',
      report: report.toArtifact(),
    });

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    if (overallQualitySummary) {
      const mean = (overallQualitySummary.aggregations?.score as { mean?: unknown }).mean;
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.25);
      }
    }
  });
});
