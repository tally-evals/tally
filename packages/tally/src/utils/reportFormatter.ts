/**
 * Report Formatter Utilities
 *
 * Functions to format evaluation reports as pretty console tables
 */

import type {
  EvaluationReport,
  PerTargetResult,
  Conversation,
  Metric,
  MetricScalar,
} from '@tally/core/types';

/**
 * Format evaluation report as console tables
 * Shows turn-by-turn conversation with single-turn metrics, then multi-turn metrics
 */
export function formatReportAsTables(
  report: EvaluationReport,
  conversations: readonly Conversation[],
): void {
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION REPORT');
  console.log('='.repeat(80));
  console.log(`Run ID: ${report.runId}`);
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Total Conversations: ${report.perTargetResults.length}`);
  console.log('');

  // Process each conversation
  for (let i = 0; i < report.perTargetResults.length; i++) {
    const result = report.perTargetResults[i];
    if (!result) continue;

    const conversation = conversations[i];
    if (!conversation) continue;

    formatConversationTable(result, conversation, report, i + 1);
  }

  // Format summary table
  formatSummaryTable(report);
}

/**
 * Format a single conversation as a table
 */
function formatConversationTable(
  result: PerTargetResult,
  conversation: Conversation,
  report: EvaluationReport,
  conversationNumber: number,
): void {
  console.log('\n' + '-'.repeat(80));
  console.log(`CONVERSATION ${conversationNumber}: ${conversation.id}`);
  console.log('-'.repeat(80));

  // Separate single-turn and multi-turn metrics
  const singleTurnMetrics = result.rawMetrics.filter(
    (m) =>
      (m.metricDef as unknown as { scope: 'single' | 'multi' }).scope ===
      'single',
  );
  const multiTurnMetrics = result.rawMetrics.filter(
    (m) =>
      (m.metricDef as unknown as { scope: 'single' | 'multi' }).scope ===
      'multi',
  );

  // Group single-turn metrics by metric name, then match to steps by order
  // Metrics are executed in order: Metric1-Step1, Metric1-Step2, ..., Metric2-Step1, etc.
  const metricsByName = new Map<string, Metric<MetricScalar>[]>();
  for (const metric of singleTurnMetrics) {
    const name = metric.metricDef.name;
    if (!metricsByName.has(name)) {
      metricsByName.set(name, []);
    }
    metricsByName.get(name)!.push(metric);
  }

  // Get eval names for single-turn metrics (sorted for consistency)
  const singleTurnEvalNames = Array.from(metricsByName.keys()).sort();

  // Create table rows for each step
  const tableRows: Array<Record<string, string | number>> = [];

  // Add rows for each conversation step
  for (let stepIdx = 0; stepIdx < conversation.steps.length; stepIdx++) {
    const step = conversation.steps[stepIdx];
    if (!step) continue;

    const inputText = truncateText(extractTextFromMessage(step.input), 60);
    const outputText = truncateText(extractTextFromMessages(step.output), 60);

    const row: Record<string, string | number> = {
      Turn: stepIdx + 1,
      Conversation: formatConversationText(inputText, outputText),
    };

    // Add single-turn metric scores for this step
    // Metrics are in order: all steps for metric1, then all steps for metric2, etc.
    for (const evalName of singleTurnEvalNames) {
      const metrics = metricsByName.get(evalName) ?? [];
      // Match by order: if we have N steps and metrics are in order, metric[stepIdx] belongs to step[stepIdx]
      if (stepIdx < metrics.length) {
        const metric = metrics[stepIdx];
        if (metric) {
          const normalized = normalizeValue(metric.value);
          // Find verdict for this step (verdicts are per eval, not per step, so we'll show aggregate)
          const verdict = result.verdicts.get(evalName);
          const verdictIcon = verdict
            ? verdict.verdict === 'pass'
              ? '✓'
              : verdict.verdict === 'fail'
              ? '✗'
              : '?'
            : '';
          row[evalName] = `${normalized.toFixed(3)} ${verdictIcon}`;
        } else {
          row[evalName] = '-';
        }
      } else {
        row[evalName] = '-';
      }
    }

    tableRows.push(row);
  }

  // Add multi-turn metrics as separate rows (not columns)
  // Deduplicate by metric name to avoid showing the same metric multiple times
  const seenMultiTurnMetrics = new Set<string>();
  for (const metric of multiTurnMetrics) {
    const metricName = metric.metricDef.name;
    if (seenMultiTurnMetrics.has(metricName)) continue;
    seenMultiTurnMetrics.add(metricName);

    const normalized = normalizeValue(metric.value);

    // Look up the eval name using the metric-to-eval mapping
    const evalName = report.metricToEvalMap?.get(metricName) ?? metricName;
    const verdict = result.verdicts.get(evalName);
    const verdictIcon = verdict
      ? verdict.verdict === 'pass'
        ? '✓'
        : verdict.verdict === 'fail'
        ? '✗'
        : '?'
      : '';

    const multiTurnRow: Record<string, string | number> = {
      Turn: '',
      Conversation: metricName,
    };

    // Put the metric value in the first single-turn metric column (or create a Score column)
    // For now, we'll put it in a way that spans visually
    // We'll use the first single-turn eval column if available, otherwise just show in Conversation
    if (singleTurnEvalNames.length > 0) {
      // Put value in first metric column, fill others with dashes
      multiTurnRow[singleTurnEvalNames[0]!] = `${normalized.toFixed(
        3,
      )} ${verdictIcon}`;
      for (let i = 1; i < singleTurnEvalNames.length; i++) {
        multiTurnRow[singleTurnEvalNames[i]!] = '-';
      }
    } else {
      // No single-turn metrics, just show in conversation column
      multiTurnRow.Conversation = `${evalName}: ${normalized.toFixed(
        3,
      )} ${verdictIcon}`;
    }

    tableRows.push(multiTurnRow);
  }

  // Column order: only Turn, Conversation, and single-turn metrics
  const allColumns = ['Turn', 'Conversation', ...singleTurnEvalNames];

  // Print table with custom formatter to handle newlines
  printTableWithNewlines(tableRows, allColumns);
}

/**
 * Print a table with support for multi-line cells
 */
function printTableWithNewlines(
  rows: Array<Record<string, string | number>>,
  columnOrder: string[],
): void {
  if (rows.length === 0) return;

  // Calculate column widths
  const columnWidths = new Map<string, number>();
  for (const col of columnOrder) {
    columnWidths.set(col, col.length);
  }

  for (const row of rows) {
    for (const col of columnOrder) {
      const value = String(row[col] ?? '-');
      // For multi-line values, find the longest line
      const lines = value.split('\n');
      const maxLineLength = Math.max(...lines.map((l) => l.length));
      const currentWidth = columnWidths.get(col) ?? 0;
      columnWidths.set(col, Math.max(currentWidth, maxLineLength));
    }
  }

  // Add padding
  for (const col of columnOrder) {
    columnWidths.set(col, (columnWidths.get(col) ?? 0) + 2);
  }

  // Print header
  const headerRow = columnOrder
    .map((col) => col.padEnd(columnWidths.get(col) ?? 0))
    .join('│');
  console.log('│' + headerRow + '│');
  console.log(
    '├' +
      columnOrder
        .map((col) => '─'.repeat(columnWidths.get(col) ?? 0))
        .join('┼') +
      '┤',
  );

  // Print rows
  for (const row of rows) {
    const rowLines: string[][] = [];
    let maxLines = 1;

    // Split each cell into lines
    for (const col of columnOrder) {
      const value = String(row[col] ?? '-');
      const lines = value.split('\n');
      maxLines = Math.max(maxLines, lines.length);
      rowLines.push(lines);
    }

    // Print each line of the row
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const lineCells = columnOrder.map((col, colIdx) => {
        const lines = rowLines[colIdx] ?? [];
        const line = lines[lineIdx] ?? '';
        return line.padEnd(columnWidths.get(col) ?? 0);
      });
      console.log('│' + lineCells.join('│') + '│');
    }
  }
}

/**
 * Format summary table with eval summaries
 */
function formatSummaryTable(report: EvaluationReport): void {
  console.log('\n' + '-'.repeat(80));
  console.log('EVAL SUMMARIES');
  console.log('-'.repeat(80));

  const summaryRows: Array<Record<string, string | number>> = [];
  const allColumns = new Set<string>(['Eval', 'Kind']);

  // First pass: collect all unique columns
  for (const [, summary] of report.evalSummaries) {
    if (summary.aggregations.mean !== undefined) {
      allColumns.add('Mean/Value');
    }
    if (summary.verdictSummary) {
      allColumns.add('Pass Rate');
      allColumns.add('Pass/Fail');
    }
    if (summary.aggregations.custom) {
      const customAggs = summary.aggregations.custom;
      for (const aggName of Object.keys(customAggs)) {
        const displayName = aggName.charAt(0).toUpperCase() + aggName.slice(1);
        allColumns.add(displayName);
      }
    }
  }

  // Second pass: build rows with all columns
  for (const [evalName, summary] of report.evalSummaries) {
    const row: Record<string, string | number> = {
      Eval: evalName,
      Kind: summary.evalKind,
    };

    // Add mean if available
    if (summary.aggregations.mean !== undefined) {
      row['Mean/Value'] = summary.aggregations.mean.toFixed(3);
    }

    // Add verdict summary if available
    if (summary.verdictSummary) {
      row['Pass Rate'] = `${summary.verdictSummary.passRate.toFixed(3)}`;
      row[
        'Pass/Fail'
      ] = `${summary.verdictSummary.passCount}/${summary.verdictSummary.failCount}`;
    }

    if (summary.aggregations.custom) {
      const customAggs = summary.aggregations.custom;
      for (const [aggName, aggValue] of Object.entries(customAggs)) {
        if (typeof aggValue === 'number') {
          const displayName =
            aggName.charAt(0).toUpperCase() + aggName.slice(1);
          row[displayName] = aggValue.toFixed(3);
        }
      }
    }

    // Fill in missing columns with hyphens
    for (const col of allColumns) {
      if (!(col in row)) {
        row[col] = '-';
      }
    }

    summaryRows.push(row);
  }

  console.table(summaryRows);
}

/**
 * Normalize a metric value to [0, 1] range
 */
function normalizeValue(value: MetricScalar): number {
  if (typeof value === 'number') {
    // Assume values are already in reasonable range, or normalize 0-5 to 0-1
    // Most LLM metrics return 0-5, so normalize that
    if (value >= 0 && value <= 5) {
      return value / 5;
    }
    // If already 0-1, return as-is
    if (value >= 0 && value <= 1) {
      return value;
    }
    // Otherwise, clamp to [0, 1]
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  // String values - return 0 for now (could be enhanced)
  return 0;
}

/**
 * Extract text from a single message
 */
function extractTextFromMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message && typeof message === 'object') {
    const msg = message as { content?: unknown; text?: string };
    if (msg.text) return msg.text;
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((c) => {
          if (typeof c === 'string') return c;
          if (c && typeof c === 'object' && 'text' in c) return String(c.text);
          return '';
        })
        .join(' ');
    }
    if (typeof msg.content === 'string') return msg.content;
  }
  return String(message);
}

/**
 * Extract text from multiple messages
 */
function extractTextFromMessages(messages: readonly unknown[]): string {
  return messages.map(extractTextFromMessage).join(' ');
}

/**
 * Truncate text to max length, preserving newlines
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format conversation text with Input and Output on separate lines
 */
function formatConversationText(input: string, output: string): string {
  return `Input: ${input}\nOutput: ${output}`;
}
