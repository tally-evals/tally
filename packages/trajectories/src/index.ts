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
	MemoryConfig,
	StepTrace,
	TrajectoryResult,
	TrajectoryStopReason,
	AgentHandle,
} from './core/types.js';

// Memory
export type { Memory } from './core/memory/interface.js';
export { LocalMemory } from './core/memory/localMemory.js';
export { NoopMemory } from './core/memory/noopMemory.js';

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

// Output helpers
export { toJSONL, toConversation, summarize } from './utils/output.js';

