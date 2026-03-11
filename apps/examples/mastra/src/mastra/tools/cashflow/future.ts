/*
    Future cashflow tools are used to create one-time future cashflow items like
    a bonus, travel cost, medical bill, car repair, etc. which are one-time cashflow items that occur on a
    specific date.
*/

import { createTool } from '@mastra/core/tools';
import { createFutureParamsSchema, type FutureCashflow } from '~/schemas/cashflow';

const generateId = () => `fc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const createFutureTool = createTool({
  id: 'create-future-cashflow',
  description:
    'Add a one-time future cashflow item (e.g. a bonus, travel cost, medical bill, car repair) on a specific date.',
  inputSchema: createFutureParamsSchema,
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
    return { success: true, item: data };
  },
});
