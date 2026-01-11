/**
 * Tally CLI - Main entry point
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { BrowseView } from './components/BrowseView.js';
import { ViewRouter } from './components/ViewRouter.js';
import { loadConversationAndTallyReport, openStore } from './data/store.js';

const program = new Command();

program
  .name('tally')
  .description('Interactive CLI for visualizing Tally evaluation results')
  .version('0.0.0')
  .helpCommand('help', 'Show help information');

program
  .command('browse')
  .description('Browse .tally runs interactively')
  .action(async () => {
    try {
      const tallyStore = await openStore();
      render(React.createElement(BrowseView, { store: tallyStore }));
    } catch (err) {
      console.error(chalk.red(`✗ ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('view <conversation>')
  .option('-r, --report <file>', 'Report JSON file path (required)')
  .description('View a single conversation with its evaluation report')
  .action(async (conversation: string, options: { report?: string }) => {
    try {
      if (!options.report) {
        console.error(chalk.red('✗ Error: --report option is required'));
        console.log(chalk.gray('Usage: tally view <conversation> --report <file>'));
        process.exit(1);
      }

      const tallyStore = await openStore();
      const { conversation: convData, report } = await loadConversationAndTallyReport({
        store: tallyStore,
        conversationId: conversation,
        runId: options.report,
      });

      render(React.createElement(ViewRouter, { conversation: convData, report }));
    } catch (err) {
      console.error(chalk.red(`✗ ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.outputHelp();
}
