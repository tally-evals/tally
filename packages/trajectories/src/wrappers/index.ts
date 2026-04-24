/**
 * Agent wrappers — re-exports from per-runtime modules.
 *
 * Import directly from the sub-modules for better tree-shaking:
 *   import { withAISdkAgent } from '@tally-evals/trajectories/wrappers/ai-sdk'
 *   import { withMastraAgent } from '@tally-evals/trajectories/wrappers/mastra'
 */

export { withAISdkAgent } from './ai-sdk.js';
export { withMastraAgent } from './mastra.js';
export type { MastraAgentLike } from './mastra.js';
