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

import { describe, it, expect } from 'vitest';
import { cashflowCopilotAgent } from '../../../src/mastra/agents/cashflow-copilot-agent';
import { cashflowCurveTrajectory } from './definitions';
import { runCase, saveTallyReportToStore } from '../../utils/harness';
import {
  createTally,
  runAllTargets,
  defineBaseMetric,
  defineInput,
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
  thresholdVerdict,
  formatReportAsTables,
} from '@tally-evals/tally';
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
  createClarificationPrecisionMetric,
  createOverClarificationMetric,
  createBufferConsiderationMetric,
  createImpactReportingMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';

describe('Cashflow Copilot Agent - Curve Ball', () => {
  it('should handle ambiguous requests and incomplete information', async () => {
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

    const model = google('models/gemini-2.5-flash-lite');

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

    // Buffer Consideration: Agent should reference safety buffer/commitments in answers
    // (e.g. step-10 asks about buying a car — agent should factor in upcoming bills)
    const bufferConsideration = createBufferConsiderationMetric({
      provider: model,
    });

    // Impact Reporting: Agent should quantify scenario impact when answering what-ifs
    // (e.g. step-10 asks whether a 100k car purchase causes a deficit)
    const impactReporting = createImpactReportingMetric({
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
        defineInput({ metric: bufferConsideration, weight: 0.1 }),
        defineInput({ metric: impactReporting, weight: 0.1 }),
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

    const bufferConsiderationEval = defineSingleTurnEval({
      name: 'Buffer Consideration',
      metric: bufferConsideration,
      verdict: thresholdVerdict(0.4), // Lower threshold: user setup is incomplete
    });

    const impactReportingEval = defineSingleTurnEval({
      name: 'Impact Reporting',
      metric: impactReporting,
      verdict: thresholdVerdict(0.4), // Lower threshold: curveball scenario
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
        bufferConsiderationEval,
        impactReportingEval,
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
      `   Overall Quality mean: ${(overallQualitySummary?.aggregations?.score as any)?.Mean}`,
    );

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    // Check mean score (lower threshold for curveball)
    if (overallQualitySummary) {
      const mean = (overallQualitySummary.aggregations?.score as any)?.Mean;
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.15);
      }
    }
  }, 300000);
});

