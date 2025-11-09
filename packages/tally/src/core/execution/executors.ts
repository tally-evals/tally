/**
 * Metric Executors
 *
 * Centralized executors for LLM-based and code-based metrics.
 * Handle timing, optional caching (for code metrics), and post-processing.
 */

import type {
	MetricDef,
	MetricScalar,
	Conversation,
	SingleTargetFor,
	LLMMetricFields,
	CodeMetricFields,
	DatasetItem,
	ConversationStep,
} from '@tally/core/types';
import type { MemoryCache } from './cache/memoryCache';
import { generateMetricValue, type GenerateObjectOptions } from './llm/generateObject';
import { formatRubric } from './llm/prompts';
import { extractTextFromMessage, extractTextFromMessages } from '../../metrics/common/utils';

export interface ExecutorOptions {
	cache?: MemoryCache<MetricScalar>;
	llmOptions?: GenerateObjectOptions;
	/**
	 * Preprocessed payload for multi-turn metrics.
	 * Passed to LLM context and to code-based compute.
	 */
	prepared?: unknown;
	/**
	 * Arbitrary per-run variables to inject into prompt context.
	 * Intended for string-based variables to be used in templates.
	 */
	runMetadata?: Record<string, unknown>;
}

export interface MetricExecutionResult<T extends MetricScalar> {
	value: T;
	confidence?: number;
	reasoning?: string;
	executionTime: number;
}

export interface MetricExecutor<TTarget, T extends MetricScalar> {
	execute(
		metricDef: MetricDef<T, unknown>,
		target: TTarget,
		options?: ExecutorOptions
	): Promise<MetricExecutionResult<T>>;
}

class LLMMetricExecutor<TTarget, T extends MetricScalar>
	implements MetricExecutor<TTarget, T>
{
	async execute(
		metricDef: MetricDef<T, unknown>,
		target: TTarget,
		options?: ExecutorOptions
	): Promise<MetricExecutionResult<T>> {
		const startTime = Date.now();

		// Build base context depending on scope
		let context: Record<string, unknown>;
		const scope = (metricDef as unknown as { scope: 'single' | 'multi' }).scope;
		if (scope === 'single') {
			// Start with defaults derived from the target
			context = buildSingleTurnLLMContext(
				target as SingleTargetFor<unknown>
			);
		} else {
			context = buildMultiTurnLLMContext(
				target as unknown as Conversation
			);
		}

		// Merge preprocessed payload (if any) – becomes first-class context
		if (options?.prepared !== undefined && typeof options.prepared === 'object' && options.prepared !== null) {
			Object.assign(context, options.prepared as Record<string, unknown>);
		}

		// Merge metric metadata into context (for static variables like expectedPoints)
		if (metricDef.metadata) {
			Object.assign(context, metricDef.metadata);
		}

		// Merge per-run metadata (string variables etc.)
		if (options?.runMetadata) {
			Object.assign(context, options.runMetadata);
		}

		// If LLM metric has a rubric, inject formatted rubric into context
		// LLM-specific fields
		const llmFields = metricDef as unknown as LLMMetricFields<T>;
		if (llmFields.rubric) {
			(context as Record<string, unknown>).rubric = formatRubric(llmFields.rubric as never);
		}

		const result = await generateMetricValue<T>(
			llmFields.provider,
			llmFields.prompt,
			metricDef.valueType,
			context,
			options?.llmOptions
		);

		let value = result.value;
		if (llmFields.postProcessing?.transform) {
			value = llmFields.postProcessing.transform(String(value)) as T;
		}

		return {
			value,
			executionTime: Date.now() - startTime,
			...(result.confidence !== undefined && { confidence: result.confidence }),
			...(result.reasoning !== undefined && { reasoning: result.reasoning }),
		};
	}
}

