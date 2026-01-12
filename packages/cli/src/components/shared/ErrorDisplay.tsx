/**
 * Error display component
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../utils/colors.js';

interface ErrorDisplayProps {
  title: string;
  message: string;
  details?: string;
}

export function ErrorDisplay({
  title,
  message,
  details,
}: ErrorDisplayProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor="red" paddingX={1} paddingY={1}>
        <Box flexDirection="column">
          <Text>{colors.error(`✗ ${title}`)}</Text>
          <Text>{message}</Text>
          {details && <Text>{colors.muted(details)}</Text>}
        </Box>
      </Box>
    </Box>
  );
}
