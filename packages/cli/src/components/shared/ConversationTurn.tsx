/**
 * Individual conversation turn display component
 */

import type { ConversationStep } from '@tally-evals/core';
import { Box, Text } from 'ink';
import type React from 'react';
import { colors } from '../../utils/colors';
import {
  extractTextFromMessage,
  extractTextFromMessages,
  extractToolCallsFromMessages,
  type MetricScalar,
  sanitizeText,
  truncateText,
} from '../../utils/formatters';
import { MetricsTable } from './MetricsTable';
import { ToolCallList } from './ToolCallList.jsx';

export type CliMetricRow = {
  name: string;
  score?: number;
  verdict?: 'pass' | 'fail' | 'unknown';
  passAt?: string;
  reasoning?: string;
  rawValue?: MetricScalar;
};

interface ConversationTurnProps {
  stepIndex: number;
  step: ConversationStep;
  metrics: CliMetricRow[];
  expanded?: boolean;
}

export function ConversationTurn({
  stepIndex,
  step,
  metrics,
  expanded = false,
}: ConversationTurnProps): React.ReactElement {
  const inputText = sanitizeText(extractTextFromMessage(step.input));
  const outputText = sanitizeText(extractTextFromMessages(step.output));
  const toolCalls = extractToolCallsFromMessages(step.output);

  const displayInput = expanded ? inputText : truncateText(inputText, 80);
  const displayOutput = expanded ? outputText : truncateText(outputText, 80);

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
              maxReasoningLength={expanded ? 100 : 40}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
