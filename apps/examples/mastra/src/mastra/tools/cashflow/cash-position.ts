import { createTool } from '@mastra/core/tools';
import { updateCashPositionParamsSchema } from '~/schemas/cashflow';

export const updateCashPositionTool = createTool({
  id: 'update-cash-position',
  description: "Set or update the user's current cash balance.",
  inputSchema: updateCashPositionParamsSchema,
  execute: async ({ context }) => {
    const position = {
      userId: context.userId,
      currentBalance: context.currentBalance,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, position };
  },
});
