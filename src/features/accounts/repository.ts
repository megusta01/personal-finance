import { and, asc, eq, getTableColumns, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { accounts, transactions, type AccountType } from '@/db/schema';
import { ADJUSTMENT_CATEGORY } from '@/db/seed';
import { nowTimestamp, todayISO, type ISODate } from '@/lib/dates';

export const ACCOUNT_TABLES = ['accounts', 'transactions'];

/**
 * Saldo de uma conta = saldo inicial
 *   + receitas pagas − despesas pagas
 *   − transferências que saíram + transferências que entraram.
 */
// Nomes qualificados à mão: dentro da subconsulta, uma coluna sem tabela ("id")
// seria resolvida contra `transactions`, e não contra `accounts`.
const balanceSql = sql<number>`"accounts"."initial_balance_cents" + coalesce((
  select sum(case
    when t.kind = 'income'   and t.account_id    = "accounts"."id" then t.amount_cents
    when t.kind = 'expense'  and t.account_id    = "accounts"."id" then -t.amount_cents
    when t.kind = 'transfer' and t.account_id    = "accounts"."id" then -t.amount_cents
    when t.kind = 'transfer' and t.to_account_id = "accounts"."id" then t.amount_cents
    else 0 end)
  from transactions t
  where t.deleted_at is null and t.status = 'paid'
    and (t.account_id = "accounts"."id" or t.to_account_id = "accounts"."id")
), 0)`;

function selectWithBalance(db: AppDb) {
  return db
    .select({ ...getTableColumns(accounts), balanceCents: balanceSql.as('balance_cents') })
    .from(accounts);
}

export type AccountWithBalance = ReturnType<ReturnType<typeof selectWithBalance>['all']>[number];

export function listAccountsWithBalance(
  db: AppDb,
  { archived = false } = {},
): AccountWithBalance[] {
  return selectWithBalance(db)
    .where(
      and(
        isNull(accounts.deletedAt),
        archived ? isNotNull(accounts.archivedAt) : isNull(accounts.archivedAt),
      ),
    )
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt))
    .all();
}

/** Contas ativas (não arquivadas), sem saldo — para seletores. */
export function listActiveAccounts(db: AppDb) {
  return db
    .select()
    .from(accounts)
    .where(and(isNull(accounts.deletedAt), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt))
    .all();
}

export function getAccount(db: AppDb, id: string): AccountWithBalance | undefined {
  return selectWithBalance(db)
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
    .get();
}

/** Saldo total: soma das contas ativas marcadas para entrar no total. */
export function totalBalance(db: AppDb): number {
  return listAccountsWithBalance(db)
    .filter((a) => a.includeInTotal)
    .reduce((sum, a) => sum + a.balanceCents, 0);
}

export type AccountInput = {
  name: string;
  type: AccountType;
  institution?: string | null;
  color: string;
  icon: string;
  initialBalanceCents: number;
  includeInTotal: boolean;
};

function cleanAccount(input: AccountInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome para a conta.');
  if (!Number.isInteger(input.initialBalanceCents)) throw new Error('Saldo inicial inválido.');
  return { ...input, name, institution: input.institution?.trim() || null };
}

export function createAccount(db: AppDb, input: AccountInput): string {
  const id = randomUUID();
  const now = nowTimestamp();
  const last = db
    .select({ max: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
    .from(accounts)
    .get();
  db.insert(accounts)
    .values({
      id,
      ...cleanAccount(input),
      sortOrder: (last?.max ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function updateAccount(db: AppDb, id: string, input: AccountInput) {
  db.update(accounts)
    .set({ ...cleanAccount(input), updatedAt: nowTimestamp() })
    .where(eq(accounts.id, id))
    .run();
}

export function countActiveAccounts(db: AppDb): number {
  return listActiveAccounts(db).length;
}

export function accountTransactionCount(db: AppDb, id: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)),
      ),
    )
    .get();
  return row?.n ?? 0;
}

/** Arquivar esconde a conta das listas e do saldo total, mas mantém o histórico. */
export function archiveAccount(db: AppDb, id: string) {
  if (countActiveAccounts(db) <= 1) throw new Error('Você precisa de pelo menos uma conta ativa.');
  const now = nowTimestamp();
  db.update(accounts).set({ archivedAt: now, updatedAt: now }).where(eq(accounts.id, id)).run();
}

export function unarchiveAccount(db: AppDb, id: string) {
  db.update(accounts)
    .set({ archivedAt: null, updatedAt: nowTimestamp() })
    .where(eq(accounts.id, id))
    .run();
}

/** Excluir só é permitido para contas sem movimentações; as outras podem ser arquivadas. */
export function deleteAccount(db: AppDb, id: string) {
  if (accountTransactionCount(db, id) > 0) {
    throw new Error('Esta conta tem movimentações. Arquive em vez de excluir.');
  }
  const acc = getAccount(db, id);
  if (acc && !acc.archivedAt && countActiveAccounts(db) <= 1) {
    throw new Error('Você precisa de pelo menos uma conta ativa.');
  }
  const now = nowTimestamp();
  db.update(accounts).set({ deletedAt: now, updatedAt: now }).where(eq(accounts.id, id)).run();
}

/**
 * Ajusta o saldo para bater com o banco: cria um lançamento de "Ajuste de saldo"
 * com a diferença, na data informada. O histórico anterior não é alterado.
 * Retorna o id do lançamento, ou null se o saldo já estava certo.
 */
export function adjustBalance(
  db: AppDb,
  accountId: string,
  targetCents: number,
  on: ISODate = todayISO(),
): string | null {
  const acc = getAccount(db, accountId);
  if (!acc) throw new Error('Conta não encontrada.');
  const diff = targetCents - acc.balanceCents;
  if (diff === 0) return null;
  const kind = diff > 0 ? 'income' : 'expense';
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(transactions)
    .values({
      id,
      kind,
      amountCents: Math.abs(diff),
      description: 'Ajuste de saldo',
      accountId,
      categoryId: ADJUSTMENT_CATEGORY[kind],
      occurredOn: on,
      status: 'paid',
      origin: 'app',
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
