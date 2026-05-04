/**
 * Flight Booking Agent — Trajectory Definitions
 *
 * Demonstrates Tally's HIL (Human-in-the-Loop) support using AI SDK v6.
 *
 * The `bookFlight` tool has `needsApproval: true` which causes the agent to
 * pause and emit a `tool-approval-request` before executing the booking.
 * Tally's trajectory orchestrator detects this and resolves it according to
 * the `hil` config on each trajectory.
 */

import { google } from '@ai-sdk/google';
import type { Trajectory } from '@tally-evals/trajectories';

const userModel = google('models/gemini-2.5-flash-lite');

// ---------------------------------------------------------------------------
// Shared persona
// ---------------------------------------------------------------------------

const BOOKING_PERSONA = {
  name: 'Alex',
  description:
    'You are a traveller who wants to fly from New York (JFK) to San Francisco (SFO) on June 15th, 2025. You are ready to book once you see a good option. Provide your details (name: Alex Johnson, email: alex@example.com, payment: credit_card) when asked.',
  guardrails: [
    'Provide details naturally as the agent asks for them',
    'Express your preference for the cheapest available option',
    'Confirm when you are ready to proceed with booking',
    'Do not make up booking references — rely on what the agent tells you',
  ],
} as const;

// ---------------------------------------------------------------------------
// Golden path — approval scenario
//
// The HIL config sets `bookFlight` to `approve` with a mock booking result.
// The trajectory orchestrator will auto-approve the pending tool call and
// return the provided result to the agent so it can confirm the booking.
// ---------------------------------------------------------------------------

export const flightBookingApproveTrajectory: Trajectory = {
  goal: 'Book the cheapest available flight from New York JFK to San Francisco SFO on June 15th 2025',
  persona: BOOKING_PERSONA,
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Ask the agent to find flights from New York JFK to San Francisco SFO on June 15th, 2025',
      },
      {
        id: 'step-2',
        instruction: 'Select the cheapest flight option and confirm you want to book it',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-1' }],
      },
      {
        id: 'step-3',
        instruction: 'Provide your passenger details: name "Alex Johnson", email "alex@example.com", payment method "credit_card"',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-2' }],
      },
      {
        id: 'step-4',
        instruction: 'Confirm the booking details and acknowledge the booking confirmation',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-3' }],
      },
    ],
    start: 'step-1',
    terminals: ['step-4'],
  },
  maxTurns: 12,
  userModel,

  // ⭐ HIL configuration: auto-approve bookFlight.
  // AI SDK calls the tool's execute() function after approval, so the real
  // result comes from execute() — no need to set approveResult here.
  hil: {
    tools: {
      bookFlight: {
        behavior: 'approve',
      },
    },
    defaultPolicy: 'approve',
  },
};

// ---------------------------------------------------------------------------
// Rejection scenario
//
// The HIL config sets `bookFlight` to `reject` with a reason.
// The agent should gracefully handle the rejection and report it to the user.
// ---------------------------------------------------------------------------

export const flightBookingRejectTrajectory: Trajectory = {
  goal: 'Attempt to book a flight from New York JFK to San Francisco SFO — the booking will be declined by the approval system',
  persona: {
    ...BOOKING_PERSONA,
    description:
      'You are a traveller who wants to fly from New York (JFK) to San Francisco (SFO) on June 15th, 2025. Provide your details (name: Alex Johnson, email: alex@example.com, payment: credit_card) when asked. Accept the outcome whether approved or declined.',
  },
  steps: {
    steps: [
      {
        id: 'step-1',
        instruction: 'Ask the agent to find flights from New York JFK to San Francisco SFO on June 15th, 2025',
      },
      {
        id: 'step-2',
        instruction: 'Select the United Airlines flight and confirm you want to book it',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-1' }],
      },
      {
        id: 'step-3',
        instruction: 'Provide your passenger details: name "Alex Johnson", email "alex@example.com", payment method "credit_card"',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-2' }],
      },
      {
        id: 'step-4',
        instruction: 'Acknowledge the booking outcome (approved or declined) and end the conversation',
        preconditions: [{ type: 'stepSatisfied', stepId: 'step-3' }],
      },
    ],
    start: 'step-1',
    terminals: ['step-4'],
  },
  maxTurns: 12,
  userModel,

  // ⭐ HIL configuration: reject bookFlight — simulates a compliance hold
  hil: {
    tools: {
      bookFlight: {
        behavior: 'reject',
        rejectReason: 'Booking declined: payment method requires additional verification. Please contact support.',
      },
    },
    defaultPolicy: 'reject',
  },
};
