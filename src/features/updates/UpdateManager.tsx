import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useToast } from '@/components/ui';

/** Ao voltar para o app, procura versão nova no máximo a cada 30 minutos. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Atualizações pelo EAS Update (sem instalar APK novo).
 * O expo-updates já procura e baixa uma versão nova ao abrir o app; ela vale a partir da
 * próxima abertura. Aqui o app também procura ao voltar do segundo plano e, quando a versão
 * nova está baixada, oferece reiniciar na hora. No Expo Go, no navegador e em
 * desenvolvimento, isso fica desligado (Updates.isEnabled = false).
 */
export function UpdateManager() {
  const toast = useToast();
  const { isUpdatePending } = Updates.useUpdates();
  // O próprio expo-updates já procurou ao abrir o app; conta a partir daí.
  const lastCheck = useRef(0);
  const offered = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    lastCheck.current = Date.now();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Sem internet ou servidor fora: tenta de novo na próxima vez.
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending || offered.current) return;
    offered.current = true;
    toast({
      message: 'Nova versão do app pronta',
      actionLabel: 'Reiniciar',
      onAction: () => void Updates.reloadAsync(),
      duration: 10000,
    });
  }, [isUpdatePending, toast]);

  return null;
}
