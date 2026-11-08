import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Divider, EmptyState, Money, Screen, SectionHeader, Surface, Text } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { BalanceCard } from '@/features/home/BalanceCard';
import { MonthlyChart } from '@/features/home/MonthlyChart';
import { TransactionItem } from '@/features/transactions/TransactionItem';
import { AccountIcon } from '@/features/accounts/AccountIcon';
import { listAccountsWithBalance } from '@/features/accounts/repository';
import {
  listRecent,
  monthlySeries,
  monthTotals,
  totalBalance,
  TX_TABLES,
} from '@/features/transactions/repository';
import { CardVisual } from '@/features/cards/CardVisual';
import { STATUS_META } from '@/features/cards/meta';
import { listCardsOverview } from '@/features/cards/repository';
import { formatDateShort, formatDayHeading, greeting, monthKey, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

function SeeAll({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="link" hitSlop={8}>
      <Text variant="bodyStrong" tone="brand">
        {label}
      </Text>
    </Pressable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const month = monthKey(new Date());
  const { data } = useDbQuery(
    (db) => ({
      balance: totalBalance(db),
      totals: monthTotals(db, month),
      series: monthlySeries(db, month, 6),
      recent: listRecent(db, 5),
      accounts: listAccountsWithBalance(db),
      cards: listCardsOverview(db),
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

      {((data?.accounts.length ?? 0) > 1 || (data?.cards.length ?? 0) > 0) && (
        <>
          <SectionHeader
            title={(data?.cards.length ?? 0) > 0 ? 'Contas e cartões' : 'Suas contas'}
            action={<SeeAll label="Ver contas" href="/contas" />}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md }}
            style={{ marginHorizontal: -space.lg }}
          >
            <View style={{ width: space.lg - space.md }} />
            {data!.accounts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => router.push(`/conta/${a.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Conta ${a.name}`}
                style={({ pressed }) => [
                  styles.accountCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <AccountIcon icon={a.icon} color={a.color} size={32} />
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {a.name}
                </Text>
                <Money
                  cents={a.balanceCents}
                  variant="bodyStrong"
                  tone={a.balanceCents < 0 ? 'expense' : 'default'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                />
              </Pressable>
            ))}
            {data!.cards.map((c) => {
              const inv = c.current;
              const amount =
                inv.paidCents > 0 && inv.status !== 'paid' ? inv.remainingCents : inv.totalCents;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/cartao/${c.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Cartão ${c.name}`}
                  style={({ pressed }) => [
                    styles.accountCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: inv.status === 'overdue' ? colors.expense : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <CardVisual compact name={c.name} brand={c.brand} color={c.color} />
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Money
                    cents={amount}
                    variant="bodyStrong"
                    tone={inv.status === 'overdue' ? 'expense' : 'default'}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text
                    variant="micro"
                    tone={inv.status === 'overdue' ? 'expense' : 'subtle'}
                    numberOfLines={1}
                  >
                    {STATUS_META[inv.status].label}, vence{' '}
                    {formatDateShort(inv.dates.dueDate).slice(0, 5)}
                  </Text>
                </Pressable>
              );
            })}
            <View style={{ width: space.lg - space.md }} />
          </ScrollView>
        </>
      )}

      <SectionHeader title="Últimos 6 meses" />
      <Surface style={{ padding: space.lg }}>
        <MonthlyChart data={data?.series ?? []} current={month} />
      </Surface>

      <SectionHeader
        title="Movimentações recentes"
        action={data?.recent.length ? <SeeAll label="Ver extrato" href="/extrato" /> : undefined}
      />
      <Surface>
        {data?.recent.length ? (
          data.recent.map((t, i) => (
            <View key={t.id}>
              {i > 0 && <Divider inset={68} />}
              <TransactionItem
                item={t}
                accountId={null}
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
  {
    label: 'Transferir',
    icon: 'swap-horizontal',
    href: { pathname: '/transacao/nova', params: { tipo: 'transfer' } },
    tone: 'brand',
  },
  { label: 'Câmbio', icon: 'globe-outline', href: '/cambio', tone: 'brand' },
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
  accountCard: {
    width: 148,
    padding: space.md + 2,
    gap: space.xs + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
