import { differenceInCalendarMonths, parseISO } from 'date-fns';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { goalEntries, goals, type Goal } from '@/db/schema';
import { getAccount } from '@/features/accounts/repository';
import { nowTimestamp, todayISO, type ISODate } from '@/lib/dates';

export const GOAL_TABLES = ['goals', 'goal_entries', 'accounts', 'transactions'];

export type GoalInput = {
  name: string;
  targetCents: number;
  targetDate?: ISODate | null;
  color: string;
  icon: string;
  /** Vinculada a uma conta (ex.: poupança da reserva): o progresso é o saldo dela. */
  accountId?: string | null;
};

export type GoalProgress = Goal & {
  savedCents: number;
  ratio: number;
  remainingCents: number;
  /** Quanto guardar por mês para chegar na data (null sem data ou já concluída). */
  monthlyNeededCents: number | null;
  monthsLeft: number | null;
  done: boolean;
  accountName: string | null;
};

function clean(input: GoalInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome para a meta.');
  if (!Number.isInteger(input.targetCents) || input.targetCents <= 0)
    throw new Error('O valor da meta precisa ser maior que zero.');
  return {
    ...input,
    name,
    targetDate: input.targetDate || null,
    accountId: input.accountId || null,
  };
}

export function savedFor(db: AppDb, goal: Goal): number {
  if (goal.accountId) return getAccount(db, goal.accountId)?.balanceCents ?? 0;
  const row = db
    .select({ s: sql<number>`coalesce(sum(${goalEntries.amountCents}), 0)` })
    .from(goalEntries)
    .where(and(eq(goalEntries.goalId, goal.id), isNull(goalEntries.deletedAt)))
    .get();
  return row?.s ?? 0;
}

export function progressOf(db: AppDb, goal: Goal, today: ISODate = todayISO()): GoalProgress {
  const savedCents = savedFor(db, goal);
  const remainingCents = Math.max(0, goal.targetCents - savedCents);
  const done = savedCents >= goal.targetCents;
  let monthsLeft: number | null = null;
  let monthlyNeededCents: number | null = null;
  if (goal.targetDate && !done) {
    // Conta o mês atual como um mês para guardar.
    monthsLeft = Math.max(
      1,
      differenceInCalendarMonths(parseISO(goal.targetDate), parseISO(today)) + 1,
    );
    monthlyNeededCents = Math.ceil(remainingCents / monthsLeft);
  }
  return {
    ...goal,
    savedCents,
    ratio: savedCents / goal.targetCents,
    remainingCents,
    monthlyNeededCents,
    monthsLeft,
    done,
    accountName: goal.accountId ? (getAccount(db, goal.accountId)?.name ?? null) : null,
  };
}

export function listGoals(
  db: AppDb,
  { archived = false } = {},
  today: ISODate = todayISO(),
): GoalProgress[] {
  return db
    .select()
    .from(goals)
    .where(
      and(
        isNull(goals.deletedAt),
        archived ? isNotNull(goals.archivedAt) : isNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.targetDate), asc(goals.createdAt))
    .all()
    .map((g) => progressOf(db, g, today));
}

export function getGoal(db: AppDb, id: string): Goal | undefined {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
    .get();
}

export function createGoal(db: AppDb, input: GoalInput): string {
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(goals)
    .values({ id, ...clean(input), createdAt: now, updatedAt: now })
    .run();
  return id;
}

export function updateGoal(db: AppDb, id: string, input: GoalInput) {
  db.update(goals)
    .set({ ...clean(input), updatedAt: nowTimestamp() })
    .where(eq(goals.id, id))
    .run();
}

export function archiveGoal(db: AppDb, id: string, archived = true) {
  const now = nowTimestamp();
  db.update(goals)
    .set({ archivedAt: archived ? now : null, updatedAt: now })
    .where(eq(goals.id, id))
    .run();
}

export function deleteGoal(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(goalEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(goalEntries.goalId, id))
    .run();
  db.update(goals).set({ deletedAt: now, updatedAt: now }).where(eq(goals.id, id)).run();
}

/** Guardar (positivo) ou retirar (negativo). Só para metas sem conta vinculada. */
export function addGoalEntry(
  db: AppDb,
  goalId: string,
  amountCents: number,
  on: ISODate = todayISO(),
  note?: string | null,
): string {
  const goal = getGoal(db, goalId);
  if (!goal) throw new Error('Meta não encontrada.');
  if (goal.accountId)
    throw new Error('Esta meta acompanha o saldo de uma conta: lance o dinheiro na conta.');
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new Error('Informe um valor.');
  if (amountCents < 0 && savedFor(db, goal) + amountCents < 0)
    throw new Error('Não dá para retirar mais do que está guardado.');
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(goalEntries)
    .values({
      id,
      goalId,
      amountCents,
      occurredOn: on,
      note: note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function deleteGoalEntry(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(goalEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(goalEntries.id, id))
    .run();
}

export function restoreGoalEntry(db: AppDb, id: string) {
  db.update(goalEntries)
    .set({ deletedAt: null, updatedAt: nowTimestamp() })
    .where(eq(goalEntries.id, id))
    .run();
}

export function listGoalEntries(db: AppDb, goalId: string) {
  return db
    .select()
    .from(goalEntries)
    .where(and(eq(goalEntries.goalId, goalId), isNull(goalEntries.deletedAt)))
    .orderBy(desc(goalEntries.occurredOn), desc(goalEntries.createdAt))
    .all();
}
