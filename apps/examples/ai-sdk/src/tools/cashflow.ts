/**
 * Cashflow Tools (Example - AI SDK)
 */

import { tool } from 'ai';
import { z } from 'zod';

type Frequency = 'daily' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'yearly';
type CashflowType = 'income' | 'expense';

export interface CashPosition {
  userId: string;
  currentBalance: number;
  updatedAt: string;
}

export interface RecurringCashflow {
  id: string;
  userId: string;
  type: CashflowType;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  description?: string;
  status: 'active' | 'paused';
}

export interface FutureCashflow {
  id: string;
  userId: string;
  type: CashflowType;
  amount: number;
  date: string;
  description?: string;
  probability?: number;
  status: 'planned' | 'cancelled';
}

export interface ScenarioAdjustment {
  type: 'add_income' | 'add_expense';
  amount: number;
  date: string;
  description?: string;
}

export interface ProjectionPoint {
  date: string;
  balance: number;
  income: number;
  expense: number;
  riskLevel: 'safe' | 'tight' | 'deficit';
}

export interface MonthlyProjectionSummary {
  month: string;
  startingBalance: number;
  endingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  lowestBalance: number;
  lowestBalanceDate: string;
  deficitDates: string[];
  safetyBufferBreached: boolean;
}

export interface ProjectionResult {
  timeline: ProjectionPoint[];
  monthlySummaries: MonthlyProjectionSummary[];
  lowestBalance: number;
  lowestBalanceDate: string;
  deficitDates: string[];
  runwayDays?: number;
  totalIncome: number;
  totalExpense: number;
}

interface UserCashflowState {
  cashPosition?: CashPosition;
  recurring: RecurringCashflow[];
  future: FutureCashflow[];
}

const store = new Map<string, UserCashflowState>();
let recurringCounter = 0;
let futureCounter = 0;

