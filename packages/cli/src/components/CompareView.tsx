/**
 * Side-by-side comparison view for two reports
 */

import type { Conversation, TallyRunArtifact } from '@tally-evals/core';
import { createTargetRunView } from '@tally-evals/tally';
import Table from 'cli-table3';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useMemo, useState } from 'react';
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

/**
 * Safely get a numeric aggregation value from an Aggregations object
 * Returns undefined if the value doesn't exist or isn't a number
 */
function getNumericAggregation(
  aggregations: Record<string, number | Record<string, number>> | undefined,
  key: string,
): number | undefined {
  if (!aggregations) return undefined;

  const candidates: string[] = [key];

  // Common naming conventions in artifacts:
  // - pipeline uses aggregator.name ("Mean", "P50", ...)
  // - some consumers historically expect normalized keys ("mean", "p50", ...)
  const lower = key.toLowerCase();
  const upper = key.toUpperCase();
  candidates.push(lower, upper);

  // "mean" -> "Mean"
  if (lower === 'mean') {
    candidates.push('Mean');
  }

  // "p50" -> "P50"
  if (/^p\d+$/.test(lower)) {
    candidates.push(`P${lower.slice(1)}`);
  }

  for (const k of candidates) {
    const value = aggregations[k];
    if (typeof value === 'number') return value;
  }

  return undefined;
}

interface CompareViewProps {
  conversation: Conversation;
  leftReport: TallyRunArtifact;
  rightReport: TallyRunArtifact;
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

  // Use the type-safe view API for unified access to step results
  const leftView = useMemo(() => createTargetRunView(leftReport), [leftReport]);
  const rightView = useMemo(() => createTargetRunView(rightReport), [rightReport]);

  // Get step results from both views
  const leftStepResults = leftView.step(scrollPosition);
  const rightStepResults = rightView.step(scrollPosition);

  // Collect all eval names from both views' step results
  const evalNames = Array.from(
    new Set([
      ...Object.keys(leftStepResults),
      ...Object.keys(rightStepResults),
    ]),
  ).sort();

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

  const table = new Table({
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

  for (const evalName of evalNames) {
    const leftStep = leftStepResults[evalName] ?? null;
    const rightStep = rightStepResults[evalName] ?? null;

    const leftScoreNum = leftStep?.measurement.score;
    const rightScoreNum = rightStep?.measurement.score;

    const leftScore =
      leftScoreNum !== undefined ? formatScore(leftScoreNum) : colors.muted('-');
    const rightScore =
      rightScoreNum !== undefined ? formatScore(rightScoreNum) : colors.muted('-');

    let deltaText = colors.muted('-');
    if (typeof leftScoreNum === 'number' && typeof rightScoreNum === 'number') {
      const delta = rightScoreNum - leftScoreNum;
      deltaText =
        delta > 0.01
          ? colors.success(`+${delta.toFixed(3)}`)
          : delta < -0.01
            ? colors.error(delta.toFixed(3))
            : colors.muted(delta.toFixed(3));
    }

    table.push([evalName, leftScore, rightScore, deltaText]);
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

          // Use the view API for summary access
          const leftSummaries = leftView.summary() ?? {};
          const rightSummaries = rightView.summary() ?? {};

          const allEvalNames = new Set<string>([
            ...Object.keys(leftSummaries),
            ...Object.keys(rightSummaries),
          ]);

          for (const evalName of Array.from(allEvalNames).sort()) {
            const leftSummary = leftSummaries[evalName];
            const rightSummary = rightSummaries[evalName];
            if (!leftSummary || !rightSummary) continue;

            // Prefer raw aggregations for display; fall back to score (e.g. scorers).
            const leftAggs = leftSummary.aggregations?.raw ?? leftSummary.aggregations?.score;
            const rightAggs = rightSummary.aggregations?.raw ?? rightSummary.aggregations?.score;
            const leftMeanValue = getNumericAggregation(leftAggs, 'mean');
            const rightMeanValue = getNumericAggregation(rightAggs, 'mean');

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
