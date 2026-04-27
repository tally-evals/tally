import { google } from '@ai-sdk/google';
import {
  type Eval,
  defineBaseMetric,
  defineInput,
  defineMultiTurnEval,
  defineScorerEval,
  defineSingleTurnEval,
  thresholdVerdict,
} from '@tally-evals/tally';
import {
  createAnswerRelevanceMetric,
  createCompletenessMetric,
  createRoleAdherenceMetric,
} from '@tally-evals/tally/metrics';
import { createWeightedAverageScorer } from '@tally-evals/tally/scorers';
import type { LanguageModel } from 'ai';
import {
  createAffordabilityDecisionMetric,
  createClarificationPrecisionMetric,
  createContextPrecisionMetric,
  createContextRecallMetric,
  createOverClarificationMetric,
} from './metrics';

const DEFAULT_MODEL = google('models/gemini-3.1-flash-lite-preview');

export type CreateCashflowGoldenEvalsOptions = {
  provider?: LanguageModel;
};

export function createCashflowGoldenEvals(
  options: CreateCashflowGoldenEvalsOptions = {}
): readonly Eval[] {
  const provider = options.provider ?? DEFAULT_MODEL;

  const answerRelevance = createAnswerRelevanceMetric({
    provider,
  });

  const completeness = createCompletenessMetric({
    provider,
  });

  const roleAdherence = createRoleAdherenceMetric({
    expectedRole:
      'cashflow management assistant that helps users track income, expenses, and manage their financial situation',
    provider,
  });

  const affordabilityDecision = createAffordabilityDecisionMetric({
    provider,
  });

  const clarificationPrecision = createClarificationPrecisionMetric({
    provider,
  });

  const contextPrecision = createContextPrecisionMetric({
    provider,
  });

  const contextRecall = createContextRecallMetric({
    provider,
  });

  const overClarification = createOverClarificationMetric({
    provider,
  });

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

  return [
    defineSingleTurnEval({
      name: 'Answer Relevance',
      metric: answerRelevance,
      verdict: thresholdVerdict(2.5),
    }),
    defineSingleTurnEval({
      name: 'Completeness',
      metric: completeness,
      verdict: thresholdVerdict(3),
    }),
    defineMultiTurnEval({
      name: 'Role Adherence',
      metric: roleAdherence,
      verdict: thresholdVerdict(3.5),
    }),
    defineSingleTurnEval({
      name: 'Affordability Decision',
      metric: affordabilityDecision,
      verdict: thresholdVerdict(3.5),
    }),
    defineSingleTurnEval({
      name: 'Clarification Precision',
      metric: clarificationPrecision,
      verdict: thresholdVerdict(3.5),
    }),
    defineSingleTurnEval({
      name: 'Context Precision',
      metric: contextPrecision,
      verdict: thresholdVerdict(3.5),
    }),
    defineSingleTurnEval({
      name: 'Context Recall',
      metric: contextRecall,
      verdict: thresholdVerdict(3.5),
    }),
    defineSingleTurnEval({
      name: 'Over Clarification',
      metric: overClarification,
      verdict: thresholdVerdict(3.5),
    }),
    defineScorerEval({
      name: 'Overall Quality',
      scorer: qualityScorer,
      verdict: thresholdVerdict(0.5),
    }),
  ] as const;
}
