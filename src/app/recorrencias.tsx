import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  CategoryIcon,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  Money,
  Screen,
  SectionHeader,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { getCategory } from '@/features/categories/repository';
import {
  listRecurrencesOverview,
  RECURRENCE_TABLES,
  scheduleOf,
  type RecurrenceOverview,
} from '@/features/recurrences/repository';
import { describeSchedule } from '@/features/recurrences/schedule';
import { formatDateShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Recorrencias() {
  const { colors } = useTheme();
  const { data } = useDbQuery(
    (db) =>
      listRecurrencesOverview(db).map((r) => {
        const cat = r.categoryId ? getCategory(db, r.categoryId) : undefined;
        return { ...r, categoryIcon: cat?.icon ?? null, categoryColor: cat?.color ?? null };
      }),
    RECURRENCE_TABLES,
  );
  const all = data ?? [];
  const expenses = all.filter((r) => r.kind === 'expense');
  const incomes = all.filter((r) => r.kind === 'income');
  // Estimativa mensal das despesas fixas ativas
  const monthly = expenses
    .filter((r) => !r.pausedAt && r.nextDate)
    .reduce((s, r) => s + monthlyEquivalent(r), 0);

  return (
    <Screen
      back
      title="Recorrências"
      right={
        <IconButton
          icon="add"
          label="Nova recorrência"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() =>
            router.push({ pathname: '/transacao/nova', params: { tipo: 'expense', pendente: '1' } })
          }
        />
      }
    >
      {all.length === 0 ? (
        <Surface>
          <EmptyState
            icon="repeat"
            title="Nenhuma recorrência"
            message="Aluguel, luz, assinaturas, salário… Crie um lançamento e escolha “Repetir” para o app lançar sozinho todo mês."
            actionLabel="Criar recorrência"
            onAction={() =>
              router.push({
                pathname: '/transacao/nova',
                params: { tipo: 'expense', pendente: '1' },
              })
            }
          />
        </Surface>
      ) : (
        <>
          {expenses.length > 0 && (
            <View style={{ gap: 2 }}>
              <Text variant="caption" tone="muted">
                Despesas fixas por mês (aproximado)
              </Text>
              <Money cents={monthly} variant="title" />
            </View>
          )}
          <Group title="Despesas" items={expenses} />
          <Group title="Receitas" items={incomes} />
        </>
      )}
    </Screen>
  );
}

type Row = RecurrenceOverview & { categoryIcon: string | null; categoryColor: string | null };

function Group({ title, items }: { title: string; items: Row[] }) {
  const { colors } = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={title} />
      <Surface>
        {items.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider inset={68} />}
            <ListRow
              title={r.description}
              subtitle={`${describeSchedule(scheduleOf(r))}${r.pausedAt ? ', pausada' : r.nextDate ? `, próxima ${formatDateShort(r.nextDate).slice(0, 5)}` : ', encerrada'}${r.cardId ? ', no cartão' : ''}`}
              tone={r.pausedAt || !r.nextDate ? 'muted' : 'default'}
              left={<CategoryIcon icon={r.categoryIcon} color={r.categoryColor} />}
              right={
                <View style={{ alignItems: 'flex-end' }}>
                  <Money
                    cents={r.amountCents}
                    variant="bodyStrong"
                    tone={r.kind === 'income' ? 'income' : 'default'}
                  />
                  {r.variableAmount && (
                    <Text variant="micro" tone="subtle">
                      valor variável
                    </Text>
                  )}
                  {r.autoPay && (
                    <Ionicons
                      name="flash-outline"
                      size={12}
                      color={colors.textSubtle}
                      accessibilityLabel="Automático"
                    />
                  )}
                </View>
              }
              onPress={() => router.push(`/recorrencia/${r.id}`)}
              chevron={false}
            />
          </View>
        ))}
      </Surface>
    </View>
  );
}

function monthlyEquivalent(r: RecurrenceOverview) {
  const n = Math.max(1, r.interval);
  if (r.frequency === 'weekly') return Math.round((r.amountCents * 52) / 12 / n);
  if (r.frequency === 'yearly') return Math.round(r.amountCents / 12 / n);
  return Math.round(r.amountCents / n);
}
