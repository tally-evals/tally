import { describe, it, expect, vi } from 'bun:test';
import {
	createTopicAdherenceMetric,
	runMultiTurnMetric,
} from '../../_exports';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';
import { conversationExampleA, conversationExampleB } from '../../_fixtures/conversation.examples';
import type { Conversation } from '../../_exports';
import * as promptsModule from '../../../src/core/execution/llm/prompts';

describe('Integration | Metrics | Topic Adherence', () => {
	it('creates topic adherence metric', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const metric = createTopicAdherenceMetric({
			topics: ['weather', 'forecast'],
			provider: mockProvider,
		});

		expect(metric).toBeDefined();
		expect(metric.name).toBe('topicAdherence');
		expect(metric.valueType).toBe('number');
		expect(metric.scope).toBe('multi');
	});

	it('executes topic adherence metric on conversation', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const metric = createTopicAdherenceMetric({
			topics: ['technical support', 'troubleshooting'],
			provider: mockProvider,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleA);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes topic adherence metric with topic transitions enabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.2}');
		const metric = createTopicAdherenceMetric({
			topics: ['travel planning', 'destinations'],
			provider: mockProvider,
			allowTopicTransitions: true,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes topic adherence metric with topic transitions disabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 3.5}');
		const metric = createTopicAdherenceMetric({
			topics: ['cooking', 'recipes'],
			provider: mockProvider,
			allowTopicTransitions: false,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleA);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes topic adherence metric with strict mode enabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 3.0}');
		const metric = createTopicAdherenceMetric({
			topics: ['financial advice', 'investments'],
			provider: mockProvider,
			strictMode: true,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('executes topic adherence metric with all options enabled', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.8}');
		const metric = createTopicAdherenceMetric({
			topics: ['healthcare', 'medical advice'],
			provider: mockProvider,
			allowTopicTransitions: true,
			strictMode: true,
		});

		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('creates topic adherence metric with different topic arrays', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');
		
		const metric1 = createTopicAdherenceMetric({
			topics: ['weather'],
			provider: mockProvider,
		});
		expect(metric1).toBeDefined();

		const metric2 = createTopicAdherenceMetric({
			topics: ['travel', 'destinations', 'accommodations'],
			provider: mockProvider,
		});
		expect(metric2).toBeDefined();

		const metric3 = createTopicAdherenceMetric({
			topics: ['technical support', 'troubleshooting', 'software issues', 'hardware problems'],
			provider: mockProvider,
		});
		expect(metric3).toBeDefined();
	});

	it('executes topic adherence metric on conversation with multiple steps', async () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.2}');
		const metric = createTopicAdherenceMetric({
			topics: ['education', 'learning'],
			provider: mockProvider,
			allowTopicTransitions: true,
			strictMode: false,
		});

		// Test with conversationExampleB which has 3 steps
		const result = await runMultiTurnMetric(metric, conversationExampleB);

		expect(result).toBeDefined();
		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(5);
		expect(result.executionTime).toBeGreaterThanOrEqual(0);
	});

	it('topic adherence metric includes topics in metadata', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const topics = ['weather', 'forecast'];
		const metric = createTopicAdherenceMetric({
			topics,
			provider: mockProvider,
		});

		expect(metric.metadata).toBeDefined();
		expect(metric.metadata?.topics).toEqual(topics);
		expect(metric.metadata?.allowTopicTransitions).toBe(true); // default value
		expect(metric.metadata?.strictMode).toBe(false); // default value
	});

	it('topic adherence metric includes all options in metadata', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
		const topics = ['technical support', 'troubleshooting'];
		const metric = createTopicAdherenceMetric({
			topics,
			provider: mockProvider,
			allowTopicTransitions: false,
			strictMode: true,
		});

		expect(metric.metadata).toBeDefined();
		expect(metric.metadata?.topics).toEqual(topics);
		expect(metric.metadata?.allowTopicTransitions).toBe(false);
		expect(metric.metadata?.strictMode).toBe(true);
	});

	it('handles empty topics array', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 3.0}');
		const topics: string[] = [];
		
		expect(() => {
			createTopicAdherenceMetric({
				topics,
				provider: mockProvider,
			});
		}).not.toThrow();
	});

	it('handles single topic array', () => {
		const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
		const topics = ['weather'];
		const metric = createTopicAdherenceMetric({
			topics,
			provider: mockProvider,
		});

		expect(metric).toBeDefined();
		expect(metric.metadata?.topics).toEqual(topics);
	});

	describe('Prompt Construction', () => {
		it('verifies prompt is built with substituted values, not template variables', async () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const topics = ['weather', 'forecast'];
			const metric = createTopicAdherenceMetric({
				topics,
				provider: mockProvider,
			});

			// Save original implementation and spy on buildPrompt
			const originalBuildPrompt = promptsModule.buildPrompt;
			const buildPromptSpy = vi.spyOn(promptsModule, 'buildPrompt').mockImplementation((template, context) => {
				return originalBuildPrompt(template, context);
			});
			
			await runMultiTurnMetric(metric, conversationExampleA);

			// Verify buildPrompt was called
			expect(buildPromptSpy).toHaveBeenCalled();

			// Get the final built prompt string from the return value
			const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;

			// Verify the final prompt contains actual substituted values, NOT template variables
			expect(finalPrompt).toBeDefined();
			// Topics should be substituted (they'll be stringified in the prompt)
			expect(finalPrompt).not.toContain('{{topics}}'); // Template variable should be replaced
			expect(finalPrompt).toContain('Turn 1:'); // Actual conversation content
			expect(finalPrompt).toContain('Hello!'); // Actual conversation content
			expect(finalPrompt).not.toContain('{{conversationText}}'); // Template variable should be replaced
			expect(finalPrompt).toContain('Criteria:'); // Rubric should be formatted
			expect(finalPrompt).not.toContain('{{rubric}}'); // Template variable should be replaced

			buildPromptSpy.mockRestore();
		});

		it('verifies prompt includes topic transitions text when enabled', async () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const metric = createTopicAdherenceMetric({
				topics: ['test topic'],
				provider: mockProvider,
				allowTopicTransitions: true,
			});

			const originalBuildPrompt = promptsModule.buildPrompt;
			const buildPromptSpy = vi.spyOn(promptsModule, 'buildPrompt').mockImplementation((template, context) => {
				return originalBuildPrompt(template, context);
			});

			await runMultiTurnMetric(metric, conversationExampleA);

			const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;
			expect(finalPrompt).toContain('transitions');

			buildPromptSpy.mockRestore();
		});

		it('verifies prompt includes strict mode text when enabled', async () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const metric = createTopicAdherenceMetric({
				topics: ['test topic'],
				provider: mockProvider,
				strictMode: true,
			});

			const originalBuildPrompt = promptsModule.buildPrompt;
			const buildPromptSpy = vi.spyOn(promptsModule, 'buildPrompt').mockImplementation((template, context) => {
				return originalBuildPrompt(template, context);
			});

			await runMultiTurnMetric(metric, conversationExampleA);

			const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;
			expect(finalPrompt).toContain('strict evaluation');

			buildPromptSpy.mockRestore();
		});

		it('verifies rubric structure is correct', () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const metric = createTopicAdherenceMetric({
				topics: ['test topic'],
				provider: mockProvider,
			});

			if (metric.type === 'llm-based' && metric.rubric) {
				expect(metric.rubric.criteria).toBeDefined();
				expect(metric.rubric.scale).toBeDefined();
				expect(metric.rubric.examples).toBeDefined();
				expect(Array.isArray(metric.rubric.examples)).toBe(true);
				expect(metric.rubric.examples.length).toBeGreaterThan(0);

				// Verify rubric examples have correct structure
				for (const example of metric.rubric.examples) {
					expect(example).toHaveProperty('score');
					expect(example).toHaveProperty('reasoning');
					expect(typeof example.score).toBe('number');
					expect(typeof example.reasoning).toBe('string');
				}
			}
		});

		it('verifies conversation text is properly formatted and substituted in final prompt', async () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const metric = createTopicAdherenceMetric({
				topics: ['test topic'],
				provider: mockProvider,
			});

			const originalBuildPrompt = promptsModule.buildPrompt;
			const buildPromptSpy = vi.spyOn(promptsModule, 'buildPrompt').mockImplementation((template, context) => {
				return originalBuildPrompt(template, context);
			});
			
			await runMultiTurnMetric(metric, conversationExampleA);

			const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;
			
			// Verify conversation text is substituted in final prompt (not as template variable)
			expect(finalPrompt).toContain('Turn 1:');
			expect(finalPrompt).toContain('User:');
			expect(finalPrompt).toContain('Assistant:');
			expect(finalPrompt).toContain('Hello!');
			expect(finalPrompt).toContain('What is the capital of Japan?');
			expect(finalPrompt).not.toContain('{{conversationText}}');

			buildPromptSpy.mockRestore();
		});

		it('verifies topics are properly substituted in final prompt', async () => {
			const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
			const topics = ['weather', 'forecast', 'climate'];
			const metric = createTopicAdherenceMetric({
				topics,
				provider: mockProvider,
			});

			const originalBuildPrompt = promptsModule.buildPrompt;
			const buildPromptSpy = vi.spyOn(promptsModule, 'buildPrompt').mockImplementation((template, context) => {
				return originalBuildPrompt(template, context);
			});
			
			await runMultiTurnMetric(metric, conversationExampleA);

			const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;

			// Topics should be substituted (they'll be stringified as an array in the prompt)
			expect(finalPrompt).not.toContain('{{topics}}');
			// The topics array will be stringified, so check for individual topic values
			expect(finalPrompt).toContain('weather');
			expect(finalPrompt).toContain('forecast');
			expect(finalPrompt).toContain('climate');

			buildPromptSpy.mockRestore();
		});
	});
});
