/**
 * Side-by-side comparison view for two reports
 */

import type { Conversation, EvaluationReport, EvalSummary } from '@tally-evals/core';

/**
 * Convert evalSummaries to a properly typed Map
 * Handles both Map instances (in-memory) and plain objects (after JSON serialization)
 */
function getEvalSummariesMap(
  evalSummaries: EvaluationReport['evalSummaries'],
): Map<string, EvalSummary> {
  if (evalSummaries instanceof Map) {
    return evalSummaries;
  }
  // After JSON serialization, Map becomes a plain object
  return new Map(
    Object.entries(evalSummaries as unknown as Record<string, EvalSummary>),
  );
}

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
import Table from 'cli-table3';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useState } from 'react';
import { colors } from '../utils/colors';
import {
  extractTextFromMessage,
  extractTextFromMessages,
  extractToolCallsFromMessages,
  formatScore,
  sanitizeText,
  truncateText,
} from '../utils/formatters';
import { KeyboardHelp } from './shared/KeyboardHelp';
import { ToolCallList } from './shared/ToolCallList.jsx';
import { BreadCrumbs } from './shared/BreadCrumbs.js';

interface CompareViewProps {
  conversation: Conversation;
  leftReport: EvaluationReport;
  rightReport: EvaluationReport;
  onBack?: () => void;
}

