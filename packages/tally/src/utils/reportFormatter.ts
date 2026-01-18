/**
 * Report Formatter Utilities
 *
 * Functions to format evaluation reports as pretty console tables
 */

import type { Conversation, TallyRunArtifact } from '@tally/core/types';

/**
 * Format evaluation report as console tables
 * Shows turn-by-turn conversation with single-turn metrics, then multi-turn metrics
 */
export function formatReportAsTables(
  artifact: TallyRunArtifact,
  conversation: Conversation
): void {
  console.log('\n' + '='.repeat(80));
  console.log('TALLY RUN ARTIFACT');
  console.log('='.repeat(80));
  console.log(`Run ID: ${artifact.runId}`);
  console.log(`Created At: ${artifact.createdAt}`);
  console.log(`Conversation: ${conversation.id}`);
  console.log('');

  formatConversationTable(artifact, conversation);

  // Format summary table
  formatSummaryTable(artifact);
}

/**
 * Format a single conversation as a table
 */
function formatConversationTable(
  artifact: TallyRunArtifact,
  conversation: Conversation
): void {
  console.log('\n' + '-'.repeat(80));
  console.log(`CONVERSATION: ${conversation.id}`);
  console.log('-'.repeat(80));

  const singleTurnEvalNames = Object.keys(artifact.result.singleTurn ?? {}).sort();

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

    for (const evalName of singleTurnEvalNames) {
      const series = artifact.result.singleTurn?.[evalName];
      const stepRes = series?.byStepIndex?.[stepIdx] ?? null;
      if (!stepRes) {
        row[evalName] = '-';
        continue;
      }

      const score = stepRes.measurement.score;
      const verdict = stepRes.outcome?.verdict;
      const verdictIcon =
        verdict === 'pass'
          ? '✓'
          : verdict === 'fail'
            ? '✗'
            : verdict === 'unknown'
              ? '?'
              : '';
      row[evalName] =
        score !== undefined ? `${Number(score).toFixed(3)} ${verdictIcon}` : `- ${verdictIcon}`;
    }

    tableRows.push(row);
  }

  // Add multi-turn eval results as separate rows
  for (const [evalName, res] of Object.entries(artifact.result.multiTurn ?? {})) {
    const score = res.measurement.score;
    const verdict = res.outcome?.verdict;
    const verdictIcon =
      verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : verdict === 'unknown' ? '?' : '';

    const multiTurnRow: Record<string, string | number> = {
      Turn: '',
      Conversation: evalName,
    };

    if (singleTurnEvalNames.length > 0) {
      multiTurnRow[singleTurnEvalNames[0]!] = `${score !== undefined ? Number(score).toFixed(3) : '-'} ${verdictIcon}`;
      for (let i = 1; i < singleTurnEvalNames.length; i++) {
        multiTurnRow[singleTurnEvalNames[i]!] = '-';
      }
    } else {
      multiTurnRow.Conversation = `${evalName}: ${score !== undefined ? Number(score).toFixed(3) : '-'} ${verdictIcon}`;
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
  columnOrder: string[]
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
  const headerRow = columnOrder.map((col) => col.padEnd(columnWidths.get(col) ?? 0)).join('│');
  console.log('│' + headerRow + '│');
  console.log(
    '├' + columnOrder.map((col) => '─'.repeat(columnWidths.get(col) ?? 0)).join('┼') + '┤'
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
function formatSummaryTable(artifact: TallyRunArtifact): void {
  console.log('\n' + '-'.repeat(80));
  console.log('EVAL SUMMARIES (SCORES)');
  console.log('-'.repeat(80));

  const summaryRows: Array<Record<string, string | number>> = [];
  const allColumns = new Set<string>(['Eval', 'Kind']);

  // First pass: collect all unique columns
  const summaries = artifact.result.summaries?.byEval ?? {};
  for (const [, summary] of Object.entries(summaries)) {
    if (summary.verdictSummary) {
      allColumns.add('Pass Rate');
      allColumns.add('Pass/Fail');
    }
    if (summary.aggregations?.score) {
      const aggs = summary.aggregations.score;
      for (const aggName of Object.keys(aggs)) {
        const displayName = aggName.charAt(0).toUpperCase() + aggName.slice(1);
        allColumns.add(displayName);
      }
    }
  }

  // Second pass: build rows with all columns
  for (const [evalName, summary] of Object.entries(summaries)) {
    const row: Record<string, string | number> = {
      Eval: evalName,
      Kind: summary.kind,
    };

    // Add verdict summary if available
    if (summary.verdictSummary) {
      row['Pass Rate'] = `${summary.verdictSummary.passRate.toFixed(3)}`;
      row['Pass/Fail'] = `${summary.verdictSummary.passCount}/${summary.verdictSummary.failCount}`;
    }

    if (summary.aggregations?.score) {
      const aggs = summary.aggregations.score;
      for (const [aggName, aggValue] of Object.entries(aggs)) {
        if (typeof aggValue === 'number') {
          const displayName = aggName.charAt(0).toUpperCase() + aggName.slice(1);
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

  console.log('\n' + '-'.repeat(80));
  console.log('EVAL SUMMARIES (RAW VALUES)');
  console.log('-'.repeat(80));

  const summaryRowsRaw: Array<Record<string, string | number>> = [];
  const allColumnsRaw = new Set<string>(['Eval', 'Kind']);

  // First pass: collect all unique columns
  for (const [, summary] of Object.entries(summaries)) {
    if (summary.aggregations?.raw) {
      const aggs = summary.aggregations.raw;
      for (const aggName of Object.keys(aggs)) {
        const displayName = aggName.charAt(0).toUpperCase() + aggName.slice(1);
        allColumnsRaw.add(displayName);
      }
    }
  }

  // Second pass: build rows with all columns
  for (const [evalName, summary] of Object.entries(summaries)) {
    const row: Record<string, string | number> = {
      Eval: evalName,
      Kind: summary.kind,
    };

    if (summary.aggregations?.raw) {
      const aggs = summary.aggregations.raw;
      for (const [aggName, aggValue] of Object.entries(aggs)) {
        if (typeof aggValue === 'number') {
          const displayName = aggName.charAt(0).toUpperCase() + aggName.slice(1);
          row[displayName] = aggValue.toFixed(3);
        }
      }
    }

    // Fill in missing columns with hyphens
    for (const col of allColumnsRaw) {
      if (!(col in row)) {
        row[col] = '-';
      }
    }

    summaryRowsRaw.push(row);
  }

  console.table(summaryRowsRaw);
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
