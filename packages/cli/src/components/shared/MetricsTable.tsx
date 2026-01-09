/**
 * Reusable metrics table component
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import Table from 'cli-table3';
import { colors } from '../../utils/colors.js';
import {
  formatScore,
  formatVerdict,
  truncateText,
} from '../../utils/formatters.js';
import { Metric } from '@tally-evals/tally';

interface MetricsTableProps {
  metrics: Metric[];
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
  const tableOutput = useMemo(() => {
    if (metrics.length === 0) {
      return colors.muted('No metrics');
    }

    const isExpanded = maxReasoningLength > 40;
    const reasoningColWidth = isExpanded ? 100 : 38;

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
      colWidths: [20, 12, ...(metricToEvalMap ? [10] : []), reasoningColWidth],
    });

    for (const metric of metrics) {
      const name = truncateText(metric.metricDef.name, 20);
      const score =
        typeof metric.value === 'number'
          ? formatScore(metric.value)
          : String(metric.value);
      // Look up eval name using the metric-to-eval map, then get the verdict
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
  }, [metrics, verdicts, metricToEvalMap, maxReasoningLength]);

  return (
    <Box>
      <Text>{tableOutput}</Text>
    </Box>
  );
}
export const MetricsTable = React.memo(MetricsTableComponent);
