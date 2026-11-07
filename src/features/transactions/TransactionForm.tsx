import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
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
  Segmented,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import type { Account, Category } from '@/db/schema';
import { FALLBACK_CATEGORY } from '@/db/seed';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { getAccount, listActiveAccounts } from '@/features/accounts/repository';
import { getCategory, listCategoryTree, type CategoryNode } from '@/features/categories/repository';
import { daysAgoISO, formatDateField, todayISO } from '@/lib/dates';
import { getLastAccountId, setLastAccountId } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
  type TransactionInput,
} from './repository';

const schema = z
  .object({
    kind: z.enum(['expense', 'income', 'transfer']),
    amountCents: z
      .number()
      .int()
      .positive('Informe um valor maior que zero.')
      .max(99_999_999_999, 'Valor alto demais.'),
    description: z.string().trim().max(80, 'Use no máximo 80 caracteres.'),
    categoryId: z.string(),
    subcategoryId: z.string(),
    accountId: z.string().min(1, 'Escolha uma conta.'),
    toAccountId: z.string(),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'transfer') {
      if (!v.toAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Escolha a conta de destino.',
        });
      else if (v.toAccountId === v.accountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Escolha uma conta diferente da origem.',
        });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Escolha uma categoria.' });
    }
  });

type Values = z.infer<typeof schema>;
export type Kind = Values['kind'];

const COLUMNS = 4;
const GRID_GAP = space.sm;

type Props = {
  /** Quando presente, o formulário edita essa transação. */
  editingId?: string;
  initial?: {
    kind?: Kind;
    amountCents?: number;
    description?: string;
    categoryId?: string | null;
    accountId?: string;
    toAccountId?: string | null;
    occurredOn?: string;
    notes?: string | null;
  };
};

const NOUN: Record<Kind, { title: string; saved: string }> = {
  expense: { title: 'despesa', saved: 'Despesa registrada' },
  income: { title: 'receita', saved: 'Receita registrada' },
  transfer: { title: 'transferência', saved: 'Transferência registrada' },
};

/** Divide uma categoria guardada em (categoria principal, subcategoria). */
function splitCategory(cat: Category | undefined): { categoryId: string; subcategoryId: string } {
  if (!cat) return { categoryId: '', subcategoryId: '' };
  return cat.parentId
    ? { categoryId: cat.parentId, subcategoryId: cat.id }
    : { categoryId: cat.id, subcategoryId: '' };
}

