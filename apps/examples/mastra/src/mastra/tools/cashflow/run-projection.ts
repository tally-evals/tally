import { createTool } from '@mastra/core/tools';
import { runProjection } from './projection';
import { runProjectionParamsSchema } from '~/schemas/cashflow';

export const runProjectionTool = createTool({
  id: 'run-projection',
  description:
    'Run a cashflow projection simulation for a user between two dates. ' +
    'Applies the provided cash position, recurring cashflows, future cashflows, and optional scenario adjustments. ' +
    'Returns a day-by-day timeline plus month-by-month summaries with balances, income, expenses, and risk levels, ' +
    'plus overall summary: lowest balance, deficit dates, and runway days.',
  inputSchema: runProjectionParamsSchema,
  execute: async ({ context }) => {
    const result = await runProjection({
      userId: context.userId,
      startDate: context.startDate,
      endDate: context.endDate,
      cashPosition: context.cashPosition,
      recurringCashflows: context.recurringCashflows,
      futureCashflows: context.futureCashflows,
      safetyBuffer: context.safetyBuffer,
      scenarioAdjustments: context.scenarioAdjustments,
    });

    return {
      success: true,
      ...result,
      summary: {
        totalDays: result.timeline.length,
        totalMonths: result.monthlySummaries.length,
        totalIncome: result.totalIncome,
        totalExpense: result.totalExpense,
        netCashflow: result.totalIncome - result.totalExpense,
        lowestBalance: result.lowestBalance,
        lowestBalanceDate: result.lowestBalanceDate,
        deficitDays: result.deficitDates.length,
        runwayDays: result.runwayDays ?? null,
        hasDeficit: result.deficitDates.length > 0,
      },
    };
  },
});
