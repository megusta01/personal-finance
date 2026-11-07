import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Tabelas do app. A estrutura real é criada pelas migrations em ./migrations.ts;
 * este arquivo só descreve as colunas para o Drizzle montar consultas tipadas.
 *
 * Toda tabela sincronizável tem:
 *  - id em texto (UUID ou ID determinístico), nunca autoincremento: dois aparelhos
 *    offline não podem gerar o mesmo ID;
 *  - created_at / updated_at em ISO 8601 UTC: o sync usa updated_at para saber o que mudou;
 *  - deleted_at: exclusão "suave", para que os outros aparelhos fiquem sabendo da exclusão.
 */

const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const ACCOUNT_TYPES = ['checking', 'savings', 'wallet', 'investment', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
  institution: text('institution'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
  includeInTotal: integer('include_in_total', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: text('archived_at'),
  ...syncColumns,
});

export const CATEGORY_KINDS = ['income', 'expense'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: text('archived_at'),
  /** Categorias internas (ex.: "Ajuste de saldo"): não aparecem para escolha nem edição. */
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

export const TRANSACTION_KINDS = ['income', 'expense', 'transfer'] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_STATUSES = ['paid', 'pending'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
  /** Sempre positivo; o sinal vem de `kind`. */
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull(),
  accountId: text('account_id').notNull(),
  /** Só em transferências: conta de destino. */
  toAccountId: text('to_account_id'),
  categoryId: text('category_id'),
  /** Data do lançamento, "AAAA-MM-DD". */
  occurredOn: text('occurred_on').notNull(),
  status: text('status', { enum: TRANSACTION_STATUSES }).notNull().default('paid'),
  notes: text('notes'),
  /** De onde veio o registro: 'app' ou 'legacy' (importado da versão 1). */
  origin: text('origin')
    .notNull()
    .default(sql`'app'`),
  ...syncColumns,
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const schema = { accounts, categories, transactions };
