/**
 * Tally CLI - Main entry point
 */

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import chalk from 'chalk';
import { BrowseView } from './components/BrowseView.js';
import { ViewRouter } from './components/ViewRouter.js';
import { ConversationFile, RunFile, TallyStore } from '@tally-evals/store';

const program = new Command();

program
  .name('tally')
  .description('Interactive CLI for visualizing Tally evaluation results')
  .version('0.0.0')
  .helpCommand('help', 'Show help information');

program
  .command('browse')
  .option('-d, --directory <directory>', 'Directory to browse')
  .description('Browse .tally runs interactively')
  .action((options: { directory: string | undefined }) => {
    try {
      const tallyStore = TallyStore.create(options.directory);

      console.log(
        chalk.gray(`[tally] Loading .tally runs from: ${tallyStore.path}`),
      );

      render(React.createElement(BrowseView, { store: tallyStore }));
    } catch (err) {
      console.error(
        chalk.red(
          `✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ),
      );
      process.exit(1);
    }
  });

program
  .command('view <conversation>')
  .option('-r, --report <file>', 'Report JSON file path (required)')
  .description('View a single conversation with its evaluation report')
  .action(async (conversation: string, options: any) => {
    try {
      if (!options.report) {
        console.error(chalk.red('✗ Error: --report option is required'));
        console.log(
          chalk.gray('Usage: tally view <conversation> --report <file>'),
        );
        process.exit(1);
      }

      const tallyStore = TallyStore.create();
      const conversations = await tallyStore.conversations();
      const conv = conversations.find(
        (c: ConversationFile) => c.id === conversation,
      );

      if (!conv) {
        throw new Error(`Conversation '${conversation}' not found`);
      }

      const convData = await conv.read();
      const runs = await conv.runs();
      const runFile = runs.find((r: RunFile) => r.id === options.report);

      if (!runFile) {
        throw new Error(`Run '${options.report}' not found`);
      }

      const report = await runFile.read();

      render(
        React.createElement(ViewRouter, { conversation: convData, report }),
      );
    } catch (err) {
      console.error(
        chalk.red(
          `✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ),
      );
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.outputHelp();
}
