/**
 * AI-as-user generator for creating user messages based on persona, goal, and steps
 */

import { generateText } from 'ai';
import type { ModelMessage } from 'ai';
import type { Trajectory, TrajectoryStep } from './types.js';

export interface UserMessageContext {
	trajectory: Trajectory;
	history: readonly ModelMessage[];
	currentStepIndex: number;
	nextStep?: TrajectoryStep;
}

/**
 * Generate a user message based on persona, goal, and current step
 * 
 * @param context - Context for generating the user message
 * @param model - AI SDK model function to use for generation
 */
export async function generateUserMessage(
	context: UserMessageContext,
	model: Parameters<typeof generateText>[0]['model']
): Promise<ModelMessage> {
	const { trajectory, history, nextStep } = context;

	// Build the prompt for the AI-as-user
	const personaDesc = trajectory.persona.description;
	const personaName = trajectory.persona.name
		? `You are ${trajectory.persona.name}. ${personaDesc}`
		: personaDesc;
	const guardrails = trajectory.persona.guardrails
		? `\n\nGuardrails:\n${trajectory.persona.guardrails.map((g) => `- ${g}`).join('\n')}`
		: '';

	const goalDesc = `Your goal is: ${trajectory.goal}`;

	let stepDesc = '';
	if (nextStep) {
		stepDesc = `\n\nCurrent step instruction: ${nextStep.instruction}`;
		if (nextStep.expectedOutcome) {
			stepDesc += `\nExpected outcome: ${nextStep.expectedOutcome}`;
		}
		if (nextStep.requiredInfo && nextStep.requiredInfo.length > 0) {
			stepDesc += `\nRequired information: ${nextStep.requiredInfo.join(', ')}`;
		}
	}

	const conversationHistory = history
		.map((msg) => {
			if (typeof msg.content === 'string') {
				return `${msg.role}: ${msg.content}`;
			}
			// Handle structured content
			return `${msg.role}: [complex content]`;
		})
		.join('\n');

	const systemPrompt = `${personaName}${guardrails}

${goalDesc}${stepDesc}

Based on the conversation history below, generate your next message as the user. Be natural and follow your persona. If this is the first turn, introduce yourself or start the conversation appropriately.

Conversation history:
${conversationHistory || '(no history yet)'}

Generate your message now:`;

	// Use AI SDK to generate the user message
	const result = await generateText({
		model,
		prompt: systemPrompt,
	});

	return {
		role: 'user',
		content: result.text,
	};
}

