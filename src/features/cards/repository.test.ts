import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { getAccount } from '@/features/accounts/repository';
import { listByMonth, monthTotals, signedAmount } from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import {
  cardUsage,
  createCard,
  currentInvoice,
  deleteCard,
  deleteCardPurchase,
  getCard,
  getCardPurchase,
  invoiceMonths,
  invoiceSummary,
  restoreRows,
  saveCardPurchase,
  saveInvoicePayment,
  type CardPurchaseInput,
} from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;
let cardId: string;
const card = () => getCard(db, cardId)!;

beforeEach(async () => {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  db = testDrizzle(raw);
  // fecha dia 3, vence dia 10; limite de R$ 5.000
  cardId = createCard(db, {
    name: 'Nubank',
    brand: 'mastercard',
    lastDigits: '1234',
    color: '#6A4C93',
    limitCents: 500000,
    closingDay: 3,
    dueDay: 10,
  });
});

const purchase = (over: Partial<CardPurchaseInput> = {}): CardPurchaseInput => ({
  cardId,
  kind: 'expense',
  totalCents: 100000,
  installments: 1,
  description: 'Compra',
  categoryId: 'cat-exp-shopping',
  purchasedOn: '2026-11-20',
  ...over,
});

describe('compras no cartão', () => {
  it('parcela em faturas consecutivas e ocupa o limite cheio', () => {
    saveCardPurchase(db, purchase({ totalCents: 100000, installments: 3, description: 'Fone' }));
    expect(invoiceMonths(db, card(), '2026-11-20')).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(invoiceSummary(db, card(), '2026-12').totalCents).toBe(33334);
    expect(invoiceSummary(db, card(), '2027-02').totalCents).toBe(33333);
    expect(cardUsage(db, card())).toEqual({ usedCents: 100000, availableCents: 400000 });

    // No extrato vale a data de cada parcela (20/12 = parcela 2); na fatura vale o mês da fatura.
    const rows = listByMonth(db, { month: '2026-12', cardId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: 'Fone',
      installmentNumber: 2,
      installmentCount: 3,
      cardName: 'Nubank',
      accountId: null,
    });
  });

  it('compra no cartão conta como despesa do mês, mas não mexe no saldo da conta', () => {
    saveCardPurchase(db, purchase({ totalCents: 30000, installments: 3 }));
    expect(monthTotals(db, '2026-11')).toEqual({ incomeCents: 0, expenseCents: 10000 });
    expect(monthTotals(db, '2026-12')).toEqual({ incomeCents: 0, expenseCents: 10000 });
    expect(getAccount(db, DEFAULT_ACCOUNT.id)?.balanceCents).toBe(0);
  });

  it('pagar a fatura tira da conta, abate a fatura e libera limite, sem virar despesa', () => {
    saveCardPurchase(db, purchase({ totalCents: 50000 }));
    const pay = saveInvoicePayment(db, {
      cardId,
      invoiceMonth: '2026-12',
      accountId: DEFAULT_ACCOUNT.id,
      amountCents: 50000,
      paidOn: '2026-12-08',
    });

    expect(getAccount(db, DEFAULT_ACCOUNT.id)?.balanceCents).toBe(-50000);
    const inv = invoiceSummary(db, card(), '2026-12', '2026-12-08');
    expect(inv).toMatchObject({
      totalCents: 50000,
      paidCents: 50000,
      remainingCents: 0,
      status: 'paid',
    });
    expect(cardUsage(db, card()).availableCents).toBe(500000);
    expect(monthTotals(db, '2026-12')).toEqual({ incomeCents: 0, expenseCents: 0 });
    expect(monthTotals(db, '2026-12', DEFAULT_ACCOUNT.id)).toEqual({
      incomeCents: 0,
      expenseCents: 50000,
    });

    const [row] = listByMonth(db, { month: '2026-12', accountId: DEFAULT_ACCOUNT.id });
    expect(row?.id).toBe(pay);
    expect(signedAmount(row!, DEFAULT_ACCOUNT.id)).toBe(-50000);
    expect(signedAmount(row!, null, cardId)).toBe(50000);
    expect(signedAmount(row!)).toBe(0);
  });

  it('situação: aberta, fechada, vencida e paga parcialmente', () => {
    saveCardPurchase(db, purchase({ totalCents: 20000 }));
    expect(invoiceSummary(db, card(), '2026-12', '2026-11-25').status).toBe('open');
    expect(invoiceSummary(db, card(), '2026-12', '2026-12-05').status).toBe('closed');
    saveInvoicePayment(db, {
      cardId,
      invoiceMonth: '2026-12',
      accountId: DEFAULT_ACCOUNT.id,
      amountCents: 5000,
      paidOn: '2026-12-09',
    });
    const late = invoiceSummary(db, card(), '2026-12', '2026-12-11');
    expect(late).toMatchObject({ status: 'overdue', remainingCents: 15000 });
    // fatura "da vez" é a vencida, não a aberta
    expect(currentInvoice(db, card(), '2026-12-11').month).toBe('2026-12');
    expect(currentInvoice(db, card(), '2026-11-25').month).toBe('2026-12');
  });

  it('estorno abate a fatura e devolve limite', () => {
    saveCardPurchase(db, purchase({ totalCents: 20000 }));
    saveCardPurchase(
      db,
      purchase({
        kind: 'income',
        totalCents: 5000,
        categoryId: null,
        description: 'Estorno',
        purchasedOn: '2026-11-25',
      }),
    );
    expect(invoiceSummary(db, card(), '2026-12').totalCents).toBe(15000);
    expect(cardUsage(db, card()).usedCents).toBe(15000);
    expect(() => saveCardPurchase(db, purchase({ kind: 'income', installments: 2 }))).toThrow();
  });

  it('editar o parcelamento reaproveita as linhas e remove as que sobram', () => {
    const first = saveCardPurchase(db, purchase({ totalCents: 120000, installments: 4 }));
    expect(getCardPurchase(db, first)).toMatchObject({ totalCents: 120000, installments: 4 });

    const again = saveCardPurchase(
      db,
      purchase({ totalCents: 90000, installments: 3, description: 'TV' }),
      first,
    );
    expect(again).toBe(first); // mesmo id da 1ª parcela
    expect(getCardPurchase(db, first)).toMatchObject({
      totalCents: 90000,
      installments: 3,
      description: 'TV',
    });
    expect(invoiceMonths(db, card(), '2026-11-20')).toEqual(['2026-12', '2027-01', '2027-02']);

    const single = saveCardPurchase(db, purchase({ totalCents: 5000, installments: 1 }), first);
    expect(getCardPurchase(db, single)).toMatchObject({ totalCents: 5000, installments: 1 });
    expect(cardUsage(db, card()).usedCents).toBe(5000);

    const back = saveCardPurchase(db, purchase({ totalCents: 6000, installments: 2 }), single);
    expect(getCardPurchase(db, back)).toMatchObject({ totalCents: 6000, installments: 2 });
    expect(cardUsage(db, card()).usedCents).toBe(6000);
  });

  it('excluir apaga todas as parcelas, e desfazer volta todas', () => {
    const id = saveCardPurchase(db, purchase({ totalCents: 30000, installments: 3 }));
    const ids = deleteCardPurchase(db, id);
    expect(ids).toHaveLength(3);
    expect(cardUsage(db, card()).usedCents).toBe(0);
    restoreRows(db, ids);
    expect(cardUsage(db, card()).usedCents).toBe(30000);
  });

  it('filtrar o extrato pelo cartão mostra só o cartão, com totais próprios', async () => {
    const { createTransaction } = await import('@/features/transactions/repository');
    createTransaction(db, {
      kind: 'income',
      amountCents: 500000,
      description: 'Salário',
      categoryId: 'cat-inc-salary',
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: '2026-11-20',
    });
    saveCardPurchase(db, purchase({ totalCents: 30000, description: 'Mercado' }));
    saveCardPurchase(
      db,
      purchase({ kind: 'income', totalCents: 5000, categoryId: null, description: 'Estorno' }),
    );
    saveInvoicePayment(db, {
      cardId,
      invoiceMonth: '2026-12',
      accountId: DEFAULT_ACCOUNT.id,
      amountCents: 1000,
      paidOn: '2026-11-21',
    });

    const rows = listByMonth(db, { month: '2026-11', cardId });
    expect(rows.map((r) => r.description).sort()).toEqual([
      'Estorno',
      'Mercado',
      'Pagamento de fatura',
    ]);
    expect(monthTotals(db, '2026-11', null, cardId)).toEqual({
      incomeCents: 6000,
      expenseCents: 30000,
    });
  });

  it('cartão com lançamentos não pode ser excluído', () => {
    saveCardPurchase(db, purchase());
    expect(() => deleteCard(db, cardId)).toThrow(/Arquive/);
  });

  it('o banco recusa combinações inválidas', () => {
    expect(() =>
      saveInvoicePayment(db, {
        cardId,
        invoiceMonth: '2026-12',
        accountId: DEFAULT_ACCOUNT.id,
        amountCents: 0,
        paidOn: '2026-12-01',
      }),
    ).toThrow();
    expect(() => saveCardPurchase(db, purchase({ installments: 0 }))).toThrow();
  });
});
