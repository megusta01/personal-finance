import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  EmptyState,
  IconButton,
  Money,
  Screen,
  SectionHeader,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { GoalCard } from '@/features/goals/GoalCard';
import {
  deleteGoalEntry,
  getGoal,
  GOAL_TABLES,
  listGoalEntries,
  progressOf,
  restoreGoalEntry,
} from '@/features/goals/repository';
import { formatDateShort, formatMonthLong } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function MetaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const { data } = useDbQuery(
    (d) => {
      const goal = getGoal(d, id);
      return goal ? { goal: progressOf(d, goal), entries: listGoalEntries(d, goal.id) } : null;
    },
    GOAL_TABLES,
    [id],
  );

  if (data === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Meta não encontrada"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (!data) return null;
  const { goal, entries } = data;
  const manual = !goal.accountId;

  return (
    <Screen
      back
      title={goal.name}
      right={
        <IconButton
          icon="create-outline"
          label="Editar meta"
          onPress={() => router.push({ pathname: '/meta/editar', params: { id: goal.id } })}
        />
      }
    >
      <GoalCard goal={goal} />

      {!goal.done && (
        <Surface style={{ padding: space.lg, gap: space.xs }}>
          <Text variant="caption" tone="muted">
            Falta juntar
          </Text>
          <Money cents={goal.remainingCents} variant="title" />
          {goal.monthlyNeededCents !== null && goal.monthsLeft !== null && goal.targetDate && (
            <Text variant="caption" tone="muted">
              Guardando{' '}
              <Money
                cents={goal.monthlyNeededCents}
                variant="caption"
                tone="default"
                style={{ fontWeight: '700' }}
              />{' '}
              por mês nos próximos {goal.monthsLeft} {goal.monthsLeft === 1 ? 'mês' : 'meses'}, você
              chega lá em {formatMonthLong(goal.targetDate.slice(0, 7)).toLowerCase()}.
            </Text>
          )}
        </Surface>
      )}

      {manual ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            label="Guardar"
            icon="add"
            style={{ flex: 1 }}
            onPress={() =>
              router.push({
                pathname: '/meta/movimentar/[id]',
                params: { id: goal.id, tipo: 'guardar' },
              })
            }
          />
          <Button
            label="Retirar"
            icon="remove"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={goal.savedCents <= 0}
            onPress={() =>
              router.push({
                pathname: '/meta/movimentar/[id]',
                params: { id: goal.id, tipo: 'retirar' },
              })
            }
          />
        </View>
      ) : (
        <Surface style={{ padding: space.lg }}>
          <Text variant="caption" tone="muted">
            Esta meta acompanha o saldo de {goal.accountName}. Para guardar, transfira dinheiro para
            essa conta.
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/transacao/nova', params: { tipo: 'transfer' } })
            }
            accessibilityRole="link"
            style={{ marginTop: space.sm }}
          >
            <Text variant="bodyStrong" tone="brand">
              Fazer transferência
            </Text>
          </Pressable>
        </Surface>
      )}

      {manual && (
        <>
          <SectionHeader title="Histórico" />
          <Surface>
            {entries.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="Nada guardado ainda"
                message="Cada vez que guardar ou retirar, aparece aqui."
              />
            ) : (
              entries.map((e, i) => (
                <View key={e.id}>
                  {i > 0 && <Divider inset={space.lg} />}
                  <View style={styles.entry}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong">
                        {e.amountCents > 0 ? 'Guardado' : 'Retirado'}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {formatDateShort(e.occurredOn)}
                        {e.note ? `, ${e.note}` : ''}
                      </Text>
                    </View>
                    <Money
                      cents={Math.abs(e.amountCents)}
                      sign={e.amountCents > 0 ? 'income' : 'expense'}
                      variant="bodyStrong"
                      tone={e.amountCents > 0 ? 'income' : 'default'}
                    />
                    <IconButton
                      icon="trash-outline"
                      label="Excluir lançamento da meta"
                      size={18}
                      color={colors.textSubtle}
                      onPress={() => {
                        deleteGoalEntry(db, e.id);
                        toast({
                          message: 'Lançamento excluído',
                          actionLabel: 'Desfazer',
                          onAction: () => restoreGoalEntry(db, e.id),
                          duration: 6000,
                        });
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </Surface>
          <Text variant="caption" tone="subtle">
            O dinheiro das metas é um controle à parte: guardar aqui não tira o valor de nenhuma
            conta.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.sm,
  },
});
