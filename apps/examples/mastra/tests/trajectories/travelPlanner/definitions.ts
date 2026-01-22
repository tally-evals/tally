/**
 * Travel Planner Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete trip planning flow
 */
export const travelPlannerGoldenTrajectory: Trajectory = {
  goal: 'Plan a complete trip to San Francisco including flights, accommodations, vehicle rentals, dining reservations, and weather information',
  persona: {
    name: 'Travel Enthusiast',
    description:
      'You are planning a trip and need help finding flights, accommodations, vehicle rentals and dining reservations. You provide information step by step as the agent asks for it. You are friendly and cooperative.',
    guardrails: [
      'Provide information naturally and conversationally',
      'Answer clarifying questions when asked',
      'Express preferences when relevant',
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
        instruction: 'Provide origin city (New York), JFK',
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
        instruction:
          'Review flight options and express preference from given options',
      },
      {
        id: 'step-7',
        instruction: 'Request help finding a hotel in San Francisco',
      },
      {
        id: 'step-8',
        instruction:
          'Provide check-in date and duration (June 15th for 5 nights)',
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
        instruction: 'Review hotel options and express preference',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-10',
          },
        ],
      },
      {
        id: 'step-12',
        instruction: 'Request help finding a vehicle to rent in San Francisco',
      },
      {
        id: 'step-13',
        instruction: 'Express preference for sedans',
      },
      {
        id: 'step-14',
        instruction: 'Review vehicle rental options and express preference',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-13',
          },
        ],
      },
      {
        id: 'step-15',
        instruction:
          'Request help finding a restaurant to dine at in San Francisco',
      },
      {
        id: 'step-16',
        instruction: 'Express preference for Italian cuisine',
      },
      {
        id: 'step-17',
        instruction: 'Review restaurant options and express preference',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-16',
          },
        ],
      },
      {
        id: 'step-18',
        instruction: 'Ask about weather during the trip',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-17',
          },
        ],
      },
    ],
    start: 'step-1',
    terminals: ['step-18'],
  },
  maxTurns: 25,
  loopDetection: {
    maxConsecutiveSameStep: 5,
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
      'Backtrack on decisions',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction:
          "Express interest in planning a trip but don't specify destination",
      },
      {
        id: 'step-2',
        instruction: 'Provide destination but no dates',
      },
      {
        id: 'step-3',
        instruction: 'Change destination after providing it',
      },
      {
        id: 'step-4',
        instruction:
          'Provide conflicting information (e.g., round trip but no return date)',
      },
      {
        id: 'step-5',
        instruction: 'Request accommodations before flights are confirmed',
      },
      {
        id: 'step-6',
        instruction: 'Disregard agent questions and request vehicles',
      },
      {
        id: 'step-7',
        instruction: 'Request restaurants before vehicles are confirmed',
      },
      {
        id: 'step-8',
        instruction: 'Request changes to accommodations',
      },
      {
        id: 'step-9',
        instruction: 'Cancel the trip',
      },
    ],
    start: 'step-1',
    terminals: ['step-9'],
  },
  maxTurns: 15,
  userModel: google('models/gemini-2.5-flash-lite'),
};
