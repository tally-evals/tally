import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { demandLetterTools } from '../tools/demandLetter';

const DEFAULT_MODEL_ID = 'models/gemini-2.5-flash-lite';
const DEFAULT_MAX_STEPS = 40;

const DEMAND_LETTER_SYSTEM_PROMPT = `You are a helpful legal assistant collecting information to draft a demand letter. 
- Start by calling startSession to begin the questionnaire.
- For each question, present it briefly and call answerQuestion with the user's response.
- If answerQuestion returns a retry, show the summary/suggestion/example/nextSteps and ask for a corrected answer.
- Continue until no nextQuestion is returned, then present the preview.
- Keep responses concise and professional; do not invent facts.`;

export const demandLetterAgent = new Agent({
	model: google(DEFAULT_MODEL_ID),
	tools: demandLetterTools,
	stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
	system: DEMAND_LETTER_SYSTEM_PROMPT,
});