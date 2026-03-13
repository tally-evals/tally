/**
 * Impact Reporting Completeness Metric
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createIdentityNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface ImpactAnalysis {
  monthlySavings?: number;
  minBalanceChange?: number;
  riskDaysChange?: number;
  bufferImpact?: number;
  [key: string]: number | undefined;
}

export interface ImpactReportingMetadata {
  baselineAnalysis?: ImpactAnalysis;
  scenarioAnalysis?: ImpactAnalysis;
  expectedMetrics: string[];
  scenarioQuery?: string;
}

export interface ImpactReportingOptions {
  provider: LanguageModel;
  reportingLevel?: 'quantified' | 'mentioned';
}

export function createImpactReportingMetric(
  options: ImpactReportingOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider, reportingLevel = 'quantified' } = options;

  const base = defineBaseMetric({
    name: 'impactReportingCompleteness',
    valueType: 'number',
    description:
      'Measures whether the assistant reports key impact metrics (savings, balance changes, risk) for what-if scenarios',
    metadata: {
      reportingLevel,
    },
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected: DatasetItem) => {
      const { input, output } = extractInputOutput(selected);
      const metadata = selected.metadata as ImpactReportingMetadata | undefined;

      const baselineAnalysis = metadata?.baselineAnalysis ?? {};
      const scenarioAnalysis = metadata?.scenarioAnalysis ?? {};
      const expectedMetrics = metadata?.expectedMetrics ?? [];
      const scenarioQuery = metadata?.scenarioQuery ?? '';

      return {
        input,
        output,
        scenarioQuery,
        baselineAnalysis: JSON.stringify(baselineAnalysis, null, 2),
        scenarioAnalysis: JSON.stringify(scenarioAnalysis, null, 2),
        expectedMetrics: expectedMetrics.join(', '),
        reportingLevel,
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant properly reports impact metrics for a what-if scenario analysis.

Scenario Query:
{{scenarioQuery}}

User Input:
{{input}}

Assistant Response:
{{output}}

Baseline Analysis:
{{baselineAnalysis}}

Scenario Analysis:
{{scenarioAnalysis}}

Expected Metrics to Report: {{expectedMetrics}}

Reporting Level Required: {{reportingLevel}}

Evaluate the completeness of impact reporting:

For QUANTIFIED level: The assistant must provide specific numeric values for each metric (e.g., "saves $50/month", "min balance improves by $200").

For MENTIONED level: The assistant must at least mention each metric category even without exact numbers.

Expected metrics may include:
- monthly_savings: Monthly cost/revenue change
- min_balance_change: Change in minimum balance
- risk_days_change: Change in days below buffer
- buffer_impact: Impact on safety buffer

Provide a score between 0 and 1:
- 1.0: Reports all expected metrics with appropriate detail
- 0.75: Reports most metrics (3 out of 4)
- 0.5: Reports some metrics (2 out of 4)
- 0.25: Reports few metrics (1 out of 4)
- 0.0: Reports none of the expected metrics`,
      variables: [] as const,
    },
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
