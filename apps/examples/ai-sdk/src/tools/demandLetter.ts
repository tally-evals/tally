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
	options?: string[];
	validation: {
		type: 'text' | 'email' | 'phone' | 'currency' | 'date';
		required: boolean;
		minLength?: number;
		maxLength?: number;
	};
}

export const demandLetterTools = {
	startSession: tool({
		description: 'Start a new demand letter chat session and return the first question',
		inputSchema: z.object({}),
		execute: async () => {
			const sessionId = createSession();
			const next = getNextQuestion(sessionId);

			return {
				sessionId,
				question: next,
			};
		},
	}),

	answerQuestion: tool({
		description: 'Submit an answer for the current demand letter question',
		inputSchema: z.object({
			sessionId: z.string().describe('Session identifier returned by startSession'),
			questionId: z.string().describe('ID of the question being answered'),
			answer: z.string().describe('User answer text'),
		}),
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

			if (result.status === 'ok') {
				const next = getNextQuestion(sessionId);
				return {
					...result,
					nextQuestion: next,
					preview: next ? undefined : result.preview,
				};
			}

			return {
				...result,
				nextQuestion: null,
				preview: undefined,
			};
		},
	}),
};

