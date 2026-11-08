import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Chip,
  ColorPicker,
  ConfirmDialog,
  DatePickerSheet,
  Field,
  FormLayout,
  IconPicker,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { listActiveAccounts } from '@/features/accounts/repository';
import { GOAL_COLORS, GOAL_ICONS } from '@/features/goals/meta';
import {
  archiveGoal,
  createGoal,
  deleteGoal,
  getGoal,
  updateGoal,
} from '@/features/goals/repository';
import { formatDateField, todayISO } from '@/lib/dates';
import { space } from '@/theme/tokens';

/** Criar (sem id) ou editar (com ?id=) uma meta. */
export default function EditarMeta() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const toast = useToast();
  const [goal] = useState(() => (id ? getGoal(db, id) : undefined));
  const { data: accounts } = useDbQuery((d) => listActiveAccounts(d), ['accounts']);

  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal?.targetCents ?? 0);
  const [targetDate, setTargetDate] = useState<string | null>(goal?.targetDate ?? null);
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0]!);
  const [icon, setIcon] = useState<string>(goal?.icon ?? GOAL_ICONS[0]!);
  const [accountId, setAccountId] = useState<string | null>(goal?.accountId ?? null);
  const [dateOpen, setDateOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    try {
      const input = { name, targetCents: target, targetDate, color, icon, accountId };
      if (goal) updateGoal(db, goal.id, input);
      else createGoal(db, input);
      toast({ message: goal ? 'Meta atualizada' : 'Meta criada' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title={goal ? 'Editar meta' : 'Nova meta'}
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
            label={goal ? 'Salvar alterações' : 'Criar meta'}
            disabled={!name.trim() || target <= 0}
            onPress={save}
          />
        </>
      }
    >
      <TextField
        label="Nome"
        placeholder="Ex.: Reserva de emergência, Viagem para o Chile"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />

      <Field label="Quanto quer juntar">
        <MoneyInput value={target} onChange={setTarget} accessibilityLabel="Valor da meta" />
      </Field>

      <Field label="Até quando" hint="Opcional. Com prazo, o app calcula quanto guardar por mês.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label="Sem prazo" selected={!targetDate} onPress={() => setTargetDate(null)} />
          <Chip
            icon="calendar-outline"
            label={targetDate ? formatDateField(targetDate) : 'Escolher data'}
            selected={!!targetDate}
            onPress={() => setDateOpen(true)}
          />
        </View>
      </Field>

      <Field
        label="Como acompanhar"
        hint={
          accountId
            ? 'O progresso é o saldo dessa conta.'
            : 'Você registra quanto guardou ou retirou.'
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip
            label="Eu registro os valores"
            selected={!accountId}
            onPress={() => setAccountId(null)}
          />
          {(accounts ?? []).map((a) => (
            <Chip
              key={a.id}
              icon={ACCOUNT_TYPE_META[a.type].icon}
              label={`Saldo de ${a.name}`}
              selected={accountId === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>
      </Field>

      <Field label="Cor">
        <ColorPicker colors={GOAL_COLORS} value={color} onChange={setColor} />
      </Field>
      <Field label="Ícone">
        <IconPicker icons={GOAL_ICONS} value={icon} color={color} onChange={setIcon} />
      </Field>

      {goal && (
        <View style={{ gap: space.sm }}>
          <Button
            label={goal.archivedAt ? 'Reativar meta' : 'Arquivar meta'}
            variant="secondary"
            icon={goal.archivedAt ? 'refresh' : 'archive-outline'}
            onPress={() => {
              archiveGoal(db, goal.id, !goal.archivedAt);
              toast({ message: goal.archivedAt ? 'Meta reativada' : 'Meta arquivada' });
              router.dismissTo('/metas');
            }}
          />
          <Button
            label="Excluir meta"
            variant="danger"
            icon="trash-outline"
            onPress={() => setConfirm(true)}
          />
        </View>
      )}

      <DatePickerSheet
        visible={dateOpen}
        value={targetDate ?? todayISO()}
        onSelect={setTargetDate}
        onClose={() => setDateOpen(false)}
      />
      <ConfirmDialog
        visible={confirm}
        title="Excluir esta meta?"
        message="A meta e o histórico de valores guardados nela serão removidos. Suas contas não mudam."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (goal) deleteGoal(db, goal.id);
          setConfirm(false);
          toast({ message: 'Meta excluída' });
          router.dismissTo('/metas');
        }}
        onCancel={() => setConfirm(false)}
      />
    </FormLayout>
  );
}
