import { addDays, parseISO, subDays } from 'date-fns';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { recurrences, transactions, type Recurrence } from '@/db/schema';
import { FALLBACK_CATEGORY } from '@/db/seed';
import { invoiceMonthFor } from '@/features/cards/cycle';
import { getCard } from '@/features/cards/repository';
import { SYNC_EPOCH } from '@/db/sync-tables';
import { nowTimestamp, todayISO, toISODate, type ISODate } from '@/lib/dates';
import {
  nextOccurrence,
  nthOccurrence,
  occurrencesBetween,
  type Frequency,
  type Schedule,
} from './schedule';

export const RECURRENCE_TABLES = [
  'recurrences',
  'transactions',
  'categories',
  'accounts',
  'credit_cards',
];

/** Até quantos dias à frente as contas recorrentes aparecem em "a pagar". */
export const HORIZON_DAYS = 45;

const day = (iso: ISODate, delta: number) => toISODate(addDays(parseISO(iso), delta));

/** ID previsível de cada ocorrência: o mesmo em qualquer aparelho (o sync não duplica). */
export function occurrenceId(recurrenceId: string, date: ISODate) {
  return `${recurrenceId}@${date}`;
}

export function scheduleOf(
  r: Pick<Recurrence, 'frequency' | 'interval' | 'startOn' | 'endOn' | 'maxCount'>,
): Schedule {
  return {
    frequency: r.frequency,
    interval: r.interval,
    startOn: r.startOn,
    endOn: r.endOn,
    count: r.maxCount,
  };
}

export type RecurrenceInput = {
  kind: 'income' | 'expense';
  amountCents: number;
  variableAmount: boolean;
  description: string;
  categoryId?: string | null;
  /** Exatamente um dos dois. */
  accountId?: string | null;
  cardId?: string | null;
  frequency: Frequency;
  interval: number;
  /** Primeira ocorrência (ou, ao editar, a próxima a partir de agora). */
  startOn: ISODate;
  endOn?: ISODate | null;
  maxCount?: number | null;
  autoPay: boolean;
  notes?: string | null;
};

function clean(input: RecurrenceInput) {
  const description = input.description.trim();
  if (!description) throw new Error('Dê um nome para a recorrência.');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error('O valor precisa ser maior que zero.');
  if (!input.accountId === !input.cardId) throw new Error('Escolha uma conta ou um cartão.');
  if (input.endOn && input.endOn < input.startOn)
    throw new Error('O fim precisa ser depois do início.');
  return {
    kind: input.kind,
    amountCents: input.amountCents,
    variableAmount: input.variableAmount,
    description,
    categoryId: input.categoryId || FALLBACK_CATEGORY[input.kind],
    accountId: input.accountId || null,
    cardId: input.cardId || null,
    frequency: input.frequency,
    interval: Math.min(36, Math.max(1, Math.trunc(input.interval))),
    startOn: input.startOn,
    endOn: input.endOn || null,
    maxCount: input.maxCount || null,
    // Débito automático não se aplica a cartão (lá tudo já é lançado na data).
    autoPay: input.cardId ? false : input.autoPay,
    notes: input.notes?.trim() || null,
  };
}

export function getRecurrence(db: AppDb, id: string): Recurrence | undefined {
  return db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.id, id), isNull(recurrences.deletedAt)))
    .get();
}

export function listRecurrences(db: AppDb): Recurrence[] {
  return db
    .select()
    .from(recurrences)
    .where(isNull(recurrences.deletedAt))
    .orderBy(asc(recurrences.description))
    .all();
}

export function createRecurrence(
  db: AppDb,
  input: RecurrenceInput,
  today: ISODate = todayISO(),
): string {
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(recurrences)
    .values({ id, ...clean(input), generatedUntil: null, createdAt: now, updatedAt: now })
    .run();
  generateRecurrence(db, id, today);
  return id;
}

/**
 * Cria as ocorrências que faltam até hoje + HORIZON_DAYS (cartão: só até hoje, porque
 * assinatura no cartão aparece quando é cobrada). Nunca mexe no que já existe:
 * ocorrências editadas ou excluídas pela pessoa continuam como ela deixou.
 */
