import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedReminder } from './plan';

/**
 * Notificações locais (agendadas no próprio aparelho). Funcionam no Expo Go;
 * só as notificações push, vindas de servidor, precisariam de um development build.
 * Na web não há lembretes.
 */

export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

const CHANNEL = 'vencimentos';
let configured = false;

export async function configureNotifications() {
  if (!remindersSupported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Vencimentos',
      description: 'Contas a pagar, recebimentos e faturas de cartão',
      // eslint-disable-next-line import/namespace -- o enum existe (vem de um `export *`), o lint não enxerga
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function hasPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Pede permissão (mostra o pedido do sistema só se ainda não foi respondido). */
export async function requestPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

/** Troca todos os lembretes agendados pelo plano novo. */
export async function applyPlan(plan: PlannedReminder[]) {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.date,
        channelId: CHANNEL,
      },
    });
  }
}

export async function cancelAll() {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
