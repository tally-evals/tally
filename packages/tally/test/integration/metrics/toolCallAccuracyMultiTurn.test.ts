import { describe, expect, it } from 'bun:test';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { createToolCallAccuracyMultiTurnMetric, runMultiTurnMetric } from '../../_exports';
import type { Conversation } from '../../_exports';

describe('Integration | Metrics | Tool Call Accuracy (Multi-Turn)', () => {
  it('creates multi-turn tool call accuracy metric', () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [{ toolName: 'getWeather' }, { toolName: 'formatResponse' }],
      toolCallOrder: ['getWeather', 'formatResponse'],
      strictMode: false,
    });

    expect(metric).toBeDefined();
    expect(metric.name).toBe('toolCallAccuracyMultiTurn');
    expect(metric.valueType).toBe('number');
    expect(metric.scope).toBe('multi');
  });

  it('scores high when expected tool calls are present across multiple steps', async () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [{ toolName: 'getWeather' }, { toolName: 'formatResponse' }],
      toolCallOrder: ['getWeather', 'formatResponse'],
    });

    const conversation: Conversation = {
      id: 'conv-tools-correct',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'What is the weather in Paris?' },
          output: [
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Checking weather.' },
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'getWeather',
                  input: { location: 'Paris' },
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
        {
          stepIndex: 1,
          input: { role: 'user', content: 'Now summarize it.' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_2',
                  toolName: 'formatResponse',
                  input: {},
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const result = await runMultiTurnMetric(metric, conversation);
    expect(result.value).toBeGreaterThan(0.8);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('scores lower when an expected tool call is missing', async () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [{ toolName: 'getWeather' }, { toolName: 'formatResponse' }],
      strictMode: false,
    });

    const conversation: Conversation = {
      id: 'conv-tools-missing',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Check weather.' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'getWeather',
                  input: { location: 'Paris' },
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const result = await runMultiTurnMetric(metric, conversation);
    expect(result.value).toBeLessThan(0.8);
    expect(result.value).toBeGreaterThan(0);
  });

  it('returns 0 in strict mode when extra calls exist anywhere in conversation', async () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [{ toolName: 'getWeather' }],
      strictMode: true,
    });

    const conversation: Conversation = {
      id: 'conv-tools-strict',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Check weather.' },
          output: [
            {
              role: 'assistant',
              content: [
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
        },
      ],
    };

    const result = await runMultiTurnMetric(metric, conversation);
    expect(result.value).toBe(0);
  });

  it('validates arguments across conversation steps', async () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [
        {
          toolName: 'getWeather',
          argsSchema: z.object({
            location: z.string(),
            unit: z.enum(['celsius', 'fahrenheit']).optional(),
          }),
        },
      ],
    });
    // creates two conversations, one with invalid arguments, one with valid arguments. 
    const invalidConversation: Conversation = {
      id: 'conv-tools-invalid-args',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Check weather.' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'getWeather',
                  input: { location: 'Paris', unit: 'kelvin' },
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const validConversation: Conversation = {
      id: 'conv-tools-valid-args',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Check weather.' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'getWeather',
                  input: { location: 'Paris', unit: 'celsius' },
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const invalidResult = await runMultiTurnMetric(metric, invalidConversation);
    const validResult = await runMultiTurnMetric(metric, validConversation);
    expect(validResult.value).toBeGreaterThan(invalidResult.value);
  });

  it('checks tool call order across turns', async () => {
    const metric = createToolCallAccuracyMultiTurnMetric({
      expectedToolCalls: [{ toolName: 'step1' }, { toolName: 'step2' }],
      toolCallOrder: ['step1', 'step2'],
      strictMode: false,
    });

    const correctOrderConversation: Conversation = {
      id: 'conv-tools-order-correct',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Do step 1' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'step1',
                  input: {},
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
        {
          stepIndex: 1,
          input: { role: 'user', content: 'Do step 2' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_2',
                  toolName: 'step2',
                  input: {},
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const wrongOrderConversation: Conversation = {
      id: 'conv-tools-order-wrong',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user', content: 'Do step 1' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_1',
                  toolName: 'step2',
                  input: {},
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
        {
          stepIndex: 1,
          input: { role: 'user', content: 'Do step 2' },
          output: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call_2',
                  toolName: 'step1',
                  input: {},
                },
              ],
            },
          ] as readonly ModelMessage[],
        },
      ],
    };

    const correctResult = await runMultiTurnMetric(metric, correctOrderConversation);
    const wrongResult = await runMultiTurnMetric(metric, wrongOrderConversation);
    expect(correctResult.value).toBeGreaterThan(wrongResult.value);
  });
});
