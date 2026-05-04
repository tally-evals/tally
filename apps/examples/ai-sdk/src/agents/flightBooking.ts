/**
 * Flight Booking Agent (AI SDK HIL Example)
 *
 *
 * The `bookFlight` tool has `needsApproval: true`, so whenever the agent
 * decides to book a flight, execution pauses and emits a
 * `tool-approval-request` part in the response.  The caller (or trajectory
 * orchestrator) must resolve the pending approval before the tool executes.
 */

import { ToolLoopAgent as Agent, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { flightBookingTools } from '../tools/flightBooking';

const DEFAULT_MODEL_ID = 'models/gemini-2.5-flash-lite';

const SYSTEM_PROMPT = `You are a helpful flight booking assistant. Your job is to:

1. Help the user find suitable flights by using the searchFlights tool.
2. Present the flight options clearly, including airline, times, and price.
3. When the user selects a flight or asks you to book one, use the bookFlight tool.
4. Confirm booking details (passenger name, email, payment method) before attempting to book.
5. If the user provides all required details, proceed directly with the booking tool call.
6. After a booking is confirmed or rejected, summarise what happened.

Important rules:
- Always search before booking so the user can see options.
- Ask for passenger name, email address, and preferred payment method before calling bookFlight.
- Be concise and friendly.
- Do NOT invent booking references or confirmations — rely solely on tool results.`;

export const flightBookingAgent = new Agent({
  model: google(DEFAULT_MODEL_ID),
  tools: flightBookingTools,
  stopWhen: stepCountIs(10),
  instructions: SYSTEM_PROMPT,
});
