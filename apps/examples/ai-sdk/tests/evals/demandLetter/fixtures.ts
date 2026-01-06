import type { Conversation } from '@tally-evals/tally';
import {
	createSession,
	getNextQuestion,
	submitAnswer,
} from '../../../src/agents/demandLetter/runtime';

export interface ChatFixture {
	id: string;
	description: string;
	answers: Array<{ questionId: string; answer: string }>;
}

// Hand-authored fixtures covering branches and error→retry flows.
export const chatFixtures: ChatFixture[] = [
	{
		id: 'self-money-yes-discussed',
		description: 'Myself, money owed yes, discussed yes, complete to preview',
		answers: [
			{ questionId: 'q1', answer: 'Services purchased or performed' },
			{ questionId: 'q2', answer: 'Myself' },
			{ questionId: 'q3', answer: 'Jane Doe' },
			{ questionId: 'q7', answer: 'BrightEdge Marketing' },
			{ questionId: 'q8', answer: 'They were our marketing vendor' },
			{
				questionId: 'q9',
				answer:
					'They failed to deliver the agreed ad campaigns despite payment.',
			},
			{
				questionId: 'q10',
				answer: 'Contract signed Jan 5, invoices Feb 1 and Mar 1; no delivery.',
			},
			{ questionId: 'q11', answer: 'Yes' },
			{ questionId: 'q12', answer: '$2,500' },
			{
				questionId: 'q13',
				answer: 'Payment was due on March 15, 2025.',
			},
			{
				questionId: 'q14',
				answer: 'Lost ad spend and time; no response from them.',
			},
			{
				questionId: 'q15',
				answer:
					'A refund of $2,500 and confirmation they will stop billing us.',
			},
			{ questionId: 'q16', answer: 'Yes' },
			{
				questionId: 'q17',
				answer:
					'We discussed via email in April; they acknowledged delay but did nothing.',
			},
			{ questionId: 'q18', answer: 'Nothing else.' },
			{ questionId: 'q19', answer: 'April 30, 2025' },
			{ questionId: 'q20', answer: 'jane@example.com' },
			{ questionId: 'q21', answer: 'support@brightedge.com' },
		],
	},
	{
		id: 'business-money-no',
		description: 'Business representation, money owed no, skip amount/due date',
		answers: [
			{ questionId: 'q1', answer: 'Goods bought or sold' },
			{ questionId: 'q2', answer: 'A business' },
			{ questionId: 'q4', answer: 'Acme Corp' },
			{ questionId: 'q7', answer: 'Global Supplies' },
			{ questionId: 'q8', answer: 'Supplier relationship' },
			{ questionId: 'q9', answer: 'Goods delivered were defective.' },
			{ questionId: 'q10', answer: 'Delivered March 1; issue found March 3.' },
			{ questionId: 'q11', answer: 'No' },
			{ questionId: 'q14', answer: 'Our business reputation suffered.' },
			{ questionId: 'q15', answer: 'Replacement goods and apology.' },
			{ questionId: 'q16', answer: 'No' },
			{ questionId: 'q18', answer: 'No' },
			{ questionId: 'q19', answer: 'No further info.' },
			{ questionId: 'q20', answer: 'ops@acme.com' },
			{ questionId: 'q21', answer: 'contact@globalsupplies.com' },
		],
	},
	{
		id: 'lawfirm-money-yes',
		description: 'Law firm representing client, money owed yes',
		answers: [
			{ questionId: 'q1', answer: 'A contract' },
			{ questionId: 'q2', answer: 'Law firm representing client' },
			{ questionId: 'q5', answer: 'Contoso LLC' },
			{ questionId: 'q7', answer: 'Northwind Trading' },
			{ questionId: 'q8', answer: 'They are the distributor for our client.' },
			{ questionId: 'q9', answer: 'They breached the distribution agreement.' },
			{ questionId: 'q10', answer: 'Agreement signed Feb 1; breach in April.' },
			{ questionId: 'q11', answer: 'Yes' },
			{ questionId: 'q12', answer: '$15,000' },
			{ questionId: 'q13', answer: 'Was due April 30, 2025.' },
			{ questionId: 'q14', answer: 'Client lost sales and goodwill.' },
			{ questionId: 'q15', answer: 'Full payment and stop using our marks.' },
			{ questionId: 'q16', answer: 'Yes' },
			{
				questionId: 'q17',
				answer:
					'We spoke by phone May 5; they promised to pay but have not.',
			},
			{ questionId: 'q18', answer: 'No further info.' },
			{ questionId: 'q19', answer: 'May 20, 2025' },
			{ questionId: 'q20', answer: 'counsel@firm.com' },
			{ questionId: 'q21', answer: 'legal@northwind.com' },
		],
	},
	{
		id: 'someone-else-discussed-no',
		description: 'Representing someone else, discussed no',
		answers: [
			{ questionId: 'q1', answer: 'A family or personal relationship' },
			{ questionId: 'q2', answer: 'Someone Else' },
			{ questionId: 'q6', answer: 'Imran Ali' },
			{ questionId: 'q7', answer: 'John Smith' },
			{ questionId: 'q8', answer: 'They are neighbors' },
			{ questionId: 'q9', answer: 'Property boundary dispute.' },
			{ questionId: 'q10', answer: 'Fence moved April 10, 2025.' },
			{ questionId: 'q11', answer: 'No' },
			{ questionId: 'q14', answer: 'Stress and reduced property value.' },
			{ questionId: 'q15', answer: 'Restore fence to original line.' },
			{ questionId: 'q16', answer: 'No' },
			{ questionId: 'q18', answer: 'No' },
			{ questionId: 'q19', answer: 'No additional info.' },
			{ questionId: 'q20', answer: 'helper@example.com' },
			{ questionId: 'q21', answer: 'john.smith@example.com' },
		],
	},
	{
		id: 'email-retry-then-ok',
		description: 'Email fails then passes, money yes',
		answers: [
			{ questionId: 'q1', answer: 'A business relationship' },
			{ questionId: 'q2', answer: 'Myself' },
			{ questionId: 'q3', answer: 'Alex Lee' },
			{ questionId: 'q7', answer: 'ACME Widgets' },
			{ questionId: 'q8', answer: 'Supplier' },
			{ questionId: 'q9', answer: 'Late shipments causing delays.' },
			{ questionId: 'q10', answer: 'Shipments due weekly in March; missed 2.' },
			{ questionId: 'q11', answer: 'Yes' },
			{ questionId: 'q12', answer: '$3,000' },
			{ questionId: 'q13', answer: 'Due March 20, 2025.' },
			{ questionId: 'q14', answer: 'Lost customers.' },
			{ questionId: 'q15', answer: 'Refund and assurance of delivery.' },
			{ questionId: 'q16', answer: 'Yes' },
			{ questionId: 'q17', answer: 'Emails on March 25; no resolution.' },
			{ questionId: 'q18', answer: 'Nothing else.' },
			{ questionId: 'q19', answer: 'April 5, 2025' },
			{ questionId: 'q20', answer: 'bad-email' }, // invalid
			{ questionId: 'q20', answer: 'alex.lee@example.com' }, // corrected
			{ questionId: 'q21', answer: 'support@acmewidgets.com' },
		],
	},
	{
		id: 'currency-retry-then-ok',
		description: 'Currency fails then passes',
		answers: [
			{ questionId: 'q1', answer: 'Something else' },
			{ questionId: 'q2', answer: 'Myself' },
			{ questionId: 'q3', answer: 'Taylor Kim' },
			{ questionId: 'q7', answer: 'Neighbor' },
			{ questionId: 'q8', answer: 'Neighbor' },
			{ questionId: 'q9', answer: 'Damage to shared driveway.' },
			{ questionId: 'q10', answer: 'Incident on May 1, 2025.' },
			{ questionId: 'q11', answer: 'Yes' },
			{ questionId: 'q12', answer: 'ten dollars' }, // invalid
			{ questionId: 'q12', answer: '$750' }, // corrected
			{ questionId: 'q13', answer: 'Due May 15, 2025.' },
			{ questionId: 'q14', answer: 'Repair costs and inconvenience.' },
			{ questionId: 'q15', answer: 'Pay for repairs.' },
			{ questionId: 'q16', answer: 'No' },
			{ questionId: 'q18', answer: 'No' },
			{ questionId: 'q19', answer: 'No additional info.' },
			{ questionId: 'q20', answer: 'taylor@example.com' },
			{ questionId: 'q21', answer: 'neighbor@example.com' },
		],
	},
];

