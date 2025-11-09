/**
 * AI SDK generateObject Wrapper
 *
 * Wraps AI SDK's generateObject with provider resolution and template
 * variable substitution. Uses generateObject's built-in type-safe schema validation.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { ModelProvider, PromptTemplate, MetricScalar } from '@tally/core/types';
import { buildPrompt } from './prompts';
import { createValueTypeSchema } from './parse';

/**
 * Options for LLM generation
 */
export interface GenerateObjectOptions {
	maxRetries?: number;
	temperature?: number;
}

/**
 * Resolve a model provider (direct instance or factory function)
 *
 * @param provider - Model provider (direct or factory)
 * @returns LanguageModel instance
 */
function resolveProvider(provider: ModelProvider): LanguageModel {
	if (typeof provider === 'function') {
		return provider();
	}
	return provider;
}

/**
 * Generate structured output from an LLM using a prompt template
 *
 * @param provider - Model provider (direct or factory function)
 * @param prompt - Prompt template with variable substitutions
 * @param valueType - Expected value type for the metric
 * @param context - Context object with variable values for template substitution
 * @param options - Optional generation options
 * @returns Object with value, confidence, and reasoning
 */
export async function generateMetricValue<T extends MetricScalar>(
	provider: ModelProvider,
	prompt: PromptTemplate,
	valueType: 'number' | 'boolean' | 'string' | 'ordinal',
	context: Record<string, unknown>,
	options?: GenerateObjectOptions
): Promise<{
	value: T;
	confidence?: number;
	reasoning?: string;
}> {
	const model = resolveProvider(provider);
	const fullPrompt = buildPrompt(prompt, context);

	// Create zod schema for the expected value type
	const valueSchema = createValueTypeSchema(valueType);

	// Create output schema that includes optional confidence and reasoning
	const outputSchema = z.object({
		value: valueSchema,
		confidence: z.number().min(0).max(1).optional(),
		reasoning: z.string().optional(),
	});

	try {
		// generateObject already validates against the schema and returns type-safe results
		const result = await generateObject({
			model,
			prompt: fullPrompt,
			schema: outputSchema,
			maxRetries: options?.maxRetries ?? 1,
			...(options?.temperature !== undefined && { temperature: options.temperature }),
		});

		// result.object is already validated and type-safe based on the schema
		return {
			value: result.object.value as T,
			...(result.object.confidence !== undefined && {
				confidence: result.object.confidence,
			}),
			...(result.object.reasoning !== undefined && {
				reasoning: result.object.reasoning,
			}),
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`LLM generation failed: ${error.message}`);
		}
		throw error;
	}
}

