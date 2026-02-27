import { sqliteTable, real, text } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// -----------------------------
// Domain Models (new spec)
// -----------------------------

export interface User {
  id: string;
  name: string;
  baseCurrency: string;
}

export interface CashPosition {
  userId: string;
  currentBalance: number;
  updatedAt: string;
}

export type CashflowType = 'income' | 'expense';

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurringCashflow {
  id: string;
  userId: string;
  type: CashflowType;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  status: 'active' | 'paused';
}

export interface FutureCashflow {
  id: string;
  userId: string;
  type: CashflowType;
  amount: number;
  date: string;
  probability?: number;
  status: 'planned' | 'cancelled';
}

// -----------------------------
// SQLite Tables (Drizzle ORM)
// -----------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull(),
});

export type UserRow = InferSelectModel<typeof users>;
export type NewUserRow = InferInsertModel<typeof users>;

export const cashPositions = sqliteTable('cash_positions', {
  userId: text('user_id').primaryKey(),
  currentBalance: real('current_balance').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type CashPositionRow = InferSelectModel<typeof cashPositions>;
export type NewCashPositionRow = InferInsertModel<typeof cashPositions>;

export const recurringCashflows = sqliteTable('recurring_cashflows', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  amount: real('amount').notNull(),
  frequency: text('frequency').notNull(), // Frequency
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull(), // 'active' | 'paused'
});

export type RecurringCashflowRow = InferSelectModel<typeof recurringCashflows>;
export type NewRecurringCashflowRow = InferInsertModel<typeof recurringCashflows>;

export const futureCashflows = sqliteTable('future_cashflows', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  probability: real('probability'),
  status: text('status').notNull(), // 'planned' | 'cancelled'
});

export type FutureCashflowRow = InferSelectModel<typeof futureCashflows>;
export type NewFutureCashflowRow = InferInsertModel<typeof futureCashflows>;