export function TransactionForm({ editingId, initial = {} }: Props) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [dateOpen, setDateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  // Valores iniciais calculados uma vez, na abertura.
  const [defaults] = useState<Values>(() => {
    const active = listActiveAccounts(db);
    const ids = new Set(active.map((a) => a.id));
    const last = getLastAccountId();
    const accountId = initial.accountId ?? (last && ids.has(last) ? last : active[0]?.id) ?? '';
    const kind = initial.kind ?? 'expense';
    const cat =
      kind === 'transfer'
        ? { categoryId: '', subcategoryId: '' }
        : initial.categoryId
          ? splitCategory(getCategory(db, initial.categoryId))
          : { categoryId: FALLBACK_CATEGORY[kind], subcategoryId: '' };
    return {
      kind,
      amountCents: initial.amountCents ?? 0,
      description: initial.description ?? '',
      ...cat,
      accountId,
      toAccountId:
        initial.toAccountId ??
        (kind === 'transfer' ? (active.find((a) => a.id !== accountId)?.id ?? '') : ''),
      occurredOn: initial.occurredOn ?? todayISO(),
      notes: initial.notes ?? '',
    };
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const [kind, occurredOn, categoryId, subcategoryId, accountId, toAccountId] = useWatch({
    control,
    name: ['kind', 'occurredOn', 'categoryId', 'subcategoryId', 'accountId', 'toAccountId'],
  });

  const { data: catalog } = useDbQuery(
    (d) => {
      const tree: CategoryNode[] = kind === 'transfer' ? [] : listCategoryTree(d, kind);
      // Ao editar algo com categoria arquivada, ela continua aparecendo para não sumir da tela.
      if (categoryId && kind !== 'transfer' && !tree.some((c) => c.id === categoryId)) {
        const extra = getCategory(d, categoryId);
        if (extra) tree.push({ ...extra, children: [] });
      }
      const accounts = listActiveAccounts(d);
      for (const id of [defaults.accountId, defaults.toAccountId]) {
        if (id && !accounts.some((a) => a.id === id)) {
          const row = getAccount(d, id);
          if (row) accounts.push(row);
        }
      }
      return { tree, accounts };
    },
    ['categories', 'accounts'],
    [kind, categoryId],
  );

  const accounts = catalog?.accounts ?? [];
  const parent = catalog?.tree.find((c) => c.id === categoryId);
  const accent =
    kind === 'income' ? colors.income : kind === 'expense' ? colors.expense : colors.brand;
  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const isTransfer = kind === 'transfer';

  const changeKind = (k: Kind) => {
    setValue('kind', k);
    if (k === 'transfer') {
      setValue('categoryId', '');
      setValue('subcategoryId', '');
      if (!toAccountId || toAccountId === accountId)
        setValue('toAccountId', accounts.find((a) => a.id !== accountId)?.id ?? '');
    } else {
      setValue('categoryId', FALLBACK_CATEGORY[k]);
      setValue('subcategoryId', '');
    }
  };

  const onSubmit = handleSubmit((v) => {
    let input: TransactionInput;
    if (v.kind === 'transfer') {
      input = {
        kind: 'transfer',
        amountCents: v.amountCents,
        description: v.description.trim() || 'Transferência',
        accountId: v.accountId,
        toAccountId: v.toAccountId,
        occurredOn: v.occurredOn,
        notes: v.notes,
      };
    } else {
      const finalCategory = v.subcategoryId || v.categoryId;
      const name =
        parent?.children.find((c) => c.id === v.subcategoryId)?.name ??
        catalog?.tree.find((c) => c.id === v.categoryId)?.name;
      input = {
        kind: v.kind,
        amountCents: v.amountCents,
        // Sem descrição? Usa o nome da categoria, como os apps de banco fazem.
        description: v.description.trim() || name || (v.kind === 'income' ? 'Receita' : 'Despesa'),
        categoryId: finalCategory,
        accountId: v.accountId,
        occurredOn: v.occurredOn,
        notes: v.notes,
      };
    }
    if (editingId) updateTransaction(db, editingId, input);
    else createTransaction(db, input);
    setLastAccountId(v.accountId);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast({ message: editingId ? 'Alterações salvas' : NOUN[v.kind].saved });
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

  const needsMoreAccounts = isTransfer && accounts.length < 2;

  return (
    <FormLayout
      title={editingId ? `Editar ${NOUN[kind].title}` : `Nova ${NOUN[kind].title}`}
      onClose={() => router.back()}
      footer={
        needsMoreAccounts ? undefined : (
          <Button
            size="lg"
            label={editingId ? 'Salvar alterações' : `Salvar ${NOUN[kind].title}`}
            onPress={() => onSubmit()}
            loading={isSubmitting}
          />
        )
      }
    >
      <Segmented
        accessibilityLabel="Tipo de transação"
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'expense', label: 'Despesa', activeColor: colors.expense },
          { value: 'income', label: 'Receita', activeColor: colors.income },
          { value: 'transfer', label: 'Transferência', activeColor: colors.brand },
        ]}
      />

      {needsMoreAccounts ? (
        <EmptyState
          icon="swap-horizontal"
          title="Você precisa de duas contas"
          message="Transferências movem dinheiro entre contas suas. Cadastre outra conta para continuar."
          actionLabel="Criar conta"
          onAction={() => router.replace('/conta/nova')}
        />
      ) : (
        <>
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
                placeholder={
                  isTransfer
                    ? 'Ex.: Guardar para a viagem'
                    : kind === 'income'
                      ? 'Ex.: Salário de novembro'
                      : 'Ex.: Almoço no centro'
                }
                hint={
                  isTransfer
                    ? 'Opcional. Se ficar vazio, usamos "Transferência".'
                    : 'Opcional. Se ficar vazio, usamos o nome da categoria.'
                }
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                maxLength={80}
                returnKeyType="done"
                error={errors.description?.message}
              />
            )}
          />

          {isTransfer ? (
            <>
              <Field label="De" error={errors.accountId?.message}>
                <AccountChips
                  accounts={accounts}
                  value={accountId}
                  onChange={(id) => setValue('accountId', id)}
                />
              </Field>
              <Field label="Para" error={errors.toAccountId?.message}>
                <AccountChips
                  accounts={accounts}
                  value={toAccountId}
                  disabledId={accountId}
                  onChange={(id) => setValue('toAccountId', id, { shouldValidate: true })}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Categoria" error={errors.categoryId?.message}>
                <View
                  style={styles.grid}
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Categoria"
                  onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                >
                  {catalog?.tree.map((c) => {
                    const selected = categoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="radio"
                        accessibilityLabel={c.name}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setValue('categoryId', c.id, { shouldValidate: true });
                          setValue('subcategoryId', '');
                        }}
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
              </Field>

              {parent && parent.children.length > 0 && (
                <Field label={`Subcategoria de ${parent.name}`} hint="Opcional">
                  <View style={styles.row} accessibilityRole="radiogroup">
                    <Chip
                      label="Nenhuma"
                      selected={!subcategoryId}
                      onPress={() => setValue('subcategoryId', '')}
                    />
                    {parent.children.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.name}
                        selected={subcategoryId === s.id}
                        onPress={() => setValue('subcategoryId', s.id)}
                      />
                    ))}
                  </View>
                </Field>
              )}
            </>
          )}

          <Field label="Data">
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
          </Field>

          {!isTransfer && accounts.length > 0 && (
            <Field label="Conta" error={errors.accountId?.message}>
              <AccountChips
                accounts={accounts}
                value={accountId}
                onChange={(id) => setValue('accountId', id)}
              />
            </Field>
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
        </>
      )}

      {editingId && (
        <Button
          label="Excluir transação"
          variant="danger"
          icon="trash-outline"
          onPress={() => setConfirmDelete(true)}
        />
      )}

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
    </FormLayout>
  );
}

function AccountChips({
  accounts,
  value,
  onChange,
  disabledId,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  disabledId?: string;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {accounts
        .filter((a) => a.id !== disabledId)
        .map((a) => (
          <Chip
            key={a.id}
            icon={ACCOUNT_TYPE_META[a.type].icon}
            label={a.name}
            selected={value === a.id}
            onPress={() => onChange(a.id)}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
