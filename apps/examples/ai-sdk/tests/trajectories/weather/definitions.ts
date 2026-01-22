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
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Ask for current weather in San Francisco',
			},
			{
				id: 'step-2',
				instruction: 'Ask for weather in New York and request conversion to celsius',
			},
			{
				id: 'step-3',
				instruction: 'Ask for weather forecast in Paris, France for a specific date',
			},
		],
		start: 'step-1',
		terminals: ['step-3'],
	},
	maxTurns: 10,
	storage: {
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
	steps: {
		steps: [
			{
				id: 'step-1',
				instruction: 'Ask for weather without specifying a location',
			},
			{
				id: 'step-2',
				instruction: 'Provide an ambiguous location name (e.g., "Springfield")',
			},
			{
				id: 'step-3',
				instruction: 'Ask for weather forecast but forget to mention the date',
			},
			{
				id: 'step-4',
				instruction: 'Request weather for a past date',
			},
		],
		start: 'step-1',
		terminals: ['step-4'],
	},
	maxTurns: 10,
	storage: {
		strategy: 'local',
		conversationId: 'weather-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

