/**
 * HIL (Human-in-the-Loop) module
 *
 * Re-exports all public HIL types and functions.
 */

export { resolveHILCalls } from './handler.js';
export type { HILResolutionResult } from './handler.js';
export { generateHILDecision, toHILDecision } from './prompt.js';

export type {
	HILToolCall,
	HILApproveDecision,
	HILRejectDecision,
	HILDecision,
	HILContext,
	HILHandler,
	HILToolPolicy,
	HILConfig,
	HILInteraction,
} from './types.js';
