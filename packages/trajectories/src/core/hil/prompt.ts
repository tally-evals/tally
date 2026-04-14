/**
 * HIL LLM prompt builder — generates decisions for HIL tool calls
 * using the AI-as-user LLM, staying in-persona.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { HILToolCall, HILDecision, HILContext } from './types.js';
import { formatConversationFromTraces } from '../../utils/messageFormatting.js';

/** Zod schema for the structured LLM output */
const hilDecisionSchema = z.object({
	decision: z.enum(['approve', 'reject']),
	reason: z
		.string()
		.optional()
		.describe('Short explanation for the decision'),
});

/**
 * Ask the LLM-as-user to make a HIL decision for a pending tool call.
 *
 * The prompt frames the user-persona as the decision-maker. The LLM sees:
 * - The persona description + guardrails
 * - The conversation so far
 * - The specific tool call with its arguments
 * - Optional per-tool guidance
 *
 * @returns A typed HILDecision (approve / reject)
 */
export async function generateHILDecision(
	call: HILToolCall,
	context: HILContext,
	guidance: string | undefined,
	model: LanguageModel,
): Promise<HILDecision> {
	// Build persona header
	const personaName = context.persona.name
		? `You are ${context.persona.name}. ${context.persona.description}`
		: context.persona.description;
	const guardrails = context.persona.guardrails
		? `\n\nGuardrails:\n${context.persona.guardrails.map((g) => `- ${g}`).join('\n')}`
		: '';

	// Conversation context from step traces
	const { conversationContext } = formatConversationFromTraces(
		context.stepTraces,
		2,
	);

	const system = `${personaName}${guardrails}

You are the USER/CUSTOMER in this conversation. The AI assistant you are talking to wants to perform an action and is asking for your approval or input.

Your goal is: ${context.goal}

You must respond as the user would, based on your persona, your goal, and the conversation so far. Think about whether approving or rejecting this action helps you achieve your goal.`;

	const argsFormatted =
		typeof call.args === 'object' && call.args !== null
			? JSON.stringify(call.args, null, 2)
			: String(call.args ?? '(no arguments)');

	const prompt = `The assistant wants to execute the tool "${call.toolName}" with these arguments:

\`\`\`json
${argsFormatted}
\`\`\`

${guidance ? `Guidance: ${guidance}\n` : ''}
Conversation so far:
${conversationContext || '(no history yet)'}

Based on your persona and goal, decide:
- "approve" — if you want the action to proceed
- "reject"  — if you do not want this action

Respond with your decision.`;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bypass deep type instantiation with zod + generateObject
	const result = await generateObject({
		model,
		schema: hilDecisionSchema as any,
		system,
		prompt,
	});

	return toHILDecision(result.object);
}

/**
 * Convert the raw schema output to a typed HILDecision.
 *
 * Exported for unit testing.
 */
export function toHILDecision(raw: z.infer<typeof hilDecisionSchema>): HILDecision {
	switch (raw.decision) {
		case 'approve':
			return { type: 'approve' };
		case 'reject':
			return { type: 'reject', ...(raw.reason && { reason: raw.reason }) };
	}
}
