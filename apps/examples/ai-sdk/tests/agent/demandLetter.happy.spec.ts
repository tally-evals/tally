import { describe, it, expect } from 'vitest';

import {
	createSession,
	getNextQuestion,
	submitAnswer,
	type AnswerResult,
} from '../../src/agents/demandLetter/runtime';

/**
 * Happy-path smoke test that drives the demand letter flow with hardcoded answers.
 * This bypasses trajectories and simply exercises the agent tools end-to-end.
 */
describe('Demand Letter Agent - Happy Path (manual harness)', () => {
	it('collects answers and reaches preview', async () => {
		const answers: Record<string, string> = {
			q1: 'Goods bought or sold',
			q2: 'Myself',
			q3: 'Alice Smith',
			q7: 'Acme Corp',
			q8: 'I purchased goods from Acme Corp.',
			q9: 'They delivered defective products and refused replacement.',
			q10: 'Delivery on Jan 5, 2025; refusal on Jan 12, 2025.',
			q11: 'Yes',
			q12: '$1,200',
			q13: 'Due on Jan 20, 2025',
			q14: 'Lost revenue and customer complaints.',
			q15: 'Refund plus shipping reimbursement.',
			q16: 'Yes',
			q17: 'Discussed by email on Jan 15; they declined a refund.',
			q18: 'I have receipts and email thread.',
			q19: 'Within 7 days',
			q20: 'alice@example.com',
			q21: 'legal@acme.com',
		};

		const sessionId = createSession();
		let question = getNextQuestion(sessionId);
		let lastResult: AnswerResult | undefined;

		while (question) {
			const answer = answers[question.id];
			expect(answer, `Missing answer for ${question.id}`).toBeTruthy();

			// eslint-disable-next-line no-console
			console.log(`Q${question.order} (${question.id}): ${question.text}`);
			// eslint-disable-next-line no-console
			console.log(`A: ${answer}`);

			const result = await submitAnswer({
				sessionId,
				questionId: question.id,
				answer: answer as string,
			});
			lastResult = result;

			expect(result.status).toBe('ok');

			question = getNextQuestion(sessionId);
		}

		// Final preview should be present when the flow ends
		expect(lastResult?.preview).toBeDefined();
	});
});

