import { describe, expect, it } from 'vitest';
import {
  conversationStepToStepTrace,
  conversationToStepTraces,
  stepTracesToConversation,
} from '../../src/conversion';
import { sampleConversation, sampleStepTrace, stepTraceWithToolCall } from '../fixtures/messages';

describe('stepTracesToConversation', () => {
  it('converts StepTrace[] to Conversation with correct structure', () => {
    const traces = [sampleStepTrace, stepTraceWithToolCall];
    const conversation = stepTracesToConversation(traces, 'test-conv-id');

    expect(conversation.id).toBe('test-conv-id');
    expect(conversation.steps).toHaveLength(2);
    expect(conversation.steps[0]?.stepIndex).toBe(0);
    expect(conversation.steps[1]?.stepIndex).toBe(1);
  });

  it('preserves timestamps and writes trace info into step metadata', () => {
    const traces = [sampleStepTrace];
    const conversation = stepTracesToConversation(traces, 'test-id', {
      metadata: { source: 'test' },
    });

    expect(conversation.metadata?.source).toBe('test');
    expect(conversation.steps[0]?.timestamp).toEqual(sampleStepTrace.timestamp);
    expect(conversation.steps[0]?.metadata?.originalTurnIndex).toBe(0);
    expect(conversation.steps[0]?.metadata?.stepId).toBe('step-0');
    expect(conversation.steps[0]?.metadata?.selection).toEqual({ method: 'start' });
  });
});

describe('conversationToStepTraces', () => {
  it('converts Conversation to StepTrace[]', () => {
    const traces = conversationToStepTraces(sampleConversation);

    expect(traces).toHaveLength(2);
    expect(traces[0]?.turnIndex).toBe(0);
    expect(traces[0]?.userMessage.role).toBe('user');
    expect(traces[0]?.agentMessages).toHaveLength(1);
  });

  it('preserveTurnIndices option recovers original turn indices', () => {
    // Create conversation with originalTurnIndex in metadata
    const conversationWithIndices = {
      id: 'test',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user' as const, content: 'Hi' },
          output: [{ role: 'assistant' as const, content: 'Hello' }],
          metadata: { originalTurnIndex: 5 },
        },
      ],
    };

    const traces = conversationToStepTraces(conversationWithIndices, { preserveTurnIndices: true });

    expect(traces[0]?.turnIndex).toBe(5);
  });
});

describe('conversationStepToStepTrace', () => {
  it('converts single step to StepTrace', () => {
    const step = sampleConversation.steps[0];
    const trace = conversationStepToStepTrace(step);

    expect(trace.turnIndex).toBe(step.stepIndex);
    expect(trace.userMessage).toBe(step.input);
    expect(trace.agentMessages).toEqual([...step.output]);
  });
});
