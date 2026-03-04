/**
 * Turn-by-turn scrollable view for detailed metrics
 */

import type { Conversation, TallyRunArtifact } from '@tally-evals/core';
import { createTargetRunView } from '@tally-evals/tally';
import { Box, Text, useInput, useStdout } from 'ink';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { colors } from 'src/utils/colors.js';
import { formatPassAt } from 'src/utils/formatters';
import { ConversationTurn } from './shared/ConversationTurn';
import { MetricsTable } from './shared/MetricsTable';
import { Scrollable } from './shared/Scrollable';

type CliMetricRow = React.ComponentProps<typeof ConversationTurn>['metrics'][number];

interface TurnByTurnViewProps {
  conversation: Conversation;
  report: TallyRunArtifact;
  onToggleView?: () => void;
  onBack?: (() => void) | undefined;
}

export function TurnByTurnView({
  conversation,
  report,
  onToggleView,
  onBack,
}: TurnByTurnViewProps): React.ReactElement {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const expandedRef = useRef(expanded);
  const scrollPositionRef = useRef(scrollPosition);

  const { stdout } = useStdout();

  const terminalHeight = stdout.rows;
  const terminalWidth = stdout.columns;

  const messageAreaHeight = terminalHeight - 12;

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    scrollPositionRef.current = scrollPosition;
  }, [scrollPosition]);

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.escape && onBack) {
      onBack();
    }
    if (input === '\t' || (key?.ctrl && input === 'i')) {
      onToggleView?.();
    }
    if (input === 'e' || input === 'E') {
      setExpanded(!expandedRef.current);
    }

    // Navigation:
    // - Arrow keys (Ink)
    // - Vim keys (j/k)
    // - Raw ANSI sequences as a fallback for terminals where Ink doesn't detect `upArrow`
    const isLeft =
      key.leftArrow ||
      input === 'k' ||
      input === 'K' ||
      input === '\u001b[A' ||
      input === '\u001b[D';
    const isRight =
      key.rightArrow ||
      input === 'j' ||
      input === 'J' ||
      input === '\u001b[B' ||
      input === '\u001b[C';

    if (isLeft) {
      setScrollPosition((prev) => Math.max(0, prev - 1));
    }
    if (isRight) {
      setScrollPosition((prev) =>
        Math.min(conversation.steps.length - 1, prev + 1),
      );
    }
  });

  // Use the type-safe view API for unified access to step and conversation results
  const view = useMemo(() => createTargetRunView(report), [report]);

  // Get step results (single-turn + step-indexed scorers) via unified view API
  const stepResults = view.step(scrollPosition);
  const currentTurnMetrics: CliMetricRow[] = Object.entries(stepResults)
    .map(([evalName, stepRes]) => {
      const evalDef = view.eval(evalName);
      return {
        name: evalName,
        ...(evalDef?.verdict ? { passAt: formatPassAt(evalDef.verdict) } : {}),
        ...(stepRes.measurement.score !== undefined
          ? { score: Number(stepRes.measurement.score) }
          : {}),
        ...(stepRes.measurement.rawValue !== undefined
          ? { rawValue: stepRes.measurement.rawValue as any }
          : {}),
        ...(stepRes.outcome?.verdict !== undefined
          ? { verdict: stepRes.outcome.verdict }
          : {}),
        ...(stepRes.measurement.reasoning !== undefined
          ? { reasoning: stepRes.measurement.reasoning }
          : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentStep = conversation.steps[scrollPosition];
  if (!currentStep) {
    return <Text>{colors.error('No step found at current position')}</Text>;
  }

  // Get conversation-level results (multi-turn + scalar scorers) via unified view API
  const conversationResults = view.conversation();
  const multiTurnRows: CliMetricRow[] = Object.entries(conversationResults).map(
    ([evalName, res]) => {
      const evalDef = view.eval(evalName);
      return {
        name: evalName,
        ...(evalDef?.verdict ? { passAt: formatPassAt(evalDef.verdict) } : {}),
        ...(res.measurement.score !== undefined
          ? { score: Number(res.measurement.score) }
          : {}),
        ...(res.measurement.rawValue !== undefined
          ? { rawValue: res.measurement.rawValue as any }
          : {}),
        ...(res.outcome?.verdict !== undefined ? { verdict: res.outcome.verdict } : {}),
        ...(res.measurement.reasoning !== undefined
          ? { reasoning: res.measurement.reasoning }
          : {}),
      };
    },
  );

  return (
    <Box flexDirection="column" key={`turn-${expanded}`}>
      <Box paddingX={1}>
        <Text>
          {colors.bold(`Conversation: ${conversation.id}`)}{' '}
          {colors.muted(
            `(Turn ${scrollPosition + 1}/${conversation.steps.length})`,
          )}
        </Text>
      </Box>

      <Scrollable height={messageAreaHeight} width={terminalWidth}>
        <ConversationTurn
          stepIndex={scrollPosition}
          step={currentStep}
          metrics={currentTurnMetrics}
          expanded={expanded}
        />

        {multiTurnRows.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Box paddingX={1}>
              <Text>{colors.bold('Multi-turn Metrics')}</Text>
            </Box>
            <Box>
              <MetricsTable
                metrics={multiTurnRows}
                maxReasoningLength={expanded ? 100 : 40}
              />
            </Box>
          </Box>
        )}
      </Scrollable>
    </Box>
  );
}
