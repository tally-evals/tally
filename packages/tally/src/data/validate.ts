/**
 * Data Validation
 *
 * Runtime type guards and validation utilities for DatasetItem and Conversation.
 */

import type { DatasetItem, Conversation, ConversationStep } from '@tally/core/types';
import type { ModelMessage } from 'ai';

/**
 * Validate that a value is a DatasetItem
 *
 * @param value - Value to validate
 * @returns True if value is a valid DatasetItem
 */
export function isValidDatasetItem(value: unknown): value is DatasetItem {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const item = value as Record<string, unknown>;

	// Required fields
	if (typeof item.id !== 'string') {
		return false;
	}
	if (typeof item.prompt !== 'string') {
		return false;
	}
	if (typeof item.completion !== 'string') {
		return false;
	}

	// Optional metadata
	if (item.metadata !== undefined && typeof item.metadata !== 'object') {
		return false;
	}

	return true;
}

/**
 * Validate that a value is a ConversationStep
 *
 * @param value - Value to validate
 * @returns True if value is a valid ConversationStep
 */
export function isValidConversationStep(value: unknown): value is ConversationStep {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const step = value as Record<string, unknown>;

	// Required fields
	if (typeof step.stepIndex !== 'number') {
		return false;
	}
	if (!isModelMessage(step.input)) {
		return false;
	}
	if (!Array.isArray(step.output) || !step.output.every(isModelMessage)) {
		return false;
	}

	// Optional fields
	if (step.id !== undefined && typeof step.id !== 'string') {
		return false;
	}
	if (step.timestamp !== undefined && !(step.timestamp instanceof Date)) {
		return false;
	}
	if (step.metadata !== undefined && typeof step.metadata !== 'object') {
		return false;
	}

	return true;
}

/**
 * Validate that a value is a Conversation
 *
 * @param value - Value to validate
 * @returns True if value is a valid Conversation
 */
export function isValidConversation(value: unknown): value is Conversation {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const conv = value as Record<string, unknown>;

	// Required fields
	if (typeof conv.id !== 'string') {
		return false;
	}
	if (!Array.isArray(conv.steps)) {
		return false;
	}

	// Validate all steps
	for (const step of conv.steps) {
		if (!isValidConversationStep(step)) {
			return false;
		}
	}

	// Optional metadata
	if (conv.metadata !== undefined && typeof conv.metadata !== 'object') {
		return false;
	}

	return true;
}

/**
 * Validate an array of DatasetItems
 *
 * @param value - Value to validate
 * @returns True if value is an array of valid DatasetItems
 */
export function isValidDataset(value: unknown): value is DatasetItem[] {
	if (!Array.isArray(value)) {
		return false;
	}

	for (const item of value) {
		if (!isValidDatasetItem(item)) {
			return false;
		}
	}

	return true;
}

/**
 * Validate an array of Conversations
 *
 * @param value - Value to validate
 * @returns True if value is an array of valid Conversations
 */
export function isValidConversations(value: unknown): value is Conversation[] {
	if (!Array.isArray(value)) {
		return false;
	}

	for (const conv of value) {
		if (!isValidConversation(conv)) {
			return false;
		}
	}

	return true;
}

/**
 * Validate that a value is a ModelMessage (from AI SDK)
 *
 * @param value - Value to validate
 * @returns True if value is a valid ModelMessage
 */
function isModelMessage(value: unknown): value is ModelMessage {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const msg = value as Record<string, unknown>;

	// ModelMessage must have a 'role' field
	if (typeof msg.role !== 'string') {
		return false;
	}

	// Common roles: 'user', 'assistant', 'system', 'tool'
	const validRoles = ['user', 'assistant', 'system', 'tool'];
	if (!validRoles.includes(msg.role)) {
		return false;
	}

	// Must have content (string or array)
	if (msg.content === undefined) {
		return false;
	}

	return true;
}

/**
 * Assert that a value is a DatasetItem, throwing if not
 *
 * @param value - Value to assert
 * @param message - Optional error message
 * @throws Error if value is not a valid DatasetItem
 */
export function assertDatasetItem(
	value: unknown,
	message?: string
): asserts value is DatasetItem {
	if (!isValidDatasetItem(value)) {
		throw new Error(message ?? 'Value is not a valid DatasetItem');
	}
}

/**
 * Assert that a value is a Conversation, throwing if not
 *
 * @param value - Value to assert
 * @param message - Optional error message
 * @throws Error if value is not a valid Conversation
 */
export function assertConversation(
	value: unknown,
	message?: string
): asserts value is Conversation {
	if (!isValidConversation(value)) {
		throw new Error(message ?? 'Value is not a valid Conversation');
	}
}

/**
 * Assert that a value is an array of DatasetItems, throwing if not
 *
 * @param value - Value to assert
 * @param message - Optional error message
 * @throws Error if value is not a valid DatasetItem array
 */
export function assertDataset(
	value: unknown,
	message?: string
): asserts value is DatasetItem[] {
	if (!isValidDataset(value)) {
		throw new Error(message ?? 'Value is not a valid DatasetItem array');
	}
}

/**
 * Assert that a value is an array of Conversations, throwing if not
 *
 * @param value - Value to assert
 * @param message - Optional error message
 * @throws Error if value is not a valid Conversation array
 */
export function assertConversations(
	value: unknown,
	message?: string
): asserts value is Conversation[] {
	if (!isValidConversations(value)) {
		throw new Error(message ?? 'Value is not a valid Conversation array');
	}
}

