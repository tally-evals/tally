/**
 * Individual conversation turn display component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../utils/colors.js';
import {
  extractTextFromMessage,
  extractTextFromMessages,
  extractToolCallsFromMessages,
  sanitizeText,
  truncateText,
} from '../../utils/formatters.js';
import { MetricsTable } from './MetricsTable.js';
import { ConversationStep, Metric } from '@tally-evals/tally';
import { ToolCallList } from './ToolCallList.jsx';

interface ConversationTurnProps {
  stepIndex: number;
  step: ConversationStep;
  metrics: Metric[];
  verdicts?: Map<string, { verdict: 'pass' | 'fail' | 'unknown' }>;
  expanded?: boolean;
}

export function ConversationTurn({
  stepIndex,
  step,
  metrics,
  verdicts,
  expanded = false,
}: ConversationTurnProps): React.ReactElement {
  const inputText = sanitizeText(extractTextFromMessage(step.input));
  const outputText = sanitizeText(extractTextFromMessages(step.output));
  const toolCalls = extractToolCallsFromMessages(step.output);

  const displayInput = truncateText(inputText, expanded ? 200 : 80);
  const displayOutput = truncateText(outputText, expanded ? 200 : 80);

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
    >
      <Text>
        {colors.bold(`Turn ${stepIndex + 1}`)}{' '}
        {colors.muted(`[${step.timestamp}]`)}
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text>
          {colors.info('Input:')} {displayInput}
        </Text>
        <Text>
          {colors.info('Output:')} {displayOutput}
        </Text>
        <ToolCallList toolCalls={toolCalls} />
      </Box>

      {metrics.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text>{colors.bold('Metrics:')}</Text>
          <Box>
            <MetricsTable
              metrics={metrics}
              verdicts={verdicts ?? undefined}
              maxReasoningLength={expanded ? 100 : 40}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
