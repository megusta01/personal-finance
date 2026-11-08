import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryIcon, Money, Text } from '@/components/ui';
import { formatDateShort, formatMonthShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { signedAmount, type TransactionRow } from './repository';

type Props = {
  item: TransactionRow;
  onPress?: (id: string) => void;
  showDate?: boolean;
  /** Quando a lista é de uma conta, transferências e pagamentos de fatura aparecem como entrada/saída dela. */
  accountId?: string | null;
  /** Quando a lista é de um cartão, o pagamento aparece como crédito na fatura. */
  cardId?: string | null;
};

export function categoryLabel(item: Pick<TransactionRow, 'categoryName' | 'parentCategoryName'>) {
  if (!item.categoryName) return 'Sem categoria';
  return item.parentCategoryName
    ? `${item.parentCategoryName} › ${item.categoryName}`
    : item.categoryName;
}

function subtitleOf(item: TransactionRow, cardId?: string | null) {
  switch (item.kind) {
    case 'transfer':
      return `${item.accountName ?? '?'} → ${item.toAccountName ?? '?'}`;
    case 'card_payment':
      return `${item.accountName ?? '?'} → ${item.cardName ?? 'cartão'}, fatura de ${item.invoiceMonth ? formatMonthShort(item.invoiceMonth) : '?'}`;
    default:
      // Dentro da tela do cartão não precisa repetir o nome dele.
      return item.cardId && item.cardId !== cardId
        ? `${categoryLabel(item)}, ${item.cardName ?? 'cartão'}`
        : categoryLabel(item);
  }
}

export const TransactionItem = memo(function TransactionItem({
  item,
  onPress,
  showDate,
  accountId,
  cardId,
}: Props) {
  const { colors } = useTheme();
  const neutral =
    (item.kind === 'transfer' || item.kind === 'card_payment') && !accountId && !cardId;
  const signed = signedAmount(item, accountId, cardId);
  const subtitle = [subtitleOf(item, cardId), showDate ? formatDateShort(item.occurredOn) : null]
    .filter(Boolean)
    .join(', ');
  const installment =
    item.installmentNumber && item.installmentCount
      ? `${item.installmentNumber}/${item.installmentCount}`
      : null;

  return (
    <Pressable
      onPress={() => onPress?.(item.id)}
      accessibilityRole="button"
      accessibilityHint="Abre para editar"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {item.kind === 'transfer' || item.kind === 'card_payment' ? (
        <View style={[styles.roundIcon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons
            name={item.kind === 'transfer' ? 'swap-horizontal' : 'card-outline'}
            size={19}
            color={colors.brand}
          />
        </View>
      ) : (
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.description}
          </Text>
          {item.status === 'pending' && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
              <Text variant="micro" style={{ color: colors.accent }}>
                {item.kind === 'income' ? 'A receber' : 'A pagar'}
              </Text>
            </View>
          )}
          {item.recurrenceId && (
            <Ionicons
              name="repeat"
              size={13}
              color={colors.textSubtle}
              accessibilityLabel="Recorrente"
            />
          )}
          {installment && (
            <View
              style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}
              accessibilityLabel={`Parcela ${item.installmentNumber} de ${item.installmentCount}`}
            >
              <Text variant="micro" tone="muted" tabular>
                {installment}
              </Text>
            </View>
          )}
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {neutral || item.status === 'pending' ? (
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  roundIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
