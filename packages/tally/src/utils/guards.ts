/**
 * Type guards and runtime validation utilities
 * 
 * Provides runtime type checking functions for validating data structures
 * and ensuring type safety at runtime.
 */

import type {
	DatasetItem,
	Conversation,
	ConversationStep,
	MetricDef,
	Score,
	MetricScalar,
} from '@tally/core/types';
import type { ModelMessage } from 'ai';

/**
 * Type guard for ModelMessage
 */
function isModelMessage(value: unknown): value is ModelMessage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const msg = value as Record<string, unknown>;
	return (
		typeof msg.role === 'string' &&
		['user', 'assistant', 'system', 'tool'].includes(msg.role) &&
		msg.content !== undefined
	);
}

/**
 * Type guard for DatasetItem
 */
export function isDatasetItem(value: unknown): value is DatasetItem {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const item = value as Record<string, unknown>;
	return (
		typeof item.id === 'string' &&
		typeof item.prompt === 'string' &&
		typeof item.completion === 'string' &&
		(item.metadata === undefined || typeof item.metadata === 'object')
	);
}

/**
 * Type guard for ConversationStep
 */
export function isConversationStep(value: unknown): value is ConversationStep {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const step = value as Record<string, unknown>;
	return (
		typeof step.stepIndex === 'number' &&
		isModelMessage(step.input) &&
		Array.isArray(step.output) &&
		step.output.every(isModelMessage) &&
		(step.id === undefined || typeof step.id === 'string') &&
		(step.timestamp === undefined || step.timestamp instanceof Date) &&
		(step.metadata === undefined || typeof step.metadata === 'object')
	);
}

/**
 * Type guard for Conversation
 */
export function isConversation(value: unknown): value is Conversation {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const conv = value as Record<string, unknown>;
	return (
		typeof conv.id === 'string' &&
		Array.isArray(conv.steps) &&
		conv.steps.every((step) => isConversationStep(step)) &&
		(conv.metadata === undefined || typeof conv.metadata === 'object')
	);
}

/**
 * Type guard for Score
 * Validates that a number is in the [0, 1] range
 */
export function isScore(value: unknown): value is Score {
	return typeof value === 'number' && value >= 0 && value <= 1;
}

/**
 * Type guard for MetricScalar
 */
export function isMetricScalar(value: unknown): value is MetricScalar {
	return (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'string'
	);
}

/**
 * Type guard for MetricDef
 * Basic validation - checks for required fields
 */
export function isMetricDef(value: unknown): value is MetricDef {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const def = value as Record<string, unknown>;
	return (
		typeof def.name === 'string' &&
		typeof def.valueType === 'string' &&
		(def.valueType === 'number' ||
			def.valueType === 'boolean' ||
			def.valueType === 'string' ||
			def.valueType === 'ordinal') &&
		(def.scope === undefined ||
			def.scope === 'single' ||
			def.scope === 'multi')
	);
}

/**
 * Assert that a value is a DatasetItem, throwing if not
 */
export function assertDatasetItem(
	value: unknown,
	message?: string
): asserts value is DatasetItem {
	if (!isDatasetItem(value)) {
		throw new Error(
			message || `Expected DatasetItem, got ${typeof value}`
		);
	}
}

/**
 * Assert that a value is a Conversation, throwing if not
 */
export function assertConversation(
	value: unknown,
	message?: string
): asserts value is Conversation {
	if (!isConversation(value)) {
		throw new Error(
			message || `Expected Conversation, got ${typeof value}`
		);
	}
}

/**
 * Assert that a value is a Score, throwing if not
 */
export function assertScore(
	value: unknown,
	message?: string
): asserts value is Score {
	if (!isScore(value)) {
		throw new Error(
			message || `Expected Score in [0, 1] range, got ${value}`
		);
	}
}

