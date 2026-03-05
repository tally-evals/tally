/**
 * Cashflow Response Relevance Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant stays focused on
 * the user's cashflow planning task and responds with financially relevant information.
 *
 * Useful for detecting answers that are generally conversationally relevant but miss
 * key cashflow concerns like affordability, timing, savings goals, or requested scope.
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { defineBaseMetric, defineSingleTurnLLM } from '../../core/primitives';
import { createMinMaxNormalizer } from '../../normalizers/factories';
import { extractInputOutput } from '../common/utils';

export interface CashflowRelevanceMetadata {
  /**
   * Optional key cashflow topics that should appear in a relevant answer.
   */
  expectedTopics?: string[];
  /**
   * Optional topics the assistant should avoid over-focusing on.
   */
  irrelevantTopics?: string[];
}

export interface CashflowRelevanceOptions {
  /**
   * LLM provider for evaluation.
   */
  provider: LanguageModel;
}

export function createCashflowRelevanceMetric(
  options: CashflowRelevanceOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider } = options;

  const base = defineBaseMetric({
    name: 'cashflowRelevance',
    valueType: 'number',
    description:
      'Measures whether the assistant stays focused on the user cashflow task and addresses the relevant financial concerns',
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected: DatasetItem) => {
      const { input, output } = extractInputOutput(selected);
      const metadata = selected.metadata as CashflowRelevanceMetadata | undefined;

      return {
        input,
        output,
        expectedTopics: (metadata?.expectedTopics ?? []).join(', '),
        irrelevantTopics: (metadata?.irrelevantTopics ?? []).join(', '),
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant response is relevant to a user's cashflow planning task.

User Input:
{{input}}

Assistant Response:
{{output}}

Expected Cashflow Topics:
{{expectedTopics}}

Potentially Irrelevant Topics:
{{irrelevantTopics}}

Evaluate whether the assistant stayed focused on the user's financial task.

Relevant responses should primarily address things like:
- balances, income, expenses, budgets, bills
- savings goals or affordability
- timing of expenses or purchases
- requested projection scope or planning horizon

Irrelevant responses drift into unrelated discussion or fail to address the financial task.

Use the rubric below and provide a score from 0 to 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Direct relevance to the user's financial question
2. Focus on cashflow, affordability, timing, or planning
3. Coverage of the requested task or next step
4. Avoidance of off-topic or distracting content`,
      scale: '0-5 scale where 5 = highly relevant and focused, 0 = off-topic or non-responsive',
      examples: [
        {
          score: 5,
          reasoning:
            'Directly addresses the cashflow question, focuses on relevant financial facts, and stays on task',
        },
        {
          score: 4,
          reasoning: 'Mostly relevant, with only minor omissions or slight drift',
        },
        {
          score: 3,
          reasoning: 'Partially relevant but misses important parts of the financial task',
        },
        {
          score: 2,
          reasoning: 'Only weakly connected to the user financial question',
        },
        {
          score: 1,
          reasoning: 'Mostly irrelevant and does not meaningfully help with the cashflow task',
        },
        {
          score: 0,
          reasoning: 'Off-topic or completely fails to address the cashflow request',
        },
      ],
    },
    normalization: {
      normalizer: createMinMaxNormalizer({
        min: 0,
        max: 5,
        clip: true,
      }),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
