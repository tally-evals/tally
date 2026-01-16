import type { Conversation } from '../../src/index';

export const conversationExampleA: Conversation = {
  id: 'convA',
  steps: [
    {
      stepIndex: 0,
      input: { role: 'user', content: 'Hello!' },
      output: [{ role: 'assistant', content: 'Hi there, how can I help you today?' }],
    },
    {
      stepIndex: 1,
      input: { role: 'user', content: 'What is the capital of Japan?' },
      output: [{ role: 'assistant', content: 'Tokyo' }],
    },
  ],
  metadata: { source: 'exampleA' },
};

export const conversationExampleB: Conversation = {
  id: 'convB',
  steps: [
    {
      stepIndex: 0,
      input: { role: 'user', content: 'Summarize: The sky is blue.' },
      output: [{ role: 'assistant', content: 'The sky appears blue.' }],
    },
    {
      stepIndex: 1,
      input: { role: 'user', content: 'Maintain friendly tone.' },
      output: [{ role: 'assistant', content: 'Absolutely! I will keep it friendly.' }],
    },
    {
      stepIndex: 2,
      input: { role: 'user', content: 'Now answer: 3 * 3?' },
      output: [{ role: 'assistant', content: '9' }],
    },
  ],
  metadata: { source: 'exampleB' },
};
