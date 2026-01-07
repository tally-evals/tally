import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { QUESTIONS, type QuestionConfig } from './questions';
import type { DemandLetterQuestion } from '../../tools/demandLetter';

type QuestionId = string;

interface Session {
	id: string;
	answers: Map<QuestionId, string>;
	verified: Set<QuestionId>;
}

export interface AnswerResult {
	status: 'ok' | 'retry' | 'error';
	errors?: string[];
	summary?: string;
	suggestion?: string;
	example?: string | null;
	nextSteps?: string;
	errorType?: string;
	preview?: Preview;
}

export interface PreviewItem {
	order: number;
	question: string;
	answer: string;
}

export interface Preview {
	items: PreviewItem[];
}

const sessions = new Map<string, Session>();

const model = google('models/gemini-2.5-flash-lite');

function ensureSession(sessionId: string): Session {
	const session = sessions.get(sessionId);
	if (!session) {
		throw new Error(`Session ${sessionId} not found`);
	}
	return session;
}

function makeId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
}

export function createSession(): string {
	const id = makeId();
	sessions.set(id, {
		id,
		answers: new Map(),
		verified: new Set(),
	});
	return id;
}

function getQuestionByOrder(order: number): QuestionConfig | undefined {
	return QUESTIONS.find((q) => q.order === order);
}

function getAnswerByOrder(session: Session, order: number): string | undefined {
	const q = getQuestionByOrder(order);
	if (!q) return undefined;
	return session.answers.get(q.id);
}

function isVisible(question: QuestionConfig, session: Session): boolean {
	const gate = question.showWhenChoiceEquals;
	if (!gate) return true;

	const dependent = QUESTIONS.find((q) => q.order === gate.dependsOnOrder);
	if (!dependent) return true;

	const answer = session.answers.get(dependent.id);
	if (!answer) return false;

	return gate.values.some(
		(value) => value.toLowerCase() === answer.trim().toLowerCase(),
	);
}

type Representation =
	| { type: 'myself' }
	| { type: 'business'; name?: string }
	| { type: 'law_firm'; name?: string }
	| { type: 'someone_else'; name?: string }
	| { type: 'unknown' };

function normalizeRepresentation(raw?: string): Representation {
	const val = (raw ?? '').toLowerCase().trim();
	if (val === 'myself') return { type: 'myself' };
	if (val === 'a business') return { type: 'business' };
	if (val === 'law firm representing client') return { type: 'law_firm' };
	if (val === 'someone else') return { type: 'someone_else' };
	return { type: 'unknown' };
}

function makePossessive(label: string): string {
	if (label.toLowerCase() === 'you') return 'your';
	if (label.toLowerCase().startsWith('your ')) return `${label}'s`;
	if (label.endsWith('s')) return `${label}'`;
	return `${label}'s`;
}

function getEntity(session: Session): {
	label: string;
	possessive: string;
	rep: Representation;
} {
	const repAnswer = getAnswerByOrder(session, 2);
	const rep = normalizeRepresentation(repAnswer);

	const businessName = getAnswerByOrder(session, 4);
	const lawClientName = getAnswerByOrder(session, 5);
	const personName = getAnswerByOrder(session, 6);
	const selfName = getAnswerByOrder(session, 3);

	switch (rep.type) {
		case 'business': {
			const label = businessName?.trim() || 'your business';
			return { label, possessive: makePossessive(label), rep };
		}
		case 'law_firm': {
			const label = lawClientName?.trim() || 'your client';
			return { label, possessive: makePossessive(label), rep };
		}
		case 'someone_else': {
			const label =
				personName?.trim() || "the person you're representing";
			return { label, possessive: makePossessive(label), rep };
		}
		case 'myself': {
			const label = 'you';
			return { label, possessive: 'your', rep };
		}
		default: {
			const label = selfName?.trim() || 'you';
			return { label, possessive: 'your', rep: { type: 'unknown' } };
		}
	}
}

function getOtherPartyLabel(session: Session): string {
	const other = getAnswerByOrder(session, 7)?.trim();
	return other && other.length > 0 ? other : 'the other party';
}

