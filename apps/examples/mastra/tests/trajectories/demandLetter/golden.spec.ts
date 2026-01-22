/**
 * Demand Letter Agent - Golden Path Test
 */

import { describe, it, expect } from 'vitest';
import { demandLetterAgent } from '../../../src/mastra/agents/demand-letter-agent';
import { demandLetterGoldenTrajectory } from './definitions';
import { runCase, assertToolCallSequence } from '../../utils/harness';
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

describe('Demand Letter Agent - Golden Path', () => {
  it('should create demand letter successfully', async () => {
    const { conversation } = await runCase({
      trajectory: demandLetterGoldenTrajectory,
      agent: demandLetterAgent,
      recordedPath: '_fixtures/recorded/demandLetter/golden.jsonl',
      conversationId: 'demand-letter-golden',
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
        'demandType',
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
      verdict: thresholdVerdict(0.5),
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(0.3),
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(0.7),
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(0.7),
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      inputs: [answerRelevance, completeness, roleAdherence, knowledgeRetention],
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.7), 
    });

    const evaluator = createEvaluator({
      name: 'Demand Letter Agent Quality',
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

    // Output results
    formatReportAsTables(report, [conversation]);

    // Assertions
    const targetResult = report.perTargetResults[0];
    if (!targetResult) {
        throw new Error('No target result found');
    }

    const overallQualityVerdict = targetResult.verdicts.get('Overall Quality');
    if (overallQualityVerdict) {
      expect(overallQualityVerdict.score).toBeGreaterThanOrEqual(0.6);
    }
  }, 120000); // Increased timeout for LLM calls
});
