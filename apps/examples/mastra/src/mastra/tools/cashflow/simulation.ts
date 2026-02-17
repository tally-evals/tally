import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, CashflowProfile } from './db';

// Re-using forecast logic for simulation
function getSimulatedLowestBalance(profile: CashflowProfile, days: number = 30): { balance: number; date: string } {
  let currentBalance = profile.currentBalance;
  
  // Start from the 1st of the current month
  const today = new Date('2024-05-01T00:00:00Z');
  
  let lowestBalance = currentBalance;
  let lowestDate = today.toISOString().split('T')[0]!;

  const incomeReceivedDates: string[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split('T')[0]!;
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();

    // --- PRIORITY 1: BILLS & SUBSCRIPTIONS ---
    for (const bill of profile.bills) {
      if (bill.dueDateRule === `monthly_day_${dayOfMonth}`) {
        currentBalance -= bill.amount;
      }
    }
    for (const sub of profile.subscriptions) {
      if (sub.status === 'active' && dayOfMonth === 1) {
        currentBalance -= sub.amount;
      }
    }

    // --- PRIORITY 2: INCOME ---
    let receivedIncomeThisDay = false;
    for (const income of profile.income) {
      if (income.schedule === `monthly_day_${dayOfMonth}`) {
        currentBalance += income.amount;
        receivedIncomeThisDay = true;
      }
      const daysMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      if (income.schedule.startsWith('weekly_')) {
        const dayName = income.schedule.split('_')[1];
        if (daysMap[dayName!] === dayOfWeek) {
          currentBalance += income.amount;
          receivedIncomeThisDay = true;
        }
      }
      if (income.schedule === 'bi_weekly') {
        const startRef = new Date('2024-05-15T00:00:00Z');
        const diffTime = date.getTime() - startRef.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays % 14 === 0) {
          currentBalance += income.amount;
          receivedIncomeThisDay = true;
        }
      }
    }

    if (receivedIncomeThisDay) {
      incomeReceivedDates.push(dateString);
    }

    // --- PRIORITY 3: BUDGETS ---
    for (const budget of profile.budgets) {
      if (budget.name.toLowerCase() === 'groceries') {
        const isFirstIncomeDay = receivedIncomeThisDay && incomeReceivedDates.length === 1;
        if (isFirstIncomeDay) {
          currentBalance -= budget.amount;
        }
      } else {
        if (budget.frequency === 'weekly' && dayOfWeek === 1) currentBalance -= budget.amount;
        else if (budget.frequency === 'monthly' && dayOfMonth === 1) {
          currentBalance -= budget.amount;
        }
      }
    }

    if (currentBalance < lowestBalance) {
      lowestBalance = currentBalance;
      lowestDate = dateString;
    }
  }
  return { balance: lowestBalance, date: lowestDate };
}

