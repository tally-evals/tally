import { Box, Text } from 'ink';
import React from 'react';
import { colors } from 'src/utils/colors';

export function ToolCallList({
  toolCalls,
}: {
  toolCalls: { toolName: string; toolCallId: string }[];
}) {
  return (
    toolCalls.length > 0 && (
      <Box flexDirection="column" marginLeft={3}>
        {toolCalls.map(({ toolName, toolCallId }, index) => (
          <Text key={toolCallId}>
            {index === toolCalls.length - 1 ? '╰─' : '├─'}
            {`🔧 ${colors.success(toolName)} ${colors.muted(`(${toolCallId})`)}`}
          </Text>
        ))}
      </Box>
    )
  );
}
