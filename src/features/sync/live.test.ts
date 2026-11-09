import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/db/client';
import { migrate } from '@/db/migrations';
import { DEFAULT_ACCOUNT } from '@/db/seed';
import { createTransaction, type TransactionInput } from '@/features/transactions/repository';
import { cloudRemote, openCloud } from '@/test/cloud';
import { migrationDb, openTestDb, testDrizzle } from '@/test/sqlite';
import { syncOnce } from './engine';
import {
  isNewerThanLocal,
  startLive,
  type LiveEvent,
  type LiveSource,
  type LiveStatus,
} from './live';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const ANA = '11111111-1111-4111-8111-111111111111';

async function device(): Promise<AppDb> {
  const raw = openTestDb();
  await migrate(migrationDb(raw));
  return testDrizzle(raw);
}

const coffee = {
  kind: 'expense',
  amountCents: 900,
  description: 'Café',
  categoryId: 'cat-exp-food',
  accountId: DEFAULT_ACCOUNT.id,
  occurredOn: '2026-11-09',
} as TransactionInput;

/** Fonte de avisos de mentira: o teste decide quando "a nuvem" avisa. */
function fakeSource() {
  const h: { event?: (e: LiveEvent) => void; status?: (s: LiveStatus) => void; stopped: boolean } =
    { stopped: false };
  const source: LiveSource = (_user, onEvent, onStatus) => {
    h.event = onEvent;
    h.status = onStatus;
    return () => void (h.stopped = true);
  };
  return { source, h };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('atualização ao vivo', () => {
  it('ignora avisos do que o aparelho já tem (inclusive o que ele mesmo enviou)', async () => {
    const db = await device();
    const id = createTransaction(db, coffee);
    const row = db.get<{ updated_at: string }>(
      (await import('drizzle-orm')).sql`SELECT updated_at FROM transactions WHERE id = ${id}`,
    )!;
    expect(isNewerThanLocal(db, { table: 'transactions', id, updatedAt: row.updated_at })).toBe(
      false,
    );
    expect(
      isNewerThanLocal(db, { table: 'transactions', id, updatedAt: '2999-01-01T00:00:00.000Z' }),
    ).toBe(true);
    expect(isNewerThanLocal(db, { table: 'transactions', id: 'outro', updatedAt: 'x' })).toBe(true);
    expect(isNewerThanLocal(db, { table: 'app_meta', id: 'x', updatedAt: 'x' })).toBe(false);
    // Aviso sem os dados (ex.: coluna fora do payload): busca por garantia.
    expect(isNewerThanLocal(db, { table: 'goals' })).toBe(true);
  });

  it('junta avisos em sequência num recebimento só e busca ao (re)conectar', async () => {
    const db = await device();
    const { source, h } = fakeSource();
    const pulls: number[] = [];
    const statuses: LiveStatus[] = [];
    const stop = startLive(
      db,
      ANA,
      source,
      () => pulls.push(Date.now()),
      (s) => statuses.push(s),
    );

    h.status?.('live');
    expect(pulls).toHaveLength(1); // conectou: busca o que mudou enquanto estava fora
    for (let i = 0; i < 5; i++)
      h.event?.({ table: 'transactions', id: `t${i}`, updatedAt: '2026-11-09T10:00:00.000Z' });
    vi.advanceTimersByTime(299);
    expect(pulls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(pulls).toHaveLength(2);

    h.status?.('error');
    h.status?.('live'); // reconectou
    expect(pulls).toHaveLength(3);

    stop();
    expect(h.stopped).toBe(true);
    h.event?.({ table: 'transactions', id: 'tarde', updatedAt: '2999-01-01T00:00:00.000Z' });
    vi.advanceTimersByTime(1000);
    expect(pulls).toHaveLength(3);
    expect(statuses).toEqual(['live', 'error', 'live', 'off']);
  });

  it('o aviso de outro aparelho faz este receber a mudança', async () => {
    vi.useRealTimers();
    const cloud = await openCloud();
    await cloud.addUser(ANA);
    const a = await device();
    const b = await device();
    const { source, h } = fakeSource();
    let pulled: Promise<unknown> = Promise.resolve();
    startLive(
      b,
      ANA,
      source,
      () => void (pulled = syncOnce(b, cloudRemote(cloud, ANA), ANA)),
      () => {},
      0,
    );
    const id = createTransaction(a, { ...coffee, description: 'Lançado no celular' });
    await syncOnce(a, cloudRemote(cloud, ANA), ANA);
    const row = a.get<{ updated_at: string }>(
      (await import('drizzle-orm')).sql`SELECT updated_at FROM transactions WHERE id = ${id}`,
    )!;
    h.event?.({ table: 'transactions', id, updatedAt: row.updated_at });
    await new Promise((r) => setTimeout(r, 10));
    await pulled;
    const got = b.get<{ description: string }>(
      (await import('drizzle-orm')).sql`SELECT description FROM transactions WHERE id = ${id}`,
    );
    expect(got?.description).toBe('Lançado no celular');
  });
});
