import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
    createRecurringCashflow,
} from './db/repository';
import type { RecurringCashflow } from './db/schema';

const generateId = () => `rc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const FrequencyEnum = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'semimonthly']);
const CashflowTypeEnum = z.enum(['income', 'expense']);
const RecurringStatusEnum = z.enum(['active', 'paused']);

export const createRecurringTool = createTool({
    id: 'create-recurring',
    description:
        'Add a new recurring cashflow item (e.g. salary, rent, subscription). Frequency options: daily, weekly, biweekly, semimonthly, monthly, yearly.',
    inputSchema: z.object({
        userId: z.string(),
        type: CashflowTypeEnum.describe('income or expense'),
        amount: z.number().positive(),
        frequency: FrequencyEnum,
        startDate: z.string().describe('ISO date YYYY-MM-DD when this recurrence starts'),
        endDate: z.string().optional().describe('ISO date YYYY-MM-DD when this recurrence ends'),
        status: RecurringStatusEnum.default('active'),
    }),
    execute: async ({ context }) => {
        // Build the object, only including endDate if provided
        const data: RecurringCashflow = {
            id: generateId(),
            userId: context.userId,
            type: context.type,
            amount: context.amount,
            frequency: context.frequency,
            startDate: context.startDate,
            status: context.status,
        };
        if (context.endDate !== undefined) data.endDate = context.endDate;

        const item = await createRecurringCashflow(data);
        return { success: true, item };
    },
});
