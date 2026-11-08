import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import {
  Button,
  CategoryIcon,
  Chip,
  ConfirmDialog,
  DatePickerSheet,
  EmptyState,
  Field,
  FormLayout,
  MoneyInput,
  OptionSheet,
  Text,
  TextField,
  useToast,
  type SheetOption,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { listActiveAccounts } from '@/features/accounts/repository';
import { listCards } from '@/features/cards/repository';
import { getCategory, listCategoryTree } from '@/features/categories/repository';
import { REPEAT_OPTIONS, repeatKeyOf, type RepeatKey } from '@/features/recurrences/meta';
import {
  deleteRecurrence,
  getRecurrence,
  lastDate,
  pauseRecurrence,
  resumeRecurrence,
  scheduleOf,
  updateRecurrenceFrom,
} from '@/features/recurrences/repository';
import { describeSchedule, nextOccurrence } from '@/features/recurrences/schedule';
import { formatDateField, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/**
 * Editar uma recorrência inteira (daqui pra frente). O que já foi pago não muda;
 * as ocorrências em aberto são refeitas a partir do "próximo vencimento".
 */
export default function EditarRecorrencia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const today = todayISO();
  const [rule] = useState(() => (id ? getRecurrence(db, id) : undefined));

  const [description, setDescription] = useState(rule?.description ?? '');
  const [amount, setAmount] = useState(rule?.amountCents ?? 0);
  const [variableAmount, setVariableAmount] = useState(rule?.variableAmount ?? false);
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [source, setSource] = useState(() =>
    rule?.cardId ? `card:${rule.cardId}` : (rule?.accountId ?? ''),
  );
  const [repeat, setRepeat] = useState<RepeatKey>(() =>
    rule ? (repeatKeyOf(rule.frequency, rule.interval) ?? 'm1') : 'm1',
  );
  const [nextDate, setNextDate] = useState(() =>
    rule ? (nextOccurrence(scheduleOf(rule), today) ?? today) : today,
  );
  const [endOn, setEndOn] = useState<string | null>(() => (rule ? lastDate(rule) : null));
  const [autoPay, setAutoPay] = useState(rule?.autoPay ?? false);
  const [sheet, setSheet] = useState<'category' | 'next' | 'end' | null>(null);
  const [confirm, setConfirm] = useState<'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useDbQuery(
    (d) => ({
      accounts: listActiveAccounts(d),
      cards: listCards(d),
      tree: rule ? listCategoryTree(d, rule.kind) : [],
      category: categoryId ? getCategory(d, categoryId) : undefined,
    }),
    ['accounts', 'credit_cards', 'categories'],
    [categoryId],
  );

  if (!rule) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Recorrência não encontrada"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const isCard = source.startsWith('card:');
  const opt = REPEAT_OPTIONS.find((o) => o.key === repeat)!;
  const preview = describeSchedule({
    frequency: opt.frequency ?? 'monthly',
    interval: opt.interval ?? 1,
    startOn: nextDate,
    endOn,
  });

  const categoryOptions: SheetOption<string>[] = [];
  for (const c of data?.tree ?? []) {
    categoryOptions.push({
      value: c.id,
      label: c.name,
      icon: <CategoryIcon icon={c.icon} color={c.color} size={32} />,
    });
    for (const s of c.children) categoryOptions.push({ value: s.id, label: s.name, indent: true });
  }

  const save = () => {
    try {
      updateRecurrenceFrom(db, rule.id, {
        kind: rule.kind,
        amountCents: amount,
        variableAmount,
        description,
        categoryId,
        accountId: isCard ? null : source,
        cardId: isCard ? source.slice(5) : null,
        frequency: opt.frequency ?? 'monthly',
        interval: opt.interval ?? 1,
        startOn: nextDate,
        endOn,
        maxCount: null,
        autoPay: isCard ? false : autoPay,
        notes: rule.notes,
      });
      toast({ message: 'Recorrência atualizada' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title="Editar recorrência"
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
            label="Salvar alterações"
            disabled={!description.trim() || amount <= 0}
            onPress={save}
          />
        </>
      }
    >
      <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="caption" tone="muted">
          As mudanças valem a partir do próximo vencimento. O que já foi pago continua igual.
        </Text>
      </View>

      <TextField label="Nome" value={description} onChangeText={setDescription} maxLength={80} />

      <Field label={rule.kind === 'income' ? 'Valor' : 'Valor'}>
        <MoneyInput
          value={amount}
          onChange={setAmount}
          color={rule.kind === 'income' ? colors.income : undefined}
          accessibilityLabel="Valor"
        />
      </Field>

      <SwitchRow
        title="Valor muda a cada vez"
        subtitle="Na hora de pagar, o app pede o valor certo."
        value={variableAmount}
        onChange={setVariableAmount}
      />

      <Field label="Categoria">
        <Pressable
          onPress={() => setSheet('category')}
          accessibilityRole="button"
          style={[styles.select, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <CategoryIcon icon={data?.category?.icon} color={data?.category?.color} size={32} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {data?.category?.name ?? 'Escolher'}
          </Text>
          <Text variant="caption" tone="brand">
            Trocar
          </Text>
        </Pressable>
      </Field>

      <Field label={rule.kind === 'income' ? 'Recebido em' : 'Pagar com'}>
        <View style={styles.row}>
          {(data?.accounts ?? []).map((a) => (
            <Chip
              key={a.id}
              icon={ACCOUNT_TYPE_META[a.type].icon}
              label={a.name}
              selected={source === a.id}
              onPress={() => setSource(a.id)}
            />
          ))}
          {rule.kind === 'expense' &&
            (data?.cards ?? []).map((c) => (
              <Chip
                key={c.id}
                icon="card-outline"
                label={c.name}
                selected={source === `card:${c.id}`}
                onPress={() => setSource(`card:${c.id}`)}
              />
            ))}
        </View>
      </Field>

      <Field label="Repetir" hint={preview}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          {REPEAT_OPTIONS.filter((o) => o.key !== 'none').map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={repeat === o.key}
              onPress={() => setRepeat(o.key)}
            />
          ))}
        </ScrollView>
      </Field>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <DateBox
          label="Próximo vencimento"
          value={formatDateField(nextDate)}
          onPress={() => setSheet('next')}
        />
        <DateBox
          label="Termina"
          value={endOn ? formatDateField(endOn) : 'Nunca'}
          onPress={() => setSheet('end')}
        />
      </View>
      {endOn && <Chip label="Remover data final" icon="close" onPress={() => setEndOn(null)} />}

      {!isCard && (
        <SwitchRow
          title={rule.kind === 'income' ? 'Cai automaticamente' : 'Débito automático'}
          subtitle={
            rule.kind === 'income'
              ? 'Marca como recebido sozinho no dia.'
              : 'Marca como pago sozinho no dia do vencimento.'
          }
          value={autoPay}
          onChange={setAutoPay}
        />
      )}

      <View style={{ gap: space.sm }}>
        {rule.pausedAt ? (
          <Button
            label="Retomar"
            variant="secondary"
            icon="play"
            onPress={() => {
              resumeRecurrence(db, rule.id);
              toast({ message: 'Recorrência retomada' });
              router.back();
            }}
          />
        ) : (
          <Button
            label="Pausar"
            variant="secondary"
            icon="pause"
            onPress={() => {
              pauseRecurrence(db, rule.id);
              toast({ message: 'Recorrência pausada. As próximas não serão lançadas.' });
              router.back();
            }}
          />
        )}
        <Button
          label="Excluir recorrência"
          variant="danger"
          icon="trash-outline"
          onPress={() => setConfirm('delete')}
        />
      </View>

      <OptionSheet
        visible={sheet === 'category'}
        title="Categoria"
        options={categoryOptions}
        value={categoryId}
        onSelect={setCategoryId}
        onClose={() => setSheet(null)}
      />
      <DatePickerSheet
        visible={sheet === 'next'}
        value={nextDate}
        onSelect={setNextDate}
        onClose={() => setSheet(null)}
      />
      <DatePickerSheet
        visible={sheet === 'end'}
        value={endOn ?? nextDate}
        onSelect={setEndOn}
        onClose={() => setSheet(null)}
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        title="Excluir esta recorrência?"
        message="As próximas ocorrências em aberto somem. O que já foi pago continua no histórico."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          deleteRecurrence(db, rule.id);
          setConfirm(null);
          toast({ message: 'Recorrência excluída' });
          router.back();
        }}
        onCancel={() => setConfirm(null)}
      />
    </FormLayout>
  );
}

function DateBox({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.dateBox,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </Pressable>
  );
}

function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { padding: space.md, borderRadius: radius.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dateBox: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 2,
  },
});
