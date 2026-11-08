import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Chip,
  DatePickerSheet,
  Field,
  FormLayout,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb } from '@/db/client';
import { addGoalEntry, getGoal, savedFor } from '@/features/goals/repository';
import { formatDateField, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Guardar ou retirar dinheiro de uma meta. Parâmetros: id e tipo (guardar | retirar). */
export default function MovimentarMeta() {
  const { id, tipo } = useLocalSearchParams<{ id: string; tipo?: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const withdraw = tipo === 'retirar';
  const [state] = useState(() => {
    const goal = id ? getGoal(db, id) : undefined;
    return goal ? { goal, saved: savedFor(db, goal) } : null;
  });
  const [amount, setAmount] = useState(0);
  const [on, setOn] = useState(todayISO());
  const [note, setNote] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;

  const save = () => {
    try {
      addGoalEntry(db, state.goal.id, withdraw ? -amount : amount, on, note);
      toast({ message: withdraw ? 'Valor retirado da meta' : 'Valor guardado na meta' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title={withdraw ? `Retirar de ${state.goal.name}` : `Guardar em ${state.goal.name}`}
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center">
              {error}
            </Text>
          )}
          <Button
            size="lg"
            label={withdraw ? 'Retirar' : 'Guardar'}
            disabled={amount <= 0}
            onPress={save}
          />
        </>
      }
    >
      <Field
        label={withdraw ? 'Quanto retirar' : 'Quanto guardar'}
        hint={`Guardado até agora: ${formatBRL(state.saved)}`}
      >
        <MoneyInput
          value={amount}
          onChange={setAmount}
          color={withdraw ? undefined : colors.income}
          autoFocus
          accessibilityLabel="Valor"
        />
      </Field>
      <Field label="Data">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Hoje" selected={on === todayISO()} onPress={() => setOn(todayISO())} />
          <Chip
            icon="calendar-outline"
            label={on === todayISO() ? 'Outra data' : formatDateField(on)}
            selected={on !== todayISO()}
            onPress={() => setDateOpen(true)}
          />
        </View>
      </Field>
      <TextField
        label="Observação"
        placeholder="Opcional"
        value={note}
        onChangeText={setNote}
        maxLength={120}
      />
      <DatePickerSheet
        visible={dateOpen}
        value={on}
        onSelect={setOn}
        onClose={() => setDateOpen(false)}
      />
    </FormLayout>
  );
}
