/**
 * Trajectory definitions for debug scenarios
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally/trajectories';

/**
 * Travel Planner Trajectory Definition
 * 
 * Simulates a user planning a trip with multiple steps:
 * 1. Initial request
 * 2. Providing origin
 * 3. Providing departure date
 * 4. Confirming round trip
 * 5. Providing return date
 * 6. Requesting hotel
 * 7. Providing check-in dates
 * 8. Providing guest count
 * 9. Refining preferences
 * 10. Asking about weather
 */
export const travelPlannerTrajectory: Trajectory = {
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
		conversationId: 'travel-planner-trajectory',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Demand Letter Trajectory Definition
 * 
 * Simulates a user creating a demand letter through an onboarding flow
 */
export const demandLetterTrajectory: Trajectory = {
	goal: 'Create a demand letter for an unpaid invoice',
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
		conversationId: 'demand-letter-trajectory',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Weather Trajectory Definition
 * 
 * Simulates a user asking for weather information with multiple scenarios:
 * 1. Simple current weather query
 * 2. Weather with unit conversion
 * 3. Weather forecast for specific date
 */
export const weatherTrajectory: Trajectory = {
	goal: 'Get weather information for multiple locations and scenarios',
	persona: {
		name: 'Weather Inquirer',
		description:
			'You need weather information for different locations. You may ask for current weather or forecasts. You might request temperature conversions.',
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
		conversationId: 'weather-trajectory',
	},
	userModel: google('models/gemini-2.5-flash-lite'),
};