function getOrCreateState(userId: string): UserCashflowState {
  const existing = store.get(userId);
  if (existing) {
    return existing;
  }
  const initial: UserCashflowState = {
    recurring: [],
    future: [],
  };
  store.set(userId, initial);
  return initial;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function isInRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function eventDatesForRecurring(recurring: RecurringCashflow, start: Date, end: Date): string[] {
  const from = new Date(recurring.startDate);
  const until = recurring.endDate ? new Date(recurring.endDate) : end;
  const effectiveEnd = until.getTime() < end.getTime() ? until : end;

  if (effectiveEnd.getTime() < start.getTime()) return [];
  const cursorStart = from.getTime() > start.getTime() ? from : start;

  const dates: string[] = [];
  let cursor = new Date(cursorStart);

  if (recurring.frequency === 'daily') {
    while (cursor.getTime() <= effectiveEnd.getTime()) {
      if (cursor.getTime() >= from.getTime()) {
        dates.push(toIsoDate(cursor));
      }
      cursor = addDays(cursor, 1);
    }
    return dates;
  }

  if (recurring.frequency === 'weekly' || recurring.frequency === 'biweekly') {
    const step = recurring.frequency === 'weekly' ? 7 : 14;
    let first = new Date(from);
    while (first.getTime() < cursorStart.getTime()) {
      first = addDays(first, step);
    }
    while (first.getTime() <= effectiveEnd.getTime()) {
      dates.push(toIsoDate(first));
      first = addDays(first, step);
    }
    return dates;
  }

  if (recurring.frequency === 'monthly' || recurring.frequency === 'semimonthly') {
    const startDay = from.getUTCDate();
    let monthCursor = new Date(
      Date.UTC(cursorStart.getUTCFullYear(), cursorStart.getUTCMonth(), 1)
    );

    while (monthCursor.getTime() <= effectiveEnd.getTime()) {
      const y = monthCursor.getUTCFullYear();
      const m = monthCursor.getUTCMonth();

      const primary = new Date(Date.UTC(y, m, Math.min(startDay, 28)));
      if (isInRange(primary, cursorStart, effectiveEnd) && primary.getTime() >= from.getTime()) {
        dates.push(toIsoDate(primary));
      }

      if (recurring.frequency === 'semimonthly') {
        const secondary = new Date(Date.UTC(y, m, 15));
        if (
          isInRange(secondary, cursorStart, effectiveEnd) &&
          secondary.getTime() >= from.getTime()
        ) {
          dates.push(toIsoDate(secondary));
        }
      }

      monthCursor = addMonths(monthCursor, 1);
    }
    return dates;
  }

  if (recurring.frequency === 'yearly') {
    let yearCursor = new Date(from);
    while (yearCursor.getTime() < cursorStart.getTime()) {
      yearCursor = addMonths(yearCursor, 12);
    }
    while (yearCursor.getTime() <= effectiveEnd.getTime()) {
      dates.push(toIsoDate(yearCursor));
      yearCursor = addMonths(yearCursor, 12);
    }
    return dates;
  }

  return dates;
}

function buildProjection(
  userId: string,
  startDate: string,
  endDate: string,
  safetyBuffer = 0,
  scenarioAdjustments: ScenarioAdjustment[] = []
): ProjectionResult {
  const state = getOrCreateState(userId);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const position = state.cashPosition;
  let balance = position?.currentBalance ?? 0;

  const incomeEvents = new Map<string, number>();
  const expenseEvents = new Map<string, number>();

  for (const recurring of state.recurring) {
    if (recurring.status !== 'active') continue;
    const dates = eventDatesForRecurring(recurring, start, end);
    for (const d of dates) {
      const map = recurring.type === 'income' ? incomeEvents : expenseEvents;
      map.set(d, (map.get(d) ?? 0) + recurring.amount);
    }
  }

  for (const future of state.future) {
    if (future.status !== 'planned') continue;
    const d = future.date;
    if (!isInRange(new Date(d), start, end)) continue;
    const map = future.type === 'income' ? incomeEvents : expenseEvents;
    map.set(d, (map.get(d) ?? 0) + future.amount);
  }

  for (const adjustment of scenarioAdjustments) {
    const d = adjustment.date;
    if (!isInRange(new Date(d), start, end)) continue;
    if (adjustment.type === 'add_income') {
      incomeEvents.set(d, (incomeEvents.get(d) ?? 0) + adjustment.amount);
    } else {
      expenseEvents.set(d, (expenseEvents.get(d) ?? 0) + adjustment.amount);
    }
  }

  const timeline: ProjectionPoint[] = [];
  const deficitDates: string[] = [];
  let totalIncome = 0;
  let totalExpense = 0;
  let lowestBalance = balance;
  let lowestBalanceDate = toIsoDate(start);

  let day = new Date(start);
  while (day.getTime() <= end.getTime()) {
    const key = toIsoDate(day);
    const income = incomeEvents.get(key) ?? 0;
    const expense = expenseEvents.get(key) ?? 0;
    balance = balance + income - expense;
    totalIncome += income;
    totalExpense += expense;

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceDate = key;
    }

    if (balance < 0) {
      deficitDates.push(key);
    }

    const riskLevel = balance < 0 ? 'deficit' : balance <= safetyBuffer ? 'tight' : 'safe';

    timeline.push({
      date: key,
      balance,
      income,
      expense,
      riskLevel,
    });

    day = addDays(day, 1);
  }

  const monthlyByKey = new Map<string, ProjectionPoint[]>();
  for (const point of timeline) {
    const monthKey = point.date.slice(0, 7);
    const bucket = monthlyByKey.get(monthKey) ?? [];
    bucket.push(point);
    monthlyByKey.set(monthKey, bucket);
  }

  const monthlySummaries: MonthlyProjectionSummary[] = [];
  for (const [month, points] of monthlyByKey) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) continue;

    const monthIncome = points.reduce((sum, p) => sum + p.income, 0);
    const monthExpense = points.reduce((sum, p) => sum + p.expense, 0);

    let monthLowest = first.balance;
    let monthLowestDate = first.date;
    const monthDeficits: string[] = [];
    let breached = false;

    for (const p of points) {
      if (p.balance < monthLowest) {
        monthLowest = p.balance;
        monthLowestDate = p.date;
      }
      if (p.balance < 0) monthDeficits.push(p.date);
      if (p.balance <= safetyBuffer) breached = true;
    }

    monthlySummaries.push({
      month,
      startingBalance: first.balance - first.income + first.expense,
      endingBalance: last.balance,
      totalIncome: monthIncome,
      totalExpense: monthExpense,
      netCashflow: monthIncome - monthExpense,
      lowestBalance: monthLowest,
      lowestBalanceDate: monthLowestDate,
      deficitDates: monthDeficits,
      safetyBufferBreached: breached,
    });
  }

  const firstDeficit = timeline.find((p) => p.balance < 0);
  const runwayDays = firstDeficit
    ? Math.max(
        0,
        Math.floor(
          (new Date(firstDeficit.date).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : undefined;

  return {
    timeline,
    monthlySummaries,
    lowestBalance,
    lowestBalanceDate,
    deficitDates,
    runwayDays,
    totalIncome,
    totalExpense,
  };
}

function toSerializable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

interface UpdateCashPositionInput {
  userId: string;
  currentBalance: number;
}

interface CreateRecurringInput {
  userId: string;
  type: CashflowType;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  description?: string;
}

interface CreateFutureCashflowInput {
  userId: string;
  type: CashflowType;
  amount: number;
  date: string;
  description?: string;
  probability?: number;
}

interface RunProjectionInput {
  userId: string;
  startDate: string;
  endDate: string;
  safetyBuffer?: number;
  scenarioAdjustments?: ScenarioAdjustment[];
}

interface RunProjectionOutput {
  timeline: ProjectionPoint[];
  monthlySummaries: MonthlyProjectionSummary[];
  lowestBalance: number;
  lowestBalanceDate: string;
  deficitDates: string[];
  runwayDays?: number;
  totalIncome: number;
  totalExpense: number;
  message: string;
}

const updateCashPositionInputSchema: z.ZodType<UpdateCashPositionInput> = z.object({
  userId: z.string(),
  currentBalance: z.number(),
});

const createRecurringInputSchema: z.ZodType<CreateRecurringInput> = z.object({
  userId: z.string(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'yearly']),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

const createFutureCashflowInputSchema: z.ZodType<CreateFutureCashflowInput> = z.object({
  userId: z.string(),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().optional(),
  probability: z.number().min(0).max(1).optional(),
});

const runProjectionInputSchema: z.ZodType<RunProjectionInput> = z.object({
  userId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  safetyBuffer: z.number().min(0).optional(),
  scenarioAdjustments: z
    .array(
      z.object({
        type: z.enum(['add_income', 'add_expense']),
        amount: z.number().positive(),
        date: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

function runProjectionFromInput(input: RunProjectionInput): ProjectionResult {
  const safetyBuffer = input.safetyBuffer ?? 0;
  const scenarioAdjustments: ScenarioAdjustment[] = input.scenarioAdjustments ?? [];

  return buildProjection(
    input.userId,
    input.startDate,
    input.endDate,
    safetyBuffer,
    scenarioAdjustments
  );
}

type ToolEntry = ReturnType<typeof tool>;

export const cashflowTools: Record<string, ToolEntry> = {
  updateCashPosition: tool({
    description: 'Set or update current account balance for a user',
    inputSchema: updateCashPositionInputSchema,
    execute: async ({ userId, currentBalance }) => {
      const state = getOrCreateState(userId);
      state.cashPosition = {
        userId,
        currentBalance,
        updatedAt: new Date().toISOString(),
      };

      return toSerializable({
        cashPosition: state.cashPosition,
        message: `Cash position updated for ${userId}. Current balance: ${currentBalance}.`,
      });
    },
  }),

  createRecurring: tool({
    description: 'Create a recurring income or expense entry',
    inputSchema: createRecurringInputSchema,
    execute: async ({
      userId,
      type,
      amount,
      frequency,
      startDate,
      endDate,
      description,
    }) => {
      const state = getOrCreateState(userId);
      const recurring: RecurringCashflow = {
        id: `rec-${++recurringCounter}`,
        userId,
        type,
        amount,
        frequency,
        startDate,
        endDate,
        description,
        status: 'active',
      };
      state.recurring.push(recurring);

      return toSerializable({
        recurring,
        totalRecurring: state.recurring.length,
        message: `Recurring ${type} created: ${amount} (${frequency}).`,
      });
    },
  }),

  createFutureCashflow: tool({
    description: 'Create a one-time future income or expense',
    inputSchema: createFutureCashflowInputSchema,
    execute: async ({ userId, type, amount, date, description, probability }) => {
      const state = getOrCreateState(userId);
      const future: FutureCashflow = {
        id: `fut-${++futureCounter}`,
        userId,
        type,
        amount,
        date,
        description,
        probability,
        status: 'planned',
      };
      state.future.push(future);

      return toSerializable({
        future,
        totalFuture: state.future.length,
        message: `Future ${type} created: ${amount} on ${date}.`,
      });
    },
  }),

  runProjection: tool({
    description: 'Run cashflow projection for a date range',
    inputSchema: runProjectionInputSchema,
    execute: async (input: RunProjectionInput) => {
      const { startDate, endDate } = input;
      const projection = runProjectionFromInput(input);
      const output: RunProjectionOutput = {
        timeline: projection.timeline,
        monthlySummaries: projection.monthlySummaries,
        lowestBalance: projection.lowestBalance,
        lowestBalanceDate: projection.lowestBalanceDate,
        deficitDates: projection.deficitDates,
        runwayDays: projection.runwayDays,
        totalIncome: projection.totalIncome,
        totalExpense: projection.totalExpense,
        message: `Projection generated from ${startDate} to ${endDate}. Lowest balance: ${projection.lowestBalance} on ${projection.lowestBalanceDate}.`,
      };

      return toSerializable(output);
    },
  }),
};
