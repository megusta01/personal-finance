import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Normalmente o botão principal (Salvar). Fica fixo no rodapé. */
  footer?: ReactNode;
};

/** Estrutura dos formulários em modal: barra com fechar e título, conteúdo rolável e rodapé fixo. */
export function FormLayout({ title, onClose, children, footer }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.topBar,
          { paddingTop: Platform.OS === 'android' ? insets.top + space.sm : space.md },
        ]}
      >
        <IconButton icon="close" label="Fechar" onPress={onClose} />
        <Text
          variant="heading"
          accessibilityRole="header"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {title}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + space.md,
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
            },
          ]}
        >
          <View style={styles.footerInner}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
    paddingBottom: space.xxxl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerInner: { width: '100%', maxWidth: 608, alignSelf: 'center', gap: space.sm },
});
