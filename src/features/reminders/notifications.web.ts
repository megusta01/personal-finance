import type { PlannedReminder } from './plan';

/** Na web não há lembretes agendados: tudo aqui é vazio. */
export const remindersSupported = false;
export async function configureNotifications() {}
export async function hasPermission() {
  return false;
}
export async function requestPermission() {
  return false;
}
export async function applyPlan(_plan: PlannedReminder[]) {}
export async function cancelAll() {}
