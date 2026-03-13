/**
 * Cashflow Copilot Agent Trajectory Definitions
 * Based on the new domain model: User → CashPosition → RecurringCashflow / FutureCashflow → Projection
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Full cashflow projection setup and simulation flow
 */
export const cashflowGoldenTrajectory: Trajectory = {
  goal: 'Set up a complete cashflow profile, run projections, simulate what-if scenarios, and understand financial risk',
  persona: {
    name: 'Financial Planner',
    description:
      'You are setting up your personal cashflow tracking system. You have clear financial information and provide it naturally. You are organized and want to understand your projected balance and any risks over the next few months.',
    guardrails: [
      'Provide financial information naturally and conversationally',
      'Answer clarifying questions when asked',
      'Ask about projections and scenarios after setting up data',
      'Respond to the agent with reasonable follow-up questions about affordability',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction:
          'Introduce yourself and start setup: "Hi, I want to set up cashflow tracking. My name is Alex and I use USD."',
      },
      {
        id: 'step-2',
        instruction: 'Provide current balance: "I currently have 150,000 in my account."',
      },
      {
        id: 'step-3',
        instruction:
          'Add recurring income: "I receive a salary of 120,000 every month starting on the 5th."',
      },
      {
        id: 'step-4',
        instruction: 'Add recurring expense: "I pay 45,000 rent every month on the 1st."',
      },
      {
        id: 'step-5',
        instruction:
          'Add another recurring expense: "I also pay 5,000 for internet monthly on the 10th and 2,000 for a gym subscription monthly on the 12th."',
      },
      {
        id: 'step-6',
        instruction:
          'Add a one-time future expense: "I\'m planning a vacation that will cost 30,000 next month around the 20th."',
      },
      {
        id: 'step-7',
        instruction:
          'Add a one-time future income: "I also have a freelance payment of 25,000 coming in on the 15th of next month."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-6' }],
      },
      {
        id: 'step-8',
        instruction: 'Confirm the setup summary: "Yes, that all looks correct."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-7' }],
      },
      {
        id: 'step-9',
        instruction: 'Choose the projection flow: "More than one month."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-8' }],
      },
      {
        id: 'step-10',
        instruction:
          'Request a concrete projection: "Project the next 3 months with a safety buffer of 20,000."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-9' }],
      },
      {
        id: 'step-11',
        instruction:
          'Ask a what-if scenario: "What if I also had an emergency expense of 50,000 next month? Would I go into deficit?"',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-10' }],
      },
      {
        id: 'step-12',
        instruction:
          'Ask for a final updated projection after the scenario: "Show me the updated 3-month projection and the lowest balance again."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-11' }],
      },
    ],
    start: 'step-1',
    terminals: ['step-12'],
  },
  maxTurns: 30,
  loopDetection: {
    maxConsecutiveSameStep: 5,
  },
  userModel: google('models/gemini-3.1-flash-lite-preview'),
};

/**
 * Curve Ball: Ambiguous requests, incomplete information, changing plans
 */
export const cashflowCurveTrajectory: Trajectory = {
  goal: 'Test agent handling of ambiguous financial information, incomplete setup, and changing plans',
  persona: {
    name: 'Uncertain Planner',
    description:
      'You want to track your cashflow but are unsure about details. You provide incomplete information, change amounts mid-conversation, and ask about projections before fully setting up your data.',
    guardrails: [
      'Provide incomplete information sometimes (e.g. income amount without a start date)',
      'Change amounts or dates mid-conversation',
      'Ask about projections before all data is entered',
      'Mention vague one-time events without dates (e.g. "sometime next month")',
      'Provide conflicting or contradictory amounts',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction:
          'Ask about your runway without providing any information: "How many days can I survive financially?"',
      },
      {
        id: 'step-2',
        instruction: 'Provide a name but no balance: "My name is Jordan, I use PKR"',
      },
      {
        id: 'step-3',
        instruction:
          'Provide balance without currency confirmation: "I have some money, maybe around 200,000"',
      },
      {
        id: 'step-4',
        instruction: 'Add income with no frequency: "I get paid 100,000"',
      },
      {
        id: 'step-5',
        instruction: 'Clarify frequency ambiguously: "it\'s monthly I think, or maybe bi-weekly"',
      },
      {
        id: 'step-6',
        instruction: 'Change the income amount: "Actually I think my salary is 80,000 after taxes"',
      },
      {
        id: 'step-7',
        instruction:
          'Add a future expense with a vague date: "I have a medical bill coming sometime next month"',
      },
      {
        id: 'step-8',
        instruction:
          'Request a projection even though setup is incomplete: "Can you just project it now?"',
      },
      {
        id: 'step-9',
        instruction:
          'Add conflicting data: "Wait I forgot I also have a second income of 50,000 every week but only until end of next month"',
      },
      {
        id: 'step-10',
        instruction:
          'Provide the missing date and confirm the summary: "Use the 12th of next month for the medical bill, and yes, the rest looks right."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-9' }],
      },
      {
        id: 'step-11',
        instruction: 'Choose the projection flow: "More than one month."',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-10' }],
      },
      {
        id: 'step-12',
        instruction:
          'Ask for a 2-month projection with a scenario: "Project the next 2 months. What if I spend 100,000 on a car next week, and what is the lowest balance in that period?"',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-11' }],
      },
    ],
    start: 'step-1',
    terminals: ['step-12'],
  },
  maxTurns: 25,
  userModel: google('models/gemini-3.1-flash-lite-preview'),
};
