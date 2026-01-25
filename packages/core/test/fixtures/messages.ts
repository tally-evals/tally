/**
 * Realistic ModelMessage fixtures from travel-planner-golden conversation
 * Based on actual data in apps/examples/ai-sdk/.tally/conversations/travel-planner-golden/
 */
import type { ModelMessage } from '../../src/types';

// Step 0: Simple user message (exact match from line 1)
export const userMessage: ModelMessage = {
  role: 'user',
  content:
    "Hi there! I'm looking to plan a trip to San Francisco and could use some help with the details.",
};

// Step 4: User message with specific details (exact match from line 5)
export const userMessageWithDetails: ModelMessage = {
  role: 'user',
  content:
    "I'm pretty flexible on airlines, but I'd prefer to keep it under $600 if possible. Also, direct flights would be ideal if they're available within that price range!",
};

// Step 0: Assistant message with text response (exact match from line 1)
export const assistantTextMessage: ModelMessage = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'I can help with that! What dates are you planning to visit San Francisco?',
    },
  ],
};

// Step 4: Assistant message with tool call - uses "input" not "args" (exact match from line 5)
export const assistantWithToolCall: ModelMessage = {
  role: 'assistant',
  content: [
    {
      type: 'tool-call',
      toolCallId: '3w0XeF37A5lnXnPV',
      toolName: 'searchFlights',
      // Actual format uses "input" not "args"
      input: {
        origin: 'New York, JFK',
        destination: 'San Francisco, SFO',
        departureDate: '2025-06-15',
        returnDate: '2025-06-22',
        passengers: 1,
        class: 'Economy',
        maxPrice: 600,
        maxStops: 0,
        sortBy: 'price',
      },
    },
  ],
};

// Step 4: Tool result message - uses "output.type/value" format (exact match from line 5)
export const toolResultMessage: ModelMessage = {
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: '3w0XeF37A5lnXnPV',
      toolName: 'searchFlights',
      // Actual format wraps result in { type: 'json', value: {...} }
      output: {
        type: 'json',
        value: {
          flights: [
            {
              id: 'FL005',
              airline: 'Connector Express',
              flightNumber: 'CE456',
              class: 'Economy',
              departure: { airport: 'New York', time: '09:00', date: '2025-06-15' },
              arrival: { airport: 'San Francisco', time: '16:30', date: '2025-06-15' },
              price: 275,
              duration: '7h 30m',
              stops: 0,
              aircraft: 'Embraer E190',
            },
            {
              id: 'FL001',
              airline: 'SkyWings Airlines',
              flightNumber: 'SW234',
              class: 'Economy',
              departure: { airport: 'New York', time: '08:00', date: '2025-06-15' },
              arrival: { airport: 'San Francisco', time: '14:30', date: '2025-06-15' },
              price: 299,
              duration: '6h 30m',
              stops: 0,
              aircraft: 'Boeing 737-800',
            },
          ],
          count: 8, // Actual has 8 flights total (including return)
          message: 'Found 8 flight(s) from New York, JFK to San Francisco, SFO',
        },
      },
    },
  ],
};

// Step 4: Assistant message after tool result (exact match from line 5)
export const assistantAfterToolResult: ModelMessage = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: 'I found a few direct flights for you under $600! The cheapest option is with Connector Express for $275, departing JFK at 9:00 AM and arriving in San Francisco at 4:30 PM. There are also options with SkyWings Airlines for $299 and Global Airways for $349.\n\nWould you like to look into booking any of these, or perhaps explore other options?\n',
    },
  ],
};

// Multi-turn conversation step with tool calls (step 4 from JSONL)
export const stepWithToolCalls = {
  stepIndex: 4,
  input: userMessageWithDetails,
  output: [assistantWithToolCall, toolResultMessage, assistantAfterToolResult] as const,
  timestamp: new Date('2026-01-05T07:35:44.896Z'),
  metadata: {
    completed: true,
    reason: 'goal-reached',
    summary: 'Terminal step reached',
    turnIndex: 4,
  },
};

// Simple step without tool calls (step 0 from JSONL)
export const simpleStep = {
  stepIndex: 0,
  input: userMessage,
  output: [assistantTextMessage] as const,
  timestamp: new Date('2026-01-05T07:35:31.781Z'),
  metadata: {
    completed: true,
    reason: 'goal-reached',
    summary: 'Terminal step reached',
    turnIndex: 0,
  },
};

// Complete conversation fixture
export const sampleConversation = {
  id: 'travel-planner-golden',
  steps: [simpleStep, stepWithToolCalls],
  metadata: { source: 'test-fixture' },
};

// StepTrace fixtures for conversion tests
export const sampleStepTrace = {
  turnIndex: 0,
  userMessage: userMessage,
  agentMessages: [assistantTextMessage],
  timestamp: new Date('2026-01-05T07:35:31.781Z'),
  stepId: 'step-0',
  selection: { method: 'start' as const },
};

export const stepTraceWithToolCall = {
  turnIndex: 4,
  userMessage: userMessageWithDetails,
  agentMessages: [assistantWithToolCall, toolResultMessage, assistantAfterToolResult],
  timestamp: new Date('2026-01-05T07:35:44.896Z'),
  stepId: null,
  selection: { method: 'none' as const },
};
