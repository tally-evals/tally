/**
 * Interactive directory browser for browsing .tally conversations
 */

import type { ConversationRef, RunRef, TallyStore } from '@tally-evals/core';
import type { Conversation, EvaluationReport } from '@tally-evals/core';
import { Box, Text, useInput, useStdout } from 'ink';
import { ScrollList, type ScrollListRef } from './shared/TypedScrollList';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { colors } from '../utils/colors';
import { CompareView } from './CompareView';
import { TrajectoryView } from './TrajectoryView';
import { ViewRouter } from './ViewRouter';
import { KeyboardHelp } from './shared/KeyboardHelp';
import { BreadCrumbs } from './shared/BreadCrumbs';

interface BrowseViewProps {
  store: TallyStore;
}

type BrowseScreen =
  | 'conversations'
  | 'runs'
  | 'view'
  | 'compare'
  | 'trajectory';

export function BrowseView({ store }: BrowseViewProps): React.ReactElement {
  const [screen, setScreen] = useState<BrowseScreen>('conversations');
  const [conversations, setConversations] = useState<ConversationRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConversation, setSelectedConversation] =
    useState<ConversationRef | null>(null);
  const [selectedRuns, setSelectedRuns] = useState<RunRef[]>([]);
  const [availableRuns, setAvailableRuns] = useState<RunRef[]>([]);
  const [runCounts, setRunCounts] = useState<Map<string, number>>(new Map());
  const [hasTrajectory, setHasTrajectory] = useState<Map<string, boolean>>(
    new Map(),
  );

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [leftReport, setLeftReport] = useState<EvaluationReport | null>(null);
  const [rightReport, setRightReport] = useState<EvaluationReport | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);
  const [selectedRunsSet, setSelectedRunsSet] = useState<Set<number>>(
    new Set(),
  );

  const { stdout } = useStdout();
  const conversationListRef = useRef<ScrollListRef>(null);
  const runsListRef = useRef<any>(null);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        const convRefs = await store.listConversations();
        setConversations(convRefs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load conversations',
        );
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [store]);

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
        }),
      );

      if (cancelled) return;
      setRunCounts(new Map(results));
    };

    const loadTrajectoryData = async () => {
      const trajectoryResults = await Promise.all(
        conversations.map(async (conv) => {
          try {
            const trajectoryMeta = await store.loadTrajectoryMeta(conv.id);
            return [conv.id, trajectoryMeta !== null] as const;
          } catch {
            return [conv.id, false] as const;
          }
        }),
      );

      if (cancelled) return;
      setHasTrajectory(new Map(trajectoryResults));
    };

    loadCounts();
    loadTrajectoryData();
    return () => {
      cancelled = true;
    };
  }, [conversations, store]);

  useEffect(() => {
    if (!selectedConversation) {
      setAvailableRuns([]);
      return;
    }

    const loadRuns = async () => {
      try {
        const runs = await selectedConversation.listRuns();
        setAvailableRuns(runs);
        setSelectedIndex(0);
        setSelectedRunsSet(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs');
      }
    };
    loadRuns();
  }, [selectedConversation]);

  useEffect(() => {
    if (
      screen === 'view' &&
      selectedConversation &&
      selectedRuns.length === 1
    ) {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          const convData = await selectedConversation.load();
          const reportData =
            (await selectedRuns[0]?.load()) as EvaluationReport;
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

  useEffect(() => {
    if (
      screen === 'compare' &&
      selectedConversation &&
      selectedRuns.length === 2
    ) {
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
        setSelectedRunsSet(new Set());
      } else if (screen === 'trajectory') {
        setScreen('runs');
        setSelectedRunsSet(new Set());
      } else if (screen === 'runs') {
        setScreen('conversations');
        setSelectedConversation(null);
        setSelectedRuns([]);
        setSelectedRunsSet(new Set());
      }
    }

    if (screen === 'conversations') {
      if (key.upArrow) {
        setSelectedConversationIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedConversationIndex((prev) =>
          Math.min(conversations.length - 1, prev + 1),
        );
      } else if (input === '\r' || input === '\n') {
        const conversation = conversations[selectedConversationIndex];
        if (conversation) {
          setSelectedConversation(conversation);
          setScreen('runs');
          setSelectedRunsSet(new Set());
        }
      }
    }

    if (screen === 'runs' && selectedConversation) {
      const hasTrajectoryData = hasTrajectory.get(selectedConversation.id);
      const trajectoryOffset = hasTrajectoryData ? 1 : 0;
      const totalItems = trajectoryOffset + availableRuns.length;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(totalItems - 1, prev + 1));
      } else if (input === ' ') {
        if (selectedIndex >= trajectoryOffset) {
          const runIdx = selectedIndex - trajectoryOffset;
          setSelectedRunsSet((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(runIdx)) {
              newSet.delete(runIdx);
            } else {
              newSet.add(runIdx);
            }
            return newSet;
          });
        }
      } else if (input === '\r' || input === '\n') {
        if (selectedIndex === 0 && hasTrajectoryData) {
          setScreen('trajectory');
        } else {
          const runIdx = selectedIndex - trajectoryOffset;
          const runs = Array.from(selectedRunsSet)
            .sort()
            .map((idx) => availableRuns[idx])
            .filter((run): run is RunRef => run !== undefined);

          if (runs.length === 0) {
            const run = availableRuns[runIdx];
            if (run) {
              setSelectedRuns([run]);
              setScreen('view');
            }
          } else if (runs.length === 1) {
            setSelectedRuns(runs);
            setScreen('view');
          } else if (runs.length === 2) {
            setSelectedRuns(runs);
            setScreen('compare');
          }
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
    const terminalHeight = stdout?.rows ?? 24;

    return (
      <Box flexDirection="column" height={terminalHeight}>
        <BreadCrumbs breadcrumbs={['Conversations']} />
        <Box paddingX={1} paddingTop={1} flexShrink={0}>
          <Text>{colors.bold('Select a Conversation')}</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <ScrollList
            ref={conversationListRef}
            height={terminalHeight - 8}
            width="100%"
            selectedIndex={selectedConversationIndex}
          >
            {conversations.map((conv, index) => {
              const cached = runCounts.get(conv.id);
              const runCount =
                cached ??
                (conv.id === selectedConversation?.id
                  ? availableRuns.length
                  : 0);
              const isFocused = selectedConversationIndex === index;
              const prefix = isFocused ? colors.info('▶ ') : '  ';
              const label = isFocused ? colors.info(`${conv.id}`) : conv.id;
              return (
                <Text key={conv.id}>
                  {prefix}
                  {label} {colors.muted(`(${runCount} runs)`)}
                </Text>
              );
            })}
          </ScrollList>
        </Box>

        <KeyboardHelp
          shortcuts={[
            { key: '↑↓', description: 'Navigate' },
            { key: 'Enter', description: 'Select' },
            { key: 'q', description: 'Quit' },
          ]}
        />
      </Box>
    );
  }

  if (screen === 'runs' && selectedConversation) {
    const hasTrajectoryData = hasTrajectory.get(selectedConversation.id);
    const terminalHeight = stdout?.rows ?? 24;
    const headerHeight = 5; // Approximate header space
    const runsListHeight = Math.max(5, terminalHeight - headerHeight);
    const trajectoryOffset = hasTrajectoryData ? 1 : 0;

    if (availableRuns.length === 0 && !hasTrajectoryData) {
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
      <Box flexDirection="column" height={terminalHeight}>
        <BreadCrumbs breadcrumbs={[selectedConversation.id]} />
        {hasTrajectoryData && (
          <Box flexDirection="column" marginY={1}>
            <Text
              color={selectedIndex === 0 ? 'cyan' : 'white'}
              bold={selectedIndex === 0}
            >
              {selectedIndex === 0 ? colors.info('▶ ') : '  '}
              📹 Trajectory
            </Text>
          </Box>
        )}

        <Box flexDirection="column" marginBottom={1} marginLeft={2}>
          <Text bold color="white">
            📋 Runs {colors.muted(`(${selectedRunsSet.size} selected)`)}
          </Text>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <ScrollList
            ref={runsListRef}
            height={runsListHeight}
            width="100%"
            selectedIndex={
              selectedIndex >= trajectoryOffset
                ? selectedIndex - trajectoryOffset
                : 0
            }
          >
            {availableRuns.map((run, index) => {
              const isSelected = selectedRunsSet.has(index);
              const isFocused = selectedIndex === index + trajectoryOffset;
              const checkbox = isSelected ? colors.success('◼ ') : '◻ ';
              const prefix = isFocused ? colors.info('▶ ') : '  ';
              const label = isFocused
                ? colors.info(run.id ?? 'unknown')
                : isSelected
                ? colors.success(run.id ?? 'unknown')
                : run.id ?? 'unknown';
              return (
                <Text key={run.id ?? `run-${index}`}>
                  {prefix}
                  {checkbox} {label}
                </Text>
              );
            })}
          </ScrollList>
        </Box>

        <KeyboardHelp
          shortcuts={[
            {
              key: '↑↓',
              description: hasTrajectoryData
                ? 'Navigate (Trajectory/Runs)'
                : 'Navigate runs',
            },
            { key: 'Space', description: 'Select run' },
            ...(selectedRunsSet.size <= 2
              ? [
                  {
                    key: 'Enter',
                    description:
                      selectedRunsSet.size === 2 ? 'Compare' : 'View',
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
            setSelectedRunsSet(new Set());
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

  if (
    screen === 'compare' &&
    selectedConversation &&
    selectedRuns.length === 2
  ) {
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
            setSelectedRunsSet(new Set());
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

  if (screen === 'trajectory' && selectedConversation) {
    return (
      <TrajectoryView
        store={store}
        conversationId={selectedConversation.id}
        onBack={() => {
          setScreen('runs');
          setSelectedRunsSet(new Set());
        }}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{colors.error('Invalid state')}</Text>
      <KeyboardHelp shortcuts={[{ key: 'q', description: 'Quit' }]} />
    </Box>
  );
}