export const checkAffordabilityTool = createTool({
  id: 'check-affordability',
  description: 'Check if a purchase is affordable without hitting the safety buffer. Can simulate purchase at a specific date.',
  inputSchema: z.object({
    amount: z.number(),
    description: z.string().optional(),
    purchaseDate: z.string().optional().describe('ISO date string (YYYY-MM-DD) for when the purchase occurs. Defaults to today.'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const purchaseDate = context.purchaseDate || '2024-05-01'; // Default to start of simulation for consistency
    
    // Original forecast without purchase
    const originalLowest = getSimulatedLowestBalance(profile);
    
    // Simulate purchase by creating a custom profile that includes the purchase as a one-time bill on the purchaseDate
    const simulatedProfile = JSON.parse(JSON.stringify(profile)) as CashflowProfile;
    
    // Add the purchase as a one-time "bill" in the simulation logic
    // We modify getSimulatedLowestBalance slightly or handle it here by adjusting the starting balance 
    // IF the purchase is today, or by adding it to the loop logic.
    // Given the current getSimulatedLowestBalance structure, the easiest way to support a "future" purchase 
    // without changing the core loop is to pass the purchase details to it.
    
    const getSimulatedLowestWithPurchase = (p: CashflowProfile, pAmount: number, pDate: string) => {
      let currentBalance = p.currentBalance;
      const today = new Date('2024-05-01T00:00:00Z');
      const pDateObj = new Date(`${pDate}T00:00:00Z`);
      
      let lowestBalance = currentBalance;
      let lowestDate = today.toISOString().split('T')[0]!;
      const incomeReceivedDates: string[] = [];

      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0]!;
        const dayOfMonth = date.getDate();
        const dayOfWeek = date.getDay();

        // Apply purchase if it's this day
        if (dateString === pDate) {
          currentBalance -= pAmount;
        }

        // --- PRIORITY 1: BILLS & SUBSCRIPTIONS ---
        for (const bill of p.bills) {
          if (bill.dueDateRule === `monthly_day_${dayOfMonth}`) {
            currentBalance -= bill.amount;
          }
        }
        for (const sub of p.subscriptions) {
          if (sub.status === 'active' && dayOfMonth === 1) {
            currentBalance -= sub.amount;
          }
        }

        // --- PRIORITY 2: INCOME ---
        let receivedIncomeThisDay = false;
        for (const income of p.income) {
          if (income.schedule === `monthly_day_${dayOfMonth}`) {
            currentBalance += income.amount;
            receivedIncomeThisDay = true;
          }
          // ... weekly/bi-weekly logic ...
          const daysMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
          if (income.schedule.startsWith('weekly_')) {
            const dayName = income.schedule.split('_')[1];
            if (daysMap[dayName!] === dayOfWeek) {
              currentBalance += income.amount;
              receivedIncomeThisDay = true;
            }
          }
          if (income.schedule === 'bi_weekly') {
            const startRef = new Date('2024-05-15T00:00:00Z');
            const diffTime = date.getTime() - startRef.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % 14 === 0) {
              currentBalance += income.amount;
              receivedIncomeThisDay = true;
            }
          }
        }

        if (receivedIncomeThisDay) incomeReceivedDates.push(dateString);

        // --- PRIORITY 3: BUDGETS ---
        for (const budget of p.budgets) {
          if (budget.name.toLowerCase() === 'groceries') {
            if (receivedIncomeThisDay && incomeReceivedDates.length === 1) currentBalance -= budget.amount;
          } else {
            if (budget.frequency === 'weekly' && dayOfWeek === 1) currentBalance -= budget.amount;
            else if (budget.frequency === 'monthly' && dayOfMonth === 1) currentBalance -= budget.amount;
          }
        }

        // --- PRIORITY 4: PLANNED ACTIVITIES ---
        if (dayOfMonth === 1 && p.activities) {
          const planned = p.activities.filter(act => act.status === 'planned');
          if (planned.length > 0) {
            currentBalance -= planned.reduce((sum, act) => sum + act.cost, 0);
          }
        }

        if (currentBalance < lowestBalance) {
          lowestBalance = currentBalance;
          lowestDate = dateString;
        }
      }
      return { balance: lowestBalance, date: lowestDate, endingBalance: currentBalance };
    };

    const simulatedResult = getSimulatedLowestWithPurchase(profile, context.amount, purchaseDate);
    const hitsBuffer = simulatedResult.balance < profile.safetyBuffer;
    const bufferDifference = simulatedResult.balance - profile.safetyBuffer;

    return {
      affordable: !hitsBuffer,
      purchaseDate,
      originalLowest: originalLowest.balance,
      simulatedLowest: simulatedResult.balance,
      lowestDate: simulatedResult.date,
      endingBalance: simulatedResult.endingBalance,
      safetyBuffer: profile.safetyBuffer,
      bufferDifference,
      message: hitsBuffer 
        ? `If you buy this for ${context.amount.toLocaleString()} on ${purchaseDate}, your balance would drop to ${simulatedResult.balance.toLocaleString()} on ${simulatedResult.date}, which is below your ${profile.safetyBuffer.toLocaleString()} buffer.`
        : `Yes, you can afford this if purchased on ${purchaseDate}. Your lowest projected balance would be ${simulatedResult.balance.toLocaleString()} and your ending balance would be ${simulatedResult.endingBalance.toLocaleString()}.`,
    };
  },
});

