import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Divider, EmptyState, Screen, SectionHeader, Surface, Text } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { BalanceCard } from '@/features/home/BalanceCard';
import { MonthlyChart } from '@/features/home/MonthlyChart';
import { TransactionItem } from '@/features/transactions/TransactionItem';
import {
  listRecent,
  monthlySeries,
  monthTotals,
  totalBalance,
  TX_TABLES,
} from '@/features/transactions/repository';
import { formatDayHeading, greeting, monthKey, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function Home() {
  const month = monthKey(new Date());
  const { data } = useDbQuery(
    (db) => ({
      balance: totalBalance(db),
      totals: monthTotals(db, month),
      series: monthlySeries(db, month, 6),
      recent: listRecent(db, 5),
    }),
    TX_TABLES,
    [month],
  );

  const today = formatDayHeading(todayISO(), { relative: false });

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text variant="title" accessibilityRole="header">
          {greeting()}
        </Text>
        <Text tone="muted">{today}</Text>
      </View>

      <BalanceCard
        balanceCents={data?.balance ?? 0}
        incomeCents={data?.totals.incomeCents ?? 0}
        expenseCents={data?.totals.expenseCents ?? 0}
        month={month}
      />

      <QuickActions />

      <SectionHeader title="Últimos 6 meses" />
      <Surface style={{ padding: space.lg }}>
        <MonthlyChart data={data?.series ?? []} current={month} />
      </Surface>

      <SectionHeader
        title="Movimentações recentes"
        action={
          data?.recent.length ? (
            <Pressable onPress={() => router.push('/extrato')} accessibilityRole="link" hitSlop={8}>
              <Text variant="bodyStrong" tone="brand">
                Ver extrato
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <Surface>
        {data?.recent.length ? (
          data.recent.map((t, i) => (
            <View key={t.id}>
              {i > 0 && <Divider inset={68} />}
              <TransactionItem
                item={t}
                showDate
                onPress={(id) => router.push(`/transacao/${id}`)}
              />
            </View>
          ))
        ) : (
          <EmptyState
            icon="add-circle-outline"
            title="Nenhuma movimentação ainda"
            message="Registre um gasto ou uma entrada e acompanhe seu saldo por aqui."
            actionLabel="Registrar a primeira"
            onAction={() => router.push('/transacao/nova')}
          />
        )}
      </Surface>
    </Screen>
  );
}

const ACTIONS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  tone: 'income' | 'expense' | 'brand';
}[] = [
  {
    label: 'Despesa',
    icon: 'arrow-up',
    href: { pathname: '/transacao/nova', params: { tipo: 'expense' } },
    tone: 'expense',
  },
  {
    label: 'Receita',
    icon: 'arrow-down',
    href: { pathname: '/transacao/nova', params: { tipo: 'income' } },
    tone: 'income',
  },
  { label: 'Extrato', icon: 'receipt-outline', href: '/extrato', tone: 'brand' },
  { label: 'Câmbio', icon: 'swap-horizontal', href: '/cambio', tone: 'brand' },
];

function QuickActions() {
  const { colors } = useTheme();
  const bg = { income: colors.incomeSoft, expense: colors.expenseSoft, brand: colors.brandSoft };
  const fg = { income: colors.income, expense: colors.expense, brand: colors.brand };
  return (
    <View style={styles.actions}>
      {ACTIONS.map((a) => (
        <Pressable
          key={a.label}
          onPress={() => router.push(a.href)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: bg[a.tone] }]}>
            <Ionicons name={a.icon} size={22} color={fg[a.tone]} />
          </View>
          <Text variant="caption">{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs },
  action: { alignItems: 'center', gap: space.sm, width: 72 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
