import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getCashPosition, upsertCashPosition } from './db/repository';

export const getCashPositionTool = createTool({
    id: 'get-cash-position',
    description: "Get the user's current cash balance.",
    inputSchema: z.object({
        userId: z.string().describe('The user id'),
    }),
    execute: async ({ context }) => {
        const position = await getCashPosition(context.userId);
        if (!position) {
            return { success: false, message: `No cash position found for user ${context.userId}` };
        }
        return { success: true, position };
    },
});

export const updateCashPositionTool = createTool({
    id: 'update-cash-position',
    description: "Set or update the user's current cash balance.",
    inputSchema: z.object({
        userId: z.string().describe('The user id'),
        currentBalance: z.number().describe('The current balance amount'),
    }),
    execute: async ({ context }) => {
        const position = await upsertCashPosition({
            userId: context.userId,
            currentBalance: context.currentBalance,
            updatedAt: new Date().toISOString(),
        });
        return { success: true, position };
    },
});
