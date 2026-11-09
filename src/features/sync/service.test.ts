import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ supabase: null }));
vi.mock('./session', () => ({ currentSession: () => null }));
vi.mock('@/features/recurrences/repository', () => ({ generateAll: () => {} }));

const { describeSyncError } = await import('./service');
const { RemoteError } = await import('./supabaseRemote');

describe('mensagens de erro do sync', () => {
  it('PGRST002 e erros 5xx são passageiros (tenta de novo sozinho)', () => {
    const e = new RemoteError(
      'Could not query the database for the schema cache. Retrying.',
      'PGRST002',
      503,
    );
    expect(describeSyncError(e).kind).toBe('unavailable');
    expect(describeSyncError(new RemoteError('Bad gateway', undefined, 502)).kind).toBe(
      'unavailable',
    );
  });
  it('tabela que não existe pede para rodar o schema.sql', () => {
    expect(describeSyncError(new RemoteError('x', 'PGRST205', 404)).kind).toBe('setup');
  });
  it('falha de rede vira "sem conexão"', () => {
    expect(describeSyncError(new TypeError('Failed to fetch')).kind).toBe('offline');
  });
});
