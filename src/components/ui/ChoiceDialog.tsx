import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export type Choice<T extends string> = {
  value: T;
  label: string;
  destructive?: boolean;
  primary?: boolean;
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  message?: string;
  choices: Choice<T>[];
  onChoose: (v: T) => void;
  onCancel: () => void;
};

/** Diálogo com várias opções empilhadas (ex.: "Só esta" / "Esta e as próximas"). */
export function ChoiceDialog<T extends string>({
  visible,
  title,
  message,
  choices,
  onChoose,
  onCancel,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onCancel}
        accessibilityLabel="Fechar"
      >
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          accessibilityViewIsModal
        >
          <Text variant="heading">{title}</Text>
          {message && (
            <Text tone="muted" style={{ marginTop: space.sm }}>
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            {choices.map((c) => (
              <Button
                key={c.value}
                label={c.label}
                variant={c.primary ? 'primary' : c.destructive ? 'danger' : 'secondary'}
                onPress={() => onChoose(c.value)}
                style={
                  c.destructive && c.primary
                    ? { backgroundColor: colors.danger, borderColor: colors.danger }
                    : undefined
                }
              />
            ))}
            <Button label="Cancelar" variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.xxl },
  card: {
    borderRadius: radius.xl,
    padding: space.xl,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  actions: { gap: space.sm, marginTop: space.xl },
});
