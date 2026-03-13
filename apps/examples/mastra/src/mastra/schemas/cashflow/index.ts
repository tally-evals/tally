import { z } from 'zod';

export const cashflowTypeSchema = z.enum(['income', 'expense']);
export const frequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'yearly',
]);
export const recurringStatusSchema = z.enum(['active', 'paused']);
export const futureStatusSchema = z.enum(['planned', 'cancelled']);

export const cashPositionSchema = z.object({
  userId: z.string(),
  currentBalance: z.number(),
  updatedAt: z.string(),
});

export const recurringCashflowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: cashflowTypeSchema,
  amount: z.number().positive(),
  frequency: frequencySchema,
  startDate: z.string(),
  endDate: z.string().optional(),
  status: recurringStatusSchema,
});

export const futureCashflowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: cashflowTypeSchema,
  amount: z.number().positive(),
  date: z.string(),
  probability: z.number().min(0).max(1).optional(),
  status: futureStatusSchema,
});

export const scenarioAdjustmentSchema = z.object({
  type: z.enum(['add_income', 'add_expense']),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().optional(),
});

export const cashflowWorkingMemorySchema = z.object({
  userId: z.string().optional(),
  cashPosition: cashPositionSchema.optional(),
  recurringCashflows: z.record(z.string(), recurringCashflowSchema).optional(),
  futureCashflows: z.record(z.string(), futureCashflowSchema).optional(),
});

export const updateCashPositionParamsSchema = z.object({
  userId: z.string().describe('The user id'),
  currentBalance: z.number().describe('The current balance amount'),
});

export const createRecurringParamsSchema = z.object({
  userId: z.string(),
  type: cashflowTypeSchema.describe('income or expense'),
  amount: z.number().positive(),
  frequency: frequencySchema,
  startDate: z.string().describe('ISO date YYYY-MM-DD when this recurrence starts'),
  endDate: z.string().optional().describe('ISO date YYYY-MM-DD when this recurrence ends'),
  status: recurringStatusSchema.default('active'),
});

export const createFutureParamsSchema = z.object({
  userId: z.string(),
  type: cashflowTypeSchema.describe('income or expense'),
  amount: z.number().positive(),
  date: z.string().describe('ISO date YYYY-MM-DD when this cashflow occurs'),
  probability: z.number().min(0).max(1).optional().describe('Likelihood 0-1 (e.g. 0.8 = 80% chance).'),
  status: futureStatusSchema.default('planned'),
});

export const runProjectionParamsSchema = z.object({
  userId: z.string().describe('The user id to run the projection for'),
  startDate: z.string().describe('ISO date YYYY-MM-DD — start of simulation'),
  endDate: z.string().describe('ISO date YYYY-MM-DD — end of simulation'),
  cashPosition: cashPositionSchema.optional().describe('Current cash position for this projection run'),
  recurringCashflows: z
    .record(z.string(), recurringCashflowSchema)
    .optional()
    .describe('Recurring cashflows keyed by id'),
  futureCashflows: z
    .record(z.string(), futureCashflowSchema)
    .optional()
    .describe('One-time future cashflows keyed by id'),
  safetyBuffer: z.number().optional().describe('Minimum balance threshold. Days below this are marked "tight".'),
  scenarioAdjustments: z
    .array(scenarioAdjustmentSchema)
    .optional()
    .describe('What-if temporary changes (e.g. add a travel expense, simulate a bonus)'),
});

export type CashPosition = z.infer<typeof cashPositionSchema>;
export type RecurringCashflow = z.infer<typeof recurringCashflowSchema>;
export type FutureCashflow = z.infer<typeof futureCashflowSchema>;
export type ScenarioAdjustment = z.infer<typeof scenarioAdjustmentSchema>;
export type RunProjectionParams = z.infer<typeof runProjectionParamsSchema>;
