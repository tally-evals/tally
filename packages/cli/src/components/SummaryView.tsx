/**
 * Summary view showing aggregate metrics
 */

import React from 'react';
import { Box, Text } from 'ink';
import Table from 'cli-table3';
import { colors } from 'src/utils/colors';
import { score } from 'src/utils/colors';
import { EvaluationReport } from '@tally-evals/tally';

interface SummaryViewProps {
  report: EvaluationReport;
}

/**
 * Format a score value with color coding
 * Assumes value is already in 0-1 range
 */
function formatScoreValue(value: number): string {
  const formatted = value.toFixed(3);

  if (value >= 0.8) {
    return score.excellent(formatted);
  } else if (value >= 0.6) {
    return score.good(formatted);
  } else if (value >= 0.4) {
    return score.fair(formatted);
  } else {
    return score.poor(formatted);
  }
}

export function SummaryView({ report }: SummaryViewProps): React.ReactElement {
  if (report.evalSummaries.size === 0) {
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

  for (const [evalName, summary] of report.evalSummaries) {
    const row = [
      evalName,
      summary.evalKind,
      formatScoreValue(summary.aggregations.mean),
      formatScoreValue(summary.aggregations.percentiles.p50),
      formatScoreValue(summary.aggregations.percentiles.p75),
      formatScoreValue(summary.aggregations.percentiles.p90),
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
