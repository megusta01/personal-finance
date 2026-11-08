import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { getAccount } from '@/features/accounts/repository';
import {
  billsSummary,
  listBillGroups,
  markBillPaid,
  markBillUnpaid,
  projectedBalance,
} from '@/features/bills/repository';
import { createCard, invoiceSummary, getCard, saveCardPurchase } from '@/features/cards/repository';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  monthTotals,
} from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import {
  createRecurrence,
  deleteRecurrence,
  endRecurrenceFrom,
  generateAll,
  getRecurrence,
  listRecurrencesOverview,
  occurrenceId,
  pauseRecurrence,
  resumeRecurrence,
  updateRecurrenceFrom,
  type RecurrenceInput,
} from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;
const TODAY = '2026-11-08';
const W = DEFAULT_ACCOUNT.id;

beforeEach(async () => {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  db = testDrizzle(raw);
});

const rent = (over: Partial<RecurrenceInput> = {}): RecurrenceInput => ({
  kind: 'expense',
  amountCents: 150000,
  variableAmount: false,
  description: 'Aluguel',
  categoryId: 'sub-home-rent',
  accountId: W,
  frequency: 'monthly',
  interval: 1,
  startOn: '2026-11-05',
  autoPay: false,
  ...over,
});

const pendingIds = () =>
  listBillGroups(db, 'expense', TODAY).flatMap((g) => g.items.map((i) => i.id));

describe('recorrências', () => {
  it('gera as ocorrências até o horizonte, como contas a pagar', () => {
    const id = createRecurrence(db, rent(), TODAY);
    // hoje 08/11 + 45 dias = 23/12 → 05/11 (vencida) e 05/12
    expect(pendingIds()).toEqual([occurrenceId(id, '2026-11-05'), occurrenceId(id, '2026-12-05')]);
    const groups = listBillGroups(db, 'expense', TODAY);
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'later']);
    // a pagar não mexe no saldo nem nos totais do mês
    expect(getAccount(db, W)?.balanceCents).toBe(0);
    expect(monthTotals(db, '2026-11')).toEqual({ incomeCents: 0, expenseCents: 0 });
  });

  it('gerar de novo não duplica nem ressuscita ocorrência excluída', () => {
    const id = createRecurrence(db, rent(), TODAY);
    deleteTransaction(db, occurrenceId(id, '2026-12-05'));
    generateAll(db, TODAY);
    generateAll(db, '2026-11-20');
    expect(pendingIds()).toEqual([occurrenceId(id, '2026-11-05')]);
    // dias depois, o horizonte avança e janeiro aparece
    generateAll(db, '2026-11-25');
    expect(
      listBillGroups(db, 'expense', '2026-11-25').flatMap((g) => g.items.map((i) => i.occurredOn)),
    ).toEqual(['2026-11-05', '2027-01-05']);
  });

  it('pagar e desfazer', () => {
    const id = createRecurrence(db, rent({ variableAmount: true }), TODAY);
    const nov = occurrenceId(id, '2026-11-05');
    const { previous } = markBillPaid(db, nov, {
      paidOn: TODAY,
      amountCents: 149900,
      accountId: W,
    });
    expect(getTransaction(db, nov)).toMatchObject({
      status: 'paid',
      occurredOn: TODAY,
      dueOn: '2026-11-05',
      amountCents: 149900,
    });
    expect(getAccount(db, W)?.balanceCents).toBe(-149900);
    expect(monthTotals(db, '2026-11').expenseCents).toBe(149900);
    markBillUnpaid(db, nov, previous);
    expect(getTransaction(db, nov)).toMatchObject({
      status: 'pending',
      occurredOn: '2026-11-05',
      amountCents: 150000,
    });
  });

  it('débito automático vira pago sozinho no dia', () => {
    const id = createRecurrence(
      db,
      rent({ description: 'Internet', amountCents: 9990, startOn: '2026-11-07', autoPay: true }),
      TODAY,
    );
    expect(getTransaction(db, occurrenceId(id, '2026-11-07'))?.status).toBe('paid');
    expect(getTransaction(db, occurrenceId(id, '2026-12-07'))?.status).toBe('pending');
    generateAll(db, '2026-12-07');
    expect(getTransaction(db, occurrenceId(id, '2026-12-07'))?.status).toBe('paid');
  });

  it('assinatura no cartão: só lança até hoje, já na fatura certa', () => {
    const cardId = createCard(db, {
      name: 'Nubank',
      brand: 'visa',
      color: '#000',
      limitCents: 100000,
      closingDay: 3,
      dueDay: 10,
    });
    const id = createRecurrence(
      db,
      rent({
        description: 'Streaming',
        amountCents: 3990,
        accountId: null,
        cardId,
        startOn: '2026-09-01',
      }),
      TODAY,
    );
    expect(getTransaction(db, occurrenceId(id, '2026-11-01'))).toMatchObject({
      status: 'paid',
      invoiceMonth: '2026-11',
      accountId: null,
    });
    expect(getTransaction(db, occurrenceId(id, '2026-12-01'))).toBeUndefined();
    expect(invoiceSummary(db, getCard(db, cardId)!, '2026-11', TODAY).totalCents).toBe(3990);
    expect(getRecurrence(db, id)?.autoPay).toBe(false);
  });

  it('editar "esta e as próximas" mantém o passado e a própria ocorrência', () => {
    const id = createRecurrence(db, rent(), TODAY);
    markBillPaid(db, occurrenceId(id, '2026-11-05'), {
      paidOn: '2026-11-05',
      amountCents: 150000,
      accountId: W,
    });
    const dec = occurrenceId(id, '2026-12-05');
    updateRecurrenceFrom(db, id, rent({ amountCents: 160000, startOn: '2026-12-05' }), {
      anchorTxId: dec,
      today: TODAY,
    });
    expect(getTransaction(db, dec)).toMatchObject({ amountCents: 160000, status: 'pending' });
    expect(getTransaction(db, occurrenceId(id, '2026-11-05'))?.amountCents).toBe(150000);
    generateAll(db, '2026-12-01');
    expect(getTransaction(db, occurrenceId(id, '2027-01-05'))?.amountCents).toBe(160000);
  });

  it('mudar o dia de vencimento refaz as ocorrências em aberto', () => {
    const id = createRecurrence(db, rent(), TODAY);
    updateRecurrenceFrom(db, id, rent({ startOn: '2026-12-10' }), { today: TODAY });
    expect(pendingIds()).toEqual([occurrenceId(id, '2026-11-05'), occurrenceId(id, '2026-12-10')]);
  });

  it('encerrar a partir de uma ocorrência e excluir', () => {
    const id = createRecurrence(db, rent(), TODAY);
    endRecurrenceFrom(db, id, '2026-12-05', TODAY);
    expect(getRecurrence(db, id)?.endOn).toBe('2026-12-04');
    generateAll(db, '2027-03-01');
    expect(pendingIds()).toEqual([occurrenceId(id, '2026-11-05')]);

    markBillPaid(db, occurrenceId(id, '2026-11-05'), {
      paidOn: TODAY,
      amountCents: 150000,
      accountId: W,
    });
    deleteRecurrence(db, id, TODAY);
    expect(getRecurrence(db, id)).toBeUndefined();
    expect(getTransaction(db, occurrenceId(id, '2026-11-05'))?.status).toBe('paid'); // histórico fica
  });

  it('pausar e retomar não gera o período pausado', () => {
    const id = createRecurrence(db, rent(), TODAY);
    pauseRecurrence(db, id, TODAY);
    expect(pendingIds()).toEqual([occurrenceId(id, '2026-11-05')]); // a vencida fica
    expect(listRecurrencesOverview(db, TODAY)[0]?.nextDate).toBeNull();
    resumeRecurrence(db, id, '2027-01-10');
    expect(
      listBillGroups(db, 'expense', '2027-01-10').flatMap((g) => g.items.map((i) => i.occurredOn)),
    ).toEqual(['2026-11-05', '2027-02-05']);
  });
});