export function CompareView({
  conversation,
  leftReport,
  rightReport,
  onBack,
}: CompareViewProps): React.ReactElement {
  const [scrollPosition, setScrollPosition] = useState(0);

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.escape && onBack) {
      onBack();
    }
    if (key.upArrow || key.leftArrow) {
      setScrollPosition(Math.max(0, scrollPosition - 1));
    }
    if (key.downArrow || key.rightArrow) {
      setScrollPosition(
        Math.min(conversation.steps.length - 1, scrollPosition + 1),
      );
    }
  });

  const leftResult = leftReport.perTargetResults[0];
  const rightResult = rightReport.perTargetResults[0];

  if (!leftResult || !rightResult) {
    return (
      <Text>{colors.error('One or both reports missing target results')}</Text>
    );
  }

  const getMetricsForStep = (
    targetMetrics: typeof leftResult.rawMetrics,
    stepIdx: number,
  ) => {
    const metricArray: typeof targetMetrics = [];
    let metricCount = 0;

    for (const metric of targetMetrics) {
      const scopeInfo = metric.metricDef as unknown as { scope?: string };
      if (scopeInfo.scope === 'single') {
        if (metricCount === stepIdx) {
          metricArray.push(metric);
        }
        metricCount++;
      }
    }

    return metricArray;
  };

  const currentStep = conversation.steps[scrollPosition];
  if (!currentStep) {
    return <Text>{colors.error('No step at current position')}</Text>;
  }

  const inputText = truncateText(
    sanitizeText(extractTextFromMessage(currentStep.input)),
    60,
  );
  const outputText = truncateText(
    sanitizeText(extractTextFromMessages(currentStep.output)),
    60,
  );
  const toolCalls = extractToolCallsFromMessages(currentStep.output);

  const leftMetrics = getMetricsForStep(leftResult.rawMetrics, scrollPosition);
  const rightMetrics = getMetricsForStep(
    rightResult.rawMetrics,
    scrollPosition,
  );

  const table = new Table({
    head: [
      colors.bold('Metric'),
      colors.bold('Left'),
      colors.bold('Right'),
      colors.bold('Delta'),
    ].map((h) => colors.info(h)),
    style: {
      head: [],
      border: ['grey'],
      compact: true,
    },
    colWidths: [20, 12, 12, 12],
  });

  const allMetricNames = new Set<string>();
  for (const m of leftMetrics) {
    allMetricNames.add(m.metricDef.name);
  }
  for (const m of rightMetrics) {
    allMetricNames.add(m.metricDef.name);
  }

  for (const metricName of Array.from(allMetricNames).sort()) {
    const leftMetric = leftMetrics.find((m) => m.metricDef.name === metricName);
    const rightMetric = rightMetrics.find(
      (m) => m.metricDef.name === metricName,
    );

    let leftNormalized = 0;
    let rightNormalized = 0;

    const leftScore = leftMetric
      ? typeof leftMetric.value === 'number'
        ? (() => {
            leftNormalized =
              leftMetric.value >= 0 && leftMetric.value <= 5
                ? leftMetric.value / 5
                : leftMetric.value;
            return formatScore(leftMetric.value);
          })()
        : String(leftMetric.value)
      : colors.muted('-');
    const rightScore = rightMetric
      ? typeof rightMetric.value === 'number'
        ? (() => {
            rightNormalized =
              rightMetric.value >= 0 && rightMetric.value <= 5
                ? rightMetric.value / 5
                : rightMetric.value;
            return formatScore(rightMetric.value);
          })()
        : String(rightMetric.value)
      : colors.muted('-');

    let deltaText = colors.muted('-');
    if (
      typeof leftMetric?.value === 'number' &&
      typeof rightMetric?.value === 'number'
    ) {
      const delta = rightNormalized - leftNormalized;
      deltaText =
        delta > 0.01
          ? colors.success(`+${delta.toFixed(3)}`)
          : delta < -0.01
          ? colors.error(delta.toFixed(3))
          : colors.muted(delta.toFixed(3));
    }

    table.push([metricName, leftScore, rightScore, deltaText]);
  }

  return (
    <Box flexDirection="column">
      <BreadCrumbs
        breadcrumbs={[
          conversation.id,
          'Runs',
          'Comparison',
          `${leftReport.runId} ${colors.muted('↔')} ${rightReport.runId}`,
        ]}
      />

      <Box paddingTop={1} paddingX={1}>
        <Text>
          {colors.muted(
            `(Turn ${scrollPosition + 1}/${conversation.steps.length})`,
          )}
        </Text>
      </Box>

      <Box marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Box flexDirection="column">
          <Text>
            {colors.info('Input:')} {inputText}
          </Text>
          <Text>
            {colors.info('Output:')} {outputText}
          </Text>
          <ToolCallList toolCalls={toolCalls} />
        </Box>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text>
            {colors.bold('Left:')} {colors.muted(leftReport.runId)}
          </Text>
          <Text>
            {colors.bold('Right:')} {colors.muted(rightReport.runId)}
          </Text>
        </Box>
      </Box>

      <Box>
        <Text>{table.toString()}</Text>
      </Box>

      <Box paddingX={1} marginTop={1} flexDirection="column">
        <Text>{colors.bold('Summary Comparison')}</Text>
      </Box>
      <Box>
        {(() => {
          const summaryTable = new Table({
            head: [
              colors.bold('Eval'),
              colors.bold('Left'),
              colors.bold('Right'),
              colors.bold('Delta'),
            ].map((h) => colors.info(h)),
            style: {
              head: [],
              border: ['grey'],
              compact: true,
            },
            colWidths: [20, 12, 12, 12],
          });

          const leftSummaries = getEvalSummariesMap(leftReport.evalSummaries);
          const rightSummaries = getEvalSummariesMap(rightReport.evalSummaries);

          for (const [evalName, leftSummary] of leftSummaries) {
            const rightSummary = rightSummaries.get(evalName);
            if (!rightSummary) continue;

            const leftMeanValue = getNumericAggregation(leftSummary.aggregations.score, 'mean');
            const rightMeanValue = getNumericAggregation(rightSummary.aggregations.score, 'mean');

            if (leftMeanValue === undefined || rightMeanValue === undefined) {
              summaryTable.push([evalName, colors.muted('-'), colors.muted('-'), colors.muted('-')]);
              continue;
            }

            const leftMean = leftMeanValue.toFixed(3);
            const rightMean = rightMeanValue.toFixed(3);
            const delta = rightMeanValue - leftMeanValue;
            const deltaText =
              delta > 0.01
                ? colors.success(`+${delta.toFixed(3)}`)
                : delta < -0.01
                ? colors.error(delta.toFixed(3))
                : colors.muted(delta.toFixed(3));

            summaryTable.push([evalName, leftMean, rightMean, deltaText]);
          }

          return <Text>{summaryTable.toString()}</Text>;
        })()}
      </Box>

      <KeyboardHelp
        shortcuts={[
          { key: '↑↓', description: 'Navigate turns' },
          ...(onBack ? [{ key: 'Esc', description: 'Back' }] : []),
          { key: 'q', description: 'Quit' },
        ]}
      />
    </Box>
  );
}
