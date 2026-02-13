/**
 * Cashflow Copilot Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete cashflow setup and management flow
 */
export const cashflowGoldenTrajectory: Trajectory = {
  goal: 'Set up a complete cashflow profile, check affordability, view forecasts, and manage activities',
  persona: {
    name: 'Financial Planner',
    description:
      'You are setting up your cashflow management system. You have clear financial information and provide it step by step as the agent asks. You are organized and want to understand your financial situation.',
    guardrails: [
      'Provide information naturally and conversationally',
      'Answer clarifying questions when asked',
      'Express preferences when relevant',
      'Ask follow-up questions about affordability and forecasts',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Express interest in setting up cashflow management and provide current balance: "I have 100,000 in my account"',
      },
      {
        id: 'step-2',
        instruction: 'Set safety buffer: "I want to keep at least 20,000 as emergency buffer"',
      },
      {
        id: 'step-3',
        instruction: 'Provide income: "I receive 120,000 salary on the 5th day of each month"',
      },
      {
        id: 'step-4',
        instruction: 'Provide a bill: "I pay 45,000 rent on the 4th day of each month"',
      },
      {
        id: 'step-5',
        instruction: 'Provide another bill: "I pay 5,000 for internet on the 10th day of each month"',
      },
      {
        id: 'step-6',
        instruction: 'Set up a budget: "I want to save 10,000 each month"',
      },
      {
        id: 'step-7',
        instruction: 'Add a subscription: "I have Netflix subscription for 500 per month"',
      },
      {
        id: 'step-8',
        instruction: 'Ask for cashflow forecast: "Can you show me my cashflow forecast for this month?"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-7',
          },
        ],
      },
      {
        id: 'step-9',
        instruction: 'Ask about affordability: "Can I afford to buy a laptop for 30,000?"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-8',
          },
        ],
      },
      {
        id: 'step-10',
        instruction: 'Ask about frequency: "How many times can I dine out if each dinner costs 5,000?"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-9',
          },
        ],
      },
      {
        id: 'step-11',
        instruction: 'Set up monthly activities: "I want to do 3 yoga classes (1,500 each), 4 movies (4,000 each), and 4 dinners (5,000 each)"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-10',
          },
        ],
      },
      {
        id: 'step-12',
        instruction: 'Ask for activity suggestions: "What activities can I accomplish today?"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-11',
          },
        ],
      },
      {
        id: 'step-13',
        instruction: 'Mark activity as completed: "I completed the yoga class"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-12',
          },
        ],
      },
      {
        id: 'step-14',
        instruction: 'Update an existing bill: "Actually, my rent increased to 50,000"',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-13',
          },
        ],
      },
      {
        id: 'step-15',
        instruction: 'Ask for updated forecast after the change',
        preconditions: [
          {
            type: 'stepSatisfied',
            stepId: 'step-14',
          },
        ],
      },
    ],
    start: 'step-1',
    terminals: ['step-15'],
  },
  maxTurns: 30,
  loopDetection: {
    maxConsecutiveSameStep: 5,
  },
  userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Ambiguous requests, incomplete information, changing plans
 */
export const cashflowCurveTrajectory: Trajectory = {
  goal: 'Test agent handling of ambiguous financial information and changing plans',
  persona: {
    name: 'Uncertain Planner',
    description:
      'You want to set up cashflow management but are unsure about details. You might provide incomplete information, change amounts or dates mid-conversation, or ask questions before providing necessary context.',
    guardrails: [
      'Provide incomplete information sometimes',
      'Change amounts or dates mid-conversation',
      'Be ambiguous about schedules (e.g., "sometime in the month")',
      'Ask about affordability before setting up the profile',
      'Provide conflicting information',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Ask about affordability without providing any financial information: "Can I afford a vacation?"',
      },
      {
        id: 'step-2',
        instruction: 'Provide balance but no other details: "I have some money in my account"',
      },
      {
        id: 'step-3',
        instruction: 'Provide income with ambiguous schedule: "I get paid sometime each month"',
      },
      {
        id: 'step-4',
        instruction: 'Change the income amount: "Actually, my salary is different, let me check... it\'s actually 100,000"',
      },
      {
        id: 'step-5',
        instruction: 'Provide a bill without amount: "I pay rent"',
      },
      {
        id: 'step-6',
        instruction: 'Provide amount but no date: "The rent is 40,000"',
      },
      {
        id: 'step-7',
        instruction: 'Change the rent amount: "Wait, I think it\'s 45,000, not 40,000"',
      },
      {
        id: 'step-8',
        instruction: 'Request forecast before providing all necessary information',
      },
      {
        id: 'step-9',
        instruction: 'Set up activities without providing costs: "I want to do yoga classes"',
      },
      {
        id: 'step-10',
        instruction: 'Provide conflicting information: "I want to save 20,000 each month but I only have 10,000 left after expenses"',
      },
      {
        id: 'step-11',
        instruction: 'Ask to update a bill that was never properly set up',
      },
      {
        id: 'step-12',
        instruction: 'Request activity suggestions without setting up activities first',
      },
    ],
    start: 'step-1',
    terminals: ['step-12'],
  },
  maxTurns: 25,
  userModel: google('models/gemini-2.5-flash-lite'),
};

