import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { authenticate, lockSupported } from './auth';

/** Depois de quanto tempo fora do app ele volta a pedir desbloqueio. */
const RELOCK_AFTER_MS = 60_000;

/**
 * Bloqueio do app. Com o bloqueio ligado:
 *  - ao abrir e ao voltar depois de 1 minuto, pede biometria (ou a senha do celular);
 *  - na lista de apps abertos, o conteúdo fica coberto (ninguém vê saldos de relance).
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { lockEnabled } = usePrefs();
  const active = lockSupported && lockEnabled;
  const [locked, setLocked] = useState(active);
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const leftAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      setBusy(false);
    }
  }, []);

  // Ligar o bloqueio nas configurações não tranca na hora: `locked` só vira true ao abrir
  // o app ou ao voltar depois de 1 minuto (a pessoa acabou de se autenticar para ligar).

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        if (leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
        leftAt.current = null;
      } else {
        setCovered(true);
        leftAt.current ??= Date.now();
      }
    });
    return () => sub.remove();
  }, [active]);

  // Pede a biometria assim que a tela de bloqueio aparece (logo depois de ela ser desenhada).
  useEffect(() => {
    if (!locked || !active || AppState.currentState !== 'active') return;
    const t = setTimeout(() => void unlock(), 250);
    return () => clearTimeout(t);
  }, [locked, active, unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {active && (locked || covered) && (
        <LockScreen onUnlock={unlock} busy={busy} showButton={locked} />
      )}
    </View>
  );
}

function LockScreen({
  onUnlock,
  busy,
  showButton,
}: {
  onUnlock: () => void;
  busy: boolean;
  showButton: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.heroBg }]}
      accessibilityViewIsModal
    >
      <View style={[styles.badge, { borderColor: colors.heroLine }]}>
        <Ionicons name="lock-closed" size={34} color={colors.heroText} />
      </View>
      <Text variant="title" style={{ color: colors.heroText }}>
        Finanças
      </Text>
      {showButton && (
        <>
          <Text style={{ color: colors.heroMuted }} align="center">
            Seus dados estão protegidos.
          </Text>
          <Button
            label="Desbloquear"
            icon="finger-print"
            onPress={onUnlock}
            loading={busy}
            style={{
              marginTop: space.lg,
              minWidth: 200,
              backgroundColor: colors.heroText,
              borderColor: colors.heroText,
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xxl,
    zIndex: 100,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
