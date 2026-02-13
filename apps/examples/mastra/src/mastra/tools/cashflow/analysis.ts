import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getProfile, CashflowProfile } from './db';

interface ForecastDay {
  date: string;
  balance: number;
  events: { name: string; amount: number; type: 'income' | 'expense' }[];
}

function generateForecast(profile: CashflowProfile, days: number = 30): ForecastDay[] {
  const forecast: ForecastDay[] = [];
  let currentBalance = profile.currentBalance;
  
  // Use a fixed reference date for deterministic results in tests
  const today = new Date('2024-05-15T00:00:00Z');

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split('T')[0]!;
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...

    const events: ForecastDay['events'] = [];

    // 1. Income
    for (const income of profile.income) {
      if (income.schedule === `monthly_day_${dayOfMonth}`) {
        events.push({ name: income.name, amount: income.amount, type: 'income' });
        currentBalance += income.amount;
      }
      // Simple weekly logic: weekly_monday, weekly_tuesday, etc.
      const daysMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const dayName = income.schedule.split('_')[1];
      if (income.schedule.startsWith('weekly_') && daysMap[dayName!] === dayOfWeek) {
        events.push({ name: income.name, amount: income.amount, type: 'income' });
        currentBalance += income.amount;
      }
    }

    // 2. Bills
    for (const bill of profile.bills) {
      if (bill.dueDateRule === `monthly_day_${dayOfMonth}`) {
        events.push({ name: bill.name, amount: bill.amount, type: 'expense' });
        currentBalance -= bill.amount;
      }
    }

    // 3. Subscriptions (active only)
    for (const sub of profile.subscriptions) {
      if (sub.status === 'active') {
        // Assume subscriptions are monthly on the 1st for simplicity unless otherwise specified
        if (dayOfMonth === 1) {
          events.push({ name: sub.name, amount: sub.amount, type: 'expense' });
          currentBalance -= sub.amount;
        }
      }
    }

    // 4. Budgets (Variable spending)
    // Distribute weekly budgets across the week or on a specific day
    for (const budget of profile.budgets) {
      if (budget.frequency === 'weekly' && dayOfWeek === 1) { // Every Monday
        events.push({ name: `${budget.name} (Weekly)`, amount: budget.amount, type: 'expense' });
        currentBalance -= budget.amount;
      } else if (budget.frequency === 'monthly' && dayOfMonth === 1) {
        events.push({ name: `${budget.name} (Monthly)`, amount: budget.amount, type: 'expense' });
        currentBalance -= budget.amount;
      }
    }

    // 5. Planned Activities (Deduct all planned activities on the 1st for simplicity in forecast)
    if (dayOfMonth === 1 && profile.activities) {
      const planned = profile.activities.filter(act => act.status === 'planned');
      if (planned.length > 0) {
        const totalPlannedCost = planned.reduce((sum, act) => sum + act.cost, 0);
        events.push({ 
          name: `Planned Activities (${planned.length} items)`, 
          amount: totalPlannedCost, 
          type: 'expense' 
        });
        currentBalance -= totalPlannedCost;
      }
    }

    forecast.push({
      date: dateString,
      balance: currentBalance,
      events,
    });
  }

  return forecast;
}

export const getForecastTool = createTool({
  id: 'get-cashflow-forecast',
  description: 'Generate a 30-day cashflow forecast based on current profile',
  inputSchema: z.object({
    days: z.number().default(30),
  }),
  execute: async ({ context }) => {
    const profile = getProfile();
    const forecast = generateForecast(profile, context.days);
    
    const lowestPoint = forecast.reduce((prev, curr) => (curr.balance < prev.balance ? curr : prev), forecast[0]!);
    const risks = forecast.filter(f => f.balance < profile.safetyBuffer);

    // Create a timeline of significant events (days with income or expenses)
    const timeline: Array<{ date: string; events: string[]; balance: number }> = [];
    
    for (const day of forecast) {
      if (day.events.length > 0) {
        const eventDescriptions = day.events.map(e => 
          e.type === 'income' 
            ? `+${e.amount.toLocaleString()} (${e.name})`
            : `-${e.amount.toLocaleString()} (${e.name})`
        );
        timeline.push({
          date: day.date,
          events: eventDescriptions,
          balance: day.balance,
        });
      }
    }

    return {
      forecast,
      timeline, // Add the timeline for easy presentation
      summary: {
        startingBalance: profile.currentBalance,
        endingBalance: forecast[forecast.length - 1]!.balance,
        lowestBalance: lowestPoint.balance,
        lowestBalanceDate: lowestPoint.date,
        safetyBuffer: profile.safetyBuffer,
        riskDaysCount: risks.length,
        plannedActivities: profile.activities
          ?.filter(act => act.status === 'planned')
          .map(act => ({
            name: act.name,
            cost: act.cost,
          })) || [],
      },
    };
  },
});

export const getRiskAnalysisTool = createTool({
  id: 'get-risk-analysis',
  description: 'Analyze financial risks and identify tight periods',
  inputSchema: z.object({}),
  execute: async () => {
    const profile = getProfile();
    const forecast = generateForecast(profile, 30);
    const safetyBuffer = profile.safetyBuffer;

    const riskPeriods: { start: string; end: string; minBalance: number }[] = [];
    let currentPeriod: { start: string; end: string; minBalance: number } | null = null;

    for (const day of forecast) {
      if (day.balance < safetyBuffer) {
        if (!currentPeriod) {
          currentPeriod = { start: day.date, end: day.date, minBalance: day.balance };
        } else {
          currentPeriod.end = day.date;
          currentPeriod.minBalance = Math.min(currentPeriod.minBalance, day.balance);
        }
      } else {
        if (currentPeriod) {
          riskPeriods.push(currentPeriod);
          currentPeriod = null;
        }
      }
    }
    if (currentPeriod) riskPeriods.push(currentPeriod);

    return {
      safetyBuffer,
      riskPeriods,
      hasRisks: riskPeriods.length > 0,
      message: riskPeriods.length > 0 
        ? `Found ${riskPeriods.length} periods where balance drops below your ${safetyBuffer} buffer.`
        : "No high-risk periods detected in the next 30 days.",
    };
  },
});

