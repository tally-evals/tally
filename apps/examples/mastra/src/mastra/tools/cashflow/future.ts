/*
    Future cashflow tools are used to create one-time future cashflow items like
    a bonus, travel cost, medical bill, car repair, etc. which are one-time cashflow items that occur on a
    specific date.
*/

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
    createFutureCashflow,
} from './db/repository';
import type { FutureCashflow } from './db/schema';

const generateId = () => `fc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const CashflowTypeEnum = z.enum(['income', 'expense']);
const FutureStatusEnum = z.enum(['planned', 'cancelled']);

export const createFutureTool = createTool({
    id: 'create-future-cashflow',
    description:
        'Add a one-time future cashflow item (e.g. a bonus, travel cost, medical bill, car repair) on a specific date.',
    inputSchema: z.object({
        userId: z.string(),
        type: CashflowTypeEnum.describe('income or expense'),
        amount: z.number().positive(),
        date: z.string().describe('ISO date YYYY-MM-DD when this cashflow occurs'),
        probability: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Likelihood 0-1 (e.g. 0.8 = 80% chance). Omit if certain.'),
        status: FutureStatusEnum.default('planned'),
    }),
    execute: async ({ context }) => {
        const data: FutureCashflow = {
            id: generateId(),
            userId: context.userId,
            type: context.type,
            amount: context.amount,
            date: context.date,
            status: context.status,
            ...(context.probability !== undefined ? { probability: context.probability } : {}),
        };
        const item = await createFutureCashflow(data);
        return { success: true, item };
    },
});
