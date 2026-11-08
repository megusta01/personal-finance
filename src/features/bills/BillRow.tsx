import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryIcon, Money, Text } from '@/components/ui';
import { daysUntil } from '@/features/reminders/plan';
import type { TransactionRow } from '@/features/transactions/repository';
import { categoryLabel } from '@/features/transactions/TransactionItem';
import { formatDateShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Linha de conta a pagar/receber, com o botão rápido "Pagar"/"Recebi". */
export function BillRow({ item, overdue }: { item: TransactionRow; overdue?: boolean }) {
  const { colors } = useTheme();
  const due = item.dueOn ?? item.occurredOn;
  const days = daysUntil(due);
  const when =
    days < 0
      ? `venceu há ${-days} dia${days === -1 ? '' : 's'}`
      : days === 0
        ? 'vence hoje'
        : days === 1
          ? 'vence amanhã'
          : `vence ${formatDateShort(due).slice(0, 5)}`;
  const isIncome = item.kind === 'income';
  return (
    <View style={styles.row}>
      {/* Área principal abre a edição; o botão Pagar fica separado (sem botão dentro de botão). */}
      <Pressable
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
        onPress={() => router.push(`/transacao/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.description}, ${when}`}
        accessibilityHint="Abre para editar"
      >
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.description}
            </Text>
            {item.recurrenceId && (
              <Ionicons
                name="repeat"
                size={14}
                color={colors.textSubtle}
                accessibilityLabel="Recorrente"
              />
            )}
          </View>
          <Text variant="caption" tone={overdue ? 'expense' : 'muted'} numberOfLines={1}>
            {isIncome ? when.replace('venceu', 'previsto').replace('vence', 'previsto') : when}
          </Text>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {item.accountName ?? categoryLabel(item)}
          </Text>
        </View>
      </Pressable>
      <View style={styles.right}>
        <Money
          cents={item.amountCents}
          variant="bodyStrong"
          tone={overdue ? 'expense' : isIncome ? 'income' : 'default'}
        />
        <Pressable
          onPress={() => router.push(`/pagamentos/pagar/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={
            isIncome ? `Marcar ${item.description} como recebido` : `Pagar ${item.description}`
          }
          hitSlop={6}
          style={({ pressed }) => [
            styles.payBtn,
            { backgroundColor: isIncome ? colors.incomeSoft : colors.brandSoft },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="checkmark" size={14} color={isIncome ? colors.income : colors.brand} />
          <Text variant="micro" style={{ color: isIncome ? colors.income : colors.brand }}>
            {isIncome ? 'Recebi' : 'Pagar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.lg },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingVertical: space.md,
  },
  right: { alignItems: 'flex-end', gap: space.xs + 2 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    minHeight: 30,
    borderRadius: radius.pill,
  },
});
