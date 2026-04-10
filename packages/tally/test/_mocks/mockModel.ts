import { MockLanguageModelV3 } from 'ai/test';

export function makeMockLanguageModelReturningObject(jsonString: string) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: 'stop',
      usage: {
        inputTokens: { total: 5, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 10, text: undefined, reasoning: undefined },
      },
      content: [{ type: 'text', text: jsonString }],
      warnings: [],
    }),
  });
}

export function makeMockLanguageModelStreamingChunks(
  chunks: Array<{ type: string; [k: string]: unknown }>
) {
  // Placeholder for future streaming cases if needed
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: 'stop',
      usage: {
        inputTokens: { total: 1, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: undefined, reasoning: undefined },
      },
      content: [{ type: 'text', text: '{}' }],
      warnings: [],
    }),
  });
}
