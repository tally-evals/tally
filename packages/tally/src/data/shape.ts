/**
 * Data Shape Adapters
 *
 * Utilities for adapting common data formats to Tally's core types.
 */

import type { DatasetItem, Conversation, ConversationStep } from '@tally/core/types';
import type { ModelMessage } from 'ai';

/**
 * Adapter options for shape transformation
 */
export interface ShapeAdapterOptions {
	/**
	 * Custom field mappings
	 * Maps Tally field names to source field names
	 */
	fieldMappings?: {
		id?: string;
		prompt?: string;
		completion?: string;
		input?: string;
		output?: string;
		metadata?: string;
	};

	/**
	 * Custom ID generator
	 * If provided, generates IDs for items that don't have them
	 */
	generateId?: (index: number, item: unknown) => string;
}

/**
 * Adapt a generic object to DatasetItem
 *
 * @param item - Source object
 * @param index - Index in array (for ID generation)
 * @param options - Adapter options
 * @returns Adapted DatasetItem
 */
export function adaptToDatasetItem(
	item: unknown,
	index: number,
	options?: ShapeAdapterOptions
): DatasetItem {
	if (typeof item !== 'object' || item === null) {
		throw new Error(`Cannot adapt non-object to DatasetItem at index ${index}`);
	}

	const source = item as Record<string, unknown>;
	const mappings = options?.fieldMappings ?? {};

	const idField = mappings.id ?? 'id';
	const promptField = mappings.prompt ?? 'prompt';
	const completionField = mappings.completion ?? 'completion';
	const metadataField = mappings.metadata ?? 'metadata';

	const id =
		(source[idField] as string | undefined) ??
		options?.generateId?.(index, item) ??
		`item-${index}`;

	const prompt = source[promptField];
	const completion = source[completionField];

	if (typeof prompt !== 'string') {
		throw new Error(
			`Missing or invalid "prompt" field at index ${index}. Expected string, got ${typeof prompt}`
		);
	}
	if (typeof completion !== 'string') {
		throw new Error(
			`Missing or invalid "completion" field at index ${index}. Expected string, got ${typeof completion}`
		);
	}

	const metadata =
		source[metadataField] !== undefined
			? (source[metadataField] as Record<string, unknown>)
			: undefined;

	return {
		id,
		prompt,
		completion,
		...(metadata && { metadata }),
	};
}

/**
 * Adapt an array of objects to DatasetItem[]
 *
 * @param items - Source array
 * @param options - Adapter options
 * @returns Adapted DatasetItem array
 */
export function adaptToDataset(
	items: unknown[],
	options?: ShapeAdapterOptions
): DatasetItem[] {
	return items.map((item, index) => adaptToDatasetItem(item, index, options));
}

/**
 * Adapt a generic object to ConversationStep
 *
 * @param step - Source object
 * @param stepIndex - Step index in conversation
 * @param options - Adapter options
 * @returns Adapted ConversationStep
 */
export function adaptToConversationStep(
	step: unknown,
	stepIndex: number,
	options?: ShapeAdapterOptions
): ConversationStep {
	if (typeof step !== 'object' || step === null) {
		throw new Error(
			`Cannot adapt non-object to ConversationStep at index ${stepIndex}`
		);
	}

	const source = step as Record<string, unknown>;
	const mappings = options?.fieldMappings ?? {};

	const inputField = mappings.input ?? 'input';
	const outputField = mappings.output ?? 'output';
	const metadataField = mappings.metadata ?? 'metadata';

	const input = source[inputField];
	const output = source[outputField];

	if (!isModelMessage(input)) {
		throw new Error(
			`Missing or invalid "input" field at step ${stepIndex}. Expected ModelMessage`
		);
	}
	
	// Normalize output: accept both single message (backward compat) and array
	let normalizedOutput: readonly ModelMessage[];
	if (Array.isArray(output)) {
		// Already an array - validate all elements
		if (!output.every(isModelMessage)) {
			throw new Error(
				`Invalid "output" field at step ${stepIndex}. Expected array of ModelMessage`
			);
		}
		normalizedOutput = output;
	} else if (isModelMessage(output)) {
		// Single message - normalize to array for backward compatibility
		normalizedOutput = [output];
	} else {
		throw new Error(
			`Missing or invalid "output" field at step ${stepIndex}. Expected ModelMessage or array of ModelMessage`
		);
	}

	const id =
		(source.id as string | undefined) ??
		options?.generateId?.(stepIndex, step) ??
		`step-${stepIndex}`;

	const timestamp =
		source.timestamp instanceof Date
			? source.timestamp
			: typeof source.timestamp === 'string'
				? new Date(source.timestamp)
				: undefined;

	const metadata =
		source[metadataField] !== undefined
			? (source[metadataField] as Record<string, unknown>)
			: undefined;

	return {
		stepIndex,
		input,
		output: normalizedOutput,
		id,
		...(timestamp && { timestamp }),
		...(metadata && { metadata }),
	};
}

/**
 * Adapt a generic object to Conversation
 *
 * @param conv - Source object
 * @param index - Index in array (for ID generation)
 * @param options - Adapter options
 * @returns Adapted Conversation
 */
export function adaptToConversation(
	conv: unknown,
	index: number,
	options?: ShapeAdapterOptions
): Conversation {
	if (typeof conv !== 'object' || conv === null) {
		throw new Error(`Cannot adapt non-object to Conversation at index ${index}`);
	}

	const source = conv as Record<string, unknown>;

	const id =
		(source.id as string | undefined) ??
		options?.generateId?.(index, conv) ??
		`conversation-${index}`;

	const stepsSource = source.steps;
	if (!Array.isArray(stepsSource)) {
		throw new Error(
			`Missing or invalid "steps" field at index ${index}. Expected array`
		);
	}

	const steps = stepsSource.map((step, stepIndex) =>
		adaptToConversationStep(step, stepIndex, options)
	);

	const metadata =
		source.metadata !== undefined
			? (source.metadata as Record<string, unknown>)
			: undefined;

	return {
		id,
		steps,
		...(metadata && { metadata }),
	};
}

/**
 * Adapt an array of objects to Conversation[]
 *
 * @param conversations - Source array
 * @param options - Adapter options
 * @returns Adapted Conversation array
 */
export function adaptToConversations(
	conversations: unknown[],
	options?: ShapeAdapterOptions
): Conversation[] {
	return conversations.map((conv, index) =>
		adaptToConversation(conv, index, options)
	);
}

/**
 * Type guard for ModelMessage (from AI SDK)
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