function contextualizeQuestionText(
	question: QuestionConfig,
	session: Session,
): string {
	const { label, possessive, rep } = getEntity(session);
	const otherParty = getOtherPartyLabel(session);

	// Helper flags
	const isMyself = rep.type === 'myself';
	const isBusiness = rep.type === 'business';
	const isLawFirm = rep.type === 'law_firm';
	const isSomeoneElse = rep.type === 'someone_else';

	// Safe defaults
	const base = question.text;

	switch (question.order) {
		case 7: {
			// Other party name question: keep independent of client; just substitute otherParty if known
			if (otherParty !== 'the other party') {
				return base.replace("the other person's name or their business name", otherParty);
			}
			return base;
		}
		case 8: {
			// Relationship with other party
			if (isMyself) return base;
			if (isBusiness || isLawFirm || isSomeoneElse) {
				return `What is ${possessive} relationship with ${otherParty} (how do you know them)?`;
			}
			return base;
		}
		case 9: {
			// Story question: preserve opener and "side of the story"
			if (isMyself) return base;
			const who =
				isBusiness || isLawFirm || isSomeoneElse
					? `${label}'s`
					: possessive;
			return `Let's start with what happened. Please tell me ${who} side of the story. You can include as many details as you want.`;
		}
		case 10: {
			// Key events — no perspective change
			return base;
		}
		case 11: {
			if (isMyself) return base;
			return `Does ${otherParty} owe ${label} money?`;
		}
		case 12: {
			if (isMyself) return base;
			return `How much does ${otherParty} owe ${label}?`;
		}
		case 13: {
			if (isMyself) return base;
			return `When was it supposed to be paid? (If ${label} is not sure, that's okay too)`;
		}
		case 14: {
			if (isMyself) return base;
			return `Can you tell me about any ways ${label} has been negatively affected by what ${otherParty} did or didn't do? If there haven't been any negative impacts, it's completely okay to say so.`;
		}
		case 15: {
			if (isMyself) return base;
			return `What does ${label} think would be a fair way to resolve this dispute? This can include money, as well as non-monetary things like a positive review, product replacement, or an apology.`;
		}
		case 16: {
			if (isMyself) return base.replace('the other person', otherParty);
			return `Have ${label} and ${otherParty} discussed this dispute before now?`;
		}
		case 17: {
			if (isMyself) return base.replace('the other party', otherParty);
			return `Okay, can you tell me what was discussed? It's helpful for me to know the main points, how ${label} communicated with ${otherParty} (like text, email, etc.), and when it happened.`;
		}
		case 18: {
			// Additional info — no perspective change
			return base;
		}
		case 19: {
			if (isMyself) return base;
			return `When does ${label} want a response to your letter?`;
		}
		case 20: {
			if (isMyself) return base;
			return `What is ${label}'s email address (the sender's contact information)?`;
		}
		case 21: {
			// Recipient email: keep focused on other party
			if (otherParty === 'the other party') return base;
			return `What is ${otherParty}'s email address (where we'll send the demand letter)?`;
		}
		default:
			return base;
	}
}

function toPublicQuestion(
	question: QuestionConfig,
	session: Session,
): DemandLetterQuestion {
	return {
		id: question.id,
		order: question.order,
		text: contextualizeQuestionText(question, session),
		type: question.type,
		options: question.options,
		validation: question.validation,
	};
}

export function getNextQuestion(
	sessionId: string,
): DemandLetterQuestion | null {
	const session = ensureSession(sessionId);
	const sorted = [...QUESTIONS].sort((a, b) => a.order - b.order);

	for (const q of sorted) {
		if (!isVisible(q, session)) continue;
		if (!session.verified.has(q.id)) {
			return toPublicQuestion(q, session);
		}
	}
	return null;
}

function buildContext(session: Session): { question: string; answer: string }[] {
	return [...session.answers.entries()]
		.map(([id, answer]) => {
			const q = QUESTIONS.find((q) => q.id === id);
			return q
				? {
						question: contextualizeQuestionText(q, session),
						answer,
					}
				: null;
		})
		.filter((x): x is { question: string; answer: string } => Boolean(x));
}

