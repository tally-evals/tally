import { z } from 'zod';

// Financial Data Schemas
export const IncomeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.number(),
  schedule: z.string().describe('e.g., "monthly_day_1", "weekly_monday"'),
});

export const BillSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.number(),
  dueDateRule: z.string().describe('e.g., "monthly_day_5"'),
  priority: z.enum(['must-pay', 'optional']).default('must-pay'),
});

export const BudgetSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.number(),
  frequency: z.enum(['weekly', 'monthly']),
});

export const SubscriptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.number(),
  status: z.enum(['active', 'cancelled']).default('active'),
});

export const ActivitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  cost: z.number(),
  duration: z.number().describe('Duration in minutes'),
  status: z.enum(['planned', 'completed']).default('planned'),
  completedAt: z.string().optional(),
});

export const CashflowProfileSchema = z.object({
  currentBalance: z.number().default(0),
  safetyBuffer: z.number().default(5000),
  income: z.array(IncomeSchema).default([]),
  bills: z.array(BillSchema).default([]),
  budgets: z.array(BudgetSchema).default([]),
  subscriptions: z.array(SubscriptionSchema).default([]),
  activities: z.array(ActivitySchema).default([]),
});

export type CashflowProfile = z.infer<typeof CashflowProfileSchema>;
export type Activity = z.infer<typeof ActivitySchema>;

/**
 * Simple local storage for financial data using Mastra's LibSQLStore.
 * we'll implement
 * a simple file-based JSON store for the "local budget model" to keep it deterministic.
 */
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'cashflow-data.json');

export function getProfile(): CashflowProfile {
  if (!fs.existsSync(DB_PATH)) {
    const defaultProfile: CashflowProfile = {
      currentBalance: 0,
      safetyBuffer: 5000,
      income: [],
      bills: [],
      budgets: [],
      subscriptions: [],
      activities: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultProfile, null, 2));
    return defaultProfile;
  }
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  const profile = JSON.parse(data);
  // Ensure activities array exists for backward compatibility
  if (!profile.activities) {
    profile.activities = [];
  }
  return profile;
}

export function saveProfile(profile: CashflowProfile) {
  fs.writeFileSync(DB_PATH, JSON.stringify(profile, null, 2));
}

