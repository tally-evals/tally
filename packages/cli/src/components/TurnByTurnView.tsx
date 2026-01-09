/**
 * Turn-by-turn scrollable view for detailed metrics
 */

import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConversationTurn } from './shared/ConversationTurn.js';
import { MetricsTable } from './shared/MetricsTable.js';
import { colors } from 'src/utils/colors.js';
import { Conversation, EvaluationReport } from '@tally-evals/tally';

interface TurnByTurnViewProps {
  conversation: Conversation;
  report: EvaluationReport;
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
    if (key.upArrow || key.leftArrow) {
      setScrollPosition((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || key.rightArrow) {
      setScrollPosition((prev) =>
        Math.min(conversation.steps.length - 1, prev + 1),
      );
    }
  });

  const perTargetResult = report.perTargetResults[0];
  if (!perTargetResult) {
    return <Text>{colors.error('No target results found in report')}</Text>;
  }

  const singleTurnMetrics = perTargetResult.rawMetrics.filter(
    (m: any) =>
      (m.metricDef as unknown as { scope?: string }).scope === 'single',
  );

  const multiTurnMetrics = perTargetResult.rawMetrics.filter(
    (m: any) =>
      (m.metricDef as unknown as { scope?: string }).scope === 'multi',
  );

  const metricsByName = new Map<string, any[]>();
  for (const metric of singleTurnMetrics) {
    const name = metric.metricDef.name;
    if (!metricsByName.has(name)) {
      metricsByName.set(name, []);
    }
    metricsByName.get(name)!.push(metric);
  }

  const currentTurnMetrics: any[] = [];
  for (const [_, metrics] of metricsByName) {
    if (scrollPosition < metrics.length) {
      currentTurnMetrics.push(metrics[scrollPosition]);
    }
  }

  const currentStep = conversation.steps[scrollPosition];
  if (!currentStep) {
    return <Text>{colors.error('No step found at current position')}</Text>;
  }

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

      <Box flexDirection="column" marginBottom={1} marginTop={1}>
        <ConversationTurn
          stepIndex={scrollPosition}
          step={currentStep}
          metrics={currentTurnMetrics}
          verdicts={perTargetResult.verdicts}
          expanded={expanded}
        />

        {multiTurnMetrics.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Box paddingX={1}>
              <Text>{colors.bold('Multi-turn Metrics')}</Text>
            </Box>
            <Box>
              <MetricsTable
                metrics={multiTurnMetrics}
                verdicts={perTargetResult.verdicts}
                metricToEvalMap={report.metricToEvalMap}
                maxReasoningLength={expanded ? 100 : 40}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
