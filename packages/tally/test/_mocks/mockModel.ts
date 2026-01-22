import { MockLanguageModelV2 } from 'ai/test';

export function makeMockLanguageModelReturningObject(jsonString: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: jsonString }],
      warnings: [],
    }),
  });
}

export function makeMockLanguageModelStreamingChunks(
  chunks: Array<{ type: string; [k: string]: unknown }>
) {
  // Placeholder for future streaming cases if needed
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: '{}' }],
      warnings: [],
    }),
  });
}
