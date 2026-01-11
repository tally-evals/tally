/**
 * Tally directory scanning utilities
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Find .tally directory by scanning current and parent directories
 *
 * If not found, creates one in the current working directory.
 *
 * @param startPath - Starting path to search from (defaults to cwd)
 * @returns Path to .tally directory
 */
export function scanTallyDirectory(startPath: string = process.cwd()): string {
  let currentPath = resolve(startPath);

  while (true) {
    const tallyPath = join(currentPath, '.tally');

    if (existsSync(tallyPath)) {
      try {
        const stats = statSync(tallyPath);
        if (stats.isDirectory()) {
          const conversationsPath = join(tallyPath, 'conversations');
          if (existsSync(conversationsPath)) {
            const convStats = statSync(conversationsPath);
            if (convStats.isDirectory()) {
              return tallyPath;
            }
          }
        }
      } catch {
        // Ignore errors and continue searching
      }
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached filesystem root
      break;
    }
    currentPath = parentPath;
  }

  // Not found, create in current directory
  const newTallyPath = join(process.cwd(), '.tally');
  const conversationsPath = join(newTallyPath, 'conversations');

  mkdirSync(newTallyPath, { recursive: true });
  mkdirSync(conversationsPath, { recursive: true });

  return newTallyPath;
}

/**
 * Check if a .tally directory exists at or above the given path
 */
export function hasTallyDirectory(startPath: string = process.cwd()): boolean {
  let currentPath = resolve(startPath);

  while (true) {
    const tallyPath = join(currentPath, '.tally');

    if (existsSync(tallyPath)) {
      try {
        const stats = statSync(tallyPath);
        if (stats.isDirectory()) {
          return true;
        }
      } catch {
        // Ignore errors and continue searching
      }
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  return false;
}

/**
 * Get the conversations directory path
 */
export function getConversationsPath(tallyPath: string): string {
  return join(tallyPath, 'conversations');
}

/**
 * Get the path for a specific conversation
 */
export function getConversationPath(tallyPath: string, conversationId: string): string {
  return join(tallyPath, 'conversations', conversationId);
}

/**
 * Get the path for runs within a conversation
 */
export function getRunsPath(tallyPath: string, conversationId: string): string {
  return join(tallyPath, 'conversations', conversationId, 'runs');
}
