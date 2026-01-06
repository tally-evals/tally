/**
 * Demand Letter Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete demand letter creation flow
 */
export const demandLetterGoldenTrajectory: Trajectory = {
	goal: 'Create a demand letter for an unpaid invoice successfully',
	persona: {
		name: 'Business Owner',
		description:
			'You need to create a legal demand letter. You provide information as the agent guides you through the process. You are professional and want to ensure all required information is included.',
		guardrails: [
			'Answer each agent question succinctly and accurately',
			'Do not volunteer extra topics; follow the questionnaire order',
			'When offered options, pick exactly one of the listed options verbatim',
			'If unsure, say you are unsure',
		],
	},
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Say you need to create a demand letter for an unpaid invoice.',
			},
			{
				id: 'step-2',
				instruction:
					'Continue to answer each question the agent asks until they reach the end and show the preview. For choice questions, answer with exactly one of the provided options.',
			},
		],
		start: 'step-1',
		terminals: ['step-2'],
	},
	maxTurns: 40,
	storage: {
		strategy: 'local',
		conversationId: 'demand-letter-golden',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Incomplete information, changing requirements, edge cases
 */
export const demandLetterCurveTrajectory: Trajectory = {
	goal: 'Test agent handling of incomplete information and changing requirements',
	persona: {
		name: 'Uncertain Business Owner',
		description:
			'You need a demand letter but sometimes provide incomplete information or change your mind about details. You might forget important information.',
		guardrails: [
			'Answer the current question, but sometimes omit details or change answers later',
			'If a question is unclear, ask for clarification',
			'Provide corrections when you realize earlier answers were wrong',
			'When offered options, pick exactly one of the listed options verbatim (even if you might change it later)',
		],
	},
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Say you need a demand letter but give minimal detail.',
			},
			{
				id: 'step-2',
				instruction: 'As questions come, sometimes give partial answers; later, correct or change them. For choice questions, answer with exactly one of the provided options.',
			},
		],
		start: 'step-1',
		terminals: ['step-2'],
	},
	maxTurns: 40,
	storage: {
		strategy: 'local',
		conversationId: 'demand-letter-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