describe('saldo previsto', () => {
  it('desconta o que falta pagar, soma o que falta receber e as faturas do mês', () => {
    createTransaction(db, {
      kind: 'income',
      amountCents: 500000,
      description: 'Salário',
      categoryId: 'cat-inc-salary',
      accountId: W,
      occurredOn: '2026-11-05',
    });
    createRecurrence(db, rent(), TODAY); // 1.500 vencido em 05/11
    createTransaction(db, {
      kind: 'income',
      amountCents: 300000,
      description: 'Freela',
      categoryId: 'cat-inc-freelance',
      accountId: W,
      occurredOn: '2026-11-30',
      status: 'pending',
    });
    createTransaction(db, {
      kind: 'expense',
      amountCents: 999,
      description: 'Fora do mês',
      categoryId: 'cat-exp-other',
      accountId: W,
      occurredOn: '2026-12-01',
      status: 'pending',
    });
    const cardId = createCard(db, {
      name: 'Nu',
      brand: 'visa',
      color: '#000',
      limitCents: 100000,
      closingDay: 3,
      dueDay: 10,
    });
    saveCardPurchase(db, {
      cardId,
      kind: 'expense',
      totalCents: 15000,
      installments: 1,
      description: 'x',
      purchasedOn: '2026-11-01',
    }); // fatura vence 10/11

    expect(billsSummary(db, TODAY)).toEqual({
      overdueCount: 1,
      overdueCents: 150000,
      payableThisMonthCents: 150000,
      receivableThisMonthCents: 300000,
      invoicesThisMonthCents: 15000,
    });
    expect(projectedBalance(db, TODAY)).toBe(500000 + 300000 - 150000 - 15000);
  });
});
