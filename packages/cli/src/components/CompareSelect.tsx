/**
 * Compare selection component - allows user to select two runs to compare
 */

import type { ConversationRef, RunRef } from '@tally-evals/core';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useEffect, useState } from 'react';
import { colors } from '../utils/colors';
import { KeyboardHelp } from './shared/KeyboardHelp';

interface CompareSelectProps {
  conversation: ConversationRef;
  onSelect: (leftRun: RunRef, rightRun: RunRef) => void;
  onCancel: () => void;
}

export function CompareSelect({
  conversation,
  onSelect,
  onCancel,
}: CompareSelectProps): React.ReactElement {
  const [runs, setRuns] = useState<RunRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    const loadRuns = async () => {
      try {
        setLoading(true);
        const availableRuns = await conversation.listRuns();
        setRuns(availableRuns);
      } catch (_err) {
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, [conversation]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setCursorPosition((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursorPosition((prev) => Math.min(runs.length - 1, prev + 1));
    } else if (input === ' ') {
      setSelectedIndices((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(cursorPosition)) {
          newSet.delete(cursorPosition);
        } else if (newSet.size < 2) {
          newSet.add(cursorPosition);
        }
        return newSet;
      });
    } else if (input === '\r' || input === '\n') {
      if (selectedIndices.size === 2) {
        const indices = Array.from(selectedIndices).sort();
        const leftRun = runs[indices[0] as number];
        const rightRun = runs[indices[1] as number];
        if (leftRun && rightRun) {
          onSelect(leftRun, rightRun);
        }
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.info('Loading runs...')}</Text>
      </Box>
    );
  }

  if (runs.length < 2) {
    return (
      <Box flexDirection="column">
        <Text>{colors.error('Not enough runs to compare')}</Text>
        <Text>
          {colors.info('Found')} {runs.length} {colors.info('run(s), need at least 2')}
        </Text>
        <KeyboardHelp shortcuts={[{ key: 'q', description: 'Back' }]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingBottom={1}>
        <Text>
          {colors.bold('Select two runs to compare')}{' '}
          {colors.muted(`(${selectedIndices.size}/2 selected)`)}
        </Text>
      </Box>

      <Box flexDirection="column" marginLeft={1} marginBottom={1}>
        {runs.map((run, index) => {
          const isSelected = selectedIndices.has(index);
          const isCursor = index === cursorPosition;
          const checkbox = isSelected ? colors.success('☑') : '☐';
          const prefix = isCursor ? colors.info('> ') : '  ';
          const label = isCursor
            ? colors.info(run.id ?? 'unknown')
            : isSelected
              ? colors.success(run.id ?? 'unknown')
              : (run.id ?? 'unknown');

          return (
            <Text key={run.id ?? `run-${index}`}>
              {prefix}
              {checkbox} {label}
            </Text>
          );
        })}
      </Box>

      <KeyboardHelp
        shortcuts={[
          { key: '↑↓', description: 'Navigate' },
          { key: 'Space', description: 'Select' },
          { key: 'Enter', description: 'Compare' },
          { key: 'q', description: 'Back' },
        ]}
      />
    </Box>
  );
}
