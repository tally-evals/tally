/**
 * Core step types for trajectory execution
 */

import type { ModelMessage } from 'ai';

export type StepId = string;

export interface StepDefinition {
	id: StepId;
	instruction: string;
	hints?: readonly string[];
	preconditions?: readonly Precondition[];
	maxAttempts?: number;
	timeoutMs?: number;
	isSatisfied?: (ctx: SatisfactionContext) => boolean | Promise<boolean>;
}

export interface StepGraph {
	steps: readonly StepDefinition[];
	start: StepId;
	terminals?: readonly StepId[];
}

export interface PreconditionContext {
	history: readonly ModelMessage[];
	snapshot: {
		satisfied: Set<StepId>;
		attemptsByStep: Map<StepId, number>;
	};
}

export type Precondition =
	| { type: 'stepSatisfied'; stepId: StepId }
	| {
			type: 'custom';
			name?: string;
			/**
			 * Evaluate whether this precondition is satisfied.
			 * Can be synchronous (returns boolean) or asynchronous (returns Promise<boolean>).
			 * All preconditions are evaluated in parallel when checking step eligibility.
			 */
			evaluate: (ctx: PreconditionContext) => boolean | Promise<boolean>;
	  };

export type StepStatus =
	| 'idle'
	| 'in_progress'
	| 'satisfied'
	| 'blocked'
	| 'failed'
	| 'skipped';

export interface StepRuntimeState {
	stepId: StepId;
	status: StepStatus;
	attempts: number;
	lastUpdatedAt: Date;
}

export interface StepsSnapshot {
	graph: StepGraph;
	steps: readonly StepRuntimeState[];
	current?: StepId;
}

export interface SatisfactionContext {
	history: readonly ModelMessage[];
	snapshot: {
		satisfied: Set<StepId>;
		attemptsByStep: Map<StepId, number>;
	};
	step: StepDefinition;
	state: StepRuntimeState;
}

export interface StepSelectorResult {
	candidates: readonly { stepId: StepId; score: number; reasons?: string[] }[];
	chosen: StepId | null;
}

