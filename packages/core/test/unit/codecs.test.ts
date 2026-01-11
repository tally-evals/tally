import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';
import {
  decodeConversation,
  decodeReport,
  encodeConversation,
  encodeReport,
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

describe('EvaluationReportCodec', () => {
  it('round-trips report with realistic structure from actual run data', () => {
    // Realistic report based on actual run-1767864765136-8zeeq5q.json
    const report = {
      runId: 'run-1767864765136-test',
      timestamp: new Date('2026-01-08T09:32:45.136Z'),
      perTargetResults: [
        {
          targetId: 'travel-planner-golden',
          rawMetrics: [
            {
              metricDef: {
                name: 'answerRelevance',
                valueType: 'number' as const,
                description: 'Measures how relevant the output is to the input query',
              },
              value: 5,
              confidence: 0.9,
              reasoning: 'The response directly addresses the user query.',
              executionTime: 2187,
              timestamp: new Date('2026-01-08T09:32:47.324Z'),
            },
          ],
          derivedMetrics: [
            {
              definition: {
                name: 'Answer Relevance_score',
                valueType: 'number' as const,
                description: 'Normalized score for Answer Relevance',
              },
              value: 1,
            },
          ],
          verdicts: new Map([
            [
              'Answer Relevance',
              {
                verdict: 'pass' as const,
                score: 1,
                rawValue: null,
              },
            ],
          ]),
        },
      ],
      aggregateSummaries: [
        {
          metric: {
            name: 'Answer Relevance_score',
            valueType: 'number' as const,
            description: 'Normalized score for Answer Relevance',
          },
          aggregations: {
            mean: 1,
            percentiles: { p50: 1, p75: 1, p90: 1, p95: 1, p99: 1 },
            passRate: 1,
            failRate: 0,
            passCount: 1,
            failCount: 0,
          },
          count: 1,
        },
      ],
      evalSummaries: new Map([
        [
          'Answer Relevance',
          {
            evalName: 'Answer Relevance',
            evalKind: 'singleTurn' as const,
            aggregations: {
              mean: 1,
              percentiles: { p50: 1, p75: 1, p90: 1, p95: 1, p99: 1 },
              passRate: 1,
              failRate: 0,
              passCount: 1,
              failCount: 0,
            },
            verdictSummary: {
              passRate: 1,
              failRate: 0,
              passCount: 1,
              failCount: 0,
              totalCount: 1,
            },
          },
        ],
      ]),
      metricToEvalMap: new Map([['answerRelevance', 'Answer Relevance']]),
      metadata: { dataCount: 1, evaluatorCount: 1 },
    };

    const encoded = encodeReport(report);
    const decoded = decodeReport(encoded);

    expect(decoded.runId).toBe('run-1767864765136-test');
    expect(decoded.perTargetResults).toHaveLength(1);
    expect(decoded.perTargetResults[0]?.verdicts).toBeInstanceOf(Map);
    expect(decoded.evalSummaries).toBeInstanceOf(Map);

    // Cast to Map since Zod schema has union type (Map | object)
    const evalSummariesMap = decoded.evalSummaries as Map<string, unknown>;
    const evalSummary = evalSummariesMap.get('Answer Relevance') as
      | { evalName: string }
      | undefined;
    expect(evalSummary?.evalName).toBe('Answer Relevance');
    expect(decoded.aggregateSummaries[0]?.aggregations.mean).toBe(1);
  });
});
