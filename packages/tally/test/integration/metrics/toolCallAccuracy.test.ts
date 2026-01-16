import { describe, expect, it } from 'bun:test';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { createToolCallAccuracyMetric, runSingleTurnMetric } from '../../_exports';
import type { ConversationStep, DatasetItem } from '../../_exports';

describe('Integration | Metrics | Tool Call Accuracy', () => {
  it('creates tool call accuracy metric', () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
          argsSchema: z.object({
            location: z.string(),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
        },
        {
          toolName: 'formatResponse',
        },
      ],
      toolCallOrder: ['getWeather', 'formatResponse'],
      strictMode: false,
    });

    expect(metric).toBeDefined();
    expect(metric.name).toBe('toolCallAccuracy');
    expect(metric.valueType).toBe('number');
    expect(metric.scope).toBe('single');
  });

  it('executes tool call accuracy metric on ConversationStep with correct tool calls', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
          argsSchema: z.object({
            location: z.string(),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
        },
        {
          toolName: 'formatResponse',
        },
      ],
      toolCallOrder: ['getWeather', 'formatResponse'],
      strictMode: false,
    });

    const step: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather in Paris?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check the weather for you.' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris', unit: 'celsius' },
            },
            {
              type: 'tool-call',
              toolCallId: 'call_2',
              toolName: 'formatResponse',
              input: {},
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const result = await runSingleTurnMetric(metric, step);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    // Should have high score since all expected calls are present, args are valid, and order is correct
    expect(result.value).toBeGreaterThan(0.8);
  });

  it('executes tool call accuracy metric on ConversationStep with missing tool calls', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
        },
        {
          toolName: 'formatResponse',
        },
      ],
      strictMode: false,
    });

    const step: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check.' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris' },
            },
            // Missing formatResponse
          ],
        },
      ] as readonly ModelMessage[],
    };

    const result = await runSingleTurnMetric(metric, step);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    // Should have lower score since one expected call is missing
    // Presence: 0.5 (1/2), Args: 1.0 (no schemas), Order: 1.0 (no order) = 0.5*0.5 + 1.0*0.3 + 1.0*0.2 = 0.75
    expect(result.value).toBeLessThan(0.8); // Less than perfect score
    expect(result.value).toBeGreaterThan(0); // But still some score
  });

  it('executes tool call accuracy metric with strict mode', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
        },
      ],
      strictMode: true,
    });

    // Test with exact match - should pass
    const stepCorrect: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris' },
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultCorrect = await runSingleTurnMetric(metric, stepCorrect);
    expect(resultCorrect.value).toBeGreaterThan(0);

    // Test with extra tool call - should fail in strict mode
    const stepExtra: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris' },
            },
            {
              type: 'tool-call',
              toolCallId: 'call_2',
              toolName: 'extraTool',
              input: {},
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultExtra = await runSingleTurnMetric(metric, stepExtra);
    expect(resultExtra.value).toBe(0); // Strict mode should return 0 for extra calls
  });

  it('executes tool call accuracy metric with invalid arguments', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
          argsSchema: z.object({
            location: z.string(),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
        },
      ],
      strictMode: false,
    });

    // Test with invalid args (wrong unit value)
    const stepInvalid: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris', unit: 'kelvin' }, // Invalid unit
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultInvalid = await runSingleTurnMetric(metric, stepInvalid);
    expect(resultInvalid.value).toBeLessThan(1); // Should have lower score due to invalid args

    // Test with valid args
    const stepValid: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather?' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'getWeather',
              input: { location: 'Paris', unit: 'celsius' }, // Valid unit
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultValid = await runSingleTurnMetric(metric, stepValid);
    expect(resultValid.value).toBeGreaterThan(resultInvalid.value); // Should score higher
  });

  it('executes tool call accuracy metric with order checking', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'step1',
        },
        {
          toolName: 'step2',
        },
      ],
      toolCallOrder: ['step1', 'step2'],
      strictMode: false,
    });

    // Test with correct order
    const stepCorrectOrder: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'Do something' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Processing...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'step1',
              input: {},
            },
            {
              type: 'tool-call',
              toolCallId: 'call_2',
              toolName: 'step2',
              input: {},
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultCorrect = await runSingleTurnMetric(metric, stepCorrectOrder);
    expect(resultCorrect.value).toBeGreaterThan(0.8);

    // Test with wrong order
    const stepWrongOrder: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'Do something' },
      output: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Processing...' },
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'step2',
              input: {},
            },
            {
              type: 'tool-call',
              toolCallId: 'call_2',
              toolName: 'step1',
              input: {},
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const resultWrong = await runSingleTurnMetric(metric, stepWrongOrder);
    expect(resultWrong.value).toBeLessThan(resultCorrect.value); // Should score lower
  });

  it('executes tool call accuracy metric on DatasetItem with ModelMessage completion', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
        },
      ],
      strictMode: false,
    });

    const item = {
      id: 'test-1',
      prompt: 'What is the weather in Paris?',
      completion: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check the weather for you.' },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'getWeather',
            input: { location: 'Paris', unit: 'celsius' },
          },
        ],
      } as ModelMessage,
    } as unknown as DatasetItem;

    const result = await runSingleTurnMetric(metric, item);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('executes tool call accuracy metric with tool calls in separate assistant messages (JSONL format)', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'weather',
          argsSchema: z.object({
            location: z.string(),
          }),
        },
      ],
      strictMode: false,
    });

    // Simulate JSONL format where tool calls are in separate assistant messages
    const step: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'What is the weather in San Francisco?' },
      output: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'weather',
              input: { location: 'San Francisco, CA' },
            },
          ],
        },
        {
          role: 'tool',
          toolCallId: 'call_1',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'weather',
              output: { temperature: 72, condition: 'sunny' },
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'The current weather in San Francisco, CA is sunny with a temperature of 72°F.',
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const result = await runSingleTurnMetric(metric, step);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    // Should have high score since tool call is present and args are valid
    expect(result.value).toBeGreaterThan(0.8);
  });

  it('executes tool call accuracy metric with multiple tool calls in same message (travel planner format)', async () => {
    const metric = createToolCallAccuracyMetric({
      expectedToolCalls: [
        {
          toolName: 'searchFlights',
          argsSchema: z.object({
            origin: z.string(),
            destination: z.string(),
            departureDate: z.string(),
            returnDate: z.string(),
            passengers: z.number(),
          }),
        },
      ],
      strictMode: false,
    });

    // Simulate travel planner format with multiple tool calls in one message
    const step: ConversationStep = {
      stepIndex: 0,
      input: { role: 'user', content: 'Search flights from New York to San Francisco' },
      output: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'searchFlights',
              input: {
                origin: 'New York, JFK',
                destination: 'San Francisco, SFO',
                departureDate: '2025-06-15',
                returnDate: '2025-06-22',
                passengers: 1,
              },
            },
            {
              type: 'tool-call',
              toolCallId: 'call_2',
              toolName: 'searchFlights',
              input: {
                origin: 'New York, LGA',
                destination: 'San Francisco, SFO',
                departureDate: '2025-06-15',
                returnDate: '2025-06-22',
                passengers: 1,
              },
            },
          ],
        },
      ] as readonly ModelMessage[],
    };

    const result = await runSingleTurnMetric(metric, step);

    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    // Should have high score since expected tool call is present (even if multiple times)
    expect(result.value).toBeGreaterThan(0.8);
  });
});