export function generateRecurrence(db: AppDb, id: string, today: ISODate = todayISO()) {
  const r = getRecurrence(db, id);
  if (!r || r.pausedAt) return;
  const isCard = !!r.cardId;
  const until = isCard ? today : day(today, HORIZON_DAYS);
  const from = r.generatedUntil ? day(r.generatedUntil, 1) : r.startOn;
  if (from > until) return;
  const card = isCard ? getCard(db, r.cardId!) : undefined;
  if (isCard && !card) return;
  const now = nowTimestamp();

  for (const { date } of occurrencesBetween(scheduleOf(r), from, until)) {
    const paid = isCard || (r.autoPay && date <= today);
    db.insert(transactions)
      .values({
        id: occurrenceId(r.id, date),
        kind: r.kind,
        amountCents: r.amountCents,
        description: r.description,
        accountId: r.accountId,
        toAccountId: null,
        categoryId: r.categoryId,
        occurredOn: date,
        status: paid ? 'paid' : 'pending',
        dueOn: isCard ? null : date,
        notes: r.notes,
        cardId: r.cardId,
        invoiceMonth: card ? invoiceMonthFor(date, card) : null,
        recurrenceId: r.id,
        origin: 'recurrence',
        createdAt: now,
        // Ocorrência ainda não tocada: perde para qualquer edição feita em outro aparelho.
        updatedAt: SYNC_EPOCH,
      })
      .onConflictDoNothing()
      .run();
  }
  db.update(recurrences).set({ generatedUntil: until }).where(eq(recurrences.id, r.id)).run();
}

/**
 * Roda ao abrir o app e quando ele volta para a frente:
 * cria ocorrências novas e efetiva o débito automático que venceu.
 */
export function generateAll(db: AppDb, today: ISODate = todayISO()) {
  for (const r of listRecurrences(db)) generateRecurrence(db, r.id, today);
  const auto = db
    .select({ id: recurrences.id })
    .from(recurrences)
    .where(and(isNull(recurrences.deletedAt), eq(recurrences.autoPay, true)))
    .all()
    .map((r) => r.id);
  if (auto.length) {
    db.update(transactions)
      .set({ status: 'paid', updatedAt: nowTimestamp() })
      .where(
        and(
          inArray(transactions.recurrenceId, auto),
          eq(transactions.status, 'pending'),
          lte(transactions.dueOn, today),
          isNull(transactions.deletedAt),
        ),
      )
      .run();
  }
}

/** Remove (suave) as ocorrências ainda em aberto a partir de uma data. Pagas ficam. */
function dropPendingFrom(
  db: AppDb,
  recurrenceId: string,
  from: ISODate,
  today: ISODate,
  exceptId?: string,
) {
  const now = nowTimestamp();
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(transactions.recurrenceId, recurrenceId),
        isNull(transactions.deletedAt),
        // pendentes de conta, ou do cartão ainda não cobradas (data futura)
        sql`(${transactions.status} = 'pending' or ${transactions.occurredOn} > ${today})`,
        gte(transactions.occurredOn, from),
        exceptId ? sql`${transactions.id} <> ${exceptId}` : undefined,
      ),
    )
    .run();
}

/** Último dia de uma recorrência limitada por número de vezes (para converter em data). */
export function lastDate(
  r: Pick<Recurrence, 'frequency' | 'interval' | 'startOn' | 'endOn' | 'maxCount'>,
): ISODate | null {
  if (r.maxCount) return nthOccurrence(scheduleOf(r), r.maxCount - 1);
  return r.endOn ?? null;
}

/**
 * Edita a recorrência daqui pra frente. As ocorrências já pagas não mudam; as em aberto
 * a partir de `input.startOn` são refeitas com os dados novos.
 *
 * Com `anchorTxId` ("esta e as próximas", a partir de uma ocorrência): essa ocorrência
 * é atualizada no lugar (mantém o ID e o status) e vira a primeira da regra nova.
 */
