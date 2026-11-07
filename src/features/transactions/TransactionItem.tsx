import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryIcon, Money, Text } from '@/components/ui';
import { formatDateShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import type { TransactionRow } from './repository';

type Props = {
  item: TransactionRow;
  onPress?: (id: string) => void;
  showDate?: boolean;
};

export const TransactionItem = memo(function TransactionItem({ item, onPress, showDate }: Props) {
  const { colors } = useTheme();
  const isIncome = item.kind === 'income';
  const subtitle = [
    item.categoryName ?? 'Sem categoria',
    showDate ? formatDateShort(item.occurredOn) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPress?.(item.id)}
      accessibilityRole="button"
      accessibilityHint="Abre para editar"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.description}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Money
        cents={item.amountCents}
        sign={isIncome ? 'income' : 'expense'}
        variant="bodyStrong"
        tone={isIncome ? 'income' : 'default'}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 64,
  },
  body: { flex: 1, gap: 2 },
});
