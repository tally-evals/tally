/**
 * Demand Letter Agent (Mastra Example)
 * 
 * An agent that helps users create demand letters through an onboarding flow.
 * 
 * @example
 * ```ts
 * import { demandLetterAgent } from '@tally/examples-mastra';
 * 
 * const result = await demandLetterAgent.generate({
 *   messages: [{ role: 'user', content: 'I need to create a demand letter' }],
 * });
 * ```
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { demandLetterTools } from '../tools/demandLetter';

const DEMAND_LETTER_INSTRUCTIONS = `You are a helpful legal assistant that helps users create demand letters. Your goal is to guide users through collecting all necessary information to create a proper demand letter.

1. Start by explaining what information is needed for a demand letter
2. Use the getTemplateFields tool to show users what fields are required
3. Ask for information one field at a time, being clear about what you need
4. Use the validateInputs tool to ensure information is correct before proceeding
5. Once all required information is collected, use the renderPreview tool to show the user a preview
6. Be professional, clear, and helpful throughout the process

Always ensure all required fields are collected before generating the final demand letter.`;

/**
 * Demand Letter Agent instance with pre-configured instructions and settings
 */
export const demandLetterAgent = new Agent({
	name: 'demand-letter-agent',
	instructions: DEMAND_LETTER_INSTRUCTIONS,
	model: google('models/gemini-2.5-flash-lite'),
	tools: demandLetterTools,
});

