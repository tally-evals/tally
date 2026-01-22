/**
 * LLM Output Parsing
 *
 * Utilities for parsing and validating LLM outputs, including structured
 * output validation using zod schemas.
 */

import { z } from 'zod';
import type { MetricScalar } from '@tally/core/types';

/**
 * Parse a raw LLM output string to a metric value
 *
 * @param rawOutput - Raw string output from LLM
 * @param valueType - Expected value type ('number', 'boolean', 'string', 'ordinal')
 * @returns Parsed metric value
 */
export function parseMetricValue(
	rawOutput: string,
	valueType: 'number' | 'boolean' | 'string' | 'ordinal'
): MetricScalar {
	const trimmed = rawOutput.trim();

	switch (valueType) {
		case 'number':
		case 'ordinal': {
			const parsed = Number.parseFloat(trimmed);
			if (Number.isNaN(parsed)) {
				throw new Error(`Failed to parse number from LLM output: "${trimmed}"`);
			}
			return parsed;
		}

		case 'boolean': {
			const lower = trimmed.toLowerCase();
			if (lower === 'true' || lower === '1' || lower === 'yes') {
				return true;
			}
			if (lower === 'false' || lower === '0' || lower === 'no') {
				return false;
			}
			throw new Error(`Failed to parse boolean from LLM output: "${trimmed}"`);
		}

		case 'string': {
			return trimmed;
		}

		default: {
			const _exhaustive: never = valueType;
			throw new Error(`Unknown value type: ${_exhaustive}`);
		}
	}
}

/**
 * Validate structured output using a zod schema
 *
 * @param output - Raw output object from LLM
 * @param schema - Zod schema to validate against
 * @returns Validated and parsed output
 * @throws Error if validation fails
 */
export function validateStructuredOutput<T>(
	output: unknown,
	schema: z.ZodSchema<T>
): T {
	try {
		return schema.parse(output);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(
				`LLM output validation failed: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
			);
		}
		throw error;
	}
}

/**
 * Create a zod schema for a metric value type
 *
 * @param valueType - Value type to create schema for
 * @returns Zod schema for the value type
 */
export function createValueTypeSchema(
	valueType: 'number' | 'boolean' | 'string' | 'ordinal'
): z.ZodSchema<MetricScalar> {
	switch (valueType) {
		case 'number':
		case 'ordinal': {
			return z.number();
		}
		case 'boolean': {
			return z.boolean();
		}
		case 'string': {
			return z.string();
		}
		default: {
			const _exhaustive: never = valueType;
			throw new Error(`Unknown value type: ${_exhaustive}`);
		}
	}
}

