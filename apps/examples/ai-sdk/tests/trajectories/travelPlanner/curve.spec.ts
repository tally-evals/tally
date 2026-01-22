/**
 * Travel Planner Agent - Curve Ball Test
 */

import { describe, it, expect } from 'vitest';
import { travelPlannerAgent } from '../../../src/agents/travelPlanner';
import { travelPlannerCurveTrajectory } from './definitions';
import { runCase } from '../../utils/harness';
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

describe('Travel Planner Agent - Curve Ball', () => {
  it('should handle ambiguous requests and changing plans', async () => {
    const { conversation } = await runCase({
      trajectory: travelPlannerCurveTrajectory,
      agent: travelPlannerAgent,
      recordedPath: '_fixtures/recorded/travelPlanner/curve.jsonl',
      conversationId: 'travel-planner-curve',
      generateLogs: true,
    });

    expect(conversation.steps.length).toBeGreaterThan(0);

    const model = google('models/gemini-2.5-flash-lite');

    const answerRelevance = createAnswerRelevanceMetric({
      provider: model,
    });

    const completeness = createCompletenessMetric({
      provider: model,
    });

    const roleAdherence = createRoleAdherenceMetric({
      expectedRole: 'travel planning assistant',
      provider: model,
    });

    const knowledgeRetention = createKnowledgeRetentionMetric({
      provider: model,
      parameters: ['origin', 'destination', 'dates', 'preferences'],
    });

    const overallQuality = defineBaseMetric({
      name: 'overallQuality',
      valueType: 'number',
    });

    const qualityScorer = createWeightedAverageScorer({
      name: 'OverallQuality',
      output: overallQuality,
      inputs: [
        defineInput({ metric: answerRelevance, weight: 0.3 }),
        defineInput({ metric: roleAdherence, weight: 0.25 }),
        defineInput({ metric: knowledgeRetention, weight: 0.25 }),
        defineInput({ metric: completeness, weight: 0.2 }),
      ],
    });

    // Create evals
    const answerRelevanceEval = defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(0.6), // Curve ball: agent should answer questions, but some turns may be questions
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(0.4), // Curve ball: user is uncertain about their preferences, so some turns may be incomplete
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(0.7), // Curve ball: agent should consistently act as travel assistant regardless of user behavior
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(0.5), // Curve ball: even though user's preferences are changing, agent should remember them well
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      inputs: [
        answerRelevance,
        completeness,
        roleAdherence,
        knowledgeRetention,
      ],
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5), // Curve ball: overall quality should be reasonable
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

    formatReportAsTables(report, [conversation]);

    expect(report).toBeDefined();
    expect(report.perTargetResults.length).toBeGreaterThan(0);
    expect(report.evalSummaries.size).toBeGreaterThan(0);

    const overallQualitySummary = report.evalSummaries.get('Overall Quality');
    if (overallQualitySummary) {
      expect(overallQualitySummary.aggregations.mean).toBeGreaterThan(0.4);
    }
  });
});
