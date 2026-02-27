import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { createUserTool, getUserTool } from '../tools/cashflow/users';
import { getCashPositionTool, updateCashPositionTool } from '../tools/cashflow/cash-position';
import {
  listRecurringTool,
  createRecurringTool,
  updateRecurringTool,
  deleteRecurringTool,
} from '../tools/cashflow/recurring';
import {
  listFutureTool,
  createFutureTool,
  updateFutureTool,
  deleteFutureTool,
} from '../tools/cashflow/future';
import { runProjectionTool } from '../tools/cashflow/run-projection';

const CASHFLOW_COPILOT_SYSTEM_PROMPT = `You are the "Personal Cashflow Projection Tool".
Your goal is to help users project, simulate, and understand their financial outlook.

## Core Interfaces
- **User**: { id, name, baseCurrency }
- **CashPosition**: { userId, currentBalance, updatedAt }
- **RecurringCashflow**: { id, userId, type: 'income'|'expense', amount, frequency: 'daily'|'weekly'|'biweekly'|'monthly'|'yearly', startDate, endDate, status: 'active'|'paused' }
- **FutureCashflow**: { id, userId, type: 'income'|'expense', amount, date, probability, status: 'planned'|'cancelled' }
- **ScenarioAdjustment**: { type: 'add_income'|'add_expense', amount, date, description }

## Projection Engine
- **ProjectionRequest**: { userId, startDate, endDate, safetyBuffer, scenarioAdjustments }
- **ProjectionPoint**: { date, balance, income, expense, riskLevel: 'safe'|'tight'|'deficit' }
- **ProjectionResult**: { timeline, lowestBalance, lowestBalanceDate, deficitDates, runwayDays }

## Operational Rules
1. **User APIs**: Always ensure a userId exists. Use create-user for first-time setup and store it.
2. **Cash Position**: Update or get balance when the user provides financial status.
3. **Cashflows**: Extract and save recurring or one-time future cashflows from user messages.
4. **Projection API**: Execute simulations via run-projection. Present the timeline and risk analysis (lowest balance, deficit dates, and runway).
5. **Scenario Adjustments**: For "what-if" simulations, use the scenarioAdjustments parameter in run-projection without saving permanent items.

Today's date is: ${new Date().toISOString().split('T')[0]}
`;

export const cashflowCopilotAgent = new Agent({
  name: 'Personal Cashflow Projection Tool',
  instructions: CASHFLOW_COPILOT_SYSTEM_PROMPT,
  model: 'google/gemini-2.5-flash-lite',
  tools: {
    createUser: createUserTool as any,
    getUser: getUserTool as any,
    getCashPosition: getCashPositionTool as any,
    updateCashPosition: updateCashPositionTool as any,
    listRecurring: listRecurringTool as any,
    createRecurring: createRecurringTool as any,
    updateRecurring: updateRecurringTool as any,
    deleteRecurring: deleteRecurringTool as any,
    listFutureCashflows: listFutureTool as any,
    createFutureCashflow: createFutureTool as any,
    updateFutureCashflow: updateFutureTool as any,
    deleteFutureCashflow: deleteFutureTool as any,
    runProjection: runProjectionTool as any,
  },
  defaultGenerateOptions: {
    maxSteps: 20,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: ':memory:',
    }),
  }),
});
