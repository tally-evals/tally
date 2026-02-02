import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, CashflowProfile } from './db';

// Re-using forecast logic for simulation
function getSimulatedLowestBalance(profile: CashflowProfile, days: number = 30): { balance: number; date: string } {
  let currentBalance = profile.currentBalance;
  const today = new Date();
  let lowestBalance = currentBalance;
  let lowestDate = today.toISOString().split('T')[0]!;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();

    // Income
    for (const income of profile.income) {
      if (income.schedule === `monthly_day_${dayOfMonth}`) currentBalance += income.amount;
      const daysMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const dayName = income.schedule.split('_')[1];
      if (income.schedule.startsWith('weekly_') && daysMap[dayName!] === dayOfWeek) currentBalance += income.amount;
    }
    // Bills
    for (const bill of profile.bills) {
      if (bill.dueDateRule === `monthly_day_${dayOfMonth}`) currentBalance -= bill.amount;
    }
    // Subscriptions
    for (const sub of profile.subscriptions) {
      if (sub.status === 'active' && dayOfMonth === 1) currentBalance -= sub.amount;
    }
    // Budgets
    for (const budget of profile.budgets) {
      if (budget.frequency === 'weekly' && dayOfWeek === 1) currentBalance -= budget.amount;
      else if (budget.frequency === 'monthly' && dayOfMonth === 1) currentBalance -= budget.amount;
    }

    if (currentBalance < lowestBalance) {
      lowestBalance = currentBalance;
      lowestDate = date.toISOString().split('T')[0]!;
    }
  }
  return { balance: lowestBalance, date: lowestDate };
}

export const checkAffordabilityTool = createTool({
  id: 'check-affordability',
  description: 'Check if a purchase is affordable without hitting the safety buffer',
  inputSchema: z.object({
    amount: z.number(),
    description: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const originalLowest = getSimulatedLowestBalance(profile);
    
    // Simulate purchase
    const simulatedProfile = { ...profile, currentBalance: profile.currentBalance - context.amount };
    const simulatedLowest = getSimulatedLowestBalance(simulatedProfile);

    const hitsBuffer = simulatedLowest.balance < profile.safetyBuffer;

    return {
      affordable: !hitsBuffer,
      originalLowest: originalLowest.balance,
      simulatedLowest: simulatedLowest.balance,
      lowestDate: simulatedLowest.date,
      safetyBuffer: profile.safetyBuffer,
      message: hitsBuffer 
        ? `Buying this for ${context.amount} would cause your balance to drop to ${simulatedLowest.balance} on ${simulatedLowest.date}, which is below your ${profile.safetyBuffer} buffer.`
        : `Yes, you can afford this. Your lowest projected balance would be ${simulatedLowest.balance} on ${simulatedLowest.date}.`,
    };
  },
});

export const simulateScenarioTool = createTool({
  id: 'simulate-scenario',
  description: 'Simulate financial changes (e.g., moving a bill, canceling a sub) and see the impact',
  inputSchema: z.object({
    action: z.enum(['move_bill', 'cancel_subscription', 'change_budget']),
    itemName: z.string(),
    newValue: z.string().describe('New date for move_bill, or new amount for change_budget'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const originalLowest = getSimulatedLowestBalance(profile);
    const simulatedProfile = JSON.parse(JSON.stringify(profile)) as CashflowProfile;

    if (context.action === 'cancel_subscription') {
      const sub = simulatedProfile.subscriptions.find(s => s.name.toLowerCase() === context.itemName.toLowerCase());
      if (sub) sub.status = 'cancelled';
    } else if (context.action === 'move_bill') {
      const bill = simulatedProfile.bills.find(b => b.name.toLowerCase() === context.itemName.toLowerCase());
      if (bill) bill.dueDateRule = `monthly_day_${context.newValue}`;
    } else if (context.action === 'change_budget') {
      const budget = simulatedProfile.budgets.find(b => b.name.toLowerCase() === context.itemName.toLowerCase());
      if (budget) budget.amount = Number(context.newValue);
    }

    const simulatedLowest = getSimulatedLowestBalance(simulatedProfile);
    const improvement = simulatedLowest.balance - originalLowest.balance;

    return {
      originalLowest: originalLowest.balance,
      simulatedLowest: simulatedLowest.balance,
      improvement,
      message: `This change would ${improvement >= 0 ? 'improve' : 'decrease'} your lowest projected balance by ${Math.abs(improvement)}. New lowest: ${simulatedLowest.balance} on ${simulatedLowest.date}.`,
    };
  },
});