class CodeMetricExecutor<TTarget, T extends MetricScalar>
	implements MetricExecutor<TTarget, T>
{
	async execute(
		metricDef: MetricDef<T, unknown>,
		target: TTarget,
		options?: ExecutorOptions
	): Promise<MetricExecutionResult<T>> {
		const startTime = Date.now();

		// Only code metrics are cacheable here
		const possibleCode = metricDef as unknown as Partial<CodeMetricFields<T>>;
		const cacheable =
			possibleCode.type === 'code-based' &&
			(possibleCode.cacheable !== false);

		// Use different cache keys:
		// - single-turn: target (or prepared if provided)
		// - multi-turn: prepared (preprocessed payload)
		const scope = (metricDef as unknown as { scope: 'single' | 'multi' }).scope;
		const cacheKeyInput =
			scope === 'single'
				? (options?.prepared ?? (target as unknown))
				: options?.prepared ?? target;

		if (options?.cache && cacheable) {
			const cached = options.cache.get(metricDef.name, cacheKeyInput);
			if (cached !== undefined) {
				return {
					value: cached as T,
					executionTime: Date.now() - startTime,
				};
			}
		}

		let value: T;
		if (scope === 'single') {
			// Single-turn code metric executes via compute() on preprocessed payload
			const codeFields = metricDef as unknown as CodeMetricFields<T>;
			if (typeof codeFields.compute !== 'function') {
				throw new Error(
					`Code metric "${metricDef.name}" is missing compute() for single-turn execution`
				);
			}
			// Try to attach metadata from target if available
			const meta =
				isDatasetItem(target) ? (target as unknown as DatasetItem).metadata :
				isConversationStep(target) ? (target as unknown as ConversationStep).metadata :
				undefined;
			const computeArgs = meta !== undefined
				? { data: options?.prepared, metadata: meta }
				: { data: options?.prepared };
			const rawValue = await codeFields.compute(computeArgs as never);
			value = rawValue as T;
		} else {
			// Multi-turn code metric executes via compute() on preprocessed payload
			const codeFields = metricDef as unknown as CodeMetricFields<T>;
			if (typeof codeFields.compute !== 'function') {
				throw new Error(
					`Code metric "${metricDef.name}" is missing compute() for multi-turn execution`
				);
			}
			const conversation = target as unknown as Conversation;
			const computeArgs =
				conversation.metadata !== undefined
					? { data: options?.prepared, metadata: conversation.metadata }
					: { data: options?.prepared };
			const rawValue = await codeFields.compute(computeArgs as never);
			value = rawValue as T;
		}

		if (options?.cache && cacheable) {
			options.cache.set(metricDef.name, cacheKeyInput, value);
		}

		return {
			value,
			executionTime: Date.now() - startTime,
		};
	}
}

export function getExecutor<TTarget, T extends MetricScalar>(
	metricDef: MetricDef<T, unknown>
): MetricExecutor<TTarget, T> {
	if ((metricDef as unknown as { type: 'llm-based' | 'code-based' }).type === 'llm-based') {
		return new LLMMetricExecutor<TTarget, T>();
	}
	return new CodeMetricExecutor<TTarget, T>();
}

function buildSingleTurnLLMContext<TContainer>(
	target: SingleTargetFor<TContainer>
): Record<string, unknown> {
	const context: Record<string, unknown> = {};

	// DatasetItem
	if (isDatasetItem(target)) {
		const item = target as DatasetItem;
		// Normalize to input/output for consistency
		context.input = item.prompt;
		context.output = item.completion;
		// Also include original keys for backward compatibility
		context.prompt = item.prompt;
		context.completion = item.completion;
		if (item.metadata) {
			context.metadata = item.metadata;
		}
	}

	// ConversationStep
	if (isConversationStep(target)) {
		const step = target as ConversationStep;
		// Extract text from ModelMessages
		context.input = extractTextFromMessage(step.input);
		context.output = extractTextFromMessages(step.output);
		// Also include original ModelMessages for backward compatibility
		context.inputMessage = step.input;
		context.outputMessages = step.output; // Array of messages
		// Keep outputMessage for backward compatibility (first message if available)
		if (step.output.length > 0) {
			context.outputMessage = step.output[0];
		}
		if (step.metadata) {
			context.metadata = step.metadata;
		}
	}

	return context;
}

function buildMultiTurnLLMContext(
	conversation: Conversation
): Record<string, unknown> {
	const context: Record<string, unknown> = {
		conversationId: conversation.id,
		steps: conversation.steps,
		stepCount: conversation.steps.length,
	};
	if (conversation.metadata) {
		context.metadata = conversation.metadata;
	}
	return context;
}

function isDatasetItem(value: unknown): value is DatasetItem {
	return (
		typeof value === 'object' &&
		value !== null &&
		'prompt' in (value as Record<string, unknown>) &&
		'completion' in (value as Record<string, unknown>)
	);
}

function isConversationStep(value: unknown): value is ConversationStep {
	return (
		typeof value === 'object' &&
		value !== null &&
		'input' in (value as Record<string, unknown>) &&
		'output' in (value as Record<string, unknown>)
	);
}


