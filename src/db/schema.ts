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

export const CARD_BRANDS = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

export const creditCards = sqliteTable('credit_cards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand', { enum: CARD_BRANDS }).notNull(),
  /** Só os 4 últimos dígitos, para identificar. Nunca o número completo. */
  lastDigits: text('last_digits'),
  color: text('color').notNull(),
  limitCents: integer('limit_cents').notNull(),
  closingDay: integer('closing_day').notNull(),
  dueDay: integer('due_day').notNull(),
  /** Conta sugerida para pagar a fatura. */
  paymentAccountId: text('payment_account_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: text('archived_at'),
  ...syncColumns,
});

/**
 * income/expense: receitas e despesas (numa conta, ou num cartão quando card_id está preenchido);
 * transfer: entre contas; card_payment: pagamento de fatura (sai da conta, abate a fatura do cartão).
 */
export const TRANSACTION_KINDS = ['income', 'expense', 'transfer', 'card_payment'] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_STATUSES = ['paid', 'pending'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: TRANSACTION_KINDS }).notNull(),
  /** Sempre positivo; o sinal vem de `kind`. */
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull(),
  /** Vazio só em compras/estornos no cartão. */
  accountId: text('account_id'),
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
  /** Cartão da compra/estorno, ou cartão cuja fatura foi paga. */
  cardId: text('card_id'),
  /** Fatura (mês de vencimento, "AAAA-MM") onde a compra cai ou que foi paga. */
  invoiceMonth: text('invoice_month'),
  /** Parcelas de uma mesma compra compartilham o grupo. */
  installmentGroupId: text('installment_group_id'),
  installmentNumber: integer('installment_number'),
  installmentCount: integer('installment_count'),
  /** Vencimento (contas a pagar/receber). Continua guardado depois de pago. */
  dueOn: text('due_on'),
  /** Recorrência que gerou este lançamento. */
  recurrenceId: text('recurrence_id'),
  ...syncColumns,
});

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;

export const recurrences = sqliteTable('recurrences', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  /** Valor muda todo mês (luz, água): o app pede o valor na hora de pagar. */
  variableAmount: integer('variable_amount', { mode: 'boolean' }).notNull().default(false),
  description: text('description').notNull(),
  categoryId: text('category_id'),
  /** Exatamente um dos dois: conta ou cartão (assinatura no cartão). */
  accountId: text('account_id'),
  cardId: text('card_id'),
  frequency: text('frequency', { enum: FREQUENCIES }).notNull(),
  interval: integer('interval_n').notNull().default(1),
  startOn: text('start_on').notNull(),
  endOn: text('end_on'),
  maxCount: integer('max_count'),
  /** Débito automático: vira "pago" sozinho no dia. */
  autoPay: integer('auto_pay', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  pausedAt: text('paused_at'),
  /** Até que data as ocorrências já foram criadas. */
  generatedUntil: text('generated_until'),
  ...syncColumns,
});

/** Orçamento mensal de uma categoria principal de despesa (inclui as subcategorias). */
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  ...syncColumns,
});

/** Meta de economia. Com conta vinculada, o progresso é o saldo dela; sem, a soma dos aportes. */
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetCents: integer('target_cents').notNull(),
  targetDate: text('target_date'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  accountId: text('account_id'),
  archivedAt: text('archived_at'),
  ...syncColumns,
});

/** Aporte (positivo) ou retirada (negativa) de uma meta sem conta vinculada. */
export const goalEntries = sqliteTable('goal_entries', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  occurredOn: text('occurred_on').notNull(),
  note: text('note'),
  ...syncColumns,
});

export type Account = typeof accounts.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalEntry = typeof goalEntries.$inferSelect;
export type Recurrence = typeof recurrences.$inferSelect;
export type CreditCard = typeof creditCards.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const schema = {
  accounts,
  categories,
  transactions,
  creditCards,
  recurrences,
  budgets,
  goals,
  goalEntries,
};
