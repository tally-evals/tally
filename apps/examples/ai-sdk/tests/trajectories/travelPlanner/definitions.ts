/**
 * Travel Planner Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete trip planning flow
 */
export const travelPlannerGoldenTrajectory: Trajectory = {
	goal: 'Plan a complete trip to San Francisco including flights, accommodations, and weather information',
	persona: {
		name: 'Travel Enthusiast',
		description:
			'You are planning a trip and need help finding flights and accommodations. You provide information step by step as the agent asks for it. You are friendly and cooperative.',
		guardrails: [
			'Provide information naturally and conversationally',
			'Answer clarifying questions when asked',
			'Express preferences when relevant',
		],
	},
	steps: [
		{
			instruction: 'Express interest in planning a trip to San Francisco',
			expectedOutcome: 'Agent acknowledges and asks for origin',
		},
		{
			instruction: 'Provide origin city (New York)',
			expectedOutcome: 'Agent acknowledges origin and asks for departure date',
		},
		{
			instruction: 'Provide departure date (June 15th, 2025)',
			expectedOutcome: 'Agent asks if round trip is needed',
		},
		{
			instruction: 'Confirm round trip is needed',
			expectedOutcome: 'Agent asks for return date',
		},
		{
			instruction: 'Provide return date (June 20th, 2025)',
			expectedOutcome: 'Agent searches for flights',
		},
		{
			instruction: 'Request help finding a hotel in San Francisco',
			expectedOutcome: 'Agent asks for check-in/check-out dates',
		},
		{
			instruction: 'Provide check-in date and duration (June 15th for 5 nights)',
			expectedOutcome: 'Agent asks for number of guests',
		},
		{
			instruction: 'Provide guest count (just for me)',
			expectedOutcome: 'Agent searches for accommodations',
		},
		{
			instruction: 'Express preference for hotels over apartments',
			expectedOutcome: 'Agent refines search or presents results',
		},
		{
			instruction: 'Ask about weather during the trip',
			expectedOutcome: 'Agent provides weather forecast',
		},
	],
	mode: 'loose',
	maxTurns: 15,
	memory: {
		strategy: 'local',
		conversationId: 'travel-planner-golden',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Ambiguous requests, changing plans, incomplete information
 */
export const travelPlannerCurveTrajectory: Trajectory = {
	goal: 'Test agent handling of ambiguous requests and changing travel plans',
	persona: {
		name: 'Indecisive Traveler',
		description:
			'You want to plan a trip but are unsure about details. You might change destinations, dates, or preferences mid-conversation. You sometimes provide incomplete information.',
		guardrails: [
			'Provide incomplete information sometimes',
			'Change destinations or dates mid-conversation',
			'Be ambiguous about preferences',
		],
	},
	steps: [
		{
			instruction: 'Express interest in planning a trip but don\'t specify destination',
			expectedOutcome: 'Agent asks for destination',
		},
		{
			instruction: 'Provide destination but no dates',
			expectedOutcome: 'Agent asks for dates',
		},
		{
			instruction: 'Change destination after providing it',
			expectedOutcome: 'Agent handles the change gracefully',
		},
		{
			instruction: 'Provide conflicting information (e.g., round trip but no return date)',
			expectedOutcome: 'Agent clarifies or asks for missing information',
		},
		{
			instruction: 'Request accommodations before flights are confirmed',
			expectedOutcome: 'Agent handles appropriately (may ask for flight dates or proceed)',
		},
	],
	mode: 'loose',
	maxTurns: 15,
	memory: {
		strategy: 'local',
		conversationId: 'travel-planner-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

