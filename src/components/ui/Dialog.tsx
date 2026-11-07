import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação no visual do app (o Alert nativo não funciona no navegador). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
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
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              style={[
                { flex: 1 },
                destructive && { backgroundColor: colors.danger, borderColor: colors.danger },
              ]}
            />
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
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
});
