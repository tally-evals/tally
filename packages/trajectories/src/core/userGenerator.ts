/**
 * AI-as-user generator for creating user messages based on persona, goal, and steps
 */

import { generateText } from 'ai';
import type { ModelMessage } from 'ai';
import type { Trajectory, StepTrace } from './types.js';
import type { StepDefinition } from './steps/types.js';
import { formatConversationFromTraces } from '../utils/messageFormatting.js';

export interface UserMessageContext {
	trajectory: Trajectory;
	stepTraces: readonly StepTrace[];
	lastNSteps?: number;
	nextStep?: StepDefinition;
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
	const { trajectory, stepTraces, lastNSteps = 2, nextStep } = context;

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
		if (nextStep.hints && nextStep.hints.length > 0) {
			stepDesc += `\nHints: ${nextStep.hints.join(', ')}`;
		}
	}

	// Format conversation from step traces
	const { conversationContext: conversationHistory, lastAssistantMessage: assistantQuestion } =
		formatConversationFromTraces(stepTraces, lastNSteps);

		const systemMessage = `${personaName}${guardrails}

CRITICAL: You are the USER/CUSTOMER in this conversation, NOT the assistant. The assistant is helping YOU achieve YOUR goal.

DO NOT:
- Present search results, enumerate options, or give recommendations as if you were the assistant
- Say things like "I've found", "I can help you", "I've got options for you", "I'm excited to help you"
- Act like you're providing a service to the assistant, or use a service-provider tone
- Ask questions that sound like the assistant guiding a user (e.g., "where will you be flying from?", "what's your order number?")
- Provide reassurance or advice like "don't worry", "here's what I recommend", "let me handle that"
- Speak in the assistant's voice or offer to perform actions on the user's behalf

DO:
- Answer the assistant's questions directly
- Provide information the assistant asks for
- Express YOUR preferences and needs
- Ask questions about YOUR needs or constraints (from your perspective)
- Sound like a customer seeking help, not a service provider
- Use phrases like "I need", "I want", "I'm looking for", "Could you help me"

Few-shot examples across domains (answer like a user, not an assistant):

Travel planning:
- Assistant: "What city are you departing from?"
- User: "I'll be flying from New York."
- Assistant: "When do you want to leave?"
- User: "June 15th works for me."

E‑commerce return:
- Assistant: "Could you share your order number?"
- User: "Sure — it's 123-456-XYZ."
- Assistant: "Do you prefer a refund or a replacement?"
- User: "A replacement is fine."

Calendar scheduling:
- Assistant: "What day and time work for you?"
- User: "Tuesday afternoon would be great — around 3pm."
- Assistant: "Do you prefer virtual or in-person?"
- User: "Virtual is better for me."

Legal document (demand letter):
- Assistant: "What's the invoice amount and due date?"
- User: "$2,500 and it was due on March 15th."
- Assistant: "Who is the recipient?"
- User: "ABC Company, 42 Market Street."

Weather information:
- Assistant: "Which city's weather do you need?"
- User: "San Francisco."
- Assistant: "Do you want today or a specific date?"
- User: "Today is fine, and could you give it in celsius?"
`;

		const userPrompt = `${goalDesc}${stepDesc}

${assistantQuestion ? `The assistant just said: "${assistantQuestion}"

You MUST respond to this as the USER/CUSTOMER. Answer their question or respond to what they said naturally based on your persona and goal. Do NOT ask questions back unless you're asking about YOUR own needs.` : ''}

${nextStep ? `Your current task is to: ${nextStep.instruction}

You MUST follow this instruction while responding to the assistant. If the step instruction asks you to provide specific information (e.g., an order number "123-456", a date "June 15th", a recipient address, or a location), make sure you include that information in your response. Respond naturally as ${trajectory.persona.name || 'the user'}, but ensure your message:
1. Answers the assistant's question/statement (if they asked one)
2. Accomplishes what the step instruction asks
3. Sounds like YOU (the customer) talking to the assistant, not the other way around` : assistantQuestion ? `Respond naturally to what the assistant said, staying true to your persona (${trajectory.persona.name || 'the user'}) and working towards your goal. Be authentic and conversational - answer their question or respond to their statement in a way that feels natural for someone with your characteristics.` : 'Generate your next message as the user/customer, responding naturally based on your persona and goal.'}

Conversation history:
${conversationHistory || '(no history yet)'}

Generate your message as the USER/CUSTOMER now:`;

	// Use AI SDK to generate the user message
	const result = await generateText({
		model,
			system: systemMessage,
			prompt: userPrompt,
	});

	return {
		role: 'user',
		content: result.text,
	};
}

