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
import { createTally, formatReportAsTables, runAllTargets } from '@tally-evals/tally';
import type { CoreMessage as ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  assertToolCallSequence,
  getTrajectoryTestSkipReason,
  runCase,
  saveTallyReportToStore,
} from '../../utils/harness';
import { cashflowGoldenTrajectory } from './definitions';
import { createCashflowGoldenEvals } from './evals';

const skipReason = getTrajectoryTestSkipReason('cashflow-golden');
if (skipReason) {
  console.warn(`Skipping Cashflow Copilot Agent - Golden Path: ${skipReason}`);
}
const describeCashflowGolden = skipReason ? describe.skip : describe;

function getSummaryScoreValue(summary: {
  aggregations?: {
    score?: Record<string, unknown>;
  };
}): number | undefined {
  const mean = summary.aggregations?.score?.mean ?? summary.aggregations?.score?.Mean;
  return typeof mean === 'number' ? mean : undefined;
}

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

    const model = google('models/gemini-3-flash-preview');
    const evals = createCashflowGoldenEvals({ provider: model });

    const tally = createTally({
      data: [conversation],
      evals,
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
