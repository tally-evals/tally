import type { EvalSummary } from '@tally-evals/core';

function getNumericAggregation(
  aggregations: Record<string, number | Record<string, number>> | undefined,
  key: string
): number | undefined {
  const value = aggregations?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function getSummaryScoreValue(summary: EvalSummary): number | undefined {
  return (
    getNumericAggregation(summary.aggregations?.score, 'Mean') ??
    getNumericAggregation(summary.aggregations?.score, 'mean') ??
    getNumericAggregation(summary.aggregations?.score, 'value')
  );
}
