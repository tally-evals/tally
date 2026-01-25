/**
 * Travel Planner Agent - Golden Path Test
 */

import { describe, it, expect } from 'bun:test';
import { travelPlannerAgent } from '../../../src/agents/travelPlanner';
import { travelPlannerGoldenTrajectory } from './definitions';
import {
  runCase,
  assertToolCallSequence,
  saveTallyReportToStore,
} from '../../utils/harness';
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
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import { google } from '@ai-sdk/google';
import { createKnowledgeRetentionMetric } from './metrics';
import { createPercentileAggregator } from '@tally-evals/tally/aggregators';

describe('Travel Planner Agent - Golden Path', () => {
  it('should plan trip successfully', async () => {
    const { conversation, mode } = await runCase({
      trajectory: travelPlannerGoldenTrajectory,
      agent: travelPlannerAgent,
      conversationId: 'travel-planner-golden',
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
        const hasToolCalls = step.output.some((msg: unknown) => {
          if (!msg || typeof msg !== 'object') return false;
          if (
            !('role' in msg) ||
            (msg as { role?: unknown }).role !== 'assistant'
          )
            return false;
          const content = (msg as { content?: unknown }).content;
          if (!Array.isArray(content)) return false;
          return content.some(
            (p: unknown) =>
              typeof p === 'object' &&
              p !== null &&
              'type' in p &&
              (p as { type?: unknown }).type === 'tool-call',
          );
        });
        if (hasToolCalls) {
          throw error;
        }
      }
    }

    // In record mode, skip evaluation assertions (agent output varies)
    if (mode === 'record') {
      console.log(`✅ Recording complete: ${conversation.steps.length} steps`);
      return;
    }

    const model = google('models/gemini-2.5-flash-lite');

    // Create metrics for travel planner evaluation
    // Answer Relevance: Agent should answer user questions appropriately
    const answerRelevance = createAnswerRelevanceMetric({
      provider: model,
      aggregators: [
        createPercentileAggregator({
          percentile: 67,
          description: '67th percentile of the answer relevance metric',
        }),
      ],
    });

    // Completeness: Agent should provide complete information when needed
    // For travel planning, we expect the agent to gather necessary details
    const completeness = createCompletenessMetric({
      provider: model,
    });

    // Role Adherence: Agent should act as a helpful travel planning assistant
    const roleAdherence = createRoleAdherenceMetric({
      expectedRole:
        'travel planning assistant that helps users find flights, accommodations, and travel information',
      provider: model,
    });

    const knowledgeRetention = createKnowledgeRetentionMetric({
      provider: model,
      parameters: ['origin', 'destination', 'dates', 'preferences'],
    });

    // Overall Quality: Combined score of all metrics
    const overallQuality = defineBaseMetric<number>({
      name: 'overallQuality',
      valueType: 'number',
    });

    const qualityScorer = createWeightedAverageScorer({
      name: 'OverallQuality',
      output: overallQuality,
      inputs: [
        defineInput({ metric: answerRelevance, weight: 0.3 }), // Most important: agent must answer questions
        defineInput({ metric: roleAdherence, weight: 0.3 }), // Important: agent must act as travel assistant
        defineInput({ metric: knowledgeRetention, weight: 0.25 }), // Knowledge retention is important for long-term success
        defineInput({ metric: completeness, weight: 0.15 }), // Less critical: completeness varies by turn
      ],
    });

    // Create evals with appropriate pass/fail criteria for golden path
    // Golden path expectations (adjusted based on realistic performance):
    // - Answer Relevance: 0.5+ (agent should answer questions, but some turns may be questions)
    // - Completeness: 0.3+ (some turns may be incomplete when agent asks clarifying questions)
    // - Role Adherence: 0.7+ (agent should consistently act as travel assistant)
    // - Overall Quality: 0.5+ (combined score should be reasonable for golden path)
    // - Knowledge Retention: 0.7+ (agent should remember the user's preferences well since they are unchanging)

    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.5), // Golden path: agent should answer questions, but some turns may be questions
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(2), // Lower threshold: agent asks questions, so some turns are incomplete
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5), // Golden path: agent should consistently act as travel assistant
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(3.0), // Golden path: expect decent retention (normalized >= 0.6)
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5), // Golden path: overall quality should be reasonable
    });

    const tally = createTally({
      data: [conversation],
      evals: [
        answerRelevanceEval,
        completenessEval,
        roleAdherenceEval,
        knowledgeRetentionEval,
        overallQualityEval,
      ],
      context: runAllTargets(),
    });

    const report = await tally.run({
      llmOptions: {
        temperature: 0,
        maxRetries: 2,
      },
    });
    await saveTallyReportToStore({
      conversationId: 'travel-planner-golden',
      report: report.toArtifact(),
    });

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(
      Object.keys(report.result.summaries?.byEval ?? {}).length,
    ).toBeGreaterThan(0);

    // Format and display report as tables
    formatReportAsTables(report.toArtifact(), conversation);

    // Using the new type-safe view API
    const view = report.view();
    
    // Access summary via view (type-safe with autocomplete)
    const answerRelevanceSummary = view.summary()?.['Answer Relevance'];
    console.log(`Answer Relevance P95: ${answerRelevanceSummary?.aggregations?.score.P95}`);

    // Iterate steps using the generator
    for (const step of view.steps()) {
      const relevance = step['Answer Relevance'];
      if (relevance?.outcome) {
        console.log(`Step ${step.index}: Answer Relevance verdict = ${relevance.outcome.verdict}`);
      }
    }

    // Access conversation-level results (type-safe)
    const conversationResults = view.conversation();

    // Overall Quality: Should pass for golden path (score >= 0.6)
    const overallQualityResult = conversationResults['Overall Quality'];
    if (overallQualityResult?.outcome) {
      expect(overallQualityResult.outcome.verdict).toBe('pass');
      const s = overallQualityResult.measurement.score;
      if (typeof s === 'number') expect(s).toBeGreaterThanOrEqual(0.6);
    }

    // Role Adherence: Should pass for golden path (score >= 0.7)
    const roleAdherenceResult = conversationResults['Role Adherence'];
    if (roleAdherenceResult?.outcome) {
      expect(roleAdherenceResult.outcome.verdict).toBe('pass');
      const s = roleAdherenceResult.measurement.score;
      if (typeof s === 'number') expect(s).toBeGreaterThanOrEqual(0.7);
    }

    // Knowledge Retention: Should pass for golden path (score >= 0.6)
    const knowledgeRetentionResult = conversationResults['Knowledge Retention'];
    if (knowledgeRetentionResult?.outcome) {
      expect(knowledgeRetentionResult.outcome.verdict).toBe('pass');
      const s = knowledgeRetentionResult.measurement.score;
      if (typeof s === 'number') expect(s).toBeGreaterThanOrEqual(0.6);
    }

    const overallQualitySummary =
      report.result.summaries?.byEval?.['Overall Quality'];
    const mean = overallQualitySummary?.aggregations?.score.Mean;
    if (typeof mean === 'number') expect(mean).toBeGreaterThanOrEqual(0.6);
  }, 300000); // 5 minute timeout for trajectory execution
});
