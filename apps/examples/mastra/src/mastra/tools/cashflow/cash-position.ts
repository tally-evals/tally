import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { upsertCashPosition } from './db/repository';

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
