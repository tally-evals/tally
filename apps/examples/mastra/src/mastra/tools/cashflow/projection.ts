import type { CashPosition, FutureCashflow, RecurringCashflow, ScenarioAdjustment } from '~/schemas/cashflow';

// -----------------------------
// Types
// -----------------------------

// defines input for a projection run
export interface ProjectionRequest {
  userId: string;
  startDate: string;
  endDate: string;
  cashPosition?: CashPosition | undefined;
  recurringCashflows?: Record<string, RecurringCashflow> | undefined;
  futureCashflows?: Record<string, FutureCashflow> | undefined;
  safetyBuffer?: number | undefined;
  scenarioAdjustments?: ScenarioAdjustment[] | undefined;
}
// defines a single point in the projection timeline (basically a day, what does my money looks like on this specific day)
export interface ProjectionPoint {
  date: string;
  balance: number;
  income: number;
  expense: number;
  riskLevel?: 'safe' | 'tight' | 'deficit';
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

// defines the output of a projection run (summarise the financial risk)
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

// -----------------------------
// Helpers
// -----------------------------

// convert the date string to a Date object
const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`);
// slice the date string to the format YYYY-MM-DD
const formatDate = (d: Date): string => d.toISOString().slice(0, 10);
const formatMonth = (d: Date): string => d.toISOString().slice(0, 7);

// Projection is simulated day-by-day, so we need to generate a list of dates between the start and end date.
function* eachDay(start: Date, end: Date): Generator<Date> {
  const cur = new Date(start);
  while (cur <= end) {
    yield new Date(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}
// Calculate the number of days between two dates. This is used to determine if a recurring cashflow occurs on a given date.
// Used for weekly, biweekly, monthly, and yearly recurring cashflows. (takes the time differnce in milliseconds and converts it to days)
const diffDays = (a: Date, b: Date): number => Math.floor((b.getTime() - a.getTime()) / 86_400_000);

function occursOnDate(cf: RecurringCashflow, date: Date): boolean {
  if (cf.status !== 'active') return false;
  const start = toDate(cf.startDate);
  if (date < start) return false;
  if (cf.endDate && date > toDate(cf.endDate)) return false;

  const diff = diffDays(start, date);
  switch (cf.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return diff % 7 === 0;
    case 'biweekly':
      return diff % 14 === 0;
    case 'semimonthly': {
      const day = date.getUTCDate();
      const startDay = start.getUTCDate();
      if (startDay === 1) return day === 1 || day === 15;
      if (startDay === 15) {
        const lastDay = new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getDate();
        return day === 15 || day === lastDay;
      }
      return (
        day === startDay || day === (startDay + 15) % 30 || (startDay > 15 && day === startDay - 15)
      );
    }
    case 'monthly':
      return date.getUTCDate() === start.getUTCDate();
    case 'yearly':
      return date.getUTCDate() === start.getUTCDate() && date.getUTCMonth() === start.getUTCMonth();
    default:
      return false;
  }
}

/*
converts a list of items to a map of items by date. This is used to group recurring cashflows and scenario adjustments by date.
*/
const groupByDate = <T extends { date: string }>(items: T[]): Map<string, T[]> =>
  items.reduce((map, item) => {
    map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, new Map<string, T[]>());

// sums the amounts of a list of items by type. This is used to calculate the total income and expense for a given date.
const sumAmounts = (items: { type: string; amount: number }[], incomeKey: string) =>
  items.reduce(
    (acc, item) => {
      if (item.type === incomeKey) acc.income += item.amount;
      else acc.expense += item.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

const riskLevel = (balance: number, safetyBuffer?: number): ProjectionPoint['riskLevel'] => {
  if (balance < 0) return 'deficit';
  if (safetyBuffer !== undefined) return balance < safetyBuffer ? 'tight' : 'safe';
  return undefined;
};

// -----------------------------
// Projection engine
// -----------------------------

export async function runProjection(request: ProjectionRequest): Promise<ProjectionResult> {
  const {
    userId,
    startDate,
    endDate,
    cashPosition,
    recurringCashflows = {},
    futureCashflows = {},
    safetyBuffer,
    scenarioAdjustments = [],
  } = request;

  const recurring = Object.values(recurringCashflows).filter((cf) => cf.userId === userId);
  const future = Object.values(futureCashflows).filter((cf) => cf.userId === userId);

  const futureByDate = groupByDate(future.filter((f) => f.status === 'planned'));
  const adjustmentsByDate = groupByDate(scenarioAdjustments);

  let balance = cashPosition?.currentBalance ?? 0;
  let lowestBalance = balance;
  let lowestBalanceDate = startDate;
  let totalIncome = 0;
  let totalExpense = 0;
  const deficitDates: string[] = [];
  const timeline: ProjectionPoint[] = [];
  const monthlySummaries: MonthlyProjectionSummary[] = [];
  let currentMonthSummary: MonthlyProjectionSummary | null = null;

  for (const date of eachDay(toDate(startDate), toDate(endDate))) {
    const dateStr = formatDate(date);
    const monthKey = formatMonth(date);

    if (currentMonthSummary === null || currentMonthSummary.month !== monthKey) {
      if (currentMonthSummary !== null) {
        currentMonthSummary.netCashflow =
          currentMonthSummary.totalIncome - currentMonthSummary.totalExpense;
        monthlySummaries.push(currentMonthSummary);
      }

      currentMonthSummary = {
        month: monthKey,
        startingBalance: balance,
        endingBalance: balance,
        totalIncome: 0,
        totalExpense: 0,
        netCashflow: 0,
        lowestBalance: balance,
        lowestBalanceDate: dateStr,
        deficitDates: [],
        safetyBufferBreached: safetyBuffer !== undefined ? balance < safetyBuffer : false,
      };
    }

    const fromRecurring = sumAmounts(
      recurring.filter((cf) => occursOnDate(cf, date)),
      'income'
    );
    const fromFuture = sumAmounts(futureByDate.get(dateStr) ?? [], 'income');
    const fromAdjustments = sumAmounts(adjustmentsByDate.get(dateStr) ?? [], 'add_income');

    const income = fromRecurring.income + fromFuture.income + fromAdjustments.income;
    const expense = fromRecurring.expense + fromFuture.expense + fromAdjustments.expense;

    totalIncome += income;
    totalExpense += expense;
    currentMonthSummary.totalIncome += income;
    currentMonthSummary.totalExpense += expense;

    balance += income - expense;
    currentMonthSummary.endingBalance = balance;

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceDate = dateStr;
    }
    if (balance < currentMonthSummary.lowestBalance) {
      currentMonthSummary.lowestBalance = balance;
      currentMonthSummary.lowestBalanceDate = dateStr;
    }
    if (balance < 0) deficitDates.push(dateStr);
    if (balance < 0) currentMonthSummary.deficitDates.push(dateStr);
    if (safetyBuffer !== undefined && balance < safetyBuffer) {
      currentMonthSummary.safetyBufferBreached = true;
    }

    /* 
    makes an object like this: { date: '2026-01-01', balance: 1000, income: 1000, expense: 0 }
    if balance < 0 = deficit, if balance >= 0 but below safety buffer = tight, if balance >= safety buffer = safe
    */
    const point: ProjectionPoint = { date: dateStr, balance, income, expense };
    const risk = riskLevel(balance, safetyBuffer);
    if (risk !== undefined) point.riskLevel = risk;

    timeline.push(point);
  }

  if (currentMonthSummary !== null) {
    currentMonthSummary.netCashflow =
      currentMonthSummary.totalIncome - currentMonthSummary.totalExpense;
    monthlySummaries.push(currentMonthSummary);
  }
  /*
time line is an array of objects like this: { date: '2026-01-01', balance: 1000, income: 1000, expense: 0 }
findIndex returns the index of the first item where balance < 0.

if there's no deficit, then firstDeficit is -1 and runwayDays is undefined
if there's a deficit, then firstDeficit is the index of the first deficit and runwayDays is the number of days until the first deficit
*/
  const firstDeficit = timeline.findIndex((p) => p.balance < 0);
  // if there is a deficit, we calculate the runway days (number of days until the first deficit)
  const result: ProjectionResult = {
    timeline,
    monthlySummaries,
    lowestBalance,
    lowestBalanceDate,
    deficitDates,
    totalIncome,
    totalExpense,
  };
  // if there is a deficit, we add the runway days to the result
  if (firstDeficit >= 0) result.runwayDays = firstDeficit;

  return result;
}
