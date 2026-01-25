/**
 * @tally/trajectories
 * 
 * A framework-agnostic trajectory generation package for building multi-turn conversation trajectories.
 */

// Core types
export type {
	Trajectory,
	Persona,
	StepTrace,
	TrajectoryResult,
	TrajectoryStopReason,
	AgentHandle,
} from './core/types.js';

// Step types
export type {
	StepId,
	StepDefinition,
	StepGraph,
	Precondition,
	PreconditionContext,
	StepStatus,
	StepRuntimeState,
	StepsSnapshot,
	SatisfactionContext,
} from './core/steps/types.js';

// Storage
// NOTE: AgentMemory is intentionally internal-only. The public API persists via core TallyStore.

// Orchestrator
export { createTrajectory, runTrajectory } from './core/orchestrator.js';
export type { RunTrajectoryOptions } from './core/orchestrator.js';

// Agent wrappers
export { withAISdkAgent, withMastraAgent } from './wrappers/index.js';

// Policies
export { DefaultPolicy } from './policies/index.js';
export type { PolicyContext, PolicyResult } from './policies/index.js';

// User generator
export { generateUserMessage } from './core/userGenerator.js';
export type { UserMessageContext } from './core/userGenerator.js';

// Prompt utilities
export { buildPromptFromMessages, messagesToMessages } from './utils/prompt.js';

// Logger utilities
export { logStep, logTrajectoryStart, logTrajectoryEnd } from './utils/logger.js';

// Output helpers
export { toJSONL, toConversation, summarize } from './utils/output.js';

