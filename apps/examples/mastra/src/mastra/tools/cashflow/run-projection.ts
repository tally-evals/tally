import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runProjection } from './projection';

const ScenarioAdjustmentSchema = z.object({
    type: z.enum(['add_income', 'add_expense']),
    amount: z.number().positive(),
    date: z.string().describe('ISO date YYYY-MM-DD'),
    description: z.string().optional(),
});

export const runProjectionTool = createTool({
    id: 'run-projection',
    description:
        'Run a cashflow projection simulation for a user between two dates. ' +
        'Applies all active recurring cashflows, planned future cashflows, and optional scenario adjustments. ' +
        'Returns a day-by-day timeline with balance, income, expenses, and risk levels, ' +
        'plus summary: lowest balance, deficit dates, and runway days.',
    inputSchema: z.object({
        userId: z.string().describe('The user id to run the projection for'),
        startDate: z.string().describe('ISO date YYYY-MM-DD — start of simulation'),
        endDate: z.string().describe('ISO date YYYY-MM-DD — end of simulation'),
        safetyBuffer: z
            .number()
            .optional()
            .describe('Minimum balance threshold. Days below this are marked "tight".'),
        scenarioAdjustments: z
            .array(ScenarioAdjustmentSchema)
            .optional()
            .describe('What-if temporary changes (e.g. add a vacation expense, simulate a bonus)'),
    }),
    execute: async ({ context }) => {
        const result = await runProjection({
            userId: context.userId,
            startDate: context.startDate,
            endDate: context.endDate,
            safetyBuffer: context.safetyBuffer,
            scenarioAdjustments: context.scenarioAdjustments,
        });

        return {
            success: true,
            ...result,
            summary: {
                totalDays: result.timeline.length,
                lowestBalance: result.lowestBalance,
                lowestBalanceDate: result.lowestBalanceDate,
                deficitDays: result.deficitDates.length,
                runwayDays: result.runwayDays ?? null,
                hasDeficit: result.deficitDates.length > 0,
            },
        };
    },
});
