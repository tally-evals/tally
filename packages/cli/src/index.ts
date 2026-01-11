/**
 * Tally CLI - Main entry point
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { BrowseView } from './components/BrowseView';
import { ViewRouter } from './components/ViewRouter';
import { loadConversationAndTallyReport, openStore } from './data/store';

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

program
  .command('serve')
  .description('Start web viewer for browsing conversations and trajectories')
  .option('-p, --port <port>', 'Port to listen on', '4321')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options: { port: string; open: boolean }) => {
    try {
      const port = Number.parseInt(options.port, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red('✗ Invalid port number'));
        process.exit(1);
      }

      // Verify we have a tally project
      try {
        await openStore();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(chalk.red('✗ Cannot start web viewer'));
        console.error(chalk.gray(msg));
        console.error(
          chalk.gray(
            `\nHint: run \`tally serve\` from a directory that contains a \`.tally/\` folder (or a \`tally.config.ts\`).\n` +
              `      Current directory: ${process.cwd()}`
          )
        );
        process.exit(1);
      }

      // Find viewer package path (relative to this file in dist or src)
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const viewerPath = resolve(__dirname, '../../viewer/src/index.tsx');

      console.log(chalk.green('✓ Starting Tally web viewer...'));
      console.log(chalk.gray(`  Local: ${chalk.cyan(`http://localhost:${port}`)}`));
      console.log(chalk.gray('\n  Press Ctrl+C to stop\n'));

      // Spawn the viewer using bun
      const proc = Bun.spawn(['bun', '--hot', viewerPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(port),
          TALLY_CWD: process.cwd(),
        },
        stdout: 'inherit',
        stderr: 'inherit',
      });

      // Open browser if not disabled (after a short delay)
      if (options.open) {
        setTimeout(() => {
          const url = `http://localhost:${port}`;
          const openCmd =
            process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';
          Bun.spawn([openCmd, url], { stdout: 'ignore', stderr: 'ignore' });
        }, 1000);
      }

      // Wait for the process
      await proc.exited;
    } catch (err) {
      console.error(chalk.red(`✗ ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.outputHelp();
}
