import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** Largura máxima do conteúdo em tablets e no navegador. */
export const CONTENT_MAX_WIDTH = 640;

type Props = ScrollViewProps & {
  title?: string;
  right?: ReactNode;
  /** Mostra o botão de voltar (telas empilhadas, fora das abas). */
  back?: boolean;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  title,
  right,
  back,
  children,
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        ) : undefined
      }
      {...rest}
    >
      {(title || right || back) && <ScreenHeader title={title} right={right} back={back} />}
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  right,
  back,
}: {
  title?: string;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: space.xs }}>
        {back && (
          <IconButton
            icon="chevron-back"
            label="Voltar"
            style={{ marginLeft: -space.md }}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )}
        {title ? (
          <Text
            variant="title"
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    gap: space.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    marginBottom: -space.xs,
  },
});