/**
 * Run a chat fixture through the demand letter runtime and produce a Conversation.
 */
export async function runFixture(
	fixture: ChatFixture,
): Promise<Conversation> {
	const sessionId = createSession();
	let question = getNextQuestion(sessionId);
	const steps: Array<Conversation['steps'][number]> = [];
	let stepIndex = 0;

	// Allow multiple answers per questionId (for retry/fix)
	const answerMap = new Map<string, string[]>();
	for (const { questionId, answer } of fixture.answers) {
		const list = answerMap.get(questionId) ?? [];
		list.push(answer);
		answerMap.set(questionId, list);
	}

	// Walk until completion or no next question, pulling answers by question id
	const maxSteps = 200;
	let iterations = 0;
	while (question && iterations < maxSteps) {
		iterations += 1;
		const answersForQ = answerMap.get(question.id) ?? [];
		const answer = answersForQ[0];
		if (!answer) {
			console.warn(
				`Fixture ${fixture.id}: no answer provided for ${question.id}, stopping run.`,
			);
			break;
		}

		const result = await submitAnswer({
			sessionId,
			questionId: question.id,
			answer,
		});

		// Record step: assistant asks, user answers (for simplicity)
		steps.push({
			stepIndex: stepIndex++,
			input: {
				role: 'assistant',
				content: question.text,
			},
			output: [
				{
					role: 'user',
					content: answer,
				},
			],
			metadata: {
				questionId: question.id,
				status: result.status,
				errors: result.errors,
				summary: result.summary,
				suggestion: result.suggestion,
			},
		});

		if (result.status === 'ok') {
			// Consume this answer attempt only on success
			answersForQ.shift();
			if (answersForQ.length === 0) {
				answerMap.delete(question.id);
			} else {
				answerMap.set(question.id, answersForQ);
			}
			question = getNextQuestion(sessionId);
			continue;
		}

		// Retry/validation failure:
		// If there is another answer queued for this question, consume the current and retry with the next.
		if (answersForQ.length > 1) {
			answersForQ.shift();
			answerMap.set(question.id, answersForQ);
			// stay on same question for next iteration
			continue;
		}

		// No more answers to try for this question; stop
		break;

	}

	return {
		id: fixture.id,
		steps: steps as Conversation['steps'],
	};
}

