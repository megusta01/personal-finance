/**
 * Decide quais lembretes agendar (função pura, testável sem celular).
 *
 * Para cada conta em aberto e cada fatura de cartão:
 *  - um aviso N dias antes do vencimento (se N > 0);
 *  - um aviso no dia do vencimento.
 * Contas já vencidas geram um único aviso-resumo no próximo horário.
 * O iOS guarda no máximo 64 lembretes agendados por app, então ficam os 60 mais próximos.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatBRL } from '@/lib/money';
import type { ISODate } from '@/lib/dates';

export const MAX_SCHEDULED = 60;

export type ReminderItem = {
  key: string;
  kind: 'expense' | 'income' | 'invoice';
  title: string;
  amountCents: number;
  dueOn: ISODate;
  /** Conta ou cartão, para o texto ("em Carteira"). */
  where?: string | null;
  url: string;
};

export type ReminderPrefs = { hour: number; daysBefore: number; hideValues: boolean };

export type PlannedReminder = { id: string; date: Date; title: string; body: string; url: string };

function at(date: ISODate, hour: number) {
  const d = parseISO(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function whenText(days: number) {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

function texts(item: ReminderItem, days: number, prefs: ReminderPrefs) {
  const value = prefs.hideValues ? null : formatBRL(item.amountCents);
  const where = item.where ? ` em ${item.where}` : '';
  switch (item.kind) {
    case 'invoice':
      return {
        title: `Fatura ${item.title} vence ${whenText(days)}`,
        body: value ? `Valor em aberto: ${value}.` : 'Abra o app para ver o valor.',
      };
    case 'income':
      return {
        title: `${item.title}: recebimento ${whenText(days)}`,
        body: value
          ? `${value}${where}. Marque como recebido quando entrar.`
          : 'Marque como recebido quando entrar.',
      };
    default:
      return {
        title: `${item.title} vence ${whenText(days)}`,
        body: value
          ? `${value}${where}. Toque para marcar como paga.`
          : 'Toque para marcar como paga.',
      };
  }
}

export function planReminders(
  items: ReminderItem[],
  prefs: ReminderPrefs,
  now: Date,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // próximo horário de aviso (hoje, se ainda não passou; senão amanhã)
  const nextSlot = new Date(today);
  nextSlot.setHours(prefs.hour, 0, 0, 0);
  if (nextSlot <= now) nextSlot.setDate(nextSlot.getDate() + 1);

  const overdue = items.filter((i) => i.kind !== 'income' && parseISO(i.dueOn) < today);
  if (overdue.length) {
    const total = overdue.reduce((s, i) => s + i.amountCents, 0);
    out.push({
      id: 'rem:overdue',
      date: nextSlot,
      title:
        overdue.length === 1
          ? `${overdue[0]!.title} está vencida`
          : `${overdue.length} contas vencidas`,
      body: prefs.hideValues
        ? 'Abra o app para ver e marcar como pagas.'
        : `Total de ${formatBRL(total)}. Abra o app para ver e marcar como pagas.`,
      url: '/pagamentos',
    });
  }

  for (const item of items) {
    const due = parseISO(item.dueOn);
    if (due < today) continue;
    if (prefs.daysBefore > 0) {
      const before = at(item.dueOn, prefs.hour);
      before.setDate(before.getDate() - prefs.daysBefore);
      if (before > now)
        out.push({
          id: `rem:${item.key}:before`,
          date: before,
          url: item.url,
          ...texts(item, prefs.daysBefore, prefs),
        });
    }
    const onDay = at(item.dueOn, prefs.hour);
    if (onDay > now)
      out.push({ id: `rem:${item.key}:day`, date: onDay, url: item.url, ...texts(item, 0, prefs) });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

/** Dias até o vencimento (para textos na tela). */
export function daysUntil(due: ISODate, now: Date = new Date()) {
  return differenceInCalendarDays(parseISO(due), now);
}
