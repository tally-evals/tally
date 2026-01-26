/**
 * Demand Letter Agent - Curve Ball Test
 */

import { describe, it, expect } from 'bun:test';
import { demandLetterAgent } from '../../../src/mastra/agents/demand-letter-agent';
import { demandLetterCurveTrajectory } from './definitions';
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

describe('Demand Letter Agent - Curve Ball', () => {
  it('should handle changing inputs and corrections successfully', async () => {
    const { conversation } = await runCase({
      trajectory: demandLetterCurveTrajectory,
      agent: demandLetterAgent,
      conversationId: 'demand-letter-curve',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    // Assert tool call sequences are valid
    for (const step of conversation.steps) {
      try {
        assertToolCallSequence(step);
      } catch (error) {
        // Only fail if there are tool calls but no results
        const hasToolCalls = step.output.some(
          (msg) =>
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

    const model = google('models/gemini-2.5-flash-lite');

    // Create metrics for demand letter evaluation
    
    // Answer Relevance: Agent should answer user questions appropriately
    const answerRelevance = createAnswerRelevanceMetric({
      provider: model,
    });

    // Completeness: Agent should provide complete information when needed
    const completeness = createCompletenessMetric({
      provider: model,
    });

    // Role Adherence: Agent should act as a helpful legal assistant
    const roleAdherence = createRoleAdherenceMetric({
      expectedRole:
        'helpful legal assistant that helps users create demand letters by gathering information step-by-step',
      provider: model,
    });

    // We check if the agent retained the UPDATED information
    const knowledgeRetention = createKnowledgeRetentionMetric({
      provider: model,
      parameters: [
        'recipientName',
        'recipientAddress',
        'senderName',
        'senderAddress',
        'amount',
        'dueDate',
        'description',
        'legalBasis',
      ],
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
        defineInput({ metric: answerRelevance, weight: 0.3 }),
        defineInput({ metric: completeness, weight: 0.2 }),
        defineInput({ metric: roleAdherence, weight: 0.2 }),
        defineInput({ metric: knowledgeRetention, weight: 0.3 }),
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
      verdict: thresholdVerdict(1.5),
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5),
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(3), // Slightly lower threshold for curveball as info changes
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.6), 
    });

    const evaluator = createEvaluator({
      name: 'Demand Letter Agent Quality (Curve Ball)',
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
    await saveTallyReportToStore({ conversationId: 'demand-letter-curve', report: report.toArtifact() });

    formatReportAsTables(report.toArtifact(), conversation);

    expect(report).toBeDefined();
    expect(report.result.stepCount).toBeGreaterThan(0);
    expect(Object.keys(report.result.summaries?.byEval ?? {}).length).toBeGreaterThan(0);

    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    if (overallQualitySummary) {
      const mean = (overallQualitySummary.aggregations?.score as any)?.mean;
      if (typeof mean === 'number') {
        expect(mean).toBeGreaterThan(0.4);
      }
    }
  });
});
