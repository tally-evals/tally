/**
 * Impact Reporting Completeness Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant reports
 * key impact metrics when presenting what-if scenario results.
 *
 * Evaluates if the response includes quantified impact measures like savings,
 * balance changes, risk reduction, etc.
 *
 * Supports DatasetItem with metadata containing expected metrics to report.
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { defineBaseMetric, defineSingleTurnLLM } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { extractInputOutput } from '../common/utils';

/**
 * Impact analysis data
 */
export interface ImpactAnalysis {
  monthlySavings?: number;
  minBalanceChange?: number;
  riskDaysChange?: number;
  bufferImpact?: number;
  [key: string]: number | undefined;
}

/**
 * Metadata structure for impact reporting evaluation
 */
export interface ImpactReportingMetadata {
  /**
   * Baseline analysis metrics
   */
  baselineAnalysis?: ImpactAnalysis;
  /**
   * Scenario analysis metrics
   */
  scenarioAnalysis?: ImpactAnalysis;
  /**
   * Expected metrics that should be reported
   */
  expectedMetrics: string[];
  /**
   * Scenario query/description
   */
  scenarioQuery?: string;
}

export interface ImpactReportingOptions {
  /**
   * LLM provider for evaluation
   */
  provider: LanguageModel;
  /**
   * Require quantified values or just metric mentions
   * @default 'quantified'
   */
  reportingLevel?: 'quantified' | 'mentioned';
}

/**
 * Create an impact reporting completeness metric
 *
 * Measures whether the assistant reports key impact metrics when presenting
 * what-if scenario results.
 *
 * Scoring (0-1 scale):
 * - 1.0: Reports all expected metrics with quantified values
 * - Proportional: Based on fraction of expected metrics reported
 * - Bonus: Clear, well-formatted presentation of impacts
 * - 0.0: Reports none of the expected metrics
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for impact reporting completeness
 */
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

      // Extract metadata
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
