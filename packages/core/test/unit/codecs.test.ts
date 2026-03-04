import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import {
  decodeConversation,
  decodeRunArtifact,
  encodeConversation,
  encodeRunArtifact,
} from '../../src/codecs';

const fixturesDir = join(__dirname, '../fixtures');

describe('ConversationCodec', () => {
  it('decodes valid JSONL to Conversation', () => {
    const jsonl = readFileSync(join(fixturesDir, 'sample-conversation.jsonl'), 'utf-8');
    const conversation = decodeConversation(jsonl);

    expect(conversation.id).toBe('travel-planner-golden');
    expect(conversation.steps).toHaveLength(20);
    expect(conversation.steps[0]?.stepIndex).toBe(0);
    expect(conversation.steps[0]?.input.role).toBe('user');
  });

  it('encodes Conversation to JSONL', () => {
    const conversation = {
      id: 'test-conv',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user' as const, content: 'Hello' },
          output: [{ role: 'assistant' as const, content: 'Hi there!' }],
        },
      ],
    };

    const jsonl = encodeConversation(conversation);
    const lines = jsonl.split('\n').filter(Boolean);

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? '');
    expect(parsed.conversationId).toBe('test-conv');
    expect(parsed.stepIndex).toBe(0);
  });

  it('round-trips decode → encode → decode', () => {
    const original = {
      id: 'roundtrip-test',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user' as const, content: 'Test message' },
          output: [{ role: 'assistant' as const, content: 'Response' }],
          timestamp: new Date('2026-01-01T00:00:00Z'),
          metadata: { key: 'value' },
        },
      ],
      metadata: { source: 'test' },
    };

    const encoded = encodeConversation(original);
    const decoded = decodeConversation(encoded);

    expect(decoded.id).toBe(original.id);
    expect(decoded.steps).toHaveLength(1);
    expect(decoded.steps[0]?.stepIndex).toBe(0);
    expect(decoded.steps[0]?.metadata?.key).toBe('value');
  });

  it('throws on empty content', () => {
    expect(() => decodeConversation('')).toThrow('empty');
    expect(() => decodeConversation('   \n  ')).toThrow('empty');
  });

  it('handles metadata preservation', () => {
    const jsonl = readFileSync(join(fixturesDir, 'sample-conversation.jsonl'), 'utf-8');
    const conversation = decodeConversation(jsonl);

    // Check that step metadata is preserved
    expect(conversation.steps[0]?.metadata).toBeDefined();
    expect(conversation.steps[0]?.metadata?.completed).toBe(true);
    expect(conversation.steps[0]?.metadata?.reason).toBe('goal-reached');
  });
});

describe('TallyRunArtifact codec', () => {
  it('round-trips a realistic artifact shape', () => {
    const artifact = {
      schemaVersion: 1 as const,
      runId: 'run-1767864765136-test',
      createdAt: '2026-01-08T09:32:45.136Z',
      defs: {
        metrics: {
          answerRelevance: {
            name: 'answerRelevance',
            scope: 'single' as const,
            valueType: 'number' as const,
            description: 'Measures how relevant the output is to the input query',
          },
        },
        evals: {
          'Answer Relevance': {
            name: 'Answer Relevance',
            kind: 'singleTurn' as const,
            outputShape: 'seriesByStepIndex' as const,
            metric: 'answerRelevance',
            verdict: { kind: 'number', type: 'threshold', passAt: 0.8 },
          },
        },
        scorers: {},
      },
      result: {
        stepCount: 2,
        singleTurn: {
          'Answer Relevance': {
            byStepIndex: [
              {
                evalRef: 'Answer Relevance',
                measurement: {
                  metricRef: 'answerRelevance',
                  score: 1,
                  rawValue: 5,
                  confidence: 0.9,
                  reasoning: 'The response directly addresses the user query.',
                  executionTimeMs: 2187,
                  timestamp: '2026-01-08T09:32:47.324Z',
                },
                outcome: {
                  verdict: 'pass',
                  policy: { kind: 'number', type: 'threshold', passAt: 0.8 },
                  observed: { score: 1, rawValue: 5 },
                },
              },
              null,
            ],
          },
        },
        multiTurn: {},
        scorers: {},
        summaries: {
          byEval: {
            'Answer Relevance': {
              eval: 'Answer Relevance',
              kind: 'singleTurn',
              count: 1,
              aggregations: { score: { mean: 1 } },
              verdictSummary: {
                passRate: 1,
                failRate: 0,
                unknownRate: 0,
                passCount: 1,
                failCount: 0,
                unknownCount: 0,
                totalCount: 1,
              },
            },
          },
        },
      },
      metadata: { dataCount: 1, evaluatorCount: 1 },
    };

    const encoded = encodeRunArtifact(artifact as any);
    const decoded = decodeRunArtifact(encoded);

    expect(decoded.schemaVersion).toBe(1);
    expect(decoded.runId).toBe('run-1767864765136-test');
    expect(decoded.result.stepCount).toBe(2);
    expect(decoded.result.singleTurn['Answer Relevance']?.byStepIndex).toHaveLength(2);
    expect(decoded.result.singleTurn['Answer Relevance']?.byStepIndex[0]?.evalRef).toBe(
      'Answer Relevance'
    );
  });
});
