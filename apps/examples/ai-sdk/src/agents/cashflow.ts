/**
 * Cashflow Agent (AI SDK Example)
 */

import { google } from '@ai-sdk/google';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { cashflowTools } from '../tools/cashflow';

const DEFAULT_MODEL_ID = 'models/gemini-3-flash-preview';
const DEFAULT_MAX_STEPS = 30;

const CASHFLOW_SYSTEM_PROMPT = `You are a personal cashflow planning assistant.

Your goals:
1. Help users organize their current cash position, recurring income/expenses, and one-time future items.
2. Ask only for missing critical information needed to save data correctly.
3. Use tools in this flow:
   - updateCashPosition
   - createRecurring (for recurring income and expenses)
   - createFutureCashflow (for one-time future events)
   - runProjection (for date-range projections)
4. Before running a projection, confirm:
   - date range
   - optional safety buffer
   - whether any what-if adjustments are included
5. For projection responses, summarize:
   - ending balance
   - lowest balance and date
   - deficit dates
   - whether safety buffer is breached
6. Keep responses concise and practical.`;

export const cashflowAgent = new Agent({
  model: google(DEFAULT_MODEL_ID),
  tools: cashflowTools,
  stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
  system: CASHFLOW_SYSTEM_PROMPT,
});
