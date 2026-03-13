/**
 * Cashflow Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

export const cashflowGoldenTrajectory: Trajectory = {
  goal: 'Set up cashflow data and run a clean projection successfully',
  persona: {
    name: 'Organized Planner',
    description:
      'You want to set up your cashflow profile carefully and then ask for projections and a simple what-if.',
    guardrails: [
      'Provide complete financial details when asked',
      'Confirm summaries when accurate',
      'Ask one follow-up scenario after baseline projection',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Say you want to set up cashflow tracking with user id "cashflow-user".',
      },
      {
        id: 'step-2',
        instruction: 'Provide current balance: 150000.',
      },
      {
        id: 'step-3',
        instruction: 'Provide recurring income: salary 120000 monthly starting 2026-03-05.',
      },
      {
        id: 'step-4',
        instruction:
          'Provide recurring expenses: rent 45000 monthly from 2026-03-01 and internet 5000 monthly from 2026-03-10.',
      },
      {
        id: 'step-5',
        instruction: 'Provide one-time future expense: vacation 30000 on 2026-04-20.',
      },
      {
        id: 'step-6',
        instruction: 'Request projection from 2026-03-01 to 2026-05-31 with safety buffer 20000.',
      },
      {
        id: 'step-7',
        instruction:
          'Ask what-if: add an emergency expense of 50000 on 2026-04-15 and compare impact.',
      },
    ],
    start: 'step-1',
    terminals: ['step-7'],
  },
  maxTurns: 20,
  loopDetection: {
    maxConsecutiveSameStep: 5,
  },
  conversationId: 'cashflow-golden',
  userModel: google('models/gemini-3.1-flash-lite-preview'),
};

export const cashflowCurveTrajectory: Trajectory = {
  goal: 'Test cashflow handling with incomplete data and changing details',
  persona: {
    name: 'Uncertain Planner',
    description:
      'You provide partial and sometimes conflicting information before settling on final values.',
    guardrails: [
      'Start vague, then clarify',
      'Change one financial detail mid-conversation',
      'Request projection before setup is fully complete',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Ask how long you can survive financially without giving numbers.',
      },
      {
        id: 'step-2',
        instruction: 'Provide user id cashflow-user and say balance is around 200000.',
      },
      {
        id: 'step-3',
        instruction: 'Say you get paid 100000 but do not mention frequency yet.',
      },
      {
        id: 'step-4',
        instruction: 'Clarify it is monthly, then change it to 90000 after tax.',
      },
      {
        id: 'step-5',
        instruction: 'Add a vague future expense then clarify it is 40000 on 2026-04-12.',
      },
      {
        id: 'step-6',
        instruction: 'Request projection from 2026-03-01 to 2026-04-30 with no safety buffer.',
      },
    ],
    start: 'step-1',
    terminals: ['step-6'],
  },
  maxTurns: 20,
  loopDetection: {
    maxConsecutiveSameStep: 5,
  },
  conversationId: 'cashflow-curve',
  userModel: google('models/gemini-3.1-flash-lite-preview'),
};