function validateChoice(answer: string, question: QuestionConfig): AnswerResult {
	if (!question.options || question.options.length === 0) {
		return {
			status: 'retry',
			errors: ['No options available'],
			suggestion: 'Please try again.',
		};
	}

	const match = question.options.find(
		(opt) => opt.toLowerCase() === answer.trim().toLowerCase(),
	);
	if (!match) {
		return {
			status: 'retry',
			errors: [`Please choose one of: ${question.options.join(', ')}`],
			summary: 'Invalid choice selected',
			suggestion: 'Pick one of the listed options.',
			example: question.options.join(' | '),
			nextSteps: 'Select an option and resend.',
			errorType: 'validation',
		};
	}

	return { status: 'ok' };
}

function validateEmail(answer: string): AnswerResult {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(answer.trim())) {
		return {
			status: 'retry',
			errors: ['Invalid email format'],
			summary: 'Email format validation failed',
			suggestion: 'Please enter a valid email address.',
			example: 'john@example.com',
			nextSteps: 'Check the email format and try again.',
			errorType: 'format',
		};
	}
	return { status: 'ok' };
}

function validatePhone(answer: string): AnswerResult {
	const digits = answer.replace(/\D/g, '');
	if (digits.length < 10 || digits.length > 15) {
		return {
			status: 'retry',
			errors: ['Phone number looks incomplete'],
			summary: 'Phone number validation failed',
			suggestion: 'Include area code and avoid extra characters.',
			example: '(555) 123-4567',
			nextSteps: 'Re-enter the phone number.',
			errorType: 'validation',
		};
	}
	return { status: 'ok' };
}

function validateCurrency(answer: string): AnswerResult {
	const match = answer.replace(/,/g, '').match(/([-+]?\d+(\.\d+)?)/);
	if (!match) {
		return {
			status: 'retry',
			errors: ['Invalid currency amount'],
			summary: 'Currency format validation failed',
			suggestion: 'Enter a number like 1500 or $1,500.00.',
			example: '$1,500.00',
			nextSteps: 'Provide the amount in numbers.',
			errorType: 'format',
		};
	}

	const value = parseFloat(match[1] as string);
	if (!Number.isFinite(value) || value <= 0) {
		return {
			status: 'retry',
			errors: ['Amount must be greater than zero'],
			summary: 'Invalid amount',
			suggestion: 'Use a positive amount.',
			example: '$500',
			nextSteps: 'Re-enter a positive amount.',
			errorType: 'validation',
		};
	}

	return { status: 'ok' };
}

function validateText(answer: string, question: QuestionConfig): AnswerResult {
	const trimmed = answer.trim();
	if (question.validation.required && trimmed.length === 0) {
		return {
			status: 'retry',
			errors: ['This field is required'],
			summary: 'Required field is empty',
			suggestion: 'Please provide an answer so we can continue.',
			example: undefined,
			nextSteps: 'Add a brief answer and resend.',
			errorType: 'validation',
		};
	}

	const min = question.validation.minLength;
	if (min && trimmed.length < min) {
		return {
			status: 'retry',
			errors: ['Answer is too short'],
			summary: 'Needs more detail',
			suggestion: `Please add a bit more detail (at least ${min} characters).`,
			example: undefined,
			nextSteps: 'Expand your answer slightly and resend.',
			errorType: 'validation',
		};
	}

	const max = question.validation.maxLength;
	if (max && trimmed.length > max) {
		return {
			status: 'retry',
			errors: ['Answer is too long'],
			summary: 'Answer length exceeded',
			suggestion: `Please keep it under ${max} characters.`,
			example: undefined,
			nextSteps: 'Shorten and resend.',
			errorType: 'validation',
		};
	}

	return { status: 'ok' };
}

