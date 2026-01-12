/**
 * Utility to find .tally directory by scanning current and parent directories
 */
import { existsSync, statSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';

/**
 * Find .tally directory by scanning current and parent directories
 * If not found, creates one in the current working directory
 * @param startPath Starting path to search from (defaults to current working directory)
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
      } catch {}
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }

  const newTallyPath = join(process.cwd(), '.tally');
  const conversationsPath = join(newTallyPath, 'conversations');

  mkdirSync(newTallyPath, { recursive: true });
  mkdirSync(conversationsPath, { recursive: true });

  return newTallyPath;
}
