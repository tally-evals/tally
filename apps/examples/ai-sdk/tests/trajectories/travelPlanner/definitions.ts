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
			
		},
		{
			instruction: 'Provide origin city (New York), JFK',
			
		},
		{
			instruction: 'Provide departure date (June 15th, 2025)',
			
		},
		{
			instruction: 'Confirm round trip is needed',
			
		},
		{
			instruction: 'Provide return date (June 20th, 2025)',
		},
		{
			instruction: 'Review flight options and express preference or ask for more options',
		},
		{
			instruction: 'Request help finding a hotel in San Francisco',
		},
		{
			instruction: 'Provide check-in date and duration (June 15th for 5 nights)',
		},
		{
			instruction: 'Provide guest count (just for me)',
		},
		{
			instruction: 'Express preference for hotels over apartments',
		},
		{
			instruction: 'Review hotel options and express preference or ask for more options',
		},
		{
			instruction: 'Ask about weather during the trip',
		},
	],
	mode: 'loose',
	maxTurns: 15,
	storage: {
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
		},
		{
			instruction: 'Provide destination but no dates',
		},
		{
			instruction: 'Change destination after providing it',
		},
		{
			instruction: 'Provide conflicting information (e.g., round trip but no return date)',
		},
		{
			instruction: 'Request accommodations before flights are confirmed',
		},
	],
	mode: 'loose',
	maxTurns: 15,
	storage: {
		strategy: 'local',
		conversationId: 'travel-planner-curve',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

