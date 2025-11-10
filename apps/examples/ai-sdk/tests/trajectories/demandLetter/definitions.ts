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
	steps: [
		{
			instruction: 'Express need to create a demand letter for an unpaid invoice',
			expectedOutcome: 'Agent explains the process and asks for required information',
		},
		{
			instruction: 'Provide invoice details (amount: $2,500, due date: March 15th)',
			expectedOutcome: 'Agent asks for recipient information',
		},
		{
			instruction: 'Provide recipient details (ABC Company, address)',
			expectedOutcome: 'Agent validates information and generates preview',
		},
	],
	mode: 'loose',
	maxTurns: 10,
	memory: {
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
			'Provide incomplete information sometimes',
			'Change details mid-conversation',
			'Forget to provide required fields',
		],
	},
	steps: [
		{
			instruction: 'Express need for demand letter but provide no details',
			expectedOutcome: 'Agent asks for required information',
		},
		{
			instruction: 'Provide partial information (amount but no date)',
			expectedOutcome: 'Agent asks for missing information',
		},
		{
			instruction: 'Change the amount after providing it',
			expectedOutcome: 'Agent handles the change gracefully',
		},
		{
			instruction: 'Provide invalid information (negative amount)',
			expectedOutcome: 'Agent validates and asks for correction',
		},
	],
	mode: 'loose',
	maxTurns: 10,
	memory: {
		strategy: 'local',
		conversationId: 'demand-letter-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

