import { tool } from 'ai';
import { z } from 'zod';
import {
  createSession,
  getNextQuestion,
  submitAnswer,
  type AnswerResult,
  type Preview,
} from '../agents/demandLetter/runtime';

export interface DemandLetterQuestion {
  id: string;
  order: number;
  text: string;
  type: 'open' | 'choice';
  options: string[] | null;
  validation: {
    type: 'text' | 'email' | 'phone' | 'currency' | 'date';
    required: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

export const demandLetterTools = {
  startSession: tool({
    description:
      'Start a new demand letter chat session and return the first question',
    inputSchema: z.object({}),
    outputSchema: z.object({
      sessionId: z.string(),
      question: z
        .object({
          id: z.string(),
          order: z.number(),
          text: z.string(),
          type: z.enum(['open', 'choice']),
          options: z.array(z.string()).optional(),
          validation: z.object({
            type: z.enum(['text', 'email', 'phone', 'currency', 'date']),
            required: z.boolean(),
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
          }),
        })
        .nullable()
        .optional(),
    }),
    execute: async () => {
      const sessionId = createSession();
      const next = getNextQuestion(sessionId);
      const payload: Record<string, unknown> = { sessionId };
      if (next) payload.question = next;
      return payload;
    },
  }),

  answerQuestion: tool({
    description: 'Submit an answer for the current demand letter question',
    inputSchema: z.object({
      sessionId: z
        .string()
        .describe('Session identifier returned by startSession'),
      questionId: z.string().describe('ID of the question being answered'),
      answer: z.string().describe('User answer text'),
    }),
    // outputSchema: z.object({
    //   status: z.enum(['ok', 'retry', 'error']),
    //   errors: z.array(z.string()).optional(),
    //   summary: z.string().optional(),
    //   suggestion: z.string().optional(),
    //   example: z.string().optional().nullable(),
    //   nextSteps: z.string().optional(),
    //   errorType: z.string().optional(),
    //   preview: z
    //     .object({
    //       items: z.array(
    //         z.object({
    //           order: z.number(),
    //           question: z.string(),
    //           answer: z.string(),
    //         }),
    //       ),
    //     })
    //     .optional()
    //     .nullable(),
    //   nextQuestion: z
    //     .object({
    //       id: z.string(),
    //       order: z.number(),
    //       text: z.string(),
    //       type: z.enum(['open', 'choice']),
    //       options: z.array(z.string()).optional(),
    //       validation: z.object({
    //         type: z.enum(['text', 'email', 'phone', 'currency', 'date']),
    //         required: z.boolean(),
    //         minLength: z.number().optional(),
    //         maxLength: z.number().optional(),
    //       }),
    //     })
    //     .optional()
    //     .nullable(),
    // }),
    execute: async ({
      sessionId,
      questionId,
      answer,
    }): Promise<
      AnswerResult & {
        nextQuestion?: DemandLetterQuestion | null;
        preview?: Preview;
      }
    > => {
      const result = await submitAnswer({
        sessionId,
        questionId,
        answer,
      });
      const payload: AnswerResult & {
        nextQuestion?: DemandLetterQuestion | null;
        preview?: Preview;
      } = { ...result };

      if (result.status === 'ok') {
        const next = getNextQuestion(sessionId);
        if (next) {
          payload.nextQuestion = next;
          delete payload.preview;
        } else if (result.preview) {
          payload.preview = result.preview;
        }
      } else {
        delete payload.preview;
        delete payload.nextQuestion;
      }

      return payload;
    },
  }),
};
