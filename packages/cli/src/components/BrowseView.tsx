/**
 * Interactive directory browser for browsing .tally conversations
 */

import type { ConversationRef, RunRef, TallyStore } from '@tally-evals/core';
import type { Conversation, EvaluationReport } from '@tally-evals/core';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type React from 'react';
import { useEffect, useState } from 'react';
import { colors } from '../utils/colors.js';
import { CompareView } from './CompareView.js';
import { ViewRouter } from './ViewRouter.js';
import { KeyboardHelp } from './shared/KeyboardHelp.js';

interface BrowseViewProps {
  store: TallyStore;
}

type BrowseScreen = 'conversations' | 'runs' | 'view' | 'compare';

export function BrowseView({ store }: BrowseViewProps): React.ReactElement {
  const [screen, setScreen] = useState<BrowseScreen>('conversations');
  const [conversations, setConversations] = useState<ConversationRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConversation, setSelectedConversation] = useState<ConversationRef | null>(null);
  const [selectedRuns, setSelectedRuns] = useState<RunRef[]>([]);
  const [availableRuns, setAvailableRuns] = useState<RunRef[]>([]);
  const [runCounts, setRunCounts] = useState<Map<string, number>>(new Map());

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [leftReport, setLeftReport] = useState<EvaluationReport | null>(null);
  const [rightReport, setRightReport] = useState<EvaluationReport | null>(null);

  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        const convRefs = await store.listConversations();
        setConversations(convRefs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [store]);

  // Load run counts for all conversations (so the conversations list shows correct counts).
  useEffect(() => {
    if (conversations.length === 0) return;

    let cancelled = false;

    const loadCounts = async () => {
      const results = await Promise.all(
        conversations.map(async (conv) => {
          try {
            const runs = await conv.listRuns();
            return [conv.id, runs.length] as const;
          } catch {
            return [conv.id, 0] as const;
          }
        })
      );

      if (cancelled) return;
      setRunCounts(new Map(results));
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [conversations]);

  // Load available runs when conversation is selected
  useEffect(() => {
    if (!selectedConversation) {
      setAvailableRuns([]);
      return;
    }

    const loadRuns = async () => {
      try {
        const runs = await selectedConversation.listRuns();
        setAvailableRuns(runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      }
    };
    loadRuns();
  }, [selectedConversation]);

  // Load conversation and report when entering view screen
  useEffect(() => {
    if (screen === 'view' && selectedConversation && selectedRuns.length === 1) {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          const convData = await selectedConversation.load();
          const reportData = (await selectedRuns[0]?.load()) as EvaluationReport;
          setConversation(convData);
          setReport(reportData);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [screen, selectedConversation, selectedRuns]);

  // Load conversation and reports when entering compare screen
  useEffect(() => {
    if (screen === 'compare' && selectedConversation && selectedRuns.length === 2) {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          const [convData, leftData, rightData] = await Promise.all([
            selectedConversation.load(),
            selectedRuns[0]?.load(),
            selectedRuns[1]?.load(),
          ]);
          setConversation(convData);
          setLeftReport(leftData as EvaluationReport);
          setRightReport(rightData as EvaluationReport);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [screen, selectedConversation, selectedRuns]);

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.escape && screen !== 'conversations') {
      if (screen === 'view' || screen === 'compare') {
        setScreen('runs');
        setSelectedRuns([]);
        setSelectedIndices(new Set());
        setCursorPosition(0);
      } else if (screen === 'runs') {
        setScreen('conversations');
        setSelectedConversation(null);
        setSelectedRuns([]);
        setSelectedIndices(new Set());
        setCursorPosition(0);
      }
    }

    if (screen === 'runs' && selectedConversation) {
      const runs = availableRuns;

      if (key.upArrow) {
        setCursorPosition((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setCursorPosition((prev) => Math.min(runs.length - 1, prev + 1));
      } else if (input === ' ') {
        setSelectedIndices((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(cursorPosition)) {
            newSet.delete(cursorPosition);
          } else {
            newSet.add(cursorPosition);
          }
          return newSet;
        });
      } else if (input === '\r' || input === '\n') {
        const selectedRuns = Array.from(selectedIndices)
          .sort()
          .map((idx) => runs[idx])
          .filter((run): run is RunRef => run !== undefined);

        if (selectedRuns.length === 0) {
          setSelectedRuns([runs[cursorPosition] as RunRef]);
          setScreen('view');
        } else if (selectedRuns.length === 1) {
          setSelectedRuns(selectedRuns);
          setScreen('view');
        } else if (selectedRuns.length === 2) {
          setSelectedRuns(selectedRuns);
          setScreen('compare');
        }
      }
    }
  });

  if (loading && conversations.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.info('Loading conversations...')}</Text>
      </Box>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{colors.error('Error:')}</Text>
        <Text>{error}</Text>
        <Text>{colors.muted('Press q to quit')}</Text>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>{colors.warning('No conversations found')}</Text>
        <KeyboardHelp shortcuts={[{ key: 'q', description: 'Quit' }]} />
      </Box>
    );
  }

  if (screen === 'conversations') {
    const conversationItems = conversations.map((conv) => {
      // Show cached run counts for all conversations (updated in the background).
      // Fallback: if currently selected, use loaded runs; otherwise default to 0 until cached.
      const cached = runCounts.get(conv.id);
      const runCount =
        cached ?? (conv.id === selectedConversation?.id ? availableRuns.length : 0);
      return {
        key: conv.id,
        label: `${colors.bold(conv.id)} ${colors.muted(`(${runCount} runs)`)}`,
        value: conv,
      };
    });

    return (
      <Box flexDirection="column">
        <Text>{colors.bold('Select a Conversation')}</Text>
        <Box marginTop={1} flexDirection="column">
          <SelectInput
            items={conversationItems}
            onSelect={(item) => {
              setSelectedConversation(item.value);
              setScreen('runs');
              setCursorPosition(0);
              setSelectedIndices(new Set());
            }}
          />
        </Box>
        <KeyboardHelp shortcuts={[{ key: 'q', description: 'Quit' }]} />
      </Box>
    );
  }

  if (screen === 'runs' && selectedConversation) {
    if (availableRuns.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>
            {colors.warning('No runs found for')} {selectedConversation.id}
          </Text>
          <KeyboardHelp
            shortcuts={[
              { key: 'Esc', description: 'Back' },
              { key: 'q', description: 'Quit' },
            ]}
          />
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Box paddingX={1} paddingBottom={1}>
          <Text>
            {colors.bold('Select runs')} {colors.muted(`(${selectedIndices.size} selected)`)}
          </Text>
        </Box>

        <Box flexDirection="column" marginLeft={1} marginBottom={1}>
          {availableRuns.map((run, index) => {
            const isSelected = selectedIndices.has(index);
            const isCursor = index === cursorPosition;
            const checkbox = isSelected ? colors.success('◼') : '◻';
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
            ...(selectedIndices.size <= 2
              ? [
                  {
                    key: 'Enter',
                    description: selectedIndices.size === 2 ? 'Compare' : 'View',
                  },
                ]
              : []),
            { key: 'Esc', description: 'Back' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  if (screen === 'view' && selectedConversation && selectedRuns.length === 1) {
    if (loading) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text>{colors.info('Loading conversation and report...')}</Text>
        </Box>
      );
    }

    if (error) {
      return (
        <Box flexDirection="column">
          <Text>{colors.error('✗ Error loading data:')}</Text>
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

    if (conversation && report) {
      return (
        <ViewRouter
          conversation={conversation}
          report={report}
          onBack={() => {
            setScreen('runs');
            setSelectedRuns([]);
            setSelectedIndices(new Set());
            setCursorPosition(0);
            setConversation(null);
            setReport(null);
          }}
        />
      );
    }

    return (
      <Box flexDirection="column">
        <Text>{colors.error('✗ Failed to load data')}</Text>
        <KeyboardHelp
          shortcuts={[
            { key: 'Esc', description: 'Back' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  if (screen === 'compare' && selectedConversation && selectedRuns.length === 2) {
    if (loading) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text>{colors.info('Loading conversation and reports...')}</Text>
        </Box>
      );
    }

    if (error) {
      return (
        <Box flexDirection="column">
          <Text>{colors.error('✗ Error loading data:')}</Text>
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

    if (conversation && leftReport && rightReport) {
      return (
        <CompareView
          conversation={conversation}
          leftReport={leftReport}
          rightReport={rightReport}
          onBack={() => {
            setScreen('runs');
            setSelectedRuns([]);
            setSelectedIndices(new Set());
            setCursorPosition(0);
            setConversation(null);
            setLeftReport(null);
            setRightReport(null);
          }}
        />
      );
    }

    return (
      <Box flexDirection="column">
        <Text>{colors.error('✗ Failed to load data')}</Text>
        <KeyboardHelp
          shortcuts={[
            { key: 'Esc', description: 'Back' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{colors.error('Invalid state')}</Text>
      <KeyboardHelp shortcuts={[{ key: 'q', description: 'Quit' }]} />
    </Box>
  );
}
