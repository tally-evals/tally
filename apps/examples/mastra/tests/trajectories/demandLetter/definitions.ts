/**
 * Demand Letter Agent Trajectory Definitions
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

/**
 * Golden Path: Complete demand letter creation flow
 */
export const demandLetterGoldenTrajectory: Trajectory = {
  goal: 'Create a formal demand letter for unpaid consulting services',
  persona: {
    name: 'Freelance Consultant',
    description:
      'You are a freelance web developer who is owed $5,000 for a completed website project. You need to send a formal demand letter to the client, "TechStart Inc.". You have all the necessary details and will provide them as asked.',
    guardrails: [
      'Provide accurate information clearly',
      'Be professional but firm about the debt',
      'Follow the agent\'s lead on what information to provide next',
    ],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'State that you need to write a demand letter for unpaid invoices.',
      },
      {
        id: 'step-2',
        instruction: 'Ask what information is needed to proceed.',
      },
      {
        id: 'step-3',
        instruction: 'Provide your details: Name "Alex Dev", Address "123 Coder Lane, Tech City, CA 94000".',
      },
      {
        id: 'step-4',
        instruction: 'Provide recipient details: Name "TechStart Inc.", Address "456 Venture Blvd, Startup Valley, CA 94001".',
      },
      {
        id: 'step-5',
        instruction: 'Provide the amount owed: $5,000 USD.',
      },
      {
        id: 'step-6',
        instruction: 'Provide the due date: "2025-02-15".', // usage of future date relative to context? Context says Jan 12 2026. Let's use 2026.
      },
      {
        id: 'step-7',
        instruction: 'Provide description: "Unpaid invoice #1023 for website redesign and implementation services completed on December 20, 2025."',
      },
      {
        id: 'step-8',
        instruction: 'Provide legal basis: "Breach of contract dated November 1, 2025."',
      },
      {
        id: 'step-9',
        instruction: 'Select demand type: "payment".',
      },
      {
        id: 'step-10',
        instruction: 'Review the preview and confirm it looks correct.',
      },
    ],
    start: 'step-1',
    terminals: ['step-10'],
  },
  maxTurns: 20,
  storage: {
    strategy: 'local',
    conversationId: 'demand-letter-golden',
  },
  loopDetection: {
    maxConsecutiveSameStep: 5,
  },
  userModel: google('models/gemini-2.5-flash-lite'),
};

/**
 * Curve Ball: Changing information and ambiguous inputs
 */
export const demandLetterCurveTrajectory: Trajectory = {
  goal: 'Create a demand letter where the user corrects details mid-conversation',
  persona: {
    name: 'Correcting Client',
    description: 'You are a client who realizes they provided incorrect details and corrects them when asked. You are cooperative but made some mistakes initially.',
    guardrails: [],
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'State that you need a payment demand letter for $1000 from "John Doe".',
      },
      {
        id: 'step-2',
        instruction: 'When asked for details, correct the name: "Actually, wait, it is his company, Doe Logistics LLC."',
      },
      {
        id: 'step-3',
        instruction: 'Provide the address: "123 Industrial Park, NY".',
      },
      {
        id: 'step-4',
        instruction: 'Provide your details: Name "Sam Service", Address "555 Helper St, NY".',
      },
      {
        id: 'step-5',
        instruction: 'When asked for amount validation or next steps, correct the amount: "Checking my records, the invoice is actually for $1,200, not $1000."',
      },
      {
        id: 'step-6',
        instruction: 'Provide due date: "2025-12-01".',
      },
      {
        id: 'step-7',
        instruction: 'Provide description: "Renovation work".',
      },
      {
        id: 'step-8',
        instruction: 'Provide legal basis: "Contract".',
      },
      {
        id: 'step-9',
        instruction: 'Confirm the preview looks good.',
      },
    ],
    start: 'step-1',
    terminals: ['step-9'],
  },
  maxTurns: 20,
  storage: {
    strategy: 'local',
    conversationId: 'demand-letter-curve',
  },
  userModel: google('models/gemini-2.5-flash-lite'),
};
