/**
 * E2E Tests for Trajectories Package
 * 
 * These tests use real LLM calls and require:
 * - GOOGLE_GENERATIVE_AI_API_KEY environment variable
 * - Set E2E_TRAJECTORIES=1 to run (or run in CI)
 * 
 * Run with: pnpm --filter=@tally-evals/trajectories test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { google } from '@ai-sdk/google';
import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toJSONL,
	toConversation,
	LocalStorage,
	NoopStorage,
} from '../../src/index.js';
import { shouldRunE2E, hasApiKey } from './setup.js';

// Create a simple weather agent inline to avoid circular dependencies
const weatherTools = {
	weather: tool({
		description: 'Get the current weather in a location',
		inputSchema: z.object({
			location: z.string().describe('The city and state, e.g. San Francisco, CA'),
			unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
		}),
		execute: async ({ location, unit = 'fahrenheit' }) => {
			// Mock weather data
			const temp = unit === 'celsius' ? 22 : 72;
			return {
				location,
				temperature: temp,
				unit,
				condition: 'sunny',
				message: `Current weather in ${location}: sunny, ${temp}°${unit === 'celsius' ? 'C' : 'F'}`,
			};
		},
	}),
};

const weatherAgent = new Agent({
	model: google('models/gemini-2.5-flash-lite'),
	tools: weatherTools,
	stopWhen: stepCountIs(10),
	system: 'You are a helpful weather assistant. Help users get weather information by asking for locations when needed and using the weather tool.',
});

const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('Trajectories E2E Tests', () => {
	const userModel = google('models/gemini-2.5-flash-lite');

	beforeAll(() => {
		if (!hasApiKey) {
			console.warn('⚠️  GOOGLE_GENERATIVE_AI_API_KEY not found. Skipping E2E tests.');
			console.warn('   Set E2E_TRAJECTORIES=1 and provide API key to run E2E tests.');
		}
	});

	describe('withAISdkAgent - Agent Instance Pattern', () => {
		it('should run trajectory with AI SDK Agent instance', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information for multiple locations',
					persona: {
						name: 'Weather Inquirer',
						description: 'You need weather information for different locations. When asking for weather, always include both the city and state (e.g., "San Francisco, CA" or "New York, NY"). Ask clearly and provide location names accurately.',
						guardrails: ['Ask naturally', 'Always include both city and state when asking for weather', 'Provide location names clearly'],
					},
					steps: [
						{ instruction: 'Ask for current weather in San Francisco, CA' },
						{ instruction: 'Ask for weather in New York, NY in celsius' },
					],
					mode: 'loose',
					maxTurns: 3,
					storage: { strategy: 'local', conversationId: 'e2e-agent-instance' },
					userModel,
					
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			// Assert result structure
			expect(result).toBeDefined();
			expect(result.completed).toBeTypeOf('boolean');
			expect(['goal-reached', 'max-turns', 'policy-violation', 'error']).toContain(result.reason);
			expect(result.steps.length).toBeGreaterThanOrEqual(1);
			expect(result.steps.length).toBeLessThanOrEqual(3);

			// Assert step structure
			for (const step of result.steps) {
				expect(step.turnIndex).toBeTypeOf('number');
				expect(step.userMessage.role).toBe('user');
				expect(step.userMessage.content).toBeDefined();
				expect(step.agentMessages.length).toBeGreaterThan(0);
				expect(step.agentMessages.every((msg) => msg.role === 'assistant' || msg.role === 'tool')).toBe(true);
				expect(step.timestamp).toBeInstanceOf(Date);
			}
		});

		it('should include both assistant and tool messages in agentMessages', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId: 'e2e-separation' },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			// Check that agentMessages contains assistant and tool messages
			for (const step of result.steps) {
				expect(step.agentMessages.length).toBeGreaterThan(0);
				expect(step.agentMessages.every((msg) => msg.role === 'assistant' || msg.role === 'tool')).toBe(true);
			}
		});
	});

	describe('withAISdkAgent - generateText Config Pattern', () => {
		it('should run trajectory with generateText config', async () => {
			const agent = withAISdkAgent({
				model: google('models/gemini-2.5-flash-lite'),
				temperature: 0.2,
			});

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information for different locations. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId: 'e2e-generatetext' },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result).toBeDefined();
			expect(result.steps.length).toBeGreaterThanOrEqual(1);
			expect(result.steps.length).toBeLessThanOrEqual(2);

			// Verify messages are properly formatted
			for (const step of result.steps) {
				expect(step.userMessage.role).toBe('user');
				expect(step.agentMessages.length).toBeGreaterThan(0);
			}
		});
	});

	describe('Storage Strategies', () => {
		it('should work with local storage strategy', async () => {
			const storage = new LocalStorage();
			const conversationId = 'e2e-local-storage';

			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { storage, generateLogs: true });

			// Verify storage accumulated history
			const history = storage.get(conversationId);
			expect(history.length).toBeGreaterThanOrEqual(2); // At least user + assistant messages

			// Verify result
			expect(result.steps.length).toBeGreaterThan(0);
		});

		it('should work with noop storage strategy', async () => {
			const storage = new NoopStorage();
			const conversationId = 'e2e-noop-storage';

			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'none', conversationId },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { storage, generateLogs: true });

			// Verify noop storage doesn't store anything
			const history = storage.get(conversationId);
			expect(history.length).toBe(0);

			// But trajectory should still complete
			expect(result.steps.length).toBeGreaterThan(0);
		});
	});

	describe('Output Conversions', () => {
		it('should convert result to JSONL format', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId: 'e2e-jsonl' },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });
			const jsonlLines = toJSONL(result);

			expect(jsonlLines.length).toBe(result.steps.length);
			expect(jsonlLines.length).toBeGreaterThan(0);

			// Verify each line is valid JSON
			for (const line of jsonlLines) {
				const parsed = JSON.parse(line);
				expect(parsed).toHaveProperty('conversationId');
				expect(parsed).toHaveProperty('stepIndex');
				expect(parsed).toHaveProperty('turnIndex');
				expect(parsed).toHaveProperty('input');
				expect(parsed).toHaveProperty('output');
			}
		});

		it('should convert result to Conversation format', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId: 'e2e-conversation' },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });
			const conversation = toConversation(result, 'test-conversation-id');

			expect(conversation.id).toBe('test-conversation-id');
			expect(conversation.steps.length).toBe(result.steps.length);
			expect(conversation.steps.length).toBeGreaterThan(0);

			// Verify step structure
			for (const step of conversation.steps) {
				expect(step).toHaveProperty('stepIndex');
				expect(step).toHaveProperty('input');
				expect(step).toHaveProperty('output');
				expect(step.input.role).toBe('user');
				expect(Array.isArray(step.output)).toBe(true);
			}
		});
	});

	describe('Step Indexing', () => {
		it('should correctly track turnIndex for each step', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA" or "New York, NY").',
					},
					steps: [
						{ instruction: 'Ask for current weather in San Francisco, CA' },
						{ instruction: 'Ask for weather in New York, NY' },
					],
					mode: 'loose',
					maxTurns: 3,
					storage: { strategy: 'local', conversationId: 'e2e-turn-indexing' },
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			// Verify turnIndex increments correctly
			for (let i = 0; i < result.steps.length; i++) {
				expect(result.steps[i].turnIndex).toBe(i);
			}
		});
	});

	describe('Logging', () => {
		it('should log conversation when generateLogs is enabled', async () => {
			const agent = withAISdkAgent(weatherAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Get weather information',
					persona: {
						name: 'Weather Inquirer',
						description: 'You need weather information. When asking for weather, always include both the city and state (e.g., "San Francisco, CA").',
					},
					steps: [{ instruction: 'Ask for current weather in San Francisco, CA' }],
					mode: 'loose',
					maxTurns: 2,
					storage: { strategy: 'local', conversationId: 'e2e-logging' },
					userModel,
				},
				agent
			);

			// Capture console.log output
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: unknown[]) => {
				logs.push(args.map(String).join(' '));
				originalLog(...args);
			};

			try {
				const result = await runTrajectory(trajectory, { generateLogs: true });

				// Verify logs were generated
				expect(logs.length).toBeGreaterThan(0);
				expect(logs.some((log) => log.includes('TRAJECTORY START'))).toBe(true);
				expect(logs.some((log) => log.includes('TRAJECTORY END'))).toBe(true);
				expect(logs.some((log) => log.includes('Turn'))).toBe(true);
				expect(result.steps.length).toBeGreaterThan(0);
			} finally {
				console.log = originalLog;
			}
		});
	});
});

