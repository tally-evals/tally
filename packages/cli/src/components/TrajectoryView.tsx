/**
 * Terminal UI for viewing trajectory data with step traces and tool calls
 */

import type { StepTrace, TrajectoryMeta, TallyStore } from '@tally-evals/core';
import { Box, Text, useInput, useStdout } from 'ink';
import { ScrollList, type ScrollListRef } from './shared/TypedScrollList';
import Table from 'cli-table3';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors } from '../utils/colors';
import {
  extractTextFromMessage,
  extractTextFromMessages,
} from '../utils/formatters';
import { KeyboardHelp } from './shared/KeyboardHelp';
import { Scrollable } from './shared/Scrollable';
import { ToolCallList } from './shared/ToolCallList';
import { BreadCrumbs } from './shared/BreadCrumbs';

interface TrajectoryViewProps {
  store: TallyStore;
  conversationId: string;
  onBack: () => void;
}

type UIToolCall = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
};

export function TrajectoryView({
  store,
  conversationId,
  onBack,
}: TrajectoryViewProps): React.ReactElement {
  const listRef = useRef<ScrollListRef>(null);
  const { stdout } = useStdout();

  const [meta, setMeta] = useState<TrajectoryMeta | null>(null);
  const [steps, setSteps] = useState<StepTrace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCurrentStepExpanded, setIsCurrentStepExpanded] = useState(false);
  const [intraStepScroll, setIntraStepScroll] = useState(0);
  const [currentStepHeight, setCurrentStepHeight] = useState(0);
  const [focusedIntraStep, setFocusedIntraStep] = useState(false);
  const [metrics, setMetrics] = useState({
    offset: 0,
    max: 0,
    viewport: 0,
  });

  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns - 4;

  const viewportHeight = metrics.viewport ?? 0;
  const canScrollWithinStep =
    isCurrentStepExpanded && currentStepHeight > viewportHeight * 0.8;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [metaData, stepsData] = await Promise.all([
          store.loadTrajectoryMeta(conversationId),
          store.loadTrajectoryStepTraces(conversationId),
        ]);

        if (!metaData || !stepsData) {
          setError('No trajectory data found for this conversation');
        } else {
          setMeta(metaData);
          setSteps(stepsData);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load trajectory data',
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [store, conversationId]);

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.escape) {
      if (focusedIntraStep) {
        setFocusedIntraStep(false);
      } else {
        onBack();
      }
      return;
    }

    if (key.upArrow && steps) {
      if (focusedIntraStep && canScrollWithinStep) {
        setIntraStepScroll((prev) => Math.max(0, prev - 1));
      } else if (!focusedIntraStep && !canScrollWithinStep) {
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else {
          setSelectedIndex(steps.length - 1);
        }
        setIntraStepScroll(0);
        setIsCurrentStepExpanded(false);
      } else if (
        !focusedIntraStep &&
        canScrollWithinStep &&
        intraStepScroll === 0
      ) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        setIntraStepScroll(0);
        setFocusedIntraStep(false);
        setIsCurrentStepExpanded(false);
      }
    } else if (key.downArrow && steps) {
      if (focusedIntraStep && canScrollWithinStep) {
        const maxScroll = Math.max(0, currentStepHeight - viewportHeight);
        setIntraStepScroll((prev) => Math.min(maxScroll, prev + 1));
      } else if (!focusedIntraStep && !canScrollWithinStep) {
        if (selectedIndex < steps.length - 1) {
          setSelectedIndex((prev) => Math.min(steps.length - 1, prev + 1));
        } else {
          setSelectedIndex(0);
        }
        setIntraStepScroll(0);
        setIsCurrentStepExpanded(false);
      } else if (
        !focusedIntraStep &&
        canScrollWithinStep &&
        intraStepScroll >= currentStepHeight - viewportHeight
      ) {
        if (selectedIndex < steps.length - 1) {
          setSelectedIndex((prev) => Math.min(steps.length - 1, prev + 1));
        } else {
          setSelectedIndex(0);
        }
        setIntraStepScroll(0);
        setFocusedIntraStep(false);
        setIsCurrentStepExpanded(false);
      }
    } else if (key.pageUp) {
      if (!focusedIntraStep && steps) {
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => Math.max(0, prev - 5));
        } else {
          setSelectedIndex(steps.length - 1);
        }
        setIntraStepScroll(0);
        setIsCurrentStepExpanded(false);
      }
    } else if (key.pageDown) {
      if (!focusedIntraStep && steps) {
        if (selectedIndex < steps.length - 1) {
          setSelectedIndex((prev) => Math.min(steps.length - 1, prev + 5));
        } else {
          setSelectedIndex(0);
        }
        setIntraStepScroll(0);
        setIsCurrentStepExpanded(false);
      }
    }

    if (input === ' ') {
      if (isCurrentStepExpanded && canScrollWithinStep && !focusedIntraStep) {
        setFocusedIntraStep(true);
      } else if (isCurrentStepExpanded) {
        setIsCurrentStepExpanded(false);
        setIntraStepScroll(0);
        setCurrentStepHeight(0);
        setFocusedIntraStep(false);
        listRef.current?.remeasureItem(selectedIndex);
      } else {
        setIsCurrentStepExpanded(true);
        setIntraStepScroll(0);
        listRef.current?.remeasureItem(selectedIndex);
      }
    }
  });

  const updateMetrics = useCallback(() => {
    if (listRef.current) {
      setMetrics({
        offset: listRef.current.getScrollOffset(),
        max: listRef.current.getContentHeight(),
        viewport: listRef.current.getViewportHeight(),
      });
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      listRef.current?.remeasure();
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  useEffect(() => {
    if (isCurrentStepExpanded && canScrollWithinStep && !focusedIntraStep) {
      setFocusedIntraStep(true);
    } else if (
      isCurrentStepExpanded &&
      !canScrollWithinStep &&
      focusedIntraStep
    ) {
      setFocusedIntraStep(false);
    }
  }, [
    isCurrentStepExpanded,
    currentStepHeight,
    metrics.viewport,
    focusedIntraStep,
  ]);

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.info('Loading trajectory data...')}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.error('Error:')}</Text>
        <Text>{error}</Text>
        <KeyboardHelp
          shortcuts={[
            { key: 'Esc', description: 'Back' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  if (!meta || !steps || steps.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.warning('No trajectory data available')}</Text>
        <KeyboardHelp
          shortcuts={[
            { key: 'Esc', description: 'Back' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  const extractToolCalls = (step: StepTrace): UIToolCall[] => {
    const toolCallsMap = new Map<string, UIToolCall>();

    for (const msg of step.agentMessages) {
      const content = msg.content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        if (part && typeof part === 'object') {
          const typedPart = part as unknown as Record<string, unknown>;
          if (typedPart.type === 'tool-call') {
            const toolCallId = typedPart.toolCallId;
            const toolName = typedPart.toolName;
            if (
              typeof toolCallId === 'string' &&
              typeof toolName === 'string'
            ) {
              if (!toolCallsMap.has(toolCallId)) {
                toolCallsMap.set(toolCallId, {
                  toolCallId,
                  toolName,
                  input: typedPart.input ?? typedPart.args,
                });
              }
            }
          }
        }
      }
    }

    for (const msg of step.agentMessages) {
      const content = msg.content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        if (part && typeof part === 'object') {
          const typedPart = part as unknown as Record<string, unknown>;
          if (typedPart.type === 'tool-result') {
            const toolCallId = typedPart.toolCallId;
            if (
              typeof toolCallId === 'string' &&
              toolCallsMap.has(toolCallId)
            ) {
              const toolCall = toolCallsMap.get(toolCallId)!;
              const outputWrapper = typedPart.output;
              if (outputWrapper && typeof outputWrapper === 'object') {
                const outType = (
                  outputWrapper as unknown as Record<string, unknown>
                ).type;
                const outValue = (
                  outputWrapper as unknown as Record<string, unknown>
                ).value;
                if (outType === 'json') {
                  toolCall.output = outValue;
                } else if (outType === 'text') {
                  toolCall.output =
                    typeof outValue === 'string' ? outValue : String(outValue);
                } else if (outValue !== undefined) {
                  toolCall.output = outValue;
                } else {
                  toolCall.output = outputWrapper;
                }
              } else if (typedPart.result !== undefined) {
                toolCall.output = typedPart.result;
              }
            }
          }
        }
      }
    }

    return Array.from(toolCallsMap.values());
  };

  const estimateContentHeight = (step: StepTrace): number => {
    let lines = 2;

    const userText = extractTextFromMessage(step.userMessage);
    const agentText = extractTextFromMessages(step.agentMessages);
    const toolCalls = extractToolCalls(step);

    lines += Math.ceil(userText.length / terminalWidth) + 2;
    lines += Math.ceil(agentText.length / terminalWidth) + 2;

    if (toolCalls.length > 0) {
      lines += 2;
      lines += toolCalls.length + 1;
    }

    if (
      step.selection &&
      step.selection.candidates &&
      step.selection.candidates.length > 0
    ) {
      lines += 2; // Selection Details header
      lines += 1; // Method line
      lines += 3; // Table header + separator
      lines += step.selection.candidates.length; // One row per candidate
      for (const candidate of step.selection.candidates) {
        if (candidate.reasons && candidate.reasons.length > 0) {
          const reasonText = candidate.reasons.join(' | ');
          lines += Math.ceil(reasonText.length / 50); // Assuming ~50 chars per line for reasons column
        }
      }
    }

    if (step.end) {
      lines += 2;
      if (step.end.summary) {
        lines += Math.ceil(step.end.summary.length / terminalWidth);
      }
    }

    return lines;
  };

  const estimateMetaHeight = () => {
    let lines = 8;
    lines += Math.ceil((meta.goal?.length ?? 0) / terminalWidth) + 2;
    if (meta.persona) {
      lines += Math.ceil((meta.persona.name?.length ?? 0) / terminalWidth) + 2;
      lines +=
        Math.ceil((meta.persona.description.length ?? 0) / terminalWidth) + 2;
    }
    return lines;
  };

  const renderExpandedContent = (
    step: StepTrace,
    userText: string,
    agentText: string,
    toolCalls: UIToolCall[],
  ) => {
    let selectionTable = '';
    if (
      step.selection &&
      step.selection.candidates &&
      step.selection.candidates.length > 0
    ) {
      const table = new Table({
        head: [
          colors.bold('Step ID'),
          colors.bold('Score'),
          colors.bold('Reasons'),
        ].map((h) => colors.info(h)),
        style: {
          head: [],
          border: ['grey'],
          compact: false,
        },
        wordWrap: true,
        colWidths: [15, 10, 50],
      });

      for (const candidate of step.selection.candidates) {
        const reasons =
          candidate.reasons && candidate.reasons.length > 0
            ? candidate.reasons.join(' | ')
            : '-';
        table.push([candidate.stepId, candidate.score.toFixed(2), reasons]);
      }

      selectionTable = table.toString();
    }

    return (
      <>
        <Box flexDirection="column" marginBottom={1} paddingX={1} paddingY={0}>
          <Text bold color="green">
            User:
          </Text>
          <Text color="white" wrap="wrap">
            {userText}
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={1} paddingX={1}>
          <Text bold color="yellow">
            Agent:
          </Text>
          <Text color="white" wrap="wrap">
            {agentText}
          </Text>
        </Box>

        {toolCalls.length > 0 && (
          <Box flexDirection="column" marginBottom={1} paddingX={1}>
            <Text bold color="blue">
              Tool Calls:
            </Text>
            <ToolCallList
              toolCalls={toolCalls.map((tc) => ({
                toolName: tc.toolName,
                toolCallId: tc.toolCallId,
                output: tc.output,
              }))}
            />
          </Box>
        )}

        {step.selection && (
          <Box flexDirection="column" paddingX={1}>
            <Text>
              {colors.bold(
                `${
                  step.selection.method === 'none' ? '' : 'Step Candidates | '
                }Selection Method: `,
              )}
              {colors.info(step.selection.method)}
            </Text>
            {selectionTable && (
              <Box flexDirection="column">
                <Text>{selectionTable}</Text>
              </Box>
            )}
          </Box>
        )}

        {step.end && (
          <Box flexDirection="column" paddingX={1}>
            <Text bold color="red">
              Trajectory End
            </Text>
            <Text color="white">
              Reason: {step.end.reason} | Completed:{' '}
              {step.end.completed ? 'Yes' : 'No'}
            </Text>
            {step.end.summary && (
              <Text color="yellow" wrap="wrap">
                {step.end.summary}
              </Text>
            )}
          </Box>
        )}
      </>
    );
  };

  const renderStepItem = (step: StepTrace, stepIndex: number) => {
    const isSelected = stepIndex === selectedIndex;
    const isExpanded = isSelected && isCurrentStepExpanded;

    if (isSelected && isExpanded) {
      const height = estimateContentHeight(step);
      if (height !== currentStepHeight) {
        setCurrentStepHeight(height);
      }
    }

    const userText = extractTextFromMessage(step.userMessage);
    const agentText = extractTextFromMessages(step.agentMessages);
    const toolCalls = extractToolCalls(step);

    return (
      <Box key={stepIndex} flexDirection="column" marginBottom={0}>
        <Box
          flexDirection="row"
          justifyContent="space-between"
          borderStyle={isSelected ? 'double' : 'single'}
          borderColor={isSelected ? 'cyan' : 'gray'}
          paddingX={1}
          paddingY={0}
        >
          <Text
            color={isSelected ? 'cyanBright' : 'blueBright'}
            bold={isSelected}
            wrap="truncate"
          >
            {isSelected ? '▶ ' : '  '}
            Turn {stepIndex + 1} | {step.selection?.method ?? '—'}
            {step.stepId ? ` | ${step.stepId}` : ''}
          </Text>
          <Text>{isExpanded ? '[-]' : '[+]'}</Text>
        </Box>

        {isExpanded ? (
          <Box flexDirection="column">
            {focusedIntraStep && canScrollWithinStep ? (
              <Scrollable
                height={Math.floor(terminalHeight / 2)}
                focusable={focusedIntraStep}
                initialScrollOffset={intraStepScroll}
                onScroll={setIntraStepScroll}
                borderColor="blue"
                borderStyle="single"
              >
                <Box flexDirection="column" paddingX={1} paddingY={1}>
                  {renderExpandedContent(step, userText, agentText, toolCalls)}
                </Box>
              </Scrollable>
            ) : (
              <Box
                flexDirection="column"
                paddingX={1}
                paddingY={1}
                borderStyle="single"
                borderColor="blue"
                marginBottom={1}
              >
                {renderExpandedContent(step, userText, agentText, toolCalls)}
              </Box>
            )}
          </Box>
        ) : (
          <Box paddingX={1} paddingBottom={1}>
            <Text wrap="truncate" color="gray">
              {userText.substring(0, 60)}
              {userText.length > 60 ? '...' : ''}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <BreadCrumbs breadcrumbs={[conversationId, 'Trajectory']} />
      <Box paddingX={1} paddingY={1} flexShrink={0}>
        <Text>
          {colors.bold('Goal:')} {meta.goal}
        </Text>
      </Box>

      <Box paddingX={1} flexDirection="column" marginBottom={1} flexShrink={0}>
        <Text>
          {colors.bold('Metadata:')}{' '}
          {colors.muted(
            `Created: ${new Date(meta.createdAt).toLocaleString()}`,
          )}
          {meta.maxTurns ? colors.muted(` | Max Turns: ${meta.maxTurns}`) : ''}
        </Text>
        {meta.persona && (
          <Text>
            {colors.muted(`Persona: ${meta.persona.name || 'unnamed'}`)}{' '}
            {colors.muted(`(${meta.persona.description})`)}
          </Text>
        )}
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="white">
        <ScrollList
          ref={listRef}
          height={terminalHeight - estimateMetaHeight()}
          width="100%"
          onScroll={updateMetrics}
          onContentHeightChange={updateMetrics}
          selectedIndex={selectedIndex}
          scrollAlignment="auto"
        >
          {steps.map((step, i) => renderStepItem(step, i))}
        </ScrollList>
      </Box>

      <KeyboardHelp
        shortcuts={[
          ...(focusedIntraStep
            ? [
                { key: '↑↓', description: 'Scroll step details' },
                { key: 'Space', description: 'Collapse step' },
              ]
            : [
                { key: '↑↓', description: 'Navigate steps' },
                { key: 'Space', description: 'Expand step' },
                { key: 'PgUp/PgDn', description: 'Jump 5 steps' },
              ]),
          { key: 'Esc', description: 'Back' },
          { key: 'q', description: 'Quit' },
        ]}
      />
    </Box>
  );
}