export const calculateAffordabilityFrequencyTool = createTool({
  id: 'calculate-affordability-frequency',
  description: 'Calculate how many times the user can afford a recurring expense (like dining out, sports club visits) based on their available balance above the safety buffer',
  inputSchema: z.object({
    costPerVisit: z.number().describe('Cost per visit/activity'),
    activityName: z.string().describe('Name of the activity (e.g., "dining out", "sports club")'),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const originalForecast = getSimulatedLowestBalance(profile, 30);
    
    // Available balance is the lowest balance minus safety buffer
    // This represents how much "extra" money they have beyond their safety buffer
    const availableBalance = originalForecast.balance - profile.safetyBuffer;
    
    // Calculate how many times they can afford it
    // We use Math.floor to ensure we don't exceed the available balance
    const maxAffordableTimes = Math.floor(availableBalance / context.costPerVisit);
    const totalCost = maxAffordableTimes * context.costPerVisit;
    
    // Simulate adding the activities to see the actual impact on lowest balance
    // We subtract the total cost from the starting balance to simulate the activities
    const simulatedProfile = { 
      ...profile, 
      currentBalance: profile.currentBalance - totalCost 
    };
    const simulatedForecast = getSimulatedLowestBalance(simulatedProfile, 30);
    const remainingAfterActivities = simulatedForecast.balance - profile.safetyBuffer;

    // Create calculation breakdown for user-friendly explanation
    const calculationSteps = [
      `Lowest projected balance: ${originalForecast.balance.toLocaleString()}`,
      `Safety buffer: ${profile.safetyBuffer.toLocaleString()}`,
      `Available for activities: ${originalForecast.balance.toLocaleString()} - ${profile.safetyBuffer.toLocaleString()} = ${availableBalance.toLocaleString()}`,
      `Cost per ${context.activityName}: ${context.costPerVisit.toLocaleString()}`,
      `Number of times: ${availableBalance.toLocaleString()} ÷ ${context.costPerVisit.toLocaleString()} = ${Math.max(0, maxAffordableTimes)} times`,
    ];

    return {
      activityName: context.activityName,
      costPerVisit: context.costPerVisit,
      originalLowestProjectedBalance: originalForecast.balance,
      lowestProjectedBalance: simulatedForecast.balance,
      lowestBalanceDate: simulatedForecast.date,
      safetyBuffer: profile.safetyBuffer,
      availableBalance,
      maxAffordableTimes: Math.max(0, maxAffordableTimes),
      totalCostIfMaxUsed: totalCost,
      remainingBalanceAfterMax: remainingAfterActivities,
      calculationSteps, // Add this for the agent to show step-by-step
      message: maxAffordableTimes > 0
        ? `You can afford ${maxAffordableTimes} ${context.activityName} visit(s) (${context.costPerVisit} each). After these activities, your lowest projected balance would be ${simulatedForecast.balance} on ${simulatedForecast.date}, which is ${remainingAfterActivities >= 0 ? 'above' : 'below'} your safety buffer of ${profile.safetyBuffer}.`
        : `You cannot afford any ${context.activityName} visits. Your available balance (${availableBalance}) is below the cost per visit (${context.costPerVisit}).`,
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
      if (bill) {
        // Handle both "monthly_day_X" and just "X" as input
        const day = context.newValue.includes('monthly_day_') 
          ? context.newValue 
          : `monthly_day_${context.newValue}`;
        bill.dueDateRule = day;
      }
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

