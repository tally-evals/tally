/*
    Future cashflow tools are used to list, create, update, and delete future cashflow items like 
    a bonus, vacation expense, medical bill, etc. which are one-time cashflow items that occur on a 
    specific date.
*/

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
    listFutureCashflows,
    createFutureCashflow,
    updateFutureCashflow,
    deleteFutureCashflow,
    type FutureCashflowFilter,
} from './db/repository';
import type { FutureCashflow } from './db/schema';

const generateId = () => `fc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const CashflowTypeEnum = z.enum(['income', 'expense']);
const FutureStatusEnum = z.enum(['planned', 'cancelled']);

export const listFutureTool = createTool({
    id: 'list-future-cashflows',
    description: 'List one-time future cashflow items (planned income or expenses) for a user.',
    inputSchema: z.object({
        userId: z.string(),
        type: CashflowTypeEnum.optional().describe('Filter by income or expense'),
        status: FutureStatusEnum.optional().describe('Filter by planned or cancelled'),
    }),
    execute: async ({ context }) => {
        const filter: FutureCashflowFilter = {
            userId: context.userId,
            ...(context.type !== undefined ? { type: context.type } : {}),
            ...(context.status !== undefined ? { status: context.status } : {}),
        };
        const items = await listFutureCashflows(filter);
        return { success: true, items, count: items.length };
    },
});

export const createFutureTool = createTool({
    id: 'create-future-cashflow',
    description:
        'Add a one-time future cashflow item (e.g. a bonus, vacation expense, medical bill) on a specific date.',
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

export const updateFutureTool = createTool({
    id: 'update-future-cashflow',
    description: 'Update a one-time future cashflow item by id (e.g. change amount, date, or cancel it).',
    inputSchema: z.object({
        id: z.string().describe('The future cashflow id to update'),
        type: CashflowTypeEnum.optional(),
        amount: z.number().positive().optional(),
        date: z.string().optional(),
        probability: z.number().min(0).max(1).optional(),
        status: FutureStatusEnum.optional(),
    }),
    execute: async ({ context }) => {
        const { id, ...raw } = context;
        const updates: Partial<FutureCashflow> = {
            ...(raw.type !== undefined ? { type: raw.type } : {}),
            ...(raw.amount !== undefined ? { amount: raw.amount } : {}),
            ...(raw.date !== undefined ? { date: raw.date } : {}),
            ...(raw.probability !== undefined ? { probability: raw.probability } : {}),
            ...(raw.status !== undefined ? { status: raw.status } : {}),
        };
        const item = await updateFutureCashflow(id, updates);
        if (!item) return { success: false, message: `No future cashflow found with id ${id}` };
        return { success: true, item };
    },
});

export const deleteFutureTool = createTool({
    id: 'delete-future-cashflow',
    description: 'Delete a one-time future cashflow item by id.',
    inputSchema: z.object({
        id: z.string().describe('The future cashflow id to delete'),
    }),
    execute: async ({ context }) => {
        await deleteFutureCashflow(context.id);
        return { success: true, message: `Deleted future cashflow ${context.id}` };
    },
});
