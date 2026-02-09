import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, saveProfile, IncomeSchema, BillSchema, BudgetSchema, SubscriptionSchema } from './db';

// Simple deterministic ID generator
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const updateBalanceTool = createTool({
  id: 'update-balance',
  description: 'Update the current cash balance',
  inputSchema: z.object({
    amount: z.number().describe('The new current balance'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    profile.currentBalance = context.amount;
    saveProfile(profile);
    return { success: true, currentBalance: profile.currentBalance };
  },
});

export const updateSafetyBufferTool = createTool({
  id: 'update-safety-buffer',
  description: 'Update the safety buffer / emergency fund minimum amount that the user wants to maintain',
  inputSchema: z.object({
    amount: z.number().describe('The minimum safety buffer amount to maintain'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    profile.safetyBuffer = context.amount;
    saveProfile(profile);
    return { success: true, safetyBuffer: profile.safetyBuffer };
  },
});

export const upsertIncomeTool = createTool({
  id: 'upsert-income',
  description: 'Add or update an income source',
  inputSchema: IncomeSchema,
  execute: async ({ context }) => {
    const profile = getProfile();
    const index = profile.income.findIndex((i) => i.name.toLowerCase() === context.name.toLowerCase());
    if (index >= 0) {
      profile.income[index] = { ...profile.income[index], ...context };
    } else {
      profile.income.push({ ...context, id: generateId() });
    }
    saveProfile(profile);
    return { success: true, income: profile.income };
  },
});

export const upsertBillTool = createTool({
  id: 'upsert-bill',
  description: 'Add or update a fixed bill',
  inputSchema: BillSchema,
  execute: async ({ context }) => {
    const profile = getProfile();
    const index = profile.bills.findIndex((b) => b.name.toLowerCase() === context.name.toLowerCase());
    if (index >= 0) {
      profile.bills[index] = { ...profile.bills[index], ...context };
    } else {
      profile.bills.push({ ...context, id: generateId() });
    }
    saveProfile(profile);
    return { success: true, bills: profile.bills };
  },
});

export const upsertBudgetTool = createTool({
  id: 'upsert-budget',
  description: 'Add or update a variable spending budget (envelope)',
  inputSchema: BudgetSchema,
  execute: async ({ context }) => {
    const profile = getProfile();
    const index = profile.budgets.findIndex((b) => b.name.toLowerCase() === context.name.toLowerCase());
    if (index >= 0) {
      profile.budgets[index] = { ...profile.budgets[index], ...context };
    } else {
      profile.budgets.push({ ...context, id: generateId() });
    }
    saveProfile(profile);
    return { success: true, budgets: profile.budgets };
  },
});

export const upsertSubscriptionTool = createTool({
  id: 'upsert-subscription',
  description: 'Add or update a subscription',
  inputSchema: SubscriptionSchema,
  execute: async ({ context }) => {
    const profile = getProfile();
    const index = profile.subscriptions.findIndex((s) => s.name.toLowerCase() === context.name.toLowerCase());
    if (index >= 0) {
      profile.subscriptions[index] = { ...profile.subscriptions[index], ...context };
    } else {
      profile.subscriptions.push({ ...context, id: generateId() });
    }
    saveProfile(profile);
    return { success: true, subscriptions: profile.subscriptions };
  },
});

export const deleteFinancialItemTool = createTool({
  id: 'delete-financial-item',
  description: 'Delete an income, bill, budget, or subscription by name',
  inputSchema: z.object({
    type: z.enum(['income', 'bill', 'budget', 'subscription']),
    name: z.string(),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const key = context.type === 'bill' ? 'bills' : context.type === 'budget' ? 'budgets' : context.type === 'income' ? 'income' : 'subscriptions';
    const initialLength = profile[key].length;
    profile[key] = (profile[key] as any[]).filter((item: any) => item.name.toLowerCase() !== context.name.toLowerCase());
    
    if (profile[key].length < initialLength) {
      saveProfile(profile);
      return { success: true, message: `Deleted ${context.type} ${context.name}` };
    }
    return { success: false, message: `Could not find ${context.type} ${context.name}` };
  },
});

