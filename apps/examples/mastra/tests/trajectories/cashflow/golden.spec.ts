/**
 * Cashflow Copilot Agent - Golden Path Test
 *
 * This test is used to evaluate the cashflow copilot agent's ability to manage cashflow successfully.
 * It is a golden path scenario where the user provides complete information and the agent should handle it gracefully.
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
import type { CoreMessage as ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  assertToolCallSequence,
  getTrajectoryTestSkipReason,
  runCase,
  saveTallyReportToStore,
} from '../../utils/harness';
import { getSummaryScoreValue } from '../../utils/summary';
import { cashflowGoldenTrajectory } from './definitions';
import {
  createAffordabilityDecisionMetric,
  createClarificationPrecisionMetric,
  createContextPrecisionMetric,
  createContextRecallMetric,
  createOverClarificationMetric,
} from './metrics';

const skipReason = getTrajectoryTestSkipReason('cashflow-golden');
if (skipReason) {
  console.warn(`Skipping Cashflow Copilot Agent - Golden Path: ${skipReason}`);
}
const describeCashflowGolden = skipReason ? describe.skip : describe;

describeCashflowGolden('Cashflow Copilot Agent - Golden Path', () => {
  it('should manage cashflow successfully', async () => {
    const { cashflowCopilotAgent } = await import(
      '../../../src/mastra/agents/cashflow-copilot-agent'
    );
    const { conversation, mode } = await runCase({
      trajectory: cashflowGoldenTrajectory,
      agent: cashflowCopilotAgent,
      conversationId: 'cashflow-golden',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    // Assert tool call sequences are valid
    for (const step of conversation.steps) {
      try {
        assertToolCallSequence(step);
      } catch (error) {
        // Only fail if there are tool calls but no results
        // Some steps might not have tool calls at all
        const hasToolCalls = step.output.some(
          (msg: ModelMessage) =>
            msg.role === 'assistant' &&
            (Array.isArray(msg.content)
              ? msg.content.some(
                  (p: unknown) =>
                    typeof p === 'object' && p !== null && 'type' in p && p.type === 'tool-call'
                )
              : false)
        );
        if (hasToolCalls) {
          throw error;
        }
      }
    }

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

    // Cashflow-specific metrics
    // Affordability Decision: Agent should make correct affordability decisions
    const affordabilityDecision = createAffordabilityDecisionMetric({
      provider: model,
    });

    // Clarification Precision: Agent should ask for clarification when needed
    const clarificationPrecision = createClarificationPrecisionMetric({
      provider: model,
    });

    const contextPrecision = createContextPrecisionMetric({
      provider: model,
    });

    const contextRecall = createContextRecallMetric({
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
        defineInput({ metric: roleAdherence, weight: 0.15 }),
        defineInput({ metric: affordabilityDecision, weight: 0.2 }),
        defineInput({ metric: clarificationPrecision, weight: 0.1 }),
        defineInput({ metric: overClarification, weight: 0.1 }),
        defineInput({ metric: completeness, weight: 0.05 }),
        defineInput({ metric: contextPrecision, weight: 0.1 }),
        defineInput({ metric: contextRecall, weight: 0.1 }),
      ],
    });

    // Create evals with appropriate pass/fail criteria for golden path
    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.5),
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(3),
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5),
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

    const contextPrecisionEval = defineSingleTurnEval({
      name: 'Context Precision',
      metric: contextPrecision,
      verdict: thresholdVerdict(3.5),
    });

    const contextRecallEval = defineSingleTurnEval({
      name: 'Context Recall',
      metric: contextRecall,
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
        contextPrecisionEval,
        contextRecallEval,
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

    formatReportAsTables(report.toArtifact(), conversation);

    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    console.log('Evaluation Results:');
    console.log(`   Steps evaluated: ${conversation.steps.length}`);
    console.log(
      `   Overall Quality mean: ${overallQualitySummary ? getSummaryScoreValue(overallQualitySummary) : undefined}`
    );

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    // Check mean score
    if (overallQualitySummary) {
      const mean = getSummaryScoreValue(overallQualitySummary);
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.2);
      }
    }
  }, 300000);
});
