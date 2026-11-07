import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Text } from './Text';

type ToastOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};
type ToastState = ToastOptions & { id: number };

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Aviso curto no rodapé, com ação opcional (ex.: "Desfazer" depois de excluir). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();

  const show = useCallback((t: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = setTimeout(
      () => setToast((cur) => (cur?.id === id ? null : cur)),
      t.duration ?? 4000,
    );
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const bg = scheme === 'dark' ? colors.surfaceMuted : colors.text;
  const fg = scheme === 'dark' ? colors.text : colors.bg;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
        >
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(160)}
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: bg, marginBottom: insets.bottom + 84 }]}
          >
            <Text variant="bodyStrong" style={{ color: fg, flex: 1 }}>
              {toast.message}
            </Text>
            {toast.actionLabel && (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                <Text variant="bodyStrong" style={{ color: colors.accent }}>
                  {toast.actionLabel}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    marginHorizontal: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    maxWidth: 520,
    alignSelf: 'center',
    width: '92%',
  },
});
