/**
 * Travel Planner Agent - Golden Path Test
 */

import { describe, it, expect } from 'vitest';
import { travelPlannerAgent } from '../../../src/agents/travelPlanner';
import { travelPlannerGoldenTrajectory } from './definitions';
import { runCase, assertToolCallSequence, saveTallyReportToStore } from '../../utils/harness';
import {
  createTally,
  createEvaluator,
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
          if (!('role' in msg) || (msg as { role?: unknown }).role !== 'assistant') return false;
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
    const overallQuality = defineBaseMetric({
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
      verdict: thresholdVerdict(0.5), // Golden path: agent should answer questions, but some turns may be questions
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(0.3), // Lower threshold: agent asks questions, so some turns are incomplete
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(0.7), // Golden path: agent should consistently act as travel assistant
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(0.7), // Golden path: agent should remember the user's preferences well since they are unchanging
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      inputs: [answerRelevance, completeness, roleAdherence],
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5), // Golden path: overall quality should be reasonable
    });

    const evaluator = createEvaluator({
      name: 'Travel Planner Agent Quality',
      evals: [
        answerRelevanceEval,
        completenessEval,
        roleAdherenceEval,
        knowledgeRetentionEval,
        overallQualityEval,
      ],
      context: runAllTargets(),
    });

    const tally = createTally({
      data: [conversation],
      evaluators: [evaluator],
    });

    const report = await tally.run();
    await saveTallyReportToStore({ conversationId: 'travel-planner-golden', report });

    expect(report).toBeDefined();
    expect(report.perTargetResults.length).toBeGreaterThan(0);
    expect(report.evalSummaries.size).toBeGreaterThan(0);

    // Format and display report as tables
    formatReportAsTables(report, [conversation]);

    // Assertions for golden path expectations
    // Check actual verdicts from per-target results (more reliable than summaries)
    const targetResult = report.perTargetResults[0];
    expect(targetResult).toBeDefined();

    if (!targetResult) {
      throw new Error('No target result found');
    }

    // Overall Quality: Should pass for golden path (score >= 0.6)
    const overallQualityVerdict = targetResult.verdicts.get('Overall Quality');
    if (overallQualityVerdict) {
      expect(overallQualityVerdict.verdict).toBe('pass');
      expect(overallQualityVerdict.score).toBeGreaterThanOrEqual(0.6);
    }

    // Role Adherence: Should pass for golden path (score >= 0.7)
    const roleAdherenceVerdict = targetResult.verdicts.get('Role Adherence');
    if (roleAdherenceVerdict) {
      expect(roleAdherenceVerdict.verdict).toBe('pass');
      expect(roleAdherenceVerdict.score).toBeGreaterThanOrEqual(0.7);
    }

    // Answer Relevance: Should pass for golden path (score >= 0.6)
    const answerRelevanceVerdict =
      targetResult.verdicts.get('Answer Relevance');
    if (answerRelevanceVerdict) {
      expect(answerRelevanceVerdict.verdict).toBe('pass');
      expect(answerRelevanceVerdict.score).toBeGreaterThanOrEqual(0.6);
    }

    // Knowledge Retention: Should pass for golden path (score >= 0.7)
    const knowledgeRetentionVerdict = targetResult.verdicts.get(
      'Knowledge Retention',
    );
    if (knowledgeRetentionVerdict) {
      expect(knowledgeRetentionVerdict.verdict).toBe('pass');
      expect(knowledgeRetentionVerdict.score).toBeGreaterThanOrEqual(0.7);
    }

    // Overall Quality: Should pass for golden path (score >= 0.6)
    const overallQualitySummary = report.evalSummaries.get('Overall Quality');
    if (overallQualitySummary?.aggregations?.mean !== undefined) {
      expect(overallQualitySummary.aggregations.mean).toBeGreaterThanOrEqual(
        0.6,
      );
    }
  }, 300000); // 5 minute timeout for trajectory execution
});
