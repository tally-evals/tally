/**
 * Reusable metrics table component
 */

import Table from 'cli-table3';
import { Box, Text, useStdout } from 'ink';
import React, { useMemo } from 'react';
import { colors } from '../../utils/colors';
import {
  formatScore,
  formatVerdict,
  truncateText,
} from '../../utils/formatters';
import type { CliMetricRow } from './ConversationTurn';

interface MetricsTableProps {
  metrics: CliMetricRow[];
  maxReasoningLength?: number;
}

function MetricsTableComponent({
  metrics,
  maxReasoningLength = 40,
}: MetricsTableProps): React.ReactElement {
  const { stdout } = useStdout();
  const viewportWidth = stdout.columns;

  const tableOutput = useMemo(() => {
    if (metrics.length === 0) {
      return colors.muted('No metrics');
    }

    const isExpanded = maxReasoningLength > 40;

    const metricColWidth = 20;
    const scoreColWidth = 12;
    const verdictColWidth = 10;

    const numColumns = 4;
    const borderOverhead = numColumns * 3 + 1;

    const reasoningColWidth = Math.max(
      30,
      viewportWidth -
        metricColWidth -
        scoreColWidth -
        verdictColWidth -
        borderOverhead,
    );

    const table = new Table({
      head: [
        colors.bold('Eval'),
        colors.bold('Score'),
        colors.bold('Verdict'),
        colors.bold('Reasoning'),
      ].map((h) => colors.info(h)),
      style: {
        head: [],
        border: ['grey'],
        compact: false,
      },
      wordWrap: isExpanded,
      colWidths: [
        metricColWidth,
        scoreColWidth,
        verdictColWidth,
        reasoningColWidth,
      ],
    });

    for (const metric of metrics) {
      const name = truncateText(metric.name, 20);
      const score = metric.score !== undefined ? formatScore(metric.score) : colors.muted('-');
      const verdictIcon = formatVerdict(metric.verdict);
      const fullReasoning = metric.reasoning || '';
      const reasoning =
        maxReasoningLength > 40
          ? fullReasoning.split('\n')[0]
          : truncateText(
              fullReasoning.split('\n')[0] as string,
              maxReasoningLength,
            );

      table.push([
        name,
        score,
        verdictIcon,
        reasoning as string,
      ]);
    }

    return table.toString();
  }, [metrics, maxReasoningLength, viewportWidth]);

  return (
    <Box>
      <Text>{tableOutput}</Text>
    </Box>
  );
}
export const MetricsTable = React.memo(MetricsTableComponent);
