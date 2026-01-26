/**
 * Shared Prompt Utilities
 *
 * Common prompt fragments, rubric templates, and formatters for LLM-based metrics.
 */

import type { PromptTemplate } from '@tally/core/types';

/**
 * Format a rubric into a prompt string
 *
 * @param rubric - Rubric configuration
 * @returns Formatted rubric string
 */
export function formatRubric(rubric: {
  criteria: string;
  scale?: string;
  examples?: Array<{ score: number; reasoning: string }>;
}): string {
  let rubricText = `Criteria: ${rubric.criteria}`;

  if (rubric.scale) {
    rubricText += `\nScale: ${rubric.scale}`;
  }

  if (rubric.examples && rubric.examples.length > 0) {
    rubricText += '\n\nExamples:';
    for (const example of rubric.examples) {
      rubricText += `\n- Score: ${example.score}, Reasoning: ${example.reasoning}`;
    }
  }

  return rubricText;
}

/**
 * Format few-shot examples for prompt templates
 *
 * @param examples - Array of examples with input and expected output
 * @returns Formatted examples string
 */
export function formatFewShotExamples<TVars extends readonly string[]>(
  examples: PromptTemplate<TVars>['examples']
): string {
  if (!examples || examples.length === 0) {
    return '';
  }

  let examplesText = '\n\nExamples:\n';
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (!example) continue;

    examplesText += `\nExample ${i + 1}:`;
    examplesText += `\nInput: ${JSON.stringify(example.input, null, 2)}`;
    examplesText += `\nExpected Output: ${example.expectedOutput}\n`;
  }

  return examplesText;
}

/**
 * Substitute template variables in a prompt string
 * Replaces {{variable}} with actual values from the context
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variables - Object mapping variable names to values
 * @returns Substituted string
 */
export function substituteVariables(template: string, variables: Record<string, unknown>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = String(value);
    result = result.replaceAll(placeholder, replacement);
  }

  return result;
}

/**
 * Build a complete prompt from a template and context
 *
 * @param template - Prompt template
 * @param context - Context object with variable values
 * @returns Complete prompt string
 */
export function buildPrompt<TVars extends readonly string[]>(
  template: PromptTemplate<TVars>,
  context: Record<string, unknown>
): string {
  let prompt = substituteVariables(template.instruction, context);

  if (template.examples) {
    prompt += formatFewShotExamples(template.examples);
  }

  return prompt;
}
