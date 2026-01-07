import type { Conversation } from '@tally-evals/tally';

// Code-based metric: ensure required conditional questions are present/absent
export function checkBranching(convo: Conversation): number {
	if (!convo || !Array.isArray(convo.steps)) return 0;
	const answersById = new Map<string, string>();
	for (const step of convo.steps) {
		const qId = (step as any).metadata?.questionId as string | undefined;
		const answer =
			step.output?.[0]?.content && typeof step.output[0].content === 'string'
				? step.output[0].content
				: '';
		if (qId && answer) {
			answersById.set(qId, answer);
		}
	}

	const repAnswer = answersById.get('q2')?.toLowerCase() ?? '';
	const moneyAnswer = answersById.get('q11')?.toLowerCase() ?? '';

	let score = 1;

	// Money branching
	const hasAmount = answersById.has('q12');
	const hasDueDate = answersById.has('q13');
	if (moneyAnswer === 'yes') {
		if (!hasAmount || !hasDueDate) score = 0;
	} else if (moneyAnswer === 'no') {
		if (hasAmount || hasDueDate) score = 0;
	}

	// Representation branches: presence of name questions
	const hasSelfName = answersById.has('q3');
	const hasBizName = answersById.has('q4');
	const hasClientName = answersById.has('q5');
	const hasPersonName = answersById.has('q6');

	if (repAnswer.includes('myself')) {
		if (!hasSelfName || hasBizName || hasClientName || hasPersonName) score = 0;
	}
	if (repAnswer.includes('business')) {
		if (!hasBizName) score = 0;
	}
	if (repAnswer.includes('law firm')) {
		if (!hasClientName) score = 0;
	}
	if (repAnswer.includes('someone else')) {
		if (!hasPersonName) score = 0;
	}

	return score;
}

// Code-based metric: flow completion (presence of preview-equivalent end)
export function checkCompletion(convo: Conversation): number {
	if (!convo || !Array.isArray(convo.steps)) return 0;
	const answersById = new Set<string>();
	for (const step of convo.steps) {
		const qId = (step as any).metadata?.questionId as string | undefined;
		if (qId) answersById.add(qId);
	}

	const hasSenderEmail = answersById.has('q20');
	const hasRecipientEmail = answersById.has('q21');

	return hasSenderEmail && hasRecipientEmail ? 1 : 0;
}

