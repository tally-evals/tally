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
import type { CliMetric } from './ConversationTurn';

interface MetricsTableProps {
  metrics: CliMetric[];
  verdicts?: Map<string, { verdict: 'pass' | 'fail' | 'unknown' }> | undefined;
  metricToEvalMap?: Map<string, string> | undefined;
  maxReasoningLength?: number;
}

function MetricsTableComponent({
  metrics,
  verdicts,
  metricToEvalMap,
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
    const verdictColWidth = metricToEvalMap ? 10 : 0;

    const numColumns = metricToEvalMap ? 4 : 3;
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
        colors.bold('Metric'),
        colors.bold('Score'),
        ...(metricToEvalMap ? [colors.bold('Verdict')] : []),
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
        ...(metricToEvalMap ? [verdictColWidth] : []),
        reasoningColWidth,
      ],
    });

    for (const metric of metrics) {
      const name = truncateText(metric.metricDef.name, 20);
      const score =
        typeof metric.value === 'number'
          ? formatScore(metric.value)
          : String(metric.value);
      const evalName =
        metricToEvalMap?.get(metric.metricDef.name) ?? metric.metricDef.name;
      const verdict = verdicts?.get(evalName);
      const verdictIcon = formatVerdict(verdict?.verdict);
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
        ...(metricToEvalMap ? [verdictIcon] : []),
        reasoning as string,
      ]);
    }

    return table.toString();
  }, [metrics, verdicts, metricToEvalMap, maxReasoningLength, viewportWidth]);

  return (
    <Box>
      <Text>{tableOutput}</Text>
    </Box>
  );
}
export const MetricsTable = React.memo(MetricsTableComponent);
