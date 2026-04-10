/**
 * Flight Booking Tools (AI SDK HIL Example)
 *
 * Demonstrates Human-in-the-Loop (HIL) using AI SDK v6's `needsApproval`.
 *
 * - `searchFlights`  — no approval required; returns mock flight options
 * - `bookFlight`     — requires human approval before the booking executes
 */

import { tool } from 'ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  class: 'Economy' | 'Business' | 'First';
  duration: string;
}

export interface Booking {
  bookingRef: string;
  flightId: string;
  passengerName: string;
  status: 'confirmed' | 'pending' | 'failed';
  totalCharged: number;
  confirmationEmail: string;
}

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

function mockFlights(origin: string, destination: string, date: string): Flight[] {
  return [
    {
      id: 'UA123',
      airline: 'United Airlines',
      flightNumber: 'UA 123',
      origin,
      destination,
      departureDate: date,
      departureTime: '08:00',
      arrivalTime: '11:30',
      price: 349,
      class: 'Economy',
      duration: '3h 30m',
    },
    {
      id: 'DL456',
      airline: 'Delta Air Lines',
      flightNumber: 'DL 456',
      origin,
      destination,
      departureDate: date,
      departureTime: '11:15',
      arrivalTime: '14:45',
      price: 420,
      class: 'Economy',
      duration: '3h 30m',
    },
    {
      id: 'AA789',
      airline: 'American Airlines',
      flightNumber: 'AA 789',
      origin,
      destination,
      departureDate: date,
      departureTime: '16:00',
      arrivalTime: '19:30',
      price: 299,
      class: 'Economy',
      duration: '3h 30m',
    },
  ];
}

// ---------------------------------------------------------------------------
// searchFlights — no approval required
// ---------------------------------------------------------------------------

export const searchFlights = tool({
  description:
    'Search for available flights between two cities. Returns a list of flight options with prices and schedules.',
  inputSchema: z.object({
    origin: z
      .string()
      .describe('Departure city or airport code (e.g., "New York" or "JFK")'),
    destination: z
      .string()
      .describe('Arrival city or airport code (e.g., "San Francisco" or "SFO")'),
    departureDate: z
      .string()
      .describe('Departure date in YYYY-MM-DD format (e.g., "2025-06-15")'),
    passengers: z.number().optional().describe('Number of passengers (default: 1)'),
  }),
  execute: async ({ origin, destination, departureDate }) => {
    return {
      flights: mockFlights(origin, destination, departureDate),
      searchedAt: new Date().toISOString(),
    };
  },
});

// ---------------------------------------------------------------------------
// bookFlight — requires human approval (needsApproval: true)
// ---------------------------------------------------------------------------

export const bookFlight = tool({
  description:
    'Book a specific flight by flight ID. **Requires human approval** before the charge is processed.',
  inputSchema: z.object({
    flightId: z.string().describe('The flight ID returned by searchFlights (e.g., "UA123")'),
    passengerName: z.string().describe('Full name of the passenger as it appears on their ID'),
    paymentMethod: z
      .enum(['credit_card', 'debit_card', 'paypal'])
      .describe('Payment method to use for the booking'),
    confirmEmail: z
      .string()
      .describe('Email address to send the booking confirmation to'),
  }),
  // ⭐ This is the AI SDK v6 HIL flag
  needsApproval: true,
  execute: async ({ flightId, passengerName, confirmEmail }) => {
    // This executes ONLY after the human approves the tool call.
    const bookingRef = `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      booking: {
        bookingRef,
        flightId,
        passengerName,
        status: 'confirmed',
        totalCharged: 349, // simplified mock price
        confirmationEmail: confirmEmail,
      } satisfies Booking,
      message: `Flight ${flightId} booked successfully! Confirmation ref: ${bookingRef}`,
    };
  },
});

// ---------------------------------------------------------------------------
// Tool set export
// ---------------------------------------------------------------------------

export const flightBookingTools = {
  searchFlights,
  bookFlight,
};
