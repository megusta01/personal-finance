import { addDays, endOfMonth, parseISO } from 'date-fns';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { AppDb } from '@/db/client';
import { transactions } from '@/db/schema';
import { listAccountsWithBalance } from '@/features/accounts/repository';
import { invoiceMonths, invoiceSummary, listCards } from '@/features/cards/repository';
import { HORIZON_DAYS } from '@/features/recurrences/repository';
import { listPending, type TransactionRow } from '@/features/transactions/repository';
import type { ReminderItem } from '@/features/reminders/plan';
import { nowTimestamp, todayISO, toISODate, type ISODate } from '@/lib/dates';

export const BILL_TABLES = [
  'transactions',
  'recurrences',
  'accounts',
  'categories',
  'credit_cards',
];

export type BillGroup = {
  key: 'overdue' | 'today' | 'week' | 'month' | 'later';
  title: string;
  items: TransactionRow[];
  totalCents: number;
};

/** Contas em aberto, agrupadas: vencidas, hoje, próximos 7 dias, até o fim do mês, depois. */
export function listBillGroups(
  db: AppDb,
  kind: 'income' | 'expense',
  today: ISODate = todayISO(),
): BillGroup[] {
  const until = toISODate(addDays(parseISO(today), HORIZON_DAYS));
  const week = toISODate(addDays(parseISO(today), 7));
  const monthEnd = toISODate(endOfMonth(parseISO(today)));
  const groups: BillGroup[] = [
    {
      key: 'overdue',
      title: kind === 'expense' ? 'Vencidas' : 'Atrasadas',
      items: [],
      totalCents: 0,
    },
    { key: 'today', title: 'Vencem hoje', items: [], totalCents: 0 },
    { key: 'week', title: 'Próximos 7 dias', items: [], totalCents: 0 },
    { key: 'month', title: 'Até o fim do mês', items: [], totalCents: 0 },
    { key: 'later', title: 'Mais adiante', items: [], totalCents: 0 },
  ];
  const pick = (due: ISODate) =>
    due < today
      ? groups[0]!
      : due === today
        ? groups[1]!
        : due <= week
          ? groups[2]!
          : due <= monthEnd
            ? groups[3]!
            : groups[4]!;
  for (const row of listPending(db, kind, until)) {
    const g = pick(row.dueOn ?? row.occurredOn);
    g.items.push(row);
    g.totalCents += row.amountCents;
  }
  return groups.filter((g) => g.items.length > 0);
}

export type BillsSummary = {
  overdueCount: number;
  overdueCents: number;
  /** A pagar/receber até o fim do mês (inclui vencidas). */
  payableThisMonthCents: number;
  receivableThisMonthCents: number;
  /** Faturas de cartão em aberto que vencem até o fim do mês. */
  invoicesThisMonthCents: number;
};

export function billsSummary(db: AppDb, today: ISODate = todayISO()): BillsSummary {
  const monthEnd = toISODate(endOfMonth(parseISO(today)));
  const row = db
    .select({
      overdueCount: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' and ${transactions.dueOn} < ${today} then 1 else 0 end), 0)`,
      overdueCents: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' and ${transactions.dueOn} < ${today} then ${transactions.amountCents} else 0 end), 0)`,
      payable: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
      receivable: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.status, 'pending'),
        lte(transactions.dueOn, monthEnd),
      ),
    )
    .get();

  let invoices = 0;
  for (const card of listCards(db)) {
    for (const m of invoiceMonths(db, card, today)) {
      const inv = invoiceSummary(db, card, m, today);
      if (inv.dates.dueDate <= monthEnd && inv.remainingCents > 0 && inv.status !== 'future')
        invoices += inv.remainingCents;
    }
  }
  return {
    overdueCount: row?.overdueCount ?? 0,
    overdueCents: row?.overdueCents ?? 0,
    payableThisMonthCents: row?.payable ?? 0,
    receivableThisMonthCents: row?.receivable ?? 0,
    invoicesThisMonthCents: invoices,
  };
}

