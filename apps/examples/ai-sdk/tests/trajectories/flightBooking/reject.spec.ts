/**
 * Flight Booking Agent — HIL Rejection Test
 *
 * Verifies that:
 *  1. The agent calls `searchFlights` to find options
 *  2. The agent calls `bookFlight` (which has `needsApproval: true`)
 *  3. Tally's HIL orchestrator intercepts the approval request and
 *     REJECTS it according to the trajectory's `hil` config
 *  4. The agent gracefully handles the rejection and informs the user
 */

import { describe, it, expect } from 'bun:test';
import { flightBookingAgent } from '../../../src/agents/flightBooking';
import { flightBookingRejectTrajectory } from './definitions';
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
} from '@tally-evals/tally';
import {
  createAnswerRelevanceMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';

describe('Flight Booking Agent — HIL Rejection', () => {
  it('should handle booking rejection gracefully and inform the user', async () => {
    const { conversation, mode } = await runCase({
      trajectory: flightBookingRejectTrajectory,
      agent: flightBookingAgent,
      conversationId: 'flight-booking-reject',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    // -----------------------------------------------------------------
    // Structural assertions — verify tool calls appear in the transcript
    // -----------------------------------------------------------------

    // Gather all tool names called across steps.
    // HIL tools with needsApproval:true are stored as tool-result messages
    // in role:'tool' messages (the approval-request intermediate message is
    // consolidated into the resolved result by the orchestrator).
    // We therefore scan ALL message types, not just assistant messages.
    const toolsUsed = new Set<string>();
    for (const step of conversation.steps) {
      for (const msg of step.output) {
        if (!msg || typeof msg !== 'object') continue;
        const content = (msg as { content?: unknown }).content;
        if (!Array.isArray(content)) continue;
        for (const part of content) {
          if (!part || typeof part !== 'object') continue;
          const type = (part as { type?: unknown }).type;
          // tool-call: regular tool call in assistant message
          // tool-approval-request: HIL call (before approval) in assistant message
          // tool-result: completed tool call (in tool message) — includes HIL results
          if (
            type === 'tool-call' ||
            type === 'tool-approval-request' ||
            type === 'tool-result'
          ) {
            const name = (part as { toolName?: string }).toolName;
            if (name) toolsUsed.add(name);
          }
        }
      }
    }

    console.log('🔧 Tools used:', [...toolsUsed].join(', '));

    // The agent must have searched for flights
    expect(toolsUsed.has('searchFlights')).toBe(true);

    // The agent must have attempted to book (received a rejection)
    expect(toolsUsed.has('bookFlight')).toBe(true);

    // -----------------------------------------------------------------
    // Verify the agent communicated the rejection to the user.
    // The rejection reason includes "verification" or "declined" —
    // the agent should relay this across the conversation.
    // -----------------------------------------------------------------
    const allAgentText = conversation.steps
      .flatMap((step) => step.output)
      .filter((m: unknown) => (m as { role?: unknown })?.role === 'assistant')
      .flatMap((m: unknown) => {
        const content = (m as { content?: unknown }).content;
        if (!Array.isArray(content)) return [];
        return content
          .filter((p: unknown) => (p as { type?: unknown })?.type === 'text')
          .map((p: unknown) => (p as { text: string }).text);
      })
      .join(' ')
      .toLowerCase();

    console.log('\n💬 Conversation text (excerpt):', allAgentText.slice(0, 400));

    // The agent should communicate that the booking didn't go through
    const mentionsRejection =
      allAgentText.includes('declined') ||
      allAgentText.includes('not approved') ||
      allAgentText.includes('unable to book') ||
      allAgentText.includes('could not book') ||
      allAgentText.includes("wasn't able") ||
      allAgentText.includes("wasn't") ||
      allAgentText.includes('verification') ||
      allAgentText.includes('unsuccessful') ||
      allAgentText.includes('unfortunately') ||
      allAgentText.includes('issue') ||
      allAgentText.includes('sorry');

    expect(mentionsRejection).toBe(true);

    // -----------------------------------------------------------------
    // Evals (skipped in record mode)
    // -----------------------------------------------------------------
    if (mode === 'record') {
      console.log(`✅ Recording complete: ${conversation.steps.length} steps`);
      return;
    }

    const model = google('models/gemini-2.5-flash-lite');

    // Metrics
    const answerRelevance = createAnswerRelevanceMetric({ provider: model });
    const roleAdherence = createRoleAdherenceMetric({ provider: model });

    const overallQuality = defineBaseMetric<number>({
      name: 'overallQuality',
      valueType: 'number',
    });

    const qualityScorer = createWeightedAverageScorer({
      name: 'Overall Quality',
      output: overallQuality,
      inputs: [
        defineInput({ metric: answerRelevance, weight: 0.5 }),
        defineInput({ metric: roleAdherence, weight: 0.5 }),
      ],
    });

    // Evals
    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5),
    });

    const tally = createTally({
      data: [conversation],
      evals: [answerRelevanceEval, roleAdherenceEval, overallQualityEval],
      context: runAllTargets(),
    });

    const report = await tally.run();
    await saveTallyReportToStore({
      conversationId: 'flight-booking-reject',
      report: report.toArtifact(),
    });

    console.log('\n📊 Evaluation Results:');
    console.log(`   Steps evaluated: ${conversation.steps.length}`);
    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    if (overallQualitySummary) {
      console.log(`   Overall Quality mean: ${overallQualitySummary.aggregations?.score?.Mean}`);
    }

    // Validate overall quality using the view API
    const view = report.view();
    const conversationResults = view.conversation();
    const overallQualityResult = conversationResults['Overall Quality'];
    if (overallQualityResult?.outcome) {
      expect(overallQualityResult.outcome.verdict).toBe('pass');
    }
  });
});
