import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { TallyStore, findConfigFile } from '@tally-evals/core';
import type { Conversation, EvaluationReport, RunRef } from '@tally-evals/core';

const TALLY_DIR = '.tally';

/**
 * Check if cwd contains a tally project (.tally dir or config file)
 */
export function findTallyProject(cwd: string = process.cwd()): {
  found: boolean;
  tallyDir?: string;
  configFile?: string;
} {
  const tallyDir = resolve(cwd, TALLY_DIR);
  const hasTallyDir = existsSync(tallyDir);
  const configFile = findConfigFile(cwd);

  if (hasTallyDir || configFile) {
    return {
      found: true,
      tallyDir: hasTallyDir ? tallyDir : undefined,
      configFile: configFile ?? undefined,
    };
  }

  return { found: false };
}

/**
 * Open the TallyStore for the current directory.
 * Throws a helpful error if no tally project is found.
 */
export async function openStore(): Promise<TallyStore> {
  const cwd = process.cwd();
  const project = findTallyProject(cwd);

  if (!project.found) {
    throw new Error(
      `No tally project found in ${cwd}\n\n` +
        `To get started:\n` +
        `  1. Create a ${TALLY_DIR}/ directory, or\n` +
        `  2. Add a tally.config.ts file\n\n` +
        `See: https://tally-evals.dev/docs/getting-started`
    );
  }

  return TallyStore.open({ cwd });
}

/**
 * Load a conversation and its tally evaluation report.
 */
export async function loadConversationAndTallyReport(args: {
  store: TallyStore;
  conversationId: string;
  runId: string;
}): Promise<{ conversation: Conversation; report: EvaluationReport }> {
  const { store, conversationId, runId } = args;

  const convRef = await store.getConversation(conversationId);
  if (!convRef) {
    throw new Error(`Conversation '${conversationId}' not found`);
  }

  const [conversation, runs] = await Promise.all([convRef.load(), convRef.listRuns()]);
  const runRef = runs.find((r: RunRef) => r.id === runId);
  if (!runRef) {
    throw new Error(`Run '${runId}' not found`);
  }
  if (runRef.type !== 'tally') {
    throw new Error(`Run '${runId}' is not a tally report run`);
  }

  const report = (await runRef.load()) as EvaluationReport;
  return { conversation, report };
}
