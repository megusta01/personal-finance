import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CategoryIcon,
  Chip,
  CONTENT_MAX_WIDTH,
  Divider,
  EmptyState,
  IconButton,
  Money,
  OptionSheet,
  Text,
  type SheetOption,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { AccountIcon } from '@/features/accounts/AccountIcon';
import { listActiveAccounts } from '@/features/accounts/repository';
import { CardVisual } from '@/features/cards/CardVisual';
import { listCards } from '@/features/cards/repository';
import { listCategoryTree } from '@/features/categories/repository';
import { formatDayHeading, formatMonthLong, monthKey, shiftMonth } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';
import {
  listByMonth,
  monthTotals,
  signedAmount,
  TX_TABLES,
  type KindFilter,
  type TransactionRow,
} from './repository';
import { TransactionItem } from './TransactionItem';

type Props = {
  /** Conteúdo acima dos filtros (título, cartão da conta…). */
  header: ReactNode;
  /** Quando definido, a lista é só dessa conta e o filtro de conta some. */
  fixedAccountId?: string;
};

const ALL = '__all__';

/**
 * Extrato mensal com busca e filtros (tipo, conta, categoria), agrupado por dia.
 * Usado na aba Extrato e na tela de cada conta.
 */
export function TransactionFeed({ header, fixedAccountId }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'account' | 'category' | null>(null);

  // O filtro "conta" também aceita cartões (valor "card:<id>").
  const filterCardId = accountFilter?.startsWith('card:') ? accountFilter.slice(5) : null;
  const accountId = fixedAccountId ?? (filterCardId ? null : accountFilter);
  const { data } = useDbQuery(
    (db) => ({
      rows: listByMonth(db, {
        month,
        kind,
        search,
        accountId,
        categoryId: categoryFilter,
        cardId: filterCardId,
      }),
      totals: monthTotals(db, month, accountId, filterCardId),
      accounts: listActiveAccounts(db),
      cards: listCards(db),
      expenseTree: listCategoryTree(db, 'expense'),
      incomeTree: listCategoryTree(db, 'income'),
    }),
    TX_TABLES,
    [month, kind, search, accountId, categoryFilter, filterCardId],
  );

  const sections = useMemo(
    () => groupByDay(data?.rows ?? [], accountId, filterCardId),
    [data?.rows, accountId, filterCardId],
  );
  const totals = data?.totals ?? { incomeCents: 0, expenseCents: 0 };
  const result = totals.incomeCents - totals.expenseCents;
  const filtering =
    kind !== 'all' || search.trim().length > 0 || !!accountFilter || !!categoryFilter;

  const accountOptions: SheetOption<string>[] = [
    { value: ALL, label: 'Todas as contas e cartões' },
    ...(data?.accounts ?? []).map((a) => ({
      value: a.id,
      label: a.name,
      icon: <AccountIcon icon={a.icon} color={a.color} size={32} />,
    })),
    ...(data?.cards ?? []).map((c) => ({
      value: `card:${c.id}`,
      label: c.name,
      description: 'Cartão de crédito',
      icon: <CardVisual compact name={c.name} brand={c.brand} color={c.color} />,
    })),
  ];
  const categoryOptions: SheetOption<string>[] = [{ value: ALL, label: 'Todas as categorias' }];
  for (const [title, tree] of [
    ['Despesa', data?.expenseTree],
    ['Receita', data?.incomeTree],
  ] as const) {
    for (const c of tree ?? []) {
      categoryOptions.push({
        value: c.id,
        label: c.name,
        description: title,
        icon: <CategoryIcon icon={c.icon} color={c.color} size={32} />,
      });
      for (const s of c.children)
        categoryOptions.push({ value: s.id, label: s.name, indent: true });
    }
  }
  const accountName = accountOptions.find((o) => o.value === accountFilter)?.label;
  const categoryName = categoryOptions.find((o) => o.value === categoryFilter)?.label;

  const clearFilters = () => {
    setKind('all');
    setSearch('');
    setAccountFilter(null);
    setCategoryFilter(null);
  };

  const listHeader = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      {header}

      <View
        style={[styles.monthBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <IconButton
          icon="chevron-back"
          label="Mês anterior"
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
        />
        <Text variant="heading" accessibilityLiveRegion="polite">
          {formatMonthLong(month)}
        </Text>
        <IconButton
          icon="chevron-forward"
          label="Próximo mês"
          disabled={month >= current}
          color={month >= current ? colors.textSubtle : colors.text}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
        />
      </View>

      <View style={styles.summary}>
        <Summary label="Entradas" cents={totals.incomeCents} sign="income" tone="income" />
        <Summary label="Saídas" cents={totals.expenseCents} sign="expense" tone="default" />
        <Summary
          label="Resultado"
          cents={result}
          sign="auto"
          tone={result < 0 ? 'expense' : 'default'}
        />
      </View>

      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name="search" size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar na descrição ou observação"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel="Buscar"
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {search.length > 0 && (
          <IconButton
            icon="close-circle"
            size={18}
            label="Limpar busca"
            color={colors.textSubtle}
            onPress={() => setSearch('')}
          />
        )}
      </View>

      <View style={styles.chips}>
        <Chip label="Tudo" selected={kind === 'all'} onPress={() => setKind('all')} />
        <Chip label="Entradas" selected={kind === 'income'} onPress={() => setKind('income')} />
        <Chip label="Saídas" selected={kind === 'expense'} onPress={() => setKind('expense')} />
        <Chip
          label="Transferências"
          selected={kind === 'transfer'}
          onPress={() => setKind('transfer')}
        />
      </View>

      <View style={styles.chips}>
        {!fixedAccountId && (
          <FilterPill
            icon="wallet-outline"
            label={accountName ?? 'Todas as contas e cartões'}
            active={!!accountFilter}
            onPress={() => setSheet('account')}
          />
        )}
        <FilterPill
          icon="pricetag-outline"
          label={categoryName && categoryFilter ? categoryName : 'Todas as categorias'}
          active={!!categoryFilter}
          onPress={() => setSheet('category')}
        />
      </View>
    </View>
  );

  return (
    <>
      <SectionList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 },
        ]}
        sections={sections}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={listHeader}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text variant="caption" tone="muted">
              {formatDayHeading(section.date)}
            </Text>
            {section.hasPaid && (
              <Money cents={section.net} sign="auto" variant="caption" tone="subtle" />
            )}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              { backgroundColor: colors.surface, borderColor: colors.border },
              styles.itemWrap,
              index === 0 && styles.first,
              index === section.data.length - 1 && styles.last,
            ]}
          >
            {index > 0 && <Divider inset={68} />}
            <TransactionItem
              item={item}
              accountId={accountId}
              cardId={filterCardId}
              onPress={(id) => router.push(`/transacao/${id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          filtering ? (
            <EmptyState
              icon="search-outline"
              title="Nada encontrado"
              message="Tente outro termo ou limpe os filtros."
              actionLabel="Limpar filtros"
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title={`Sem movimentações em ${formatMonthLong(month).split(' ')[0]!.toLowerCase()}`}
              message="O que você registrar com data deste mês aparece aqui."
              actionLabel="Registrar movimentação"
              onAction={() =>
                router.push(
                  fixedAccountId
                    ? { pathname: '/transacao/nova', params: { conta: fixedAccountId } }
                    : '/transacao/nova',
                )
              }
            />
          )
        }
      />
      <OptionSheet
        visible={sheet === 'account'}
        title="Filtrar por conta ou cartão"
        options={accountOptions}
        value={accountFilter ?? ALL}
        onSelect={(v) => setAccountFilter(v === ALL ? null : v)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'category'}
        title="Filtrar por categoria"
        options={categoryOptions}
        value={categoryFilter ?? ALL}
        onSelect={(v) => setCategoryFilter(v === ALL ? null : v)}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

type DaySection = { date: string; net: number; hasPaid: boolean; data: TransactionRow[] };

function groupByDay(
  rows: TransactionRow[],
  accountId: string | null | undefined,
  cardId: string | null,
): DaySection[] {
  const out: DaySection[] = [];
  for (const r of rows) {
    let s = out[out.length - 1];
    if (!s || s.date !== r.occurredOn) {
      s = { date: r.occurredOn, net: 0, hasPaid: false, data: [] };
      out.push(s);
    }
    s.data.push(r);
    // "A pagar/receber" aparece na lista, mas não entra no total do dia.
    if (r.status !== 'pending') {
      s.net += signedAmount(r, accountId, cardId);
      s.hasPaid = true;
    }
  }
  return out;
}

function FilterPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fg = active ? colors.brand : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filtro: ${label}`}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: active ? colors.brand : colors.border,
          backgroundColor: active ? colors.brandSoft : colors.surface,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={15} color={fg} />
      <Text
        variant="caption"
        numberOfLines={1}
        style={{ color: active ? colors.brand : colors.text, flexShrink: 1 }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={fg} />
    </Pressable>
  );
}

function Summary({
  label,
  cents,
  sign,
  tone,
}: {
  label: string;
  cents: number;
  sign: 'income' | 'expense' | 'auto';
  tone: 'income' | 'expense' | 'default';
}) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Money
        cents={cents}
        sign={sign}
        variant="bodyStrong"
        tone={tone}
        adjustsFontSizeToFit
        numberOfLines={1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  summary: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingLeft: space.md,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 15,
    paddingVertical: space.sm,
    outlineStyle: 'none',
  } as object,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    maxWidth: '100%',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  itemWrap: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
});
