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
			'Provide accurate information',
			'Answer all questions asked by the agent',
			'Request clarification if needed',
		],
	},
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Express need to create a demand letter for an unpaid invoice',
			},
			{
				id: 'step-2',
				instruction: 'Provide invoice details (amount: $2,500, due date: March 15th)',
			},
			{
				id: 'step-3',
				instruction: 'Provide recipient details (ABC Company, address)',
			},
		],
		start: 'step-1',
		terminals: ['step-3'],
	},
	maxTurns: 10,
	conversationId: 'demand-letter-golden',
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
			'Provide incomplete information sometimes',
			'Change details mid-conversation',
			'Forget to provide required fields',
		],
	},
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Express need for demand letter but provide no details',
			},
			{
				id: 'step-2',
				instruction: 'Provide partial information (amount but no date)',
			},
			{
				id: 'step-3',
				instruction: 'Change the amount after providing it',
			},
			{
				id: 'step-4',
				instruction: 'Provide invalid information (negative amount)',
			},
		],
		start: 'step-1',
		terminals: ['step-4'],
	},
	maxTurns: 10,
	conversationId: 'demand-letter-curve',
	userModel: google('models/gemini-2.5-flash-lite'),
};

