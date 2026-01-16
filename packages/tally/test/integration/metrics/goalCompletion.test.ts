import { describe, expect, it, vi } from 'bun:test';
import * as promptsModule from '../../../src/core/execution/llm/prompts';
import { createGoalCompletionMetric, runMultiTurnMetric } from '../../_exports';
import type { Conversation } from '../../_exports';
import { conversationExampleA, conversationExampleB } from '../../_fixtures/conversation.examples';
import { makeMockLanguageModelReturningObject } from '../../_mocks/mockModel';

describe('Integration | Metrics | Goal Completion', () => {
  it('creates goal completion metric', () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.5}');
    const metric = createGoalCompletionMetric({
      goal: 'help user book a flight',
      provider: mockProvider,
    });

    expect(metric).toBeDefined();
    expect(metric.name).toBe('goalCompletion');
    expect(metric.valueType).toBe('number');
    expect(metric.scope).toBe('multi');
  });

  it('executes goal completion metric on conversation', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
    const metric = createGoalCompletionMetric({
      goal: 'troubleshoot a technical issue',
      provider: mockProvider,
    });

    const result = await runMultiTurnMetric(metric, conversationExampleA);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('executes goal completion metric with partial completion checking enabled', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 3.5}');
    const metric = createGoalCompletionMetric({
      goal: 'help user understand a complex concept',
      provider: mockProvider,
      checkPartialCompletion: true,
    });

    const result = await runMultiTurnMetric(metric, conversationExampleB);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('executes goal completion metric with partial completion checking disabled', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 2.5}');
    const metric = createGoalCompletionMetric({
      goal: 'complete a purchase transaction',
      provider: mockProvider,
      checkPartialCompletion: false,
    });

    const result = await runMultiTurnMetric(metric, conversationExampleA);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('executes goal completion metric with efficiency checking enabled', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.2}');
    const metric = createGoalCompletionMetric({
      goal: 'resolve user complaint',
      provider: mockProvider,
      considerEfficiency: true,
    });

    const result = await runMultiTurnMetric(metric, conversationExampleB);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('executes goal completion metric with all options enabled', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.8}');
    const metric = createGoalCompletionMetric({
      goal: 'guide user through complex setup process',
      provider: mockProvider,
      checkPartialCompletion: true,
      considerEfficiency: true,
    });

    const result = await runMultiTurnMetric(metric, conversationExampleB);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('creates goal completion metric with different goal descriptions', () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 5}');

    const metric1 = createGoalCompletionMetric({
      goal: 'help user book a flight to New York',
      provider: mockProvider,
    });
    expect(metric1).toBeDefined();

    const metric2 = createGoalCompletionMetric({
      goal: 'troubleshoot Wi-Fi connectivity issues',
      provider: mockProvider,
    });
    expect(metric2).toBeDefined();

    const metric3 = createGoalCompletionMetric({
      goal: 'provide recommendations for local restaurants',
      provider: mockProvider,
    });
    expect(metric3).toBeDefined();
  });

  it('executes goal completion metric on conversation with multiple steps', async () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.2}');
    const metric = createGoalCompletionMetric({
      goal: 'help user plan a vacation itinerary',
      provider: mockProvider,
      checkPartialCompletion: true,
      considerEfficiency: true,
    });

    // Test with conversationExampleB which has 3 steps
    const result = await runMultiTurnMetric(metric, conversationExampleB);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('goal completion metric includes goal in metadata', () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
    const goal = 'help user reset their password';
    const metric = createGoalCompletionMetric({
      goal,
      provider: mockProvider,
    });

    expect(metric.metadata).toBeDefined();
    expect(metric.metadata?.goal).toBe(goal);
    expect(metric.metadata?.checkPartialCompletion).toBe(true); // default value
    expect(metric.metadata?.considerEfficiency).toBe(false); // default value
  });

  it('goal completion metric includes all options in metadata', () => {
    const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
    const goal = 'guide user through software installation';
    const metric = createGoalCompletionMetric({
      goal,
      provider: mockProvider,
      checkPartialCompletion: false,
      considerEfficiency: true,
    });

    expect(metric.metadata).toBeDefined();
    expect(metric.metadata?.goal).toBe(goal);
    expect(metric.metadata?.checkPartialCompletion).toBe(false);
    expect(metric.metadata?.considerEfficiency).toBe(true);
  });

  describe('Prompt Construction', () => {
    it('verifies prompt is built with substituted values, not template variables', async () => {
      const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
      const goal = 'help user book a flight';
      const metric = createGoalCompletionMetric({
        goal,
        provider: mockProvider,
      });

      // Save original implementation and spy on buildPrompt
      const originalBuildPrompt = promptsModule.buildPrompt;
      const buildPromptSpy = vi
        .spyOn(promptsModule, 'buildPrompt')
        .mockImplementation((template, context) => {
          return originalBuildPrompt(template, context);
        });

      await runMultiTurnMetric(metric, conversationExampleA);

      // Verify buildPrompt was called
      expect(buildPromptSpy).toHaveBeenCalled();

      // Get the final built prompt string from the return value
      const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;

      // Verify the final prompt contains actual substituted values, NOT template variables
      expect(finalPrompt).toBeDefined();
      expect(finalPrompt).toContain(goal); // Actual goal value
      expect(finalPrompt).not.toContain('{{goal}}'); // Template variable should be replaced
      expect(finalPrompt).toContain('Turn 1:'); // Actual conversation content
      expect(finalPrompt).toContain('Hello!'); // Actual conversation content
      expect(finalPrompt).not.toContain('{{conversationText}}'); // Template variable should be replaced
      expect(finalPrompt).toContain('Criteria:'); // Rubric should be formatted
      expect(finalPrompt).not.toContain('{{rubric}}'); // Template variable should be replaced

      buildPromptSpy.mockRestore();
    });

    it('verifies rubric structure is correct', () => {
      const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
      const metric = createGoalCompletionMetric({
        goal: 'test goal',
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

    it('verifies prompt includes partial completion text when enabled', async () => {
      const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
      const metric = createGoalCompletionMetric({
        goal: 'test goal',
        provider: mockProvider,
        checkPartialCompletion: true,
      });

      const originalBuildPrompt = promptsModule.buildPrompt;
      const buildPromptSpy = vi
        .spyOn(promptsModule, 'buildPrompt')
        .mockImplementation((template, context) => {
          return originalBuildPrompt(template, context);
        });

      await runMultiTurnMetric(metric, conversationExampleA);

      const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;
      expect(finalPrompt).toContain('partial completion');

      buildPromptSpy.mockRestore();
    });

    it('verifies prompt includes efficiency text when enabled', async () => {
      const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
      const metric = createGoalCompletionMetric({
        goal: 'test goal',
        provider: mockProvider,
        considerEfficiency: true,
      });

      const originalBuildPrompt = promptsModule.buildPrompt;
      const buildPromptSpy = vi
        .spyOn(promptsModule, 'buildPrompt')
        .mockImplementation((template, context) => {
          return originalBuildPrompt(template, context);
        });

      await runMultiTurnMetric(metric, conversationExampleA);

      const finalPrompt = buildPromptSpy.mock.results[0]?.value as string;
      expect(finalPrompt).toContain('efficiency');

      buildPromptSpy.mockRestore();
    });

    it('verifies conversation text is properly formatted and substituted in final prompt', async () => {
      const mockProvider = makeMockLanguageModelReturningObject('{"value": 4.0}');
      const metric = createGoalCompletionMetric({
        goal: 'test goal',
        provider: mockProvider,
      });

      const originalBuildPrompt = promptsModule.buildPrompt;
      const buildPromptSpy = vi
        .spyOn(promptsModule, 'buildPrompt')
        .mockImplementation((template, context) => {
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
  });
});
