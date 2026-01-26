/**
 * Keyboard help footer component
 */

import { Box, Text } from 'ink';
import type React from 'react';
import { colors } from '../../utils/colors.js';

interface KeyboardHelpProps {
  shortcuts: Array<{
    key: string;
    description: string;
  }>;
}

export function KeyboardHelp({ shortcuts }: KeyboardHelpProps): React.ReactElement {
  const shortcutText = shortcuts
    .map((s) => `${colors.bold(s.key)}: ${s.description}`)
    .join('  │  ');

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
      <Text>{shortcutText}</Text>
    </Box>
  );
}
