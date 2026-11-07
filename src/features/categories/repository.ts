import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { AppDb } from '@/db/client';
import { categories, transactions, type Category, type CategoryKind } from '@/db/schema';
import { nowTimestamp } from '@/lib/dates';

export const CATEGORY_TABLES = ['categories'];

export type CategoryNode = Category & { children: Category[] };

/**
 * Categorias de um tipo em árvore (pai → subcategorias), sem as de sistema.
 * Por padrão só as ativas; com `archived: true`, só as arquivadas (pais ou filhas).
 */
export function listCategoryTree(
  db: AppDb,
  kind: CategoryKind,
  { archived = false } = {},
): CategoryNode[] {
  const rows = db
    .select()
    .from(categories)
    .where(
      and(eq(categories.kind, kind), isNull(categories.deletedAt), eq(categories.isSystem, false)),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  const isArchived = (c: Category) => c.archivedAt !== null;
  const parents = rows.filter((c) => !c.parentId);
  const childrenOf = (id: string) => rows.filter((c) => c.parentId === id);

  if (!archived) {
    return parents
      .filter((p) => !isArchived(p))
      .map((p) => ({ ...p, children: childrenOf(p.id).filter((c) => !isArchived(c)) }));
  }
  // Arquivadas: pais arquivados (com todas as filhas) + filhas arquivadas de pais ativos.
  const out: CategoryNode[] = [];
  for (const p of parents) {
    if (isArchived(p)) out.push({ ...p, children: childrenOf(p.id) });
    else for (const c of childrenOf(p.id).filter(isArchived)) out.push({ ...c, children: [] });
  }
  return out;
}

export function getCategory(db: AppDb, id: string): Category | undefined {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
    .get();
}

/** IDs da categoria e de todas as suas subcategorias (para filtros e contagens). */
export function categoryFamilyIds(db: AppDb, id: string): string[] {
  const kids = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)))
    .all();
  return [id, ...kids.map((k) => k.id)];
}

export function categoryUsage(db: AppDb, id: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        inArray(transactions.categoryId, categoryFamilyIds(db, id)),
      ),
    )
    .get();
  return row?.n ?? 0;
}

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  /** Preenchido para criar uma subcategoria. */
  parentId?: string | null;
};

function nextSortOrder(db: AppDb, kind: CategoryKind, parentId: string | null) {
  const row = db
    .select({ max: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
    .from(categories)
    .where(
      and(
        eq(categories.kind, kind),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
      ),
    )
    .get();
  return (row?.max ?? 0) + 1;
}

export function createCategory(db: AppDb, input: CategoryInput): string {
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome para a categoria.');
  let { kind, icon, color } = input;
  const parentId = input.parentId ?? null;
  if (parentId) {
    const parent = getCategory(db, parentId);
    if (!parent || parent.parentId)
      throw new Error('Subcategorias só podem ficar dentro de uma categoria principal.');
    // Subcategoria herda tipo, ícone e cor da categoria pai.
    ({ kind, icon, color } = parent);
  }
  const id = randomUUID();
  const now = nowTimestamp();
  db.insert(categories)
    .values({
      id,
      name,
      kind,
      icon,
      color,
      parentId,
      sortOrder: nextSortOrder(db, kind, parentId),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

export function updateCategory(
  db: AppDb,
  id: string,
  input: Pick<CategoryInput, 'name' | 'icon' | 'color'>,
) {
  const name = input.name.trim();
  if (!name) throw new Error('Dê um nome para a categoria.');
  const current = getCategory(db, id);
  if (!current) throw new Error('Categoria não encontrada.');
  if (current.isSystem) throw new Error('Esta categoria é do sistema e não pode ser alterada.');
  const now = nowTimestamp();
  if (current.parentId) {
    db.update(categories).set({ name, updatedAt: now }).where(eq(categories.id, id)).run();
    return;
  }
  db.update(categories)
    .set({ name, icon: input.icon, color: input.color, updatedAt: now })
    .where(eq(categories.id, id))
    .run();
  // Subcategorias acompanham o visual da categoria pai.
  db.update(categories)
    .set({ icon: input.icon, color: input.color, updatedAt: now })
    .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)))
    .run();
}

/** Arquivar tira a categoria (e as subcategorias) da lista de escolha, mas o histórico continua. */
export function archiveCategory(db: AppDb, id: string) {
  const now = nowTimestamp();
  db.update(categories)
    .set({ archivedAt: now, updatedAt: now })
    .where(
      and(or(eq(categories.id, id), eq(categories.parentId, id)), isNull(categories.archivedAt)),
    )
    .run();
}

export function unarchiveCategory(db: AppDb, id: string) {
  const cat = getCategory(db, id);
  if (!cat) return;
  const now = nowTimestamp();
  // Reativar uma subcategoria reativa também a categoria pai, se ela estiver arquivada.
  const ids = cat.parentId ? [id, cat.parentId] : [id];
  db.update(categories)
    .set({ archivedAt: null, updatedAt: now })
    .where(
      and(
        cat.parentId
          ? inArray(categories.id, ids)
          : or(eq(categories.id, id), eq(categories.parentId, id)),
        isNotNull(categories.archivedAt),
      ),
    )
    .run();
}

/** Só exclui se nenhuma transação usar a categoria (nem as subcategorias). */
export function deleteCategory(db: AppDb, id: string) {
  const cat = getCategory(db, id);
  if (!cat) return;
  if (cat.isSystem) throw new Error('Esta categoria é do sistema e não pode ser excluída.');
  if (categoryUsage(db, id) > 0)
    throw new Error('Esta categoria tem movimentações. Arquive em vez de excluir.');
  const now = nowTimestamp();
  db.update(categories)
    .set({ deletedAt: now, updatedAt: now })
    .where(or(eq(categories.id, id), eq(categories.parentId, id)))
    .run();
}
