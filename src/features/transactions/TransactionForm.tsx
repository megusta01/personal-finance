import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import {
  Button,
  CategoryIcon,
  Chip,
  ConfirmDialog,
  DatePickerSheet,
  IconButton,
  MoneyInput,
  Segmented,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { DEFAULT_ACCOUNT, FALLBACK_CATEGORY } from '@/db/seed';
import { listAccounts, listCategories } from '@/features/catalog/repository';
import { daysAgoISO, formatDateField, todayISO } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from './repository';

const schema = z.object({
  kind: z.enum(['expense', 'income']),
  amountCents: z
    .number()
    .int()
    .positive('Informe um valor maior que zero.')
    .max(99_999_999_999, 'Valor alto demais.'),
  description: z.string().trim().max(80, 'Use no máximo 80 caracteres.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  accountId: z.string().min(1, 'Escolha uma conta.'),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.'),
});

const COLUMNS = 4;
const GRID_GAP = space.sm;

export type TransactionFormValues = z.infer<typeof schema>;

type Props = {
  /** Quando presente, o formulário edita essa transação. */
  editingId?: string;
  initial?: Partial<TransactionFormValues>;
};

export function TransactionForm({ editingId, initial }: Props) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [dateOpen, setDateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const startKind = initial?.kind ?? 'expense';
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: startKind,
      amountCents: 0,
      description: '',
      categoryId: FALLBACK_CATEGORY[startKind],
      accountId: DEFAULT_ACCOUNT.id,
      occurredOn: todayISO(),
      notes: '',
      ...(Object.fromEntries(
        Object.entries(initial ?? {}).filter(([, v]) => v !== undefined),
      ) as Partial<TransactionFormValues>),
    },
  });

  const kind = useWatch({ control, name: 'kind' });
  const occurredOn = useWatch({ control, name: 'occurredOn' });
  const { data: catalog } = useDbQuery(
    (d) => ({ categories: listCategories(d, kind), accounts: listAccounts(d) }),
    ['categories', 'accounts'],
    [kind],
  );

  const accent = kind === 'income' ? colors.income : colors.expense;
  const noun = kind === 'income' ? 'receita' : 'despesa';
  const today = todayISO();
  const yesterday = daysAgoISO(1);

  const onSubmit = handleSubmit((v) => {
    const categoryName = catalog?.categories.find((c) => c.id === v.categoryId)?.name;
    const input = {
      ...v,
      // Sem descrição? Usa o nome da categoria, como os apps de banco fazem.
      description:
        v.description.trim() || categoryName || (v.kind === 'income' ? 'Receita' : 'Despesa'),
    };
    if (editingId) updateTransaction(db, editingId, input);
    else createTransaction(db, input);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast({
      message: editingId
        ? 'Alterações salvas'
        : `${noun[0]!.toUpperCase()}${noun.slice(1)} registrada`,
    });
    router.back();
  });

  const onDelete = () => {
    if (!editingId) return;
    deleteTransaction(db, editingId);
    setConfirmDelete(false);
    toast({
      message: 'Transação excluída',
      actionLabel: 'Desfazer',
      onAction: () => restoreTransaction(db, editingId),
      duration: 6000,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.topBar,
          { paddingTop: Platform.OS === 'android' ? insets.top + space.sm : space.md },
        ]}
      >
        <IconButton icon="close" label="Fechar" onPress={() => router.back()} />
        <Text variant="heading">{editingId ? `Editar ${noun}` : `Nova ${noun}`}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              accessibilityLabel="Tipo de transação"
              value={field.value}
              onChange={(k) => {
                field.onChange(k);
                setValue('categoryId', FALLBACK_CATEGORY[k]);
              }}
              options={[
                { value: 'expense', label: 'Despesa', activeColor: colors.expense },
                { value: 'income', label: 'Receita', activeColor: colors.income },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="amountCents"
          render={({ field }) => (
            <MoneyInput
              value={field.value}
              onChange={field.onChange}
              color={accent}
              autoFocus={!editingId}
              error={errors.amountCents?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label="Descrição"
              placeholder={kind === 'income' ? 'Ex.: Salário de novembro' : 'Ex.: Almoço no centro'}
              hint="Opcional. Se ficar vazio, usamos o nome da categoria."
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={80}
              returnKeyType="done"
              error={errors.description?.message}
            />
          )}
        />

        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="muted">
            Categoria
          </Text>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <View
                style={styles.grid}
                accessibilityRole="radiogroup"
                accessibilityLabel="Categoria"
                onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              >
                {catalog?.categories.map((c) => {
                  const selected = field.value === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="radio"
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected }}
                      onPress={() => field.onChange(c.id)}
                      style={[
                        styles.cat,
                        gridWidth > 0 && {
                          width: (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS,
                        },
                        {
                          borderColor: selected ? accent : colors.border,
                          backgroundColor: colors.surface,
                        },
                        selected && { borderWidth: 2 },
                      ]}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size={34} />
                      <Text
                        variant="micro"
                        numberOfLines={2}
                        align="center"
                        tone={selected ? 'default' : 'muted'}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="muted">
            Data
          </Text>
          <View style={styles.row}>
            <Chip
              label="Hoje"
              selected={occurredOn === today}
              onPress={() => setValue('occurredOn', today)}
            />
            <Chip
              label="Ontem"
              selected={occurredOn === yesterday}
              onPress={() => setValue('occurredOn', yesterday)}
            />
            <Chip
              icon="calendar-outline"
              label={
                occurredOn !== today && occurredOn !== yesterday
                  ? formatDateField(occurredOn)
                  : 'Outra data'
              }
              selected={occurredOn !== today && occurredOn !== yesterday}
              onPress={() => setDateOpen(true)}
            />
          </View>
        </View>

        {(catalog?.accounts.length ?? 0) > 0 && (
          <View style={{ gap: space.sm }}>
            <Text variant="caption" tone="muted">
              Conta
            </Text>
            <Controller
              control={control}
              name="accountId"
              render={({ field }) => (
                <View style={styles.row}>
                  {catalog!.accounts.map((a) => (
                    <Chip
                      key={a.id}
                      icon="wallet-outline"
                      label={a.name}
                      selected={field.value === a.id}
                      onPress={() => field.onChange(a.id)}
                    />
                  ))}
                </View>
              )}
            />
          </View>
        )}

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextField
              label="Observação"
              placeholder="Opcional"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              maxLength={500}
              style={{ minHeight: 84, textAlignVertical: 'top' }}
              error={errors.notes?.message}
            />
          )}
        />

        {editingId && (
          <Button
            label="Excluir transação"
            variant="danger"
            icon="trash-outline"
            onPress={() => setConfirmDelete(true)}
          />
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + space.md,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <Button
          size="lg"
          label={editingId ? 'Salvar alterações' : `Salvar ${noun}`}
          onPress={() => onSubmit()}
          loading={isSubmitting}
          style={styles.save}
        />
      </View>

      <DatePickerSheet
        visible={dateOpen}
        value={occurredOn}
        onSelect={(d) => setValue('occurredOn', d)}
        onClose={() => setDateOpen(false)}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Excluir esta transação?"
        message="Ela sai do extrato e do saldo. Você pode desfazer logo em seguida."
        confirmLabel="Excluir"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
    paddingBottom: space.xxxl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cat: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  save: { width: '100%', maxWidth: 608, alignSelf: 'center' },
});
