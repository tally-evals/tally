import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import {
  cashPositions,
  recurringCashflows,
  futureCashflows,
  type CashPosition,
  type RecurringCashflow,
  type FutureCashflow,
  type CashPositionRow,
  type RecurringCashflowRow,
  type FutureCashflowRow,
} from './schema';
import { initSchema } from './migrate';

// Use :memory: for tests, file-based DB for dev/production
const DB_PATH = process.env.CASHFLOW_DB_PATH ?? './cashflow.db';

const sqlite = new Database(DB_PATH);
initSchema(sqlite);

const db = drizzle(sqlite);


export interface RecurringCashflowFilter {
  userId?: string;
  type?: RecurringCashflow['type'];
  status?: RecurringCashflow['status'];
}

// for future cashflows like investments, loans, etc. 
export interface FutureCashflowFilter {
  userId?: string;
  type?: FutureCashflow['type'];
  status?: FutureCashflow['status'];
}

// -----------------------------
// Cash Position
// -----------------------------

export async function getCashPosition(userId: string): Promise<CashPosition | null> {
  const rows = await db.select().from(cashPositions).where(eq(cashPositions.userId, userId)).limit(1);
  if (rows.length === 0) return null;
  const row: CashPositionRow = rows[0]!;
  return {
    userId: row.userId,
    currentBalance: row.currentBalance,
    updatedAt: row.updatedAt,
  };
}

export async function upsertCashPosition(position: CashPosition): Promise<CashPosition> {
  const existing = await db
    .select()
    .from(cashPositions)
    .where(eq(cashPositions.userId, position.userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(cashPositions).values({
      userId: position.userId,
      currentBalance: position.currentBalance,
      updatedAt: position.updatedAt,
    });
  } else {
    await db
      .update(cashPositions)
      .set({
        currentBalance: position.currentBalance,
        updatedAt: position.updatedAt,
      })
      .where(eq(cashPositions.userId, position.userId));
  }

  return position;
}

// -----------------------------
// Recurring Cashflows
// -----------------------------

// convert database row to recurring cashflow object 
const toRecurringCashflow = (row: RecurringCashflowRow): RecurringCashflow => {
  const base: RecurringCashflow = {
    id: row.id,
    userId: row.userId,
    type: row.type as RecurringCashflow['type'],
    amount: row.amount,
    frequency: row.frequency as RecurringCashflow['frequency'],
    startDate: row.startDate,
    status: row.status as RecurringCashflow['status'],
  };

  if (row.endDate !== null && row.endDate !== undefined) {
    base.endDate = row.endDate;
  }

  return base;
};

export async function listRecurringCashflows(
  filter: RecurringCashflowFilter = {},
): Promise<RecurringCashflow[]> {
  const rows = await db.select().from(recurringCashflows);

  return rows
    .map(toRecurringCashflow)
    .filter(
      (cf) =>
        (!filter.userId || cf.userId === filter.userId) &&
        (!filter.type || cf.type === filter.type) &&
        (!filter.status || cf.status === filter.status),
    );
}

export async function createRecurringCashflow(data: RecurringCashflow): Promise<RecurringCashflow> {
  await db.insert(recurringCashflows).values({
    id: data.id,
    userId: data.userId,
    type: data.type,
    amount: data.amount,
    frequency: data.frequency,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    status: data.status,
  });
  return data;
}

// -----------------------------
// Future Cashflows
// -----------------------------

// convert database row to future cashflow object  
const toFutureCashflow = (row: FutureCashflowRow): FutureCashflow => {
  const base: FutureCashflow = {
    id: row.id,
    userId: row.userId,
    type: row.type as FutureCashflow['type'],
    amount: row.amount,
    date: row.date,
    status: row.status as FutureCashflow['status'],
  };

  if (row.probability !== null && row.probability !== undefined) {
    base.probability = row.probability;
  }

  return base;
};

export async function listFutureCashflows(
  filter: FutureCashflowFilter = {},
): Promise<FutureCashflow[]> {
  const rows = await db.select().from(futureCashflows);

  return rows
    .map(toFutureCashflow)
    .filter(
      (cf) =>
        (!filter.userId || cf.userId === filter.userId) &&
        (!filter.type || cf.type === filter.type) &&
        (!filter.status || cf.status === filter.status),
    );
}

export async function createFutureCashflow(data: FutureCashflow): Promise<FutureCashflow> {
  await db.insert(futureCashflows).values({
    id: data.id,
    userId: data.userId,
    type: data.type,
    amount: data.amount,
    date: data.date,
    probability: data.probability ?? null,
    status: data.status,
  });
  return data;
}