export function updateRecurrenceFrom(
  db: AppDb,
  id: string,
  input: RecurrenceInput,
  { anchorTxId, today = todayISO() }: { anchorTxId?: string; today?: ISODate } = {},
) {
  const current = getRecurrence(db, id);
  if (!current) throw new Error('Recorrência não encontrada.');
  const values = clean(input);
  const from = values.startOn;
  const now = nowTimestamp();
  const anchor = anchorTxId
    ? db.select().from(transactions).where(eq(transactions.id, anchorTxId)).get()
    : undefined;

  // Refaz o que está em aberto a partir da ocorrência editada (ou de hoje), mesmo que caia
  // antes da nova data — senão a regra antiga deixaria uma conta duplicada (dia 5 e dia 10).
  // O que já venceu antes disso continua lá, porque é uma conta real em atraso.
  const anchorDate = anchor ? (anchor.dueOn ?? anchor.occurredOn) : today;
  dropPendingFrom(db, id, from < anchorDate ? from : anchorDate, today, anchorTxId);
  if (anchorTxId) {
    const card = values.cardId ? getCard(db, values.cardId) : undefined;
    db.update(transactions)
      .set({
        kind: values.kind,
        amountCents: values.amountCents,
        description: values.description,
        categoryId: values.categoryId,
        accountId: values.accountId,
        cardId: values.cardId,
        invoiceMonth: card ? invoiceMonthFor(from, card) : null,
        occurredOn: anchor?.status === 'paid' && !values.cardId ? anchor.occurredOn : from,
        dueOn: values.cardId ? null : from,
        status: values.cardId ? 'paid' : (anchor?.status ?? 'pending'),
        notes: values.notes,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(transactions.id, anchorTxId))
      .run();
  }
  db.update(recurrences)
    .set({ ...values, generatedUntil: anchorTxId ? from : day(from, -1), updatedAt: now })
    .where(eq(recurrences.id, id))
    .run();
  generateRecurrence(db, id, today);
}

/**
 * Encerra a recorrência antes de `from`: ocorrências em aberto a partir dessa data somem.
 * Se `from` é o começo, a recorrência inteira é excluída (o histórico pago fica).
 */
export function endRecurrenceFrom(
  db: AppDb,
  id: string,
  from: ISODate,
  today: ISODate = todayISO(),
) {
  const r = getRecurrence(db, id);
  if (!r) return;
  const now = nowTimestamp();
  // Também remove a ocorrência do próprio dia, mesmo se já paga (ela foi a escolhida).
  db.update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(transactions.recurrenceId, id),
        eq(transactions.occurredOn, from),
        isNull(transactions.deletedAt),
      ),
    )
    .run();
  dropPendingFrom(db, id, from, today);
  if (from <= r.startOn) {
    db.update(recurrences)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(recurrences.id, id))
      .run();
  } else {
    db.update(recurrences)
      .set({ endOn: toISODate(subDays(parseISO(from), 1)), maxCount: null, updatedAt: now })
      .where(eq(recurrences.id, id))
      .run();
  }
}

/** Exclui a regra e as ocorrências em aberto (o que já foi pago fica no histórico). */
export function deleteRecurrence(db: AppDb, id: string, today: ISODate = todayISO()) {
  const now = nowTimestamp();
  dropPendingFrom(db, id, '0000-01-01', today);
  db.update(recurrences)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(recurrences.id, id))
    .run();
}

export function pauseRecurrence(db: AppDb, id: string, today: ISODate = todayISO()) {
  const now = nowTimestamp();
  dropPendingFrom(db, id, today, today);
  db.update(recurrences)
    .set({ pausedAt: now, generatedUntil: day(today, -1), updatedAt: now })
    .where(eq(recurrences.id, id))
    .run();
}

export function resumeRecurrence(db: AppDb, id: string, today: ISODate = todayISO()) {
  db.update(recurrences)
    .set({ pausedAt: null, generatedUntil: day(today, -1), updatedAt: nowTimestamp() })
    .where(eq(recurrences.id, id))
    .run();
  generateRecurrence(db, id, today);
}

export type RecurrenceOverview = Recurrence & { nextDate: ISODate | null };

export function listRecurrencesOverview(
  db: AppDb,
  today: ISODate = todayISO(),
): RecurrenceOverview[] {
  return listRecurrences(db).map((r) => ({
    ...r,
    nextDate: r.pausedAt ? null : nextOccurrence(scheduleOf(r), today),
  }));
}
