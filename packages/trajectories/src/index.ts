/**
 * @tally/trajectories
 * 
 * A framework-agnostic trajectory generation package for building multi-turn conversation trajectories.
 */

// Core types
export type {
	Trajectory,
	TrajectoryMode,
	Persona,
	TrajectoryStep,
	StorageConfig,
	StepTrace,
	TrajectoryResult,
	TrajectoryStopReason,
	AgentHandle,
} from './core/types.js';

// Storage
export type { Storage } from './core/storage/interface.js';
export { LocalStorage } from './core/storage/localStorage.js';
export { NoopStorage } from './core/storage/noopStorage.js';

// Orchestrator
export { createTrajectory, runTrajectory } from './core/orchestrator.js';
export type { RunTrajectoryOptions } from './core/orchestrator.js';

// Agent wrappers
export { withAISdkAgent, withMastraAgent } from './wrappers/index.js';

// Policies
export { StrictPolicy, LoosePolicy } from './policies/index.js';
export type { PolicyContext, PolicyResult } from './policies/index.js';

// User generator
export { generateUserMessage } from './core/userGenerator.js';
export type { UserMessageContext } from './core/userGenerator.js';

// Prompt utilities
export { buildPromptFromHistory, historyToMessages } from './utils/prompt.js';

// Logger utilities
export { logStep, logTrajectoryStart, logTrajectoryEnd } from './utils/logger.js';

// Output helpers
export { toJSONL, toConversation, summarize } from './utils/output.js';

