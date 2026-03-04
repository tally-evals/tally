/**
 * Travel Planner Agent - Curve Ball Test
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
import { describe, expect, it } from 'vitest';
import { travelPlannerAgent } from '../../../src/mastra/agents/travel-planner-agent';
import { getTrajectoryTestSkipReason, runCase, saveTallyReportToStore } from '../../utils/harness';
import { getSummaryScoreValue } from '../../utils/summary';
import { travelPlannerCurveTrajectory } from './definitions';
import { createKnowledgeRetentionMetric } from './metrics';

const skipReason = getTrajectoryTestSkipReason('travel-planner-curve');
if (skipReason) {
  console.warn(`Skipping Travel Planner Agent - Curve Ball: ${skipReason}`);
}
const describeTravelPlannerCurve = skipReason ? describe.skip : describe;

describeTravelPlannerCurve('Travel Planner Agent - Curve Ball', () => {
  it('should handle ambiguous requests and changing plans', async () => {
    const { conversation } = await runCase({
      trajectory: travelPlannerCurveTrajectory,
      agent: travelPlannerAgent,
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
      verdict: thresholdVerdict(3), // Curve ball: agent should answer questions, but some turns may be questions
    });

    const completenessEval = defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(2), // Curve ball: user is uncertain about their preferences, so some turns may be incomplete
    });

    const roleAdherenceEval = defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5), // Curve ball: agent should consistently act as travel assistant regardless of user behavior
    });

    const knowledgeRetentionEval = defineMultiTurnEval({
      name: 'Knowledge Retention',
      metric: knowledgeRetention,
      verdict: thresholdVerdict(2.5), // Curve ball: even though user's preferences are changing, agent should remember them well
    });

    const overallQualityEval = defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5), // Curve ball: overall quality should be reasonable
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

    const report = await tally.run();
    await saveTallyReportToStore({
      conversationId: 'travel-planner-curve',
      report: report.toArtifact(),
    });

    formatReportAsTables(report.toArtifact(), conversation);

    // Debug output
    const overallQualitySummary = report.result.summaries?.byEval?.['Overall Quality'];
    console.log('📊 Evaluation Results:');
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
