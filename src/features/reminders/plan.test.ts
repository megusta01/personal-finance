import { describe, expect, it } from 'vitest';
import { MAX_SCHEDULED, planReminders, type ReminderItem } from './plan';

const now = new Date(2026, 10, 8, 10, 30); // 08/11/2026 10:30
const prefs = { hour: 9, daysBefore: 2, hideValues: false };
const item = (over: Partial<ReminderItem>): ReminderItem => ({
  key: 'x',
  kind: 'expense',
  title: 'Aluguel',
  amountCents: 150000,
  dueOn: '2026-11-15',
  where: 'Carteira',
  url: '/transacao/x',
  ...over,
});

describe('planReminders', () => {
  it('avisa N dias antes e no dia, no horário escolhido', () => {
    const plan = planReminders([item({})], prefs, now);
    expect(plan.map((p) => [p.id, p.date.toISOString(), p.title])).toEqual([
      ['rem:x:before', new Date(2026, 10, 13, 9).toISOString(), 'Aluguel vence em 2 dias'],
      ['rem:x:day', new Date(2026, 10, 15, 9).toISOString(), 'Aluguel vence hoje'],
    ]);
    expect(plan[0]?.body).toBe('R$ 1.500,00 em Carteira. Toque para marcar como paga.');
  });

  it('não agenda no passado: o aviso de hoje às 9h já passou às 10h30', () => {
    const plan = planReminders(
      [item({ dueOn: '2026-11-08' }), item({ key: 'y', dueOn: '2026-11-10' })],
      prefs,
      now,
    );
    expect(plan.map((p) => p.id)).toEqual(['rem:y:day']);
  });

  it('contas vencidas viram um resumo no próximo horário', () => {
    const plan = planReminders(
      [
        item({ key: 'a', dueOn: '2026-11-01' }),
        item({ key: 'b', dueOn: '2026-11-05', amountCents: 5000 }),
      ],
      prefs,
      now,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      id: 'rem:overdue',
      title: '2 contas vencidas',
      url: '/pagamentos',
    });
    expect(plan[0]?.date.toISOString()).toBe(new Date(2026, 10, 9, 9).toISOString());
    expect(plan[0]?.body).toContain('R$ 1.550,00');
  });

  it('fatura e recebimento têm textos próprios; "ocultar valores" esconde o valor', () => {
    const plan = planReminders(
      [
        item({ key: 'f', kind: 'invoice', title: 'Nubank', dueOn: '2026-11-10' }),
        item({ key: 'r', kind: 'income', title: 'Freela', dueOn: '2026-11-10' }),
      ],
      { ...prefs, daysBefore: 0, hideValues: true },
      now,
    );
    expect(plan.map((p) => p.title).sort()).toEqual([
      'Fatura Nubank vence hoje',
      'Freela: recebimento hoje',
    ]);
    expect(plan.every((p) => !p.body.includes('R$'))).toBe(true);
  });

  it('limita a quantidade (iOS aceita no máximo 64)', () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      item({ key: `k${i}`, dueOn: `2026-12-${String((i % 28) + 1).padStart(2, '0')}` }),
    );
    expect(planReminders(many, prefs, now)).toHaveLength(MAX_SCHEDULED);
  });
});
