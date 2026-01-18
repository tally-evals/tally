/**
 * Summary view showing aggregate metrics
 */

import type { TallyRunArtifact } from '@tally-evals/core';
import Table from 'cli-table3';
import { Box, Text } from 'ink';
import type React from 'react';
import { colors } from 'src/utils/colors';
import { score } from 'src/utils/colors';

/**
 * Safely get a numeric aggregation value from an Aggregations object
 * Returns undefined if the value doesn't exist or isn't a number
 */
function getNumericAggregation(
  aggregations: Record<string, number | Record<string, number>> | undefined,
  key: string,
): number | undefined {
  if (!aggregations) return undefined;
  const value = aggregations[key];
  return typeof value === 'number' ? value : undefined;
}

interface SummaryViewProps {
  report: TallyRunArtifact;
}

/**
 * Format a score value with color coding
 * Assumes value is already in 0-1 range
 */
function formatScoreValue(value: number): string {
  const formatted = value.toFixed(3);

  if (value >= 0.8) {
    return score.excellent(formatted);
  }
  if (value >= 0.6) {
    return score.good(formatted);
  }
  if (value >= 0.4) {
    return score.fair(formatted);
  }
  return score.poor(formatted);
}

export function SummaryView({ report }: SummaryViewProps): React.ReactElement {
  const summaries = report.result.summaries?.byEval ?? {};
  const summaryEntries = Object.entries(summaries);
  if (summaryEntries.length === 0) {
    return <Text>{colors.muted('No evaluation summaries available')}</Text>;
  }

  const table = new Table({
    head: [
      colors.bold('Eval'),
      colors.bold('Kind'),
      colors.bold('Mean'),
      colors.bold('P50'),
      colors.bold('P75'),
      colors.bold('P90'),
      colors.bold('Pass Rate'),
    ].map((h) => colors.info(h)),
    style: {
      head: [],
      border: ['grey'],
      compact: false,
    },
    wordWrap: true,
    colWidths: [20, 15, 10, 10, 10, 10, 12],
  });

  for (const [evalName, summary] of summaryEntries) {
    const percentiles = (summary.aggregations?.score as any)?.percentiles;
    const p =
      percentiles &&
      typeof percentiles === 'object' &&
      !Array.isArray(percentiles)
        ? (percentiles as { p50?: number; p75?: number; p90?: number })
        : null;
    const meanValue = getNumericAggregation(summary.aggregations?.score, 'mean');
    const row = [
      evalName,
      summary.kind,
      meanValue !== undefined ? formatScoreValue(meanValue) : colors.muted('-'),
      p?.p50 !== undefined ? formatScoreValue(p.p50) : colors.muted('-'),
      p?.p75 !== undefined ? formatScoreValue(p.p75) : colors.muted('-'),
      p?.p90 !== undefined ? formatScoreValue(p.p90) : colors.muted('-'),
      summary.verdictSummary?.passRate
        ? formatScoreValue(summary.verdictSummary.passRate)
        : colors.muted('-'),
    ];

    table.push(row);
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingX={1}>
        <Text>{colors.bold('Evaluation Summaries')}</Text>
      </Box>
      <Box>
        <Text>{table.toString()}</Text>
      </Box>
    </Box>
  );
}
