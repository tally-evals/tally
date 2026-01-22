/**
 * Loading spinner component
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps): React.ReactElement {
  return (
    <Box>
      <Box marginRight={1}>
        <Spinner type="dots" />
      </Box>
      <Text>{message}</Text>
    </Box>
  );
}

