import { createTool } from '@mastra/core/tools';
import {
  createRecurringParamsSchema,
  type RecurringCashflow,
} from '~/schemas/cashflow';

const generateId = () => `rc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const createRecurringTool = createTool({
  id: 'create-recurring',
  description:
    'Add a new recurring cashflow item (e.g. salary, rent, subscription). Frequency options: daily, weekly, biweekly, semimonthly, monthly, yearly.',
  inputSchema: createRecurringParamsSchema,
  execute: async ({ context }) => {
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
    return { success: true, item: data };
  },
});
