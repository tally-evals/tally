/**
 * Demand Letter Agent (AI SDK Example)
 * 
 * An agent that helps users create demand letters through an onboarding flow.
 * 
 * @example
 * ```ts
 * import { demandLetterAgent } from '@tally/examples-ai-sdk';
 * 
 * const result = await demandLetterAgent.generate({
 *   prompt: 'I need to create a demand letter',
 * });
 * ```
 */

import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { demandLetterTools } from '../tools/demandLetter';

const DEFAULT_MODEL_ID = 'models/gemini-2.5-flash-lite';
const DEFAULT_MAX_STEPS = 20;

const DEMAND_LETTER_SYSTEM_PROMPT = `You are a helpful legal assistant that helps users create demand letters. Your goal is to guide users through collecting all necessary information to create a proper demand letter.

1. Start by explaining what information is needed for a demand letter
2. Use the getTemplateFields tool to show users what fields are required
3. Ask for information one field at a time, being clear about what you need
4. Use the validateInputs tool to ensure information is correct before proceeding
5. Once all required information is collected, use the renderPreview tool to show the user a preview
6. Be professional, clear, and helpful throughout the process

Always ensure all required fields are collected before generating the final demand letter.`;

/**
 * Demand Letter Agent instance with pre-configured system prompt and settings
 */
export const demandLetterAgent = new Agent({
	model: google(DEFAULT_MODEL_ID),
	tools: demandLetterTools,
	stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
	system: DEMAND_LETTER_SYSTEM_PROMPT,
});

