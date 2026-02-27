import { type RecurringCashflow } from './db/schema';
import { getCashPosition, listRecurringCashflows, listFutureCashflows } from './db/repository';

// -----------------------------
// Types
// -----------------------------

export interface ScenarioAdjustment {
  type: 'add_income' | 'add_expense';
  amount: number;
  date: string;
  description?: string | undefined;
}

// defines input for a projection run
export interface ProjectionRequest {
  userId: string;
  startDate: string;
  endDate: string;
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

// defines the output of a projection run (summarise the financial risk)
export interface ProjectionResult {
  timeline: ProjectionPoint[];
  lowestBalance: number;
  lowestBalanceDate: string;
  deficitDates: string[];
  runwayDays?: number;
}

// -----------------------------
// Helpers
// -----------------------------

// convert the date string to a Date object 
const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`);
// slice the date string to the format YYYY-MM-DD
const formatDate = (d: Date): string => d.toISOString().slice(0, 10);


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
const diffDays = (a: Date, b: Date): number =>
  Math.floor((b.getTime() - a.getTime()) / 86_400_000);

function occursOnDate(cf: RecurringCashflow, date: Date): boolean {
  if (cf.status !== 'active') return false;
  const start = toDate(cf.startDate);
  if (date < start) return false;
  if (cf.endDate && date > toDate(cf.endDate)) return false;

  const diff = diffDays(start, date);
  switch (cf.frequency) {
    case 'daily':    return true;
    case 'weekly':   return diff % 7 === 0;
    case 'biweekly': return diff % 14 === 0;
    case 'monthly':  return date.getUTCDate() === start.getUTCDate();
    case 'yearly':   return date.getUTCDate() === start.getUTCDate() && date.getUTCMonth() === start.getUTCMonth();
    default:         return false;
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
    { income: 0, expense: 0 },
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
  const { userId, startDate, endDate, safetyBuffer, scenarioAdjustments = [] } = request;

  //loads all data concurrently 
  const [cashPosition, recurring, future] = await Promise.all([
    getCashPosition(userId),
    listRecurringCashflows({ userId }),
    listFutureCashflows({ userId }),
  ]);

  const futureByDate = groupByDate(future.filter((f) => f.status === 'planned'));
  const adjustmentsByDate = groupByDate(scenarioAdjustments);

  let balance = cashPosition?.currentBalance ?? 0;
  let lowestBalance = balance;
  let lowestBalanceDate = startDate;
  const deficitDates: string[] = [];
  const timeline: ProjectionPoint[] = [];


  for (const date of eachDay(toDate(startDate), toDate(endDate))) {
    const dateStr = formatDate(date);

    //we filter just the income, the rest of the things are counted as expenses 
    const fromRecurring = sumAmounts(recurring.filter((cf) => occursOnDate(cf, date)), 'income');
    const fromFuture = sumAmounts(futureByDate.get(dateStr) ?? [], 'income');
    const fromAdjustments = sumAmounts(adjustmentsByDate.get(dateStr) ?? [], 'add_income');

    const income = fromRecurring.income + fromFuture.income + fromAdjustments.income;
    const expense = fromRecurring.expense + fromFuture.expense + fromAdjustments.expense;

    balance += income - expense;

    if (balance < lowestBalance){
        lowestBalance = balance; 
        lowestBalanceDate = dateStr; 
      }
    if (balance < 0) deficitDates.push(dateStr);

    /* 
    makes an object like this: { date: '2026-01-01', balance: 1000, income: 1000, expense: 0 }
    if balance < 0 = deficit, if balance >= 0 but below safety buffer = tight, if balance >= safety buffer = safe
    */
    const point: ProjectionPoint = { date: dateStr, balance, income, expense };
    const risk = riskLevel(balance, safetyBuffer);
    if (risk !== undefined) point.riskLevel = risk;

    timeline.push(point);
  }
/*
time line is an array of objects like this: { date: '2026-01-01', balance: 1000, income: 1000, expense: 0 }
findIndex returns the index of the first item where balance < 0.

if there's no deficit, then firstDeficit is -1 and runwayDays is undefined
if there's a deficit, then firstDeficit is the index of the first deficit and runwayDays is the number of days until the first deficit
*/
  const firstDeficit = timeline.findIndex((p) => p.balance < 0);
  // if there is a deficit, we calculate the runway days (number of days until the first deficit)
  const result: ProjectionResult = { timeline, lowestBalance, lowestBalanceDate, deficitDates };
  // if there is a deficit, we add the runway days to the result
  if (firstDeficit >= 0) result.runwayDays = firstDeficit;

  return result;
}
