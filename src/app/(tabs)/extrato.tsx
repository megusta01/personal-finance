import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Chip,
  CONTENT_MAX_WIDTH,
  Divider,
  EmptyState,
  IconButton,
  Money,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { TransactionItem } from '@/features/transactions/TransactionItem';
import {
  listByMonth,
  monthTotals,
  TX_TABLES,
  type TransactionRow,
} from '@/features/transactions/repository';
import { formatDayHeading, formatMonthLong, monthKey, shiftMonth } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';

type Kind = 'all' | 'income' | 'expense';

export default function Extrato() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = monthKey(new Date());
  const [month, setMonth] = useState(current);
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');

  const { data } = useDbQuery(
    (db) => ({ rows: listByMonth(db, { month, kind, search }), totals: monthTotals(db, month) }),
    TX_TABLES,
    [month, kind, search],
  );

  const sections = useMemo(() => groupByDay(data?.rows ?? []), [data?.rows]);
  const totals = data?.totals ?? { incomeCents: 0, expenseCents: 0 };
  const result = totals.incomeCents - totals.expenseCents;
  const filtering = kind !== 'all' || search.trim().length > 0;

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <Text variant="title" accessibilityRole="header">
        Extrato
      </Text>

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
          placeholder="Buscar pela descrição"
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel="Buscar pela descrição"
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
      </View>
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 },
      ]}
      sections={sections}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHeader}>
          <Text variant="caption" tone="muted">
            {formatDayHeading(section.date)}
          </Text>
          <Money cents={section.net} sign="auto" variant="caption" tone="subtle" />
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
          <TransactionItem item={item} onPress={(id) => router.push(`/transacao/${id}`)} />
        </View>
      )}
      ListEmptyComponent={
        filtering ? (
          <EmptyState
            icon="search-outline"
            title="Nada encontrado"
            message="Tente outro termo ou limpe os filtros."
            actionLabel="Limpar filtros"
            onAction={() => {
              setKind('all');
              setSearch('');
            }}
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title={`Sem movimentações em ${formatMonthLong(month).split(' ')[0]!.toLowerCase()}`}
            message="O que você registrar com data deste mês aparece aqui."
            actionLabel="Registrar movimentação"
            onAction={() => router.push('/transacao/nova')}
          />
        )
      }
    />
  );
}

type DaySection = { date: string; net: number; data: TransactionRow[] };

function groupByDay(rows: TransactionRow[]): DaySection[] {
  const out: DaySection[] = [];
  for (const r of rows) {
    let s = out[out.length - 1];
    if (!s || s.date !== r.occurredOn) {
      s = { date: r.occurredOn, net: 0, data: [] };
      out.push(s);
    }
    s.data.push(r);
    s.net += r.kind === 'income' ? r.amountCents : -r.amountCents;
  }
  return out;
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
  chips: { flexDirection: 'row', gap: space.sm },
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
