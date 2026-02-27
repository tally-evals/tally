import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
    listRecurringCashflows,
    createRecurringCashflow,
    updateRecurringCashflow,
    deleteRecurringCashflow,
    type RecurringCashflowFilter,
} from './db/repository';
import type { RecurringCashflow } from './db/schema';

const generateId = () => `rc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const FrequencyEnum = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']);
const CashflowTypeEnum = z.enum(['income', 'expense']);
const RecurringStatusEnum = z.enum(['active', 'paused']);

export const listRecurringTool = createTool({
    id: 'list-recurring',
    description: 'List all recurring cashflow items (income and expenses) for a user.',
    inputSchema: z.object({
        userId: z.string().describe('The user id'),
        type: CashflowTypeEnum.optional().describe('Filter by type: income or expense'),
        status: RecurringStatusEnum.optional().describe('Filter by status: active or paused'),
    }),
    execute: async ({ context }) => {
        // Build filter omitting undefined values (required by exactOptionalPropertyTypes)
        const filter: RecurringCashflowFilter = { userId: context.userId };
        if (context.type !== undefined) filter.type = context.type;
        if (context.status !== undefined) filter.status = context.status;

        const items = await listRecurringCashflows(filter);
        return { success: true, items, count: items.length };
    },
});

export const createRecurringTool = createTool({
    id: 'create-recurring',
    description:
        'Add a new recurring cashflow item (e.g. salary, rent, subscription). Frequency options: daily, weekly, biweekly, monthly, yearly.',
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

export const updateRecurringTool = createTool({
    id: 'update-recurring',
    description: 'Update an existing recurring cashflow item by id.',
    inputSchema: z.object({
        id: z.string().describe('The recurring cashflow id to update'),
        type: CashflowTypeEnum.optional(),
        amount: z.number().positive().optional(),
        frequency: FrequencyEnum.optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: RecurringStatusEnum.optional(),
    }),
    execute: async ({ context }) => {
        const { id, ...raw } = context;
        // Strip undefined keys so they are truly absent (exactOptionalPropertyTypes)
        const updates: Partial<RecurringCashflow> = {};
        if (raw.type !== undefined) updates.type = raw.type;
        if (raw.amount !== undefined) updates.amount = raw.amount;
        if (raw.frequency !== undefined) updates.frequency = raw.frequency;
        if (raw.startDate !== undefined) updates.startDate = raw.startDate;
        if (raw.endDate !== undefined) updates.endDate = raw.endDate;
        if (raw.status !== undefined) updates.status = raw.status;

        const item = await updateRecurringCashflow(id, updates);
        if (!item) return { success: false, message: `No recurring cashflow found with id ${id}` };
        return { success: true, item };
    },
});

export const deleteRecurringTool = createTool({
    id: 'delete-recurring',
    description: 'Delete a recurring cashflow item by id.',
    inputSchema: z.object({
        id: z.string().describe('The recurring cashflow id to delete'),
    }),
    execute: async ({ context }) => {
        await deleteRecurringCashflow(context.id);
        return { success: true, message: `Deleted recurring cashflow ${context.id}` };
    },
});
