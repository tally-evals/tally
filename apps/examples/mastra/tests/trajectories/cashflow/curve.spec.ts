/**
 * Cashflow Copilot Agent - Curve Ball Test
 *
 * This test is used to evaluate the cashflow copilot agent's ability to handle ambiguous requests and incomplete information.
 * It is a curveball scenario where the user provides incomplete information and the agent should handle it gracefully.
 * It is also used to evaluate the agent's ability to ask for the right missing information and not ask for information already provided.
 * It is also used to evaluate the agent's ability to follow the role of a cashflow management assistant.
 * It is also used to evaluate the agent's ability to handle the context of the conversation.
 * It is also used to evaluate the agent's ability to handle the user's intent.
 * It is also used to evaluate the agent's ability to handle the user's language.
 */

import { google } from '@ai-sdk/google';
import {
  createTally,
  defineBaseMetric,
  defineInput,
  defineMultiTurnEval,
  defineScorerEval,
  defineSingleTurnEval,
  formatReportAsTables,
  runAllTargets,
  thresholdVerdict,
} from '@tally-evals/tally';
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { describe, expect, it } from 'vitest';
import {
  getTrajectoryTestSkipReason,
  runCase,
  saveTallyReportToStore,
} from '../../utils/harness';
import { getSummaryScoreValue } from '../../utils/summary';
import { cashflowCurveTrajectory } from './definitions';
import {
  createClarificationPrecisionMetric,
  createOverClarificationMetric,
} from './metrics';

const skipReason = getTrajectoryTestSkipReason('cashflow-curve');
if (skipReason) {
  console.warn(`Skipping Cashflow Copilot Agent - Curve Ball: ${skipReason}`);
}
const describeCashflowCurve = skipReason ? describe.skip : describe;

describeCashflowCurve('Cashflow Copilot Agent - Curve Ball', () => {
  it('should handle ambiguous requests and incomplete information', async () => {
    const { cashflowCopilotAgent } = await import(
      '../../../src/mastra/agents/cashflow-copilot-agent'
    );
    const { conversation, mode } = await runCase({
      trajectory: cashflowCurveTrajectory,
      agent: cashflowCopilotAgent,
      conversationId: 'cashflow-curve',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    // In record mode, skip evaluation assertions (agent output varies)
    if (mode === 'record') {
      console.log(`Recording complete: ${conversation.steps.length} steps`);
      return;
    }

    const model = google('models/gemini-3.1-flash-lite-preview');

    // General metrics
    const answerRelevance = createAnswerRelevanceMetric({
      provider: model,
    });

    const completeness = createCompletenessMetric({
      provider: model,
    });

    const roleAdherence = createRoleAdherenceMetric({
      expectedRole:
        'cashflow management assistant that helps users track income, expenses, and manage their financial situation',
      provider: model,
    });

    // Cashflow-specific metrics for curveball scenarios
    // Clarification Precision: Agent should ask for the right missing information
    // Note: These metrics work with metadata attached to conversation steps
    // For curveball scenarios, we evaluate general behavior
    const clarificationPrecision = createClarificationPrecisionMetric({
      provider: model,
    });

    // Over Clarification: Agent should not ask for information already provided
    const overClarification = createOverClarificationMetric({
      provider: model,
    });

    // Overall Quality: Combined score of all metrics
    const overallQuality = defineBaseMetric({
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

    // Create evals with adjusted thresholds for curveball scenarios
    // Curveball expectations: agent should handle ambiguity gracefully
    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.5), // Lower threshold: user provides incomplete info
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(2), // Lower threshold: user is uncertain
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5), // Agent should still act as cashflow assistant
    });

    const clarificationPrecisionEval = defineSingleTurnEval({
      name: 'Clarification Precision',
      metric: clarificationPrecision,
      verdict: thresholdVerdict(3), // Agent should ask for right missing info
    });

    const overClarificationEval = defineSingleTurnEval({
      name: 'Over Clarification',
      metric: overClarification,
      verdict: thresholdVerdict(3), // Agent should not ask for info already provided
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.4), // Lower threshold: curveball scenario
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

    formatReportAsTables(report.toArtifact(), conversation);

    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    console.log('📊 Evaluation Results:');
    console.log(`   Steps evaluated: ${conversation.steps.length}`);
    console.log(
      `   Overall Quality mean: ${overallQualitySummary ? getSummaryScoreValue(overallQualitySummary) : undefined}`
    );

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    // Check mean score (lower threshold for curveball)
    if (overallQualitySummary) {
      const mean = getSummaryScoreValue(overallQualitySummary);
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.15);
      }
    }
  }, 300000);
});
