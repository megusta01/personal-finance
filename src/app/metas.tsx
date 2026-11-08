import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState, IconButton, ListRow, Screen, SectionHeader, Surface } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { GoalCard } from '@/features/goals/GoalCard';
import { GOAL_TABLES, listGoals } from '@/features/goals/repository';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Metas() {
  const { colors } = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useDbQuery(
    (db) => ({ active: listGoals(db), archived: listGoals(db, { archived: true }) }),
    GOAL_TABLES,
  );
  const active = data?.active ?? [];
  const archived = data?.archived ?? [];

  return (
    <Screen
      back
      title="Metas"
      right={
        <IconButton
          icon="add"
          label="Nova meta"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() => router.push('/meta/editar')}
        />
      }
    >
      {active.length === 0 ? (
        <Surface>
          <EmptyState
            icon="flag-outline"
            title="Nenhuma meta ainda"
            message="Reserva de emergência, viagem, troca de carro… Defina quanto quer juntar e até quando; o app diz quanto guardar por mês."
            actionLabel="Criar meta"
            onAction={() => router.push('/meta/editar')}
          />
        </Surface>
      ) : (
        <View style={{ gap: space.md }}>
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} onPress={() => router.push(`/meta/${g.id}`)} />
          ))}
        </View>
      )}
      {archived.length > 0 && (
        <>
          <SectionHeader title="Arquivadas" />
          <Surface>
            <ListRow
              title={
                showArchived
                  ? 'Esconder metas arquivadas'
                  : `Mostrar ${archived.length} arquivada${archived.length > 1 ? 's' : ''}`
              }
              tone="muted"
              chevron={false}
              onPress={() => setShowArchived((v) => !v)}
            />
          </Surface>
          {showArchived &&
            archived.map((g) => (
              <GoalCard key={g.id} goal={g} onPress={() => router.push(`/meta/${g.id}`)} />
            ))}
        </>
      )}
    </Screen>
  );
}
