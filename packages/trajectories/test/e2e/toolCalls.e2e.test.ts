/**
 * E2E Tests for Tool Call handling in Trajectories
 *
 * Validates that both AI SDK and Mastra agents correctly execute tool calls
 * during trajectory runs and that tool call information is captured in the
 * resulting step traces.
 *
 * Requires:
 * - GOOGLE_GENERATIVE_AI_API_KEY environment variable
 * - Set E2E_TRAJECTORIES=1 to run (or run in CI)
 *
 * Run with: bun run --filter=@tally-evals/trajectories test:e2e toolCalls
 */

import { describe, it, expect } from 'bun:test';
import { google } from '@ai-sdk/google';
import { ToolLoopAgent as Agent, stepCountIs, dynamicTool } from 'ai';
import { z } from 'zod';
import { z as z4 } from 'zod/v4';
import { Agent as MastraAgent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	withMastraAgent,
	toConversation,
} from '../../src/index.js';
import { shouldRunE2E } from './setup.js';
import {
	extractToolCallsFromStep,
	hasToolCall,
	getToolNames,
} from './utils/toolCalls.js';

// ============================================================================
// AI SDK Agent Setup
// ============================================================================

const calculatorInputSchema = z.object({
	operation: z.string().describe('The arithmetic operation to perform: add, subtract, multiply, or divide'),
	a: z.number().describe('First operand'),
	b: z.number().describe('Second operand'),
});

const aiSdkCalculatorTools = {
	calculator: dynamicTool({
		description: 'Perform a basic arithmetic calculation',
		inputSchema: calculatorInputSchema,
		execute: async (input: unknown) => {
			const { operation, a, b } = input as { operation: string; a: number; b: number };
			let result = 0;
			if (operation === 'add') result = a + b;
			else if (operation === 'subtract') result = a - b;
			else if (operation === 'multiply') result = a * b;
			else if (operation === 'divide') result = b !== 0 ? a / b : NaN;
			return { operation, a, b, result };
		},
	}),
};

const aiSdkCalculatorAgent = new Agent({
	model: google('models/gemini-2.5-flash-lite'),
	tools: aiSdkCalculatorTools,
	stopWhen: stepCountIs(10),
	instructions:
		'You are a calculator assistant. When the user asks you to perform a calculation, ALWAYS use the calculator tool to compute the answer. Never compute answers in your head.',
});

// ============================================================================
// Mastra Agent Setup
// ============================================================================

const calculatorToolMastra = createTool({
	id: 'calculator',
	description: 'Perform a basic arithmetic calculation',
	inputSchema: z4.object({
		operation: z4.enum(['add', 'subtract', 'multiply', 'divide']).describe('The arithmetic operation to perform'),
		a: z4.number().describe('First operand'),
		b: z4.number().describe('Second operand'),
	}),
	outputSchema: z4.object({
		operation: z4.string(),
		a: z4.number(),
		b: z4.number(),
		result: z4.number(),
	}),
	execute: async (inputData) => {
		let result: number;
		switch (inputData.operation) {
			case 'add':
				result = inputData.a + inputData.b;
				break;
			case 'subtract':
				result = inputData.a - inputData.b;
				break;
			case 'multiply':
				result = inputData.a * inputData.b;
				break;
			case 'divide':
				result = inputData.b !== 0 ? inputData.a / inputData.b : NaN;
				break;
			default:
				result = NaN;
		}
		return { operation: inputData.operation, a: inputData.a, b: inputData.b, result };
	},
});

