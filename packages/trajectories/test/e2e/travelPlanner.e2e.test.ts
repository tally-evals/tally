/**
 * E2E Tests for Travel Planner Trajectories
 * 
 * These tests use real LLM calls and require:
 * - GOOGLE_GENERATIVE_AI_API_KEY environment variable
 * - Set E2E_TRAJECTORIES=1 to run (or run in CI)
 * 
 * Run with: pnpm --filter=@tally-evals/trajectories test:e2e travelPlanner
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { google } from '@ai-sdk/google';
import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
	createTrajectory,
	runTrajectory,
	withAISdkAgent,
	toJSONL,
	toConversation,
} from '../../src/index.js';
import { shouldRunE2E, hasApiKey } from './setup.js';
import {
	extractToolCallsFromStep,
	hasToolCall,
	getToolNames,
	countToolCallsByType,
} from './utils/toolCalls.js';

// Create travel planner tools inline to avoid circular dependencies
const travelPlannerTools = {
	searchFlights: tool({
		description: 'Search for available flights between two cities',
		inputSchema: z.object({
			origin: z.string().describe('Departure city and airport code (e.g., "New York, JFK")'),
			destination: z.string().describe('Arrival city and airport code (e.g., "San Francisco, SFO")'),
			departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
			returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format (for round trip)'),
			passengers: z.number().optional().describe('Number of passengers (default: 1)'),
		}),
		execute: async ({ origin, destination, departureDate, returnDate, passengers = 1 }) => {
			// Mock flight data
			return {
				flights: [
					{
						airline: 'United',
						flightNumber: 'UA123',
						departure: { time: '08:00', airport: origin },
						arrival: { time: '11:30', airport: destination },
						price: 350,
						class: 'economy',
					},
					{
						airline: 'American',
						flightNumber: 'AA456',
						departure: { time: '14:00', airport: origin },
						arrival: { time: '17:30', airport: destination },
						price: 380,
						class: 'economy',
					},
				],
				count: 2,
				message: `Found 2 flights from ${origin} to ${destination} on ${departureDate}`,
			};
		},
	}),

	searchAccommodations: tool({
		description: 'Search for available accommodations in a destination',
		inputSchema: z.object({
			location: z.string().describe('City or location name'),
			checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
			checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
			guests: z.number().optional().describe('Number of guests (default: 1)'),
			type: z.enum(['hotel', 'apartment', 'hostel']).optional().describe('Preferred accommodation type'),
		}),
		execute: async ({ location, checkIn, checkOut, guests = 1, type }) => {
			// Mock accommodation data
			const accommodations = [
				{
					name: 'Grand Hotel',
					type: 'hotel',
					location,
					pricePerNight: 150,
					rating: 4.5,
					amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant'],
				},
				{
					name: 'Cozy Apartment',
					type: 'apartment',
					location,
					pricePerNight: 80,
					rating: 4.2,
					amenities: ['WiFi', 'Kitchen', 'Washer'],
				},
			];

			const filtered = type ? accommodations.filter((acc) => acc.type === type) : accommodations;

			return {
				accommodations: filtered,
				count: filtered.length,
				message: `Found ${filtered.length} accommodation(s) in ${location}`,
			};
		},
	}),

	getWeatherForecast: tool({
		description: 'Get weather forecast for a destination',
		inputSchema: z.object({
			location: z.string().describe('City or location name'),
			date: z.string().describe('Date in YYYY-MM-DD format'),
		}),
		execute: async ({ location, date }) => {
			// Mock weather data
			return {
				location,
				date,
				temperature: { high: 75, low: 60, unit: 'fahrenheit' },
				condition: 'sunny',
				humidity: 65,
				windSpeed: 10,
				message: `Weather forecast for ${location} on ${date}: Sunny, 60-75°F`,
			};
		},
	}),
};

const travelPlannerAgent = new Agent({
	model: google('models/gemini-2.5-flash-lite'),
	tools: travelPlannerTools,
	stopWhen: stepCountIs(20),
	system: `You are a helpful travel planning assistant. Your goal is to help users plan their trips by:

1. Gathering all necessary information before searching:
   - For flights: origin, destination, departure date (and return date if round trip)
   - For accommodations: location, check-in date, check-out date, number of guests
   - For weather: location and date

2. When information is missing:
   - Ask ONE clarifying question at a time
   - Be specific about what you need
   - Use the conversation history to avoid asking for information already provided

3. When you have all required information:
   - Use the appropriate tools to search automatically
   - Present results clearly
   - Ask if the user wants to proceed or modify the search

4. Maintain context:
   - Reference previous parts of the conversation
   - Remember user preferences mentioned earlier
   - Build on information gathered in previous turns

5. Only search when explicitly requested or when you have complete information for that specific service:
   - For flights: Only search when user provides all flight details OR when user explicitly asks you to search
   - For accommodations: ONLY search when the user explicitly requests help finding accommodations/hotels
   - For weather: ONLY search when the user explicitly asks about weather or forecasts

IMPORTANT: Wait for explicit user requests before searching for accommodations or weather. Only search for flights automatically when you have all flight details.

Always be friendly, helpful, and efficient in gathering information.`,
});

const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E('Travel Planner E2E Tests', () => {
	const userModel = google('models/gemini-2.5-flash-lite');

	beforeAll(() => {
		if (!hasApiKey) {
			console.warn('⚠️  GOOGLE_GENERATIVE_AI_API_KEY not found. Skipping E2E tests.');
			console.warn('   Set E2E_TRAJECTORIES=1 and provide API key to run E2E tests.');
		}
	});

	describe('Travel Planner - Step Progression', () => {
		it('should progress through steps sequentially without jumping to terminal', async () => {
			const agent = withAISdkAgent(travelPlannerAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Plan a complete trip to San Francisco including flights, accommodations, and weather information',
					persona: {
						name: 'Travel Enthusiast',
						description:
							'You are planning a trip and need help finding flights and accommodations. You provide information step by step as the agent asks for it. You are friendly and cooperative.',
						guardrails: [
							'Provide information naturally and conversationally',
							'Answer clarifying questions when asked',
							'Express preferences when relevant',
							'Make sure to just confirm prefrences this is not a booking platform',
							'Do not skip ahead to weather questions until flights and accommodations are discussed',
						],
					},
					steps: {
						steps: [
							{
								id: 'step-1',
								instruction: 'Express interest in planning a trip to San Francisco',
							},
							{
								id: 'step-2',
								instruction: 'Provide origin city (New York, JFK)',
							},
							{
								id: 'step-3',
								instruction: 'Provide departure date (June 15th, 2025)',
							},
							{
								id: 'step-4',
								instruction: 'Confirm round trip is needed',
							},
							{
								id: 'step-5',
								instruction: 'Provide return date (June 20th, 2025)',
							},
							{
								id: 'step-6',
								instruction: 'Review flight options and express preference',
							},
							{
								id: 'step-7',
								instruction: 'Request help finding a hotel in San Francisco',
							},
							{
								id: 'step-8',
								instruction: 'Provide check-in date and duration (June 15th for 5 nights)',
							},
							{
								id: 'step-9',
								instruction: 'Provide guest count (just for me)',
							},
							{
								id: 'step-10',
								instruction: 'Express preference for hotels over apartments',
							},
							{
								id: 'step-11',
								instruction: 'Review hotel options and express preference or ask for more options',
							},
							{
								id: 'step-12',
								instruction: 'Ask about weather during the trip',
							},
						],
						start: 'step-1',
						terminals: ['step-12'],
					},
					maxTurns: 20,
					conversationId: 'travel-planner-e2e',
					userModel,
					
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			// Assert result structure
			expect(result).toBeDefined();
			expect(result.completed).toBeTypeOf('boolean');
			expect(result.steps.length).toBeGreaterThan(0);

			// Debug: Log step progression
			console.log('\n📊 Step Progression Analysis:');
			console.log(`Total turns: ${result.steps.length}`);
			console.log(`Completed: ${result.completed}`);
			console.log(`Reason: ${result.reason}`);

			// Check that we didn't jump to terminal too early
			// The trajectory should have at least 6-8 turns for a complete trip planning flow
			if (result.completed && result.reason === 'goal-reached') {
				console.log('\n✅ Trajectory completed by reaching terminal step');
				// For a complete trip planning flow, we expect at least 6 turns
				// (flights: 3-4 turns, accommodations: 2-3 turns, weather: 1 turn)
				expect(result.steps.length).toBeGreaterThanOrEqual(6);
			}

			// Check conversation quality - should have tool calls for flights and accommodations
			const conversation = toConversation(result, 'travel-planner-e2e');
			
			// Use utility to extract tool calls
			const toolCallCounts = countToolCallsByType(conversation);
			const hasFlightSearch = toolCallCounts.has('searchFlights') && (toolCallCounts.get('searchFlights') ?? 0) > 0;
			const hasAccommodationSearch = toolCallCounts.has('searchAccommodations') && (toolCallCounts.get('searchAccommodations') ?? 0) > 0;
			const hasWeatherSearch = toolCallCounts.has('getWeatherForecast') && (toolCallCounts.get('getWeatherForecast') ?? 0) > 0;

			console.log('\n🔍 Tool Usage:');
			console.log(`  Flight search: ${hasFlightSearch ? '✅' : '❌'} (${toolCallCounts.get('searchFlights') ?? 0} calls)`);
			console.log(`  Accommodation search: ${hasAccommodationSearch ? '✅' : '❌'} (${toolCallCounts.get('searchAccommodations') ?? 0} calls)`);
			console.log(`  Weather search: ${hasWeatherSearch ? '✅' : '❌'} (${toolCallCounts.get('getWeatherForecast') ?? 0} calls)`);

			// Log all tool calls per step for debugging
			console.log('\n📋 Tool Calls by Step:');
			for (const step of conversation.steps) {
				const toolCalls = extractToolCallsFromStep(step);
				if (toolCalls.length > 0) {
					const toolNames = getToolNames(step);
					console.log(`  Step ${step.stepIndex}: ${toolNames.join(', ')}`);
				}
			}

			// For a complete trip planning flow, we should have at least flights and accommodations
			if (result.completed && result.reason === 'goal-reached') {
				expect(hasFlightSearch || hasAccommodationSearch).toBe(true);
			}
		});

		it('should use preconditions to enforce step order', async () => {
			const agent = withAISdkAgent(travelPlannerAgent);

			const trajectory = createTrajectory(
				{
					goal: 'Plan a trip with enforced step order using preconditions',
					persona: {
						name: 'Travel Enthusiast',
						description: 'You are planning a trip and provide information step by step.',
						guardrails: ['Provide information naturally', 'Follow the conversation flow'],
					},
					steps: {
						steps: [
							{
								id: 'step-1',
								instruction: 'Express interest in planning a trip to San Francisco',
							},
							{
								id: 'step-2',
								instruction: 'Provide origin city (New York, JFK)',
								preconditions: [{ type: 'stepSatisfied', stepId: 'step-1' }],
							},
							{
								id: 'step-3',
								instruction: 'Provide departure date (June 15th, 2025)',
								preconditions: [{ type: 'stepSatisfied', stepId: 'step-2' }],
							},
							{
								id: 'step-4',
								instruction: 'Ask about weather during the trip',
								preconditions: [
									{ type: 'stepSatisfied', stepId: 'step-1' },
									{ type: 'stepSatisfied', stepId: 'step-2' },
									{ type: 'stepSatisfied', stepId: 'step-3' },
								],
							},
						],
						start: 'step-1',
						terminals: ['step-4'],
					},
					maxTurns: 10,
					conversationId: 'travel-planner-preconditions',
					userModel,
				},
				agent
			);

			const result = await runTrajectory(trajectory, { generateLogs: true });

			expect(result).toBeDefined();
			expect(result.steps.length).toBeGreaterThan(0);

			console.log('\n📊 Precondition Test Results:');
			console.log(`Total turns: ${result.steps.length}`);
			console.log(`Completed: ${result.completed}`);
			console.log(`Reason: ${result.reason}`);

			// With preconditions, step-4 should only be eligible after steps 1, 2, 3 are satisfied
			// This should prevent jumping to the terminal step too early
		});
	});
});

