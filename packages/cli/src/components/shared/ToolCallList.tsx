import { Box, Text } from 'ink';
import { colors } from 'src/utils/colors';

export function ToolCallList({
  toolCalls,
}: {
  toolCalls: { toolName: string; toolCallId: string; output?: unknown }[];
}) {
  return (
    toolCalls.length > 0 && (
      <Box flexDirection="column" marginLeft={3}>
        {toolCalls.map(({ toolName, toolCallId, output }, index) => {
          const statusIcon =
            output !== undefined ? colors.success('✓') : colors.warning('○');
          return (
            <Text key={toolCallId}>
              {index === toolCalls.length - 1 ? '╰─' : '├─'}
              {` 🔧 ${statusIcon} ${
                output !== undefined
                  ? colors.success(toolName)
                  : colors.warning(toolName)
              } ${colors.muted(`(${toolCallId})`)}`}
            </Text>
          );
        })}
      </Box>
    )
  );
}
