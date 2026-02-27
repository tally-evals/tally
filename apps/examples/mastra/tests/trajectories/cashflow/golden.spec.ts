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

import { describe, it, expect } from 'vitest';
import { cashflowCopilotAgent } from '../../../src/mastra/agents/cashflow-copilot-agent';
import { cashflowGoldenTrajectory } from './definitions';
import { runCase, assertToolCallSequence, saveTallyReportToStore } from '../../utils/harness';
import type { CoreMessage as ModelMessage } from 'ai';
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
  createAffordabilityDecisionMetric,
  createClarificationPrecisionMetric,
  createOverClarificationMetric,
  createBufferConsiderationMetric,
  createImpactReportingMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';

describe('Cashflow Copilot Agent - Golden Path', () => {
  it('should manage cashflow successfully', async () => {
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
                    typeof p === 'object' &&
                    p !== null &&
                    'type' in p &&
                    p.type === 'tool-call',
                )
              : false),
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

    // Cashflow-specific metrics
    // Affordability Decision: Agent should make correct affordability decisions
    const affordabilityDecision = createAffordabilityDecisionMetric({
      provider: model,
    });

    // Clarification Precision: Agent should ask for clarification when needed
    const clarificationPrecision = createClarificationPrecisionMetric({
      provider: model,
    });

    // Over Clarification: Agent should not ask for information already provided
    const overClarification = createOverClarificationMetric({
      provider: model,
    });

    // Buffer Consideration: Agent should mention safety buffer and upcoming commitments
    // when answering affordability questions (e.g. step-8 requests a 20k buffer projection)
    const bufferConsideration = createBufferConsiderationMetric({
      provider: model,
    });

    // Impact Reporting: Agent should report quantified impact for what-if scenarios
    // (e.g. step-9 asks about a 50k emergency expense)
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
        defineInput({ metric: roleAdherence, weight: 0.15 }),
        defineInput({ metric: affordabilityDecision, weight: 0.2 }),
        defineInput({ metric: clarificationPrecision, weight: 0.1 }),
        defineInput({ metric: overClarification, weight: 0.1 }),
        defineInput({ metric: completeness, weight: 0.05 }),
        defineInput({ metric: bufferConsideration, weight: 0.1 }),
        defineInput({ metric: impactReporting, weight: 0.1 }),
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

    const overClarificationEval = defineSingleTurnEval({
      name: 'Over Clarification',
      metric: overClarification,
      verdict: thresholdVerdict(3.5),
    });

    const bufferConsiderationEval = defineSingleTurnEval({
      name: 'Buffer Consideration',
      metric: bufferConsideration,
      verdict: thresholdVerdict(0.5),
    });

    const impactReportingEval = defineSingleTurnEval({
      name: 'Impact Reporting',
      metric: impactReporting,
      verdict: thresholdVerdict(0.5),
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
        bufferConsiderationEval,
        impactReportingEval,
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
      `   Overall Quality mean: ${(overallQualitySummary?.aggregations?.score as any)?.Mean}`,
    );

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    // Check mean score
    if (overallQualitySummary) {
      const mean = (overallQualitySummary.aggregations?.score as any)?.Mean;
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.2);
      }
    }
  }, 300000);
});

