/**
 * Router component for switching between summary and turn-by-turn views
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../utils/colors.js';
import { SummaryView } from './SummaryView.js';
import { TurnByTurnView } from './TurnByTurnView.js';
import { KeyboardHelp } from './shared/KeyboardHelp.js';
import type { ViewMode } from '../types/index.js';
import { Conversation, EvaluationReport } from '@tally-evals/tally';

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
                { key: '↑↓', description: 'Navigate turns' },
                { key: 'e', description: 'Expand/Clip' },
              ]
            : []),
        ]}
      />
    </Box>
  );
}