const mastraCalculatorAgent = new MastraAgent({
	id: 'calculator-agent',
	name: 'Calculator Agent',
	instructions:
		'You are a calculator assistant. When the user asks you to perform a calculation, ALWAYS use the calculator tool to compute the answer. Never compute answers in your head.',
	model: 'google/gemini-2.5-flash-lite',
	tools: { calculator: calculatorToolMastra },
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if any step in the result has a tool call message (role: 'tool' or
 * assistant content with tool-call parts).
 */
function resultHasToolCalls(result: { steps: readonly { agentMessages: readonly { role: string; content?: unknown }[] }[] }): boolean {
	for (const step of result.steps) {
		for (const msg of step.agentMessages) {
			if (msg.role === 'tool') return true;
			if (msg.role === 'assistant' && Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (typeof part === 'object' && part !== null && 'type' in part && (part as { type: string }).type === 'tool-call') {
						return true;
					}
				}
			}
		}
	}
	return false;
}

// ============================================================================
// Tests
// ============================================================================

const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('Tool Call E2E Tests', () => {
	const userModel = google('models/gemini-2.5-flash-lite');

	// --------------------------------------------------------------------------
	// AI SDK
	// --------------------------------------------------------------------------

	describe('AI SDK Agent — Tool Calls', () => {
		it('should invoke a tool and include tool messages in trajectory', async () => {
			const agent = withAISdkAgent(aiSdkCalculatorAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Compute arithmetic using the calculator tool',
					persona: {
						description: 'You need help with a math calculation. Ask the agent to compute the result.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to compute 17 multiplied by 23' },
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 2,
					conversationId: 'e2e-aisdk-tool-calls',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result).toBeDefined();
			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// The agent should have used the calculator tool
			expect(resultHasToolCalls(result)).toBe(true);

			// Verify agent messages include both assistant and tool roles
			const allRoles = result.steps.flatMap((s) =>
				s.agentMessages.map((m) => m.role),
			);
			expect(allRoles).toContain('assistant');
		}, 60_000);

		it('should capture tool calls in Conversation format', async () => {
			const agent = withAISdkAgent(aiSdkCalculatorAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get a calculation result',
					persona: {
						description: 'Ask the agent to add 100 and 200.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to add 100 and 200' },
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 2,
					conversationId: 'e2e-aisdk-tool-conversation',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });
			const conversation = toConversation(result, 'test-aisdk-tool');

			expect(conversation.steps.length).toBeGreaterThan(0);

			// Tool calls should be present in the conversation output messages
			let hasToolRole = false;
			let hasAssistantWithToolCallParts = false;
			for (const step of conversation.steps) {
				for (const m of step.output) {
					if (m.role === 'tool') hasToolRole = true;
					if (m.role === 'assistant' && Array.isArray(m.content)) {
						if (m.content.some((p: unknown) => typeof p === 'object' && p !== null && 'type' in p && (p as { type: string }).type === 'tool-call')) {
							hasAssistantWithToolCallParts = true;
						}
					}
				}
			}

			expect(hasToolRole || hasAssistantWithToolCallParts).toBe(true);

			// Verify the tool call info via utility
			for (const step of conversation.steps) {
				const toolCalls = extractToolCallsFromStep(step);
				if (toolCalls.length > 0) {
					expect(hasToolCall(step, 'calculator')).toBe(true);
					expect(getToolNames(step)).toContain('calculator');
				}
			}
		}, 60_000);

		it('should handle multi-step trajectory with tool calls', async () => {
			const agent = withAISdkAgent(aiSdkCalculatorAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Perform two separate calculations',
					persona: {
						description:
							'You need help with two math problems. Ask them one at a time.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to multiply 12 by 8' },
							{ id: 'step-1', instruction: 'Ask the agent to subtract 45 from 100' },
						],
						start: 'step-0',
						terminals: ['step-1'],
					},
					maxTurns: 3,
					conversationId: 'e2e-aisdk-multi-tool',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(2);

			// At least one step should have tool calls
			expect(resultHasToolCalls(result)).toBe(true);

			// Turn indices should be sequential
			for (let i = 0; i < result.steps.length; i++) {
				expect(result.steps[i].turnIndex).toBe(i);
			}
		}, 90_000);
	});

	// --------------------------------------------------------------------------
	// Mastra
	// --------------------------------------------------------------------------

	describe('Mastra Agent — Tool Calls', () => {
		it('should invoke a tool and include tool messages in trajectory', async () => {
			const agent = withMastraAgent(mastraCalculatorAgent as any);

			const trajectory = createTrajectory(
				{
					goal: 'Compute arithmetic using the calculator tool',
					persona: {
						description: 'You need help with a math calculation. Ask the agent to compute the result.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to compute 17 multiplied by 23' },
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 2,
					conversationId: 'e2e-mastra-tool-calls',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result).toBeDefined();
			expect(result.steps.length).toBeGreaterThanOrEqual(1);

			// The agent should have used the calculator tool
			expect(resultHasToolCalls(result)).toBe(true);

			// Verify agent messages include assistant role
			const allRoles = result.steps.flatMap((s) =>
				s.agentMessages.map((m) => m.role),
			);
			expect(allRoles).toContain('assistant');
		}, 60_000);

		it('should capture tool calls in Conversation format', async () => {
			const agent = withMastraAgent(mastraCalculatorAgent as any);

			const trajectory = createTrajectory(
				{
					goal: 'Get a calculation result',
					persona: {
						description: 'Ask the agent to divide 144 by 12.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to divide 144 by 12' },
						],
						start: 'step-0',
						terminals: ['step-0'],
					},
					maxTurns: 2,
					conversationId: 'e2e-mastra-tool-conversation',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });
			const conversation = toConversation(result, 'test-mastra-tool');

			expect(conversation.steps.length).toBeGreaterThan(0);

			// Tool calls should be present in the conversation output messages
			let hasToolRole = false;
			let hasAssistantWithToolCallParts = false;
			for (const step of conversation.steps) {
				for (const m of step.output) {
					if (m.role === 'tool') hasToolRole = true;
					if (m.role === 'assistant' && Array.isArray(m.content)) {
						if (m.content.some((p: unknown) => typeof p === 'object' && p !== null && 'type' in p && (p as { type: string }).type === 'tool-call')) {
							hasAssistantWithToolCallParts = true;
						}
					}
				}
			}

			expect(hasToolRole || hasAssistantWithToolCallParts).toBe(true);
		}, 60_000);

		it('should handle multi-step trajectory with tool calls', async () => {
			const agent = withMastraAgent(mastraCalculatorAgent as any);

			const trajectory = createTrajectory(
				{
					goal: 'Perform two separate calculations',
					persona: {
						description:
							'You need help with two math problems. Ask them one at a time.',
					},
					steps: {
						steps: [
							{ id: 'step-0', instruction: 'Ask the agent to add 250 and 375' },
							{ id: 'step-1', instruction: 'Ask the agent to multiply 15 by 9' },
						],
						start: 'step-0',
						terminals: ['step-1'],
					},
					maxTurns: 3,
					conversationId: 'e2e-mastra-multi-tool',
					userModel,
				},
				agent,
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result.steps.length).toBeGreaterThanOrEqual(2);

			// At least one step should have tool calls
			expect(resultHasToolCalls(result)).toBe(true);

			// Turn indices should be sequential
			for (let i = 0; i < result.steps.length; i++) {
				expect(result.steps[i].turnIndex).toBe(i);
			}
		}, 90_000);
	});
});
