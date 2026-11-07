import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { createTransaction, listByMonth } from '@/features/transactions/repository';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  getCategory,
  listCategoryTree,
  unarchiveCategory,
  updateCategory,
} from './repository';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

let db: AppDb;
beforeEach(async () => {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  db = testDrizzle(raw);
});

describe('categorias', () => {
  it('vem com subcategorias padrão e esconde as de sistema', () => {
    const tree = listCategoryTree(db, 'expense');
    const food = tree.find((c) => c.id === 'cat-exp-food');
    expect(food?.children.map((c) => c.name)).toEqual([
      'Restaurante',
      'Delivery',
      'Padaria e café',
    ]);
    expect(tree.some((c) => c.name === 'Ajuste de saldo')).toBe(false);
  });

  it('subcategoria herda tipo, ícone e cor; e acompanha mudanças do pai', () => {
    const id = createCategory(db, {
      name: 'Feira',
      kind: 'income',
      icon: 'x',
      color: '#000',
      parentId: 'cat-exp-groceries',
    });
    expect(getCategory(db, id)).toMatchObject({
      kind: 'expense',
      icon: 'cart-outline',
      parentId: 'cat-exp-groceries',
    });
    updateCategory(db, 'cat-exp-groceries', {
      name: 'Supermercado',
      icon: 'basket-outline',
      color: '#123456',
    });
    expect(getCategory(db, id)).toMatchObject({ icon: 'basket-outline', color: '#123456' });
    expect(() =>
      createCategory(db, { name: 'Neta', kind: 'expense', icon: 'x', color: '#000', parentId: id }),
    ).toThrow();
  });

  it('filtrar pela categoria pai inclui as subcategorias', () => {
    const base = {
      kind: 'expense' as const,
      amountCents: 100,
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: '2026-11-07',
    };
    createTransaction(db, { ...base, description: 'Pizza', categoryId: 'sub-food-delivery' });
    createTransaction(db, { ...base, description: 'Almoço', categoryId: 'cat-exp-food' });
    createTransaction(db, { ...base, description: 'Uber', categoryId: 'sub-transport-ride' });
    const rows = listByMonth(db, { month: '2026-11', categoryId: 'cat-exp-food' });
    expect(rows.map((r) => r.description).sort()).toEqual(['Almoço', 'Pizza']);
    expect(rows.find((r) => r.description === 'Pizza')).toMatchObject({
      categoryName: 'Delivery',
      parentCategoryName: 'Alimentação',
    });
  });

  it('arquivar some da lista; excluir só sem uso', () => {
    archiveCategory(db, 'cat-exp-pets');
    expect(listCategoryTree(db, 'expense').some((c) => c.id === 'cat-exp-pets')).toBe(false);
    expect(listCategoryTree(db, 'expense', { archived: true }).map((c) => c.id)).toContain(
      'cat-exp-pets',
    );
    unarchiveCategory(db, 'cat-exp-pets');
    expect(listCategoryTree(db, 'expense').some((c) => c.id === 'cat-exp-pets')).toBe(true);

    createTransaction(db, {
      kind: 'expense',
      amountCents: 100,
      description: 'Luz',
      categoryId: 'sub-util-power',
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: '2026-11-07',
    });
    expect(() => deleteCategory(db, 'cat-exp-utilities')).toThrow(/Arquive/);
    deleteCategory(db, 'cat-exp-travel');
    expect(getCategory(db, 'cat-exp-travel')).toBeUndefined();
  });

  it('subcategoria arquivada aparece sozinha na lista de arquivadas; reativar reativa o pai', () => {
    archiveCategory(db, 'sub-util-gas');
    expect(
      listCategoryTree(db, 'expense')
        .find((c) => c.id === 'cat-exp-utilities')
        ?.children.map((c) => c.id),
    ).not.toContain('sub-util-gas');
    expect(listCategoryTree(db, 'expense', { archived: true }).map((c) => c.id)).toEqual([
      'sub-util-gas',
    ]);
    archiveCategory(db, 'cat-exp-utilities');
    unarchiveCategory(db, 'sub-util-power');
    expect(getCategory(db, 'cat-exp-utilities')?.archivedAt).toBeNull();
  });
});
