/**
 * Summary view showing aggregate metrics
 */

import type { TallyRunArtifact } from '@tally-evals/core';
import { createTargetRunView } from '@tally-evals/tally';
import Table from 'cli-table3';
import { Box, Text } from 'ink';
import type React from 'react';
import { useMemo } from 'react';
import { colors } from 'src/utils/colors';
// Note: raw values (top line) are green; score values (bottom line) are muted.
import { colorByRate01, formatRate01 } from 'src/utils/formatters';

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

interface SummaryViewProps {
  report: TallyRunArtifact;
}

function formatScoreNumber(value: number): string {
  // Score is a 0-1 number; we render it as a plain value when shown as the
  // secondary (dim/grey) line under the raw value.
  return value.toFixed(3);
}

function formatRawValue(value: number): string {
  // Raw values can be outside 0-1; avoid score color scale.
  return value.toFixed(3);
}

function formatDualValue(args: {
  raw: number | undefined;
  score: number | undefined;
}): string {
  const rawText = args.raw !== undefined ? formatRawValue(args.raw) : '-';
  const rawLine =
    args.raw !== undefined
      ? // Color raw using the normalized score (when available).
        // This makes raw “inherit” the same heatmap meaning as the score line.
        args.score !== undefined
        ? colorByRate01(args.score, rawText)
        : colors.success(rawText)
      : colors.muted('-');
  // Terminal can't actually render smaller text; use muted grey as the
  // "secondary" (smaller-feeling) line.
  const scoreLine =
    args.score !== undefined
      ? colors.muted(formatScoreNumber(args.score))
      : colors.muted('-');
  return `${rawLine}\n${scoreLine}`;
}

export function SummaryView({ report }: SummaryViewProps): React.ReactElement {
  // Use the type-safe view API for summary access
  const view = useMemo(() => createTargetRunView(report), [report]);
  const summaries = view.summary() ?? {};
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
    const scoreAggs = summary.aggregations?.score;
    const rawAggs = summary.aggregations?.raw;

    // For single-turn/scorer we expect Mean/Pxx keys; for multi-turn we expect `value`.
    const scoreMeanOrValue =
      getNumericAggregation(scoreAggs, 'mean') ??
      getNumericAggregation(scoreAggs, 'value');
    const rawMeanOrValue =
      getNumericAggregation(rawAggs, 'mean') ?? getNumericAggregation(rawAggs, 'value');

    const scoreP50 = getNumericAggregation(scoreAggs, 'p50');
    const scoreP75 = getNumericAggregation(scoreAggs, 'p75');
    const scoreP90 = getNumericAggregation(scoreAggs, 'p90');

    const rawP50 = getNumericAggregation(rawAggs, 'p50');
    const rawP75 = getNumericAggregation(rawAggs, 'p75');
    const rawP90 = getNumericAggregation(rawAggs, 'p90');

    const evalDef = view.eval(evalName);
    const kindLabel =
      summary.kind === 'scorer'
        ? `scorer/${evalDef?.outputShape === 'seriesByStepIndex' ? 'series' : 'scalar'}`
        : summary.kind;

    const meanCell = formatDualValue({ raw: rawMeanOrValue, score: scoreMeanOrValue });
    const p50Cell = formatDualValue({ raw: rawP50, score: scoreP50 });
    const p75Cell = formatDualValue({ raw: rawP75, score: scoreP75 });
    const p90Cell = formatDualValue({ raw: rawP90, score: scoreP90 });

    const row = [
      evalName,
      kindLabel,
      meanCell,
      p50Cell,
      p75Cell,
      p90Cell,
      summary.verdictSummary?.passRate !== undefined
        ? formatRate01(summary.verdictSummary.passRate)
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