/**
 * Saldo previsto para o fim do mês = saldo de hoje
 *   + o que falta receber − o que falta pagar (até o fim do mês, nas contas que entram no total)
 *   − faturas de cartão em aberto que vencem até o fim do mês.
 */
export function projectedBalance(db: AppDb, today: ISODate = todayISO()): number {
  const monthEnd = toISODate(endOfMonth(parseISO(today)));
  const included = listAccountsWithBalance(db).filter((a) => a.includeInTotal);
  const balance = included.reduce((s, a) => s + a.balanceCents, 0);
  const ids = included.map((a) => a.id);
  let pending = 0;
  if (ids.length) {
    const row = db
      .select({
        net: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} else -${transactions.amountCents} end), 0)`,
      })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          eq(transactions.status, 'pending'),
          lte(transactions.dueOn, monthEnd),
          inArray(transactions.accountId, ids),
        ),
      )
      .get();
    pending = row?.net ?? 0;
  }
  return balance + pending - billsSummary(db, today).invoicesThisMonthCents;
}

/** Marca como pago (ou recebido). Pode ajustar valor (contas de valor variável), data e conta. */
export function markBillPaid(
  db: AppDb,
  id: string,
  opts: { paidOn: ISODate; amountCents: number; accountId: string },
) {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0)
    throw new Error('O valor precisa ser maior que zero.');
  const tx = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!tx || tx.kind === 'transfer' || tx.kind === 'card_payment' || tx.cardId)
    throw new Error('Lançamento não encontrado.');
  db.update(transactions)
    .set({
      status: 'paid',
      occurredOn: opts.paidOn,
      amountCents: opts.amountCents,
      accountId: opts.accountId,
      dueOn: tx.dueOn ?? tx.occurredOn,
      updatedAt: nowTimestamp(),
    })
    .where(eq(transactions.id, id))
    .run();
  return {
    previous: { amountCents: tx.amountCents, occurredOn: tx.occurredOn, accountId: tx.accountId },
  };
}

/** Volta para "a pagar" (desfazer pagamento): a data volta a ser o vencimento. */
export function markBillUnpaid(
  db: AppDb,
  id: string,
  restore?: { amountCents: number; accountId: string | null },
) {
  const tx = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!tx || !tx.dueOn) return;
  db.update(transactions)
    .set({
      status: 'pending',
      occurredOn: tx.dueOn,
      ...(restore ? { amountCents: restore.amountCents, accountId: restore.accountId } : {}),
      updatedAt: nowTimestamp(),
    })
    .where(eq(transactions.id, id))
    .run();
}

/** Itens para os lembretes: contas em aberto e faturas a pagar nos próximos `days` dias. */
export function reminderItems(db: AppDb, today: ISODate = todayISO(), days = 60): ReminderItem[] {
  const until = toISODate(addDays(parseISO(today), days));
  const items: ReminderItem[] = [];
  for (const kind of ['expense', 'income'] as const) {
    for (const t of listPending(db, kind, until)) {
      items.push({
        key: t.id,
        kind,
        title: t.description,
        amountCents: t.amountCents,
        dueOn: t.dueOn ?? t.occurredOn,
        where: t.accountName,
        url: `/transacao/${t.id}`,
      });
    }
  }
  for (const card of listCards(db)) {
    for (const m of invoiceMonths(db, card, today)) {
      const inv = invoiceSummary(db, card, m, today);
      if (inv.remainingCents <= 0 || inv.status === 'future' || inv.dates.dueDate > until) continue;
      items.push({
        key: `inv-${card.id}-${m}`,
        kind: 'invoice',
        title: card.name,
        amountCents: inv.remainingCents,
        dueOn: inv.dates.dueDate,
        url: `/cartao/${card.id}`,
      });
    }
  }
  return items;
}
