/**
 * Weather Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Simple weather queries that should work perfectly
 */
export const weatherGoldenTrajectory: Trajectory = {
	goal: 'Get weather information for multiple locations successfully',
	persona: {
		name: 'Weather Inquirer',
		description:
			'You need weather information for different locations. You ask clearly and provide location names accurately.',
		guardrails: [
			'Ask naturally and conversationally',
			'Provide location names clearly',
			'Request conversions when needed',
		],
	},
	steps: [
		{
			instruction: 'Ask for current weather in San Francisco',
			expectedOutcome: 'Agent provides current weather information',
		},
		{
			instruction: 'Ask for weather in New York and request conversion to celsius',
			expectedOutcome: 'Agent provides weather in celsius',
		},
		{
			instruction: 'Ask for weather forecast in Paris, France for a specific date',
			expectedOutcome: 'Agent asks for date or provides forecast',
		},
	],
	mode: 'loose',
	maxTurns: 10,
	memory: {
		strategy: 'local',
		conversationId: 'weather-golden',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Edge cases and challenging scenarios
 */
export const weatherCurveTrajectory: Trajectory = {
	goal: 'Test agent handling of edge cases and ambiguous requests',
	persona: {
		name: 'Confused Weather Inquirer',
		description:
			'You need weather information but sometimes ask ambiguously or provide incomplete information. You might change your mind mid-conversation.',
		guardrails: [
			'Ask naturally but sometimes ambiguously',
			'Provide incomplete information sometimes',
			'Change requests mid-conversation',
		],
	},
	steps: [
		{
			instruction: 'Ask for weather without specifying a location',
			expectedOutcome: 'Agent asks for location',
		},
		{
			instruction: 'Provide an ambiguous location name (e.g., "Springfield")',
			expectedOutcome: 'Agent asks for clarification or handles ambiguity',
		},
		{
			instruction: 'Ask for weather forecast but forget to mention the date',
			expectedOutcome: 'Agent asks for date or handles gracefully',
		},
		{
			instruction: 'Request weather for a past date',
			expectedOutcome: 'Agent handles past date request appropriately',
		},
	],
	mode: 'loose',
	maxTurns: 10,
	memory: {
		strategy: 'local',
		conversationId: 'weather-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

