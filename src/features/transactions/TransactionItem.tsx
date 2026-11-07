import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryIcon, Money, Text } from '@/components/ui';
import { formatDateShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { signedAmount, type TransactionRow } from './repository';

type Props = {
  item: TransactionRow;
  onPress?: (id: string) => void;
  showDate?: boolean;
  /** Quando a lista é de uma conta, a transferência aparece como entrada ou saída dela. */
  accountId?: string | null;
};

export function categoryLabel(item: Pick<TransactionRow, 'categoryName' | 'parentCategoryName'>) {
  if (!item.categoryName) return 'Sem categoria';
  return item.parentCategoryName
    ? `${item.parentCategoryName} › ${item.categoryName}`
    : item.categoryName;
}

export const TransactionItem = memo(function TransactionItem({
  item,
  onPress,
  showDate,
  accountId,
}: Props) {
  const { colors } = useTheme();
  const isTransfer = item.kind === 'transfer';
  const signed = signedAmount(item, accountId);

  const main = isTransfer
    ? `${item.accountName ?? '?'} → ${item.toAccountName ?? '?'}`
    : categoryLabel(item);
  const subtitle = [main, showDate ? formatDateShort(item.occurredOn) : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onPress?.(item.id)}
      accessibilityRole="button"
      accessibilityHint="Abre para editar"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {isTransfer ? (
        <View style={[styles.transferIcon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="swap-horizontal" size={19} color={colors.brand} />
        </View>
      ) : (
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
      )}
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.description}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {isTransfer && !accountId ? (
        <Money cents={item.amountCents} variant="bodyStrong" tone="muted" />
      ) : (
        <Money
          cents={Math.abs(signed)}
          sign={signed >= 0 ? 'income' : 'expense'}
          variant="bodyStrong"
          tone={signed > 0 ? 'income' : 'default'}
        />
      )}
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
  transferIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