async function verifyWithLLM(
	answer: string,
	questionText: string,
	context: { question: string; answer: string }[],
): Promise<AnswerResult> {
	try {
		const result = await generateObject({
			model,
			temperature: 0.1,
			schema: z.object({
				passed: z.boolean(),
				confidence: z.number().min(0).max(1),
				reasoning: z.string(),
				suggestions: z.string().optional(),
				contextualExample: z.string().optional(),
			}),
			prompt: `You are verifying an answer for a demand letter questionnaire.

QUESTION: ${questionText}
ANSWER: ${answer}

PREVIOUS ANSWERS:
${context
	.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`)
	.join('\n\n')}

Rules:
- Be forgiving; pass unless the answer is clearly irrelevant or empty.
- If the user says "none"/"no negative impact", that is acceptable.
- Keep feedback brief (2-3 lines) if failing.
`,
		});

		if (result.object.passed) {
			return { status: 'ok' };
		}

		return {
			status: 'retry',
			errors: ['Answer needs more detail'],
			summary: 'Answer needs improvement',
			suggestion:
				result.object.suggestions ??
				'Great start—could you add a bit more detail to make this clear?',
			example: result.object.contextualExample ?? null,
			nextSteps: 'Add detail and resend.',
			errorType: 'validation',
		};
	} catch (error) {
		return {
			status: 'retry',
			errors: ['Verification unavailable'],
			summary: 'Could not verify right now',
			suggestion: 'Please resend your answer.',
			example: null,
			nextSteps: 'Try again in a moment.',
			errorType: 'validation',
		};
	}
}

function needsLLM(question: QuestionConfig): boolean {
	if (process.env.SKIP_LLM_VERIFY === '1') return false;
	// Skip for structured validations
	const t = question.validation.type;
	if (['email', 'phone', 'currency', 'date'].includes(t)) return false;
	if (question.type === 'choice') return false;
	return true;
}

function buildPreview(session: Session): Preview {
	const items: PreviewItem[] = [...session.answers.entries()]
		.map(([id, answer]) => {
			const q = QUESTIONS.find((q) => q.id === id);
			if (!q) return null;
			return {
				order: q.order,
				question: q.text,
				answer,
			};
		})
		.filter((x): x is PreviewItem => Boolean(x))
		.sort((a, b) => a.order - b.order);

	return { items };
}

export async function submitAnswer(params: {
	sessionId: string;
	questionId: string;
	answer: string;
}): Promise<AnswerResult> {
	const session = ensureSession(params.sessionId);
	const question = QUESTIONS.find((q) => q.id === params.questionId);
	if (!question) {
		return {
			status: 'error',
			errors: ['Question not found'],
			summary: 'Invalid question',
			suggestion: 'Please try again.',
			errorType: 'system',
		};
	}

	// Visibility gate
	if (!isVisible(question, session)) {
		return {
			status: 'error',
			errors: ['Question is not available in this path'],
			summary: 'Invalid flow state',
			errorType: 'flow',
		};
	}

	const answer = params.answer.trim();
	let validationResult: AnswerResult;

	if (question.type === 'choice') {
		validationResult = validateChoice(answer, question);
	} else {
		switch (question.validation.type) {
			case 'email':
				validationResult = validateEmail(answer);
				break;
			case 'phone':
				validationResult = validatePhone(answer);
				break;
			case 'currency':
				validationResult = validateCurrency(answer);
				break;
			default:
				validationResult = validateText(answer, question);
		}
	}

	if (validationResult.status !== 'ok') {
		return validationResult;
	}

	// LLM verification for open text where applicable
	if (needsLLM(question)) {
		const llmResult = await verifyWithLLM(
			answer,
			contextualizeQuestionText(question, session),
			buildContext(session),
		);
		if (llmResult.status !== 'ok') {
			return llmResult;
		}
	}

	// Persist answer + mark verified
	session.answers.set(question.id, answer);
	session.verified.add(question.id);

	// Completion check
	const next = getNextQuestion(session.id);
	if (!next) {
		return {
			status: 'ok',
			preview: buildPreview(session),
		};
	}

	return { status: 'ok' };
}


