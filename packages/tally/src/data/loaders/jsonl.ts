/**
 * JSONL Data Loader
 *
 * Loads DatasetItem[] or Conversation[] from JSONL (JSON Lines) files.
 * Supports streaming for large files and validation during load.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { DatasetItem, Conversation } from '@tally/core/types';
import { isValidDatasetItem, isValidConversation } from '../validate';
import type { ShapeAdapterOptions } from '../shape';
import { adaptToDatasetItem, adaptToConversation } from '../shape';

/**
 * Options for JSONL loading
 */
export interface JSONLLoadOptions extends ShapeAdapterOptions {
	/**
	 * Validate items during load
	 * If true, validates each line against DatasetItem or Conversation schema
	 * @default true
	 */
	validate?: boolean;

	/**
	 * Skip invalid lines instead of throwing
	 * If true, logs warnings and continues; if false, throws on first invalid line
	 * @default false
	 */
	skipInvalid?: boolean;

	/**
	 * Expected data type
	 * If 'dataset', validates as DatasetItem[]; if 'conversation', validates as Conversation[]
	 * @default 'dataset'
	 */
	dataType?: 'dataset' | 'conversation';
}

/**
 * Load DatasetItem[] from a JSONL file
 *
 * @param filePath - Path to JSONL file
 * @param options - Load options
 * @returns Promise resolving to DatasetItem array
 */
export async function loadDatasetFromJSONL(
	filePath: string,
	options?: JSONLLoadOptions
): Promise<DatasetItem[]> {
	const items: DatasetItem[] = [];
	const validate = options?.validate ?? true;
	const skipInvalid = options?.skipInvalid ?? false;

	let lineNumber = 0;

	try {
		const fileStream = createReadStream(filePath, { encoding: 'utf8' });
		const rl = createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		for await (const line of rl) {
			lineNumber++;

			// Skip empty lines
			if (line.trim() === '') {
				continue;
			}

			try {
				// Parse JSON line
				const parsed = JSON.parse(line) as unknown;

				// Adapt to DatasetItem
				const item = adaptToDatasetItem(parsed, items.length, options);

				// Validate if requested
				if (validate) {
					if (!isValidDatasetItem(item)) {
				const error = new Error(
					`Invalid DatasetItem at line ${lineNumber}`
				);
				if (skipInvalid) {
					console.warn(error.message);
					continue;
				}
				throw error;
					}
				}

				items.push(item);
			} catch (error) {
				const parseError = new Error(
					`Failed to parse line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`
				);
				if (skipInvalid) {
					console.warn(parseError.message);
					continue;
				}
				throw parseError;
			}
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('line')) {
			throw error;
		}
		throw new Error(
			`Failed to load JSONL file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
		);
	}

	return items;
}

/**
 * Load Conversation[] from a JSONL file
 *
 * @param filePath - Path to JSONL file
 * @param options - Load options
 * @returns Promise resolving to Conversation array
 */
export async function loadConversationsFromJSONL(
	filePath: string,
	options?: JSONLLoadOptions
): Promise<Conversation[]> {
	const conversations: Conversation[] = [];
	const validate = options?.validate ?? true;
	const skipInvalid = options?.skipInvalid ?? false;

	let lineNumber = 0;

	try {
		const fileStream = createReadStream(filePath, { encoding: 'utf8' });
		const rl = createInterface({
			input: fileStream,
			crlfDelay: Number.POSITIVE_INFINITY,
		});

		for await (const line of rl) {
			lineNumber++;

			// Skip empty lines
			if (line.trim() === '') {
				continue;
			}

			try {
				// Parse JSON line
				const parsed = JSON.parse(line) as unknown;

				// Adapt to Conversation
				const conversation = adaptToConversation(parsed, conversations.length, options);

				// Validate if requested
				if (validate) {
					if (!isValidConversation(conversation)) {
						const error = new Error(
							`Invalid Conversation at line ${lineNumber}`
						);
						if (skipInvalid) {
							console.warn(error.message);
							continue;
						}
						throw error;
					}
				}

				conversations.push(conversation);
			} catch (error) {
				const parseError = new Error(
					`Failed to parse line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`
				);
				if (skipInvalid) {
					console.warn(parseError.message);
					continue;
				}
				throw parseError;
			}
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('line')) {
			throw error;
		}
		throw new Error(
			`Failed to load JSONL file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
		);
	}

	return conversations;
}

/**
 * Load data from JSONL file (auto-detect type)
 *
 * @param filePath - Path to JSONL file
 * @param options - Load options
 * @returns Promise resolving to DatasetItem[] or Conversation[] based on dataType option
 */
export async function loadFromJSONL<T extends 'dataset' | 'conversation'>(
	filePath: string,
	options?: JSONLLoadOptions & { dataType: T }
): Promise<T extends 'dataset' ? DatasetItem[] : Conversation[]> {
	const dataType = options?.dataType ?? 'dataset';

	if (dataType === 'conversation') {
		return (await loadConversationsFromJSONL(filePath, options)) as T extends 'dataset'
			? DatasetItem[]
			: Conversation[];
	}

	return (await loadDatasetFromJSONL(filePath, options)) as T extends 'dataset'
		? DatasetItem[]
		: Conversation[];
}

