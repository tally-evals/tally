/**
 * Router component for switching between summary and turn-by-turn views
 */

import type { Conversation, EvaluationReport } from '@tally-evals/core';
import { Box, Text, useInput } from 'ink';
import type React from 'react';
import { useState } from 'react';
import type { ViewMode } from '../types/index';
import { colors } from '../utils/colors';
import { SummaryView } from './SummaryView';
import { TurnByTurnView } from './TurnByTurnView';
import { KeyboardHelp } from './shared/KeyboardHelp';
import { BreadCrumbs } from './shared/BreadCrumbs';

interface ViewRouterProps {
  conversation: Conversation;
  report: EvaluationReport;
  onBack?: () => void;
}

export function ViewRouter({
  conversation,
  report,
  onBack,
}: ViewRouterProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.escape && onBack) {
      onBack();
    }
    if (input === '\t' || key?.tab) {
      setViewMode(viewMode === 'summary' ? 'turn-by-turn' : 'summary');
    }
  });

  return (
    <Box flexDirection="column">
      <BreadCrumbs breadcrumbs={[conversation.id, 'Runs', report.runId]} />
      <Box paddingX={1} paddingTop={1}>
        <Text>
          {colors.bold('View Mode:')}{' '}
          {colors.info(viewMode === 'summary' ? '◉ Summary' : '  Summary')}{' '}
          {colors.muted('|')}{' '}
          {colors.info(
            viewMode === 'turn-by-turn' ? '◉ Turn-by-Turn' : '  Turn-by-Turn',
          )}
        </Text>
      </Box>

      {viewMode === 'summary' ? (
        <SummaryView report={report} />
      ) : (
        <TurnByTurnView
          conversation={conversation}
          report={report}
          onToggleView={() =>
            setViewMode(
              viewMode === 'turn-by-turn' ? 'summary' : 'turn-by-turn',
            )
          }
          onBack={onBack}
        />
      )}

      <KeyboardHelp
        shortcuts={[
          { key: 'Tab', description: 'Toggle view mode' },
          ...(onBack ? [{ key: 'Esc', description: 'Back' }] : []),
          { key: 'q', description: 'Quit' },
          ...(viewMode === 'turn-by-turn'
            ? [
                { key: '⇄', description: 'Navigate turns' },
                { key: 'e', description: 'Expand/Clip' },
              ]
            : []),
        ]}
      />
    </Box>
  );
}
