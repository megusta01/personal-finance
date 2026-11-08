import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDb } from '@/db/client';
import { reminderItems } from '@/features/bills/repository';
import { generateAll } from '@/features/recurrences/repository';
import { getPrefs, subscribePrefs } from '@/lib/prefs';
import { applyPlan, cancelAll, configureNotifications, hasPermission } from './notifications';
import { planReminders } from './plan';

const WATCHED = new Set(['transactions', 'recurrences', 'credit_cards', 'accounts']);

/**
 * Tarefas em segundo plano enquanto o app está aberto:
 *  - cria as ocorrências das recorrências (ao abrir e ao voltar para o app, ex.: virou o dia);
 *  - reagenda os lembretes sempre que algo muda;
 *  - abre a tela certa quando a pessoa toca num lembrete.
 */
export function BackgroundJobs() {
  const db = useDb();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    const reschedule = async () => {
      const prefs = getPrefs();
      try {
        if (!prefs.remindersEnabled || !(await hasPermission())) return cancelAll();
        const plan = planReminders(
          reminderItems(db),
          {
            hour: prefs.reminderHour,
            daysBefore: prefs.reminderDaysBefore,
            hideValues: prefs.hideValues,
          },
          new Date(),
        );
        if (alive) await applyPlan(plan);
      } catch (e) {
        console.warn('[lembretes]', e);
      }
    };
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(reschedule, 1500);
    };
    const refresh = () => {
      try {
        generateAll(db);
      } catch (e) {
        console.warn('[recorrências]', e);
      }
      soon();
    };

    configureNotifications().catch(() => {});
    refresh();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const dbSub = addDatabaseChangeListener(({ tableName }) => WATCHED.has(tableName) && soon());
    const unsubPrefs = subscribePrefs(soon);
    return () => {
      alive = false;
      appState.remove();
      dbSub.remove();
      unsubPrefs();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db]);

  // Toque num lembrete: abre a conta, a fatura ou a lista de contas a pagar.
  useEffect(() => {
    if (!lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = lastResponse.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
  }, [lastResponse]);

  return null;
}
