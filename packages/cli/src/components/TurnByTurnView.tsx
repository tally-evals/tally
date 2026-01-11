/**
 * Turn-by-turn scrollable view for detailed metrics
 */

import type { Conversation, EvaluationReport } from '@tally-evals/core';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { colors } from 'src/utils/colors.js';
import { ConversationTurn } from './shared/ConversationTurn';
import { MetricsTable } from './shared/MetricsTable';

type MetricScope = 'single' | 'multi';
type CliMetric = React.ComponentProps<typeof ConversationTurn>['metrics'][number];

function getMetricScope(metric: CliMetric): MetricScope | undefined {
  return (metric.metricDef as unknown as { scope?: MetricScope }).scope;
}

function asStringMap<V>(
  value: Record<string, V> | Map<string, V> | undefined
): Map<string, V> | undefined {
  if (!value) return undefined;
  if (value instanceof Map) return value;
  return new Map(Object.entries(value));
}

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

    // Navigation:
    // - Arrow keys (Ink)
    // - Vim keys (j/k)
    // - Raw ANSI sequences as a fallback for terminals where Ink doesn't detect `upArrow`
    const isUp =
      key.upArrow ||
      key.leftArrow ||
      input === 'k' ||
      input === 'K' ||
      input === '\u001b[A' ||
      input === '\u001b[D';
    const isDown =
      key.downArrow ||
      key.rightArrow ||
      input === 'j' ||
      input === 'J' ||
      input === '\u001b[B' ||
      input === '\u001b[C';

    if (isUp) {
      setScrollPosition((prev) => Math.max(0, prev - 1));
    }
    if (isDown) {
      setScrollPosition((prev) => Math.min(conversation.steps.length - 1, prev + 1));
    }
  });

  const perTargetResult = report.perTargetResults[0];
  if (!perTargetResult) {
    return <Text>{colors.error('No target results found in report')}</Text>;
  }

  const rawMetrics = perTargetResult.rawMetrics as unknown as CliMetric[];

  const singleTurnMetrics = rawMetrics.filter((m) => getMetricScope(m) === 'single');

  const multiTurnMetrics = rawMetrics.filter((m) => getMetricScope(m) === 'multi');

  const metricsByName = new Map<string, CliMetric[]>();
  for (const metric of singleTurnMetrics) {
    const name = metric.metricDef.name;
    if (!metricsByName.has(name)) {
      metricsByName.set(name, []);
    }
    metricsByName.get(name)?.push(metric);
  }

  const currentTurnMetrics: CliMetric[] = [];
  for (const metrics of metricsByName.values()) {
    if (scrollPosition < metrics.length) {
      const metric = metrics[scrollPosition];
      if (metric) currentTurnMetrics.push(metric);
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
          {colors.muted(`(Turn ${scrollPosition + 1}/${conversation.steps.length})`)}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1} marginTop={1}>
        <ConversationTurn
          stepIndex={scrollPosition}
          step={currentStep}
          metrics={currentTurnMetrics}
          verdicts={asStringMap(perTargetResult.verdicts)}
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
                verdicts={asStringMap(perTargetResult.verdicts)}
                metricToEvalMap={asStringMap(report.metricToEvalMap)}
                maxReasoningLength={expanded ? 100 : 40}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
