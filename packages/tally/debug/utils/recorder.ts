/**
 * Conversation Recorder
 * 
 * Utilities for recording agent conversations and converting them
 * to Tally's Conversation and DatasetItem formats.
 */

import type { Conversation, ConversationStep, DatasetItem } from '@tally/core/types';
import type { ModelMessage } from 'ai';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { extractTextFromMessage, extractTextFromMessages } from '../../src/metrics/common/utils';

export interface AgentStep {
	stepIndex: number;
	input: ModelMessage;
	output: readonly ModelMessage[]; // Array to capture all messages in a turn
	timestamp?: Date;
	toolCalls?: Array<{
		toolCallId: string;
		toolName: string;
		args: unknown;
		result: unknown;
	}>;
}

export interface RecordedConversation {
	id: string;
	steps: AgentStep[];
	metadata?: Record<string, unknown>;
}

/**
 * Convert AI SDK Agent steps to Tally Conversation format
 */
export function convertToTallyConversation(
	recorded: RecordedConversation,
	metadata?: Record<string, unknown>
): Conversation {
	return {
		id: recorded.id,
		steps: recorded.steps.map((step) => ({
			stepIndex: step.stepIndex,
			input: step.input as ConversationStep['input'],
			output: step.output as ConversationStep['output'],
			...(step.timestamp && { timestamp: step.timestamp }),
			metadata: {
				...(step.toolCalls && { toolCalls: step.toolCalls }),
			},
		})),
		metadata: {
			...(recorded.metadata || {}),
			...(metadata || {}),
		},
	};
}

/**
 * Convert Conversation to DatasetItem array (one item per step)
 */
export function convertConversationToDataset(conversation: Conversation): DatasetItem[] {
	return conversation.steps.map((step, index) => {
		const inputText = extractTextFromMessage(step.input);
		const outputText = extractTextFromMessages(step.output);

		return {
			id: `${conversation.id}-step-${index}`,
			prompt: inputText,
			completion: outputText,
			metadata: {
				conversationId: conversation.id,
				stepIndex: step.stepIndex,
				...(step.metadata || {}),
			},
		};
	});
}

/**
 * Save conversation as JSONL file
 */
export function saveConversationJSONL(conversation: Conversation, filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = JSON.stringify(conversation) + '\n';
	writeFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Save dataset as JSONL file
 */
export function saveDatasetJSONL(dataset: DatasetItem[], filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = dataset.map((item) => JSON.stringify(item)).join('\n') + '\n';
	writeFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Save conversation as TypeScript fixture
 */
export function saveConversationFixture(conversation: Conversation, filePath: string, exportName: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const content = `import type { Conversation } from '@tally/core/types';

export const ${exportName}: Conversation = ${JSON.stringify(conversation, null, 2)} as const;
`;

	writeFileSync(filePath, content, 'utf-8');
}

/**
 * Save dataset as TypeScript fixture
 */
export function saveDatasetFixture(dataset: DatasetItem[], filePath: string, exportName: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const content = `import type { DatasetItem } from '@tally/core/types';

export const ${exportName}: readonly DatasetItem[] = ${JSON.stringify(dataset, null, 2)} as const;
`;

	writeFileSync(filePath, content, 'utf-8');
}

/**
 * Append conversation to JSONL file (one conversation per line)
 */
export function appendConversationJSONL(conversation: Conversation, filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = JSON.stringify(conversation) + '\n';
	appendFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Append dataset items to JSONL file (one item per line)
 */
export function appendDatasetJSONL(dataset: DatasetItem[], filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = dataset.map((item) => JSON.stringify(item)).join('\n') + '\n';
	appendFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Save multiple conversations to a single JSONL file
 */
export function saveConversationsJSONL(conversations: Conversation[], filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = conversations.map((conv) => JSON.stringify(conv)).join('\n') + '\n';
	writeFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Save multiple dataset items to a single JSONL file
 */
export function saveDatasetsJSONL(dataset: DatasetItem[], filePath: string): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const jsonl = dataset.map((item) => JSON.stringify(item)).join('\n') + '\n';
	writeFileSync(filePath, jsonl, 'utf-8');
}

/**
 * Save conversation steps individually to JSONL file (one step per line)
 * Each line contains a step with conversationId for grouping
 */
export function saveConversationStepsJSONL(
	conversation: Conversation,
	filePath: string
): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const stepsJsonl = conversation.steps
		.map((step) => {
			return JSON.stringify({
				conversationId: conversation.id,
				stepIndex: step.stepIndex,
				input: step.input,
				output: step.output,
				timestamp: step.timestamp,
				metadata: {
					...(conversation.metadata || {}),
					...(step.metadata || {}),
				},
			});
		})
		.join('\n') + '\n';

	appendFileSync(filePath, stepsJsonl, 'utf-8');
}

/**
 * Save multiple conversations' steps to JSONL file (one step per line)
 * Each line contains a step with conversationId for grouping
 */
export function saveConversationsStepsJSONL(
	conversations: Conversation[],
	filePath: string
): void {
	const dir = filePath.substring(0, filePath.lastIndexOf('/'));
	mkdirSync(dir, { recursive: true });

	const allSteps = conversations.flatMap((conversation) =>
		conversation.steps.map((step) => ({
			conversationId: conversation.id,
			stepIndex: step.stepIndex,
			input: step.input,
			output: step.output,
			timestamp: step.timestamp,
			metadata: {
				...(conversation.metadata || {}),
				...(step.metadata || {}),
			},
		}))
	);

	const jsonl = allSteps.map((step) => JSON.stringify(step)).join('\n') + '\n';
	writeFileSync(filePath, jsonl, 'utf-8');
}

