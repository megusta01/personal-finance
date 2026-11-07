import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Text } from './Text';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Painel que sobe do rodapé (escolher conta, categoria, etc.). */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityLabel="Fechar"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text variant="heading" style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: space.sm }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export type SheetOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Recuo para mostrar subitens (subcategorias). */
  indent?: boolean;
};

type OptionSheetProps<T extends string> = Omit<SheetProps, 'children'> & {
  options: SheetOption<T>[];
  value: T | null;
  onSelect: (v: T) => void;
};

/** Lista de opções com marcação na escolhida. */
export function OptionSheet<T extends string>({
  options,
  value,
  onSelect,
  ...sheet
}: OptionSheetProps<T>) {
  const { colors } = useTheme();
  return (
    <Sheet {...sheet}>
      <View accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => {
                onSelect(o.value);
                sheet.onClose();
              }}
              style={({ pressed }) => [
                styles.option,
                o.indent && { paddingLeft: space.xxxl + space.md },
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              {o.icon}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant={selected ? 'bodyStrong' : 'body'}>{o.label}</Text>
                {o.description && (
                  <Text variant="caption" tone="muted">
                    {o.description}
                  </Text>
                )}
              </View>
              {selected && <Ionicons name="checkmark" size={22} color={colors.brand} />}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  title: { paddingHorizontal: space.xl, marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
});
