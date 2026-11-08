import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';
import {
  Button,
  CategoryIcon,
  ChoiceDialog,
  Chip,
  ConfirmDialog,
  DatePickerSheet,
  EmptyState,
  Field,
  FormLayout,
  IconButton,
  MoneyInput,
  Segmented,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import type { Account, Category, Recurrence } from '@/db/schema';
import { FALLBACK_CATEGORY } from '@/db/seed';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { getAccount, listActiveAccounts } from '@/features/accounts/repository';
import { invoiceDates, invoiceMonthFor } from '@/features/cards/cycle';
import {
  deleteCardPurchase,
  getCard,
  listCards,
  restoreRows,
  saveCardPurchase,
} from '@/features/cards/repository';
import { getCategory, listCategoryTree, type CategoryNode } from '@/features/categories/repository';
import { markBillPaid, markBillUnpaid } from '@/features/bills/repository';
import {
  createRecurrence,
  endRecurrenceFrom,
  getRecurrence,
  lastDate,
  occurrenceId,
  scheduleOf,
  updateRecurrenceFrom,
  type RecurrenceInput,
} from '@/features/recurrences/repository';
import { REPEAT_OPTIONS } from '@/features/recurrences/meta';
import { describeSchedule } from '@/features/recurrences/schedule';
import {
  daysAgoISO,
  formatDateField,
  formatDateShort,
  formatMonthLong,
  shiftMonth,
  todayISO,
} from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { getLastAccountId, setLastAccountId } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
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
    /** Despesa/receita: sai de uma conta ou vai no cartão. */
    source: z.enum(['account', 'card']),
    accountId: z.string(),
    toAccountId: z.string(),
    cardId: z.string(),
    installments: z.number().int().min(1).max(48),
    /** Só para despesa/receita de conta: já pago ou ainda a pagar/receber. */
    paid: z.boolean(),
    repeat: z.enum(['none', 'w1', 'w2', 'm1', 'm2', 'm3', 'm6', 'y1']),
    repeatEnd: z.enum(['never', 'count', 'date']),
    repeatCount: z.number().int().min(2).max(360),
    repeatUntil: z.string(),
    variableAmount: z.boolean(),
    autoPay: z.boolean(),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    const usesCard = v.kind !== 'transfer' && v.source === 'card';
    if (usesCard && !v.cardId)
      ctx.addIssue({ code: 'custom', path: ['cardId'], message: 'Escolha um cartão.' });
    if (!usesCard && !v.accountId)
      ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Escolha uma conta.' });
    if (usesCard && v.amountCents > 0 && v.installments > v.amountCents)
      ctx.addIssue({
        code: 'custom',
        path: ['installments'],
        message: 'Valor baixo demais para tantas parcelas.',
      });
    if (v.repeat !== 'none' && v.repeatEnd === 'date' && v.repeatUntil <= v.occurredOn)
      ctx.addIssue({
        code: 'custom',
        path: ['repeatUntil'],
        message: 'A data final precisa ser depois da primeira.',
      });
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

const isTransferKind = (k: Kind) => k === 'transfer';

const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

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
    /** Compra/estorno no cartão. */
    cardId?: string | null;
    installments?: number;
    status?: 'paid' | 'pending';
    dueOn?: string | null;
    /** Ocorrência de uma recorrência: ao salvar/excluir pergunta "só esta" ou "esta e as próximas". */
    recurrenceId?: string | null;
  };
  /** Se o que está sendo editado é uma compra no cartão (todas as parcelas juntas). */
  editingCardPurchase?: boolean;
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

export function TransactionForm({ editingId, initial = {}, editingCardPurchase = false }: Props) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [dateOpen, setDateOpen] = useState(false);
  const [untilOpen, setUntilOpen] = useState(false);
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
      source: initial.cardId && kind !== 'transfer' ? 'card' : 'account',
      cardId: initial.cardId ?? listCards(db)[0]?.id ?? '',
      installments: initial.installments ?? 1,
      paid: initial.status
        ? initial.status === 'paid'
        : (initial.occurredOn ?? todayISO()) <= todayISO(),
      repeat: 'none',
      repeatEnd: 'never',
      repeatCount: 12,
      repeatUntil: '',
      variableAmount: false,
      autoPay: false,
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

  const [
    kind,
    occurredOn,
    categoryId,
    subcategoryId,
    accountId,
    toAccountId,
    source,
    cardId,
    installments,
    amountCents,
    paid,
    repeat,
    repeatEnd,
    repeatCount,
    repeatUntil,
    variableAmount,
    autoPay,
  ] = useWatch({
    control,
    name: [
      'kind',
      'occurredOn',
      'categoryId',
      'subcategoryId',
      'accountId',
      'toAccountId',
      'source',
      'cardId',
      'installments',
      'amountCents',
      'paid',
      'repeat',
      'repeatEnd',
      'repeatCount',
      'repeatUntil',
      'variableAmount',
      'autoPay',
    ],
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
      const cards = listCards(d);
      if (defaults.cardId && !cards.some((c) => c.id === defaults.cardId)) {
        const row = getCard(d, defaults.cardId);
        if (row) cards.push(row);
      }
      return { tree, accounts, cards };
    },
    ['categories', 'accounts', 'credit_cards'],
    [kind, categoryId],
  );

  const accounts = catalog?.accounts ?? [];
  const cards = catalog?.cards ?? [];
  const usesCard = !isTransferKind(kind) && source === 'card';
  const card = cards.find((c) => c.id === cardId);
  const parent = catalog?.tree.find((c) => c.id === categoryId);
  const accent =
    kind === 'income' ? colors.income : kind === 'expense' ? colors.expense : colors.brand;
  const today = todayISO();
  const yesterday = daysAgoISO(1);
  const isTransfer = kind === 'transfer';

  const changeKind = (k: Kind) => {
    setValue('kind', k);
    if (k !== 'expense') setValue('installments', 1);
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

  const editingOccurrence = !!(editingId && initial.recurrenceId);
  const [rule] = useState(() =>
    initial.recurrenceId ? getRecurrence(db, initial.recurrenceId) : undefined,
  );
  const paidTouched = useRef(false);
  const showStatus = !isTransfer && source === 'account';
  const canRepeat =
    !editingId && !isTransfer && !(usesCard && kind === 'expense' && installments > 1);

  /** Ao escolher uma data futura, o lançamento vira "a pagar" (se a pessoa não escolheu antes). */
  const setDate = (d: string) => {
    setValue('occurredOn', d);
    if (!paidTouched.current && !editingId) setValue('paid', d <= todayISO());
  };
  const [scopeFor, setScopeFor] = useState<
    null | { action: 'save'; values: Values } | { action: 'delete' }
  >(null);

  const onSubmit = handleSubmit((v) => {
    // Ocorrência de recorrência: pergunta antes se vale só para esta ou para as próximas.
    if (editingOccurrence) setScopeFor({ action: 'save', values: v });
    else save(v, 'only');
  });

  /** Regra de recorrência montada a partir do formulário. */
  function ruleFrom(v: Values, base?: Recurrence): RecurrenceInput {
    const opt = REPEAT_OPTIONS.find((o) => o.key === v.repeat);
    const isCardRule = v.source === 'card';
    return {
      kind: v.kind === 'income' ? 'income' : 'expense',
      amountCents: v.amountCents,
      variableAmount: base ? base.variableAmount : v.variableAmount,
      description:
        v.description.trim() || categoryNameOf(v) || (v.kind === 'income' ? 'Receita' : 'Despesa'),
      categoryId: v.subcategoryId || v.categoryId,
      accountId: isCardRule ? null : v.accountId,
      cardId: isCardRule ? v.cardId : null,
      frequency: base?.frequency ?? opt?.frequency ?? 'monthly',
      interval: base?.interval ?? opt?.interval ?? 1,
      startOn: v.occurredOn,
      // Ao editar "daqui pra frente", o limite por número de vezes vira data final.
      endOn: base ? lastDate(base) : v.repeatEnd === 'date' ? v.repeatUntil : null,
      maxCount: base ? null : v.repeatEnd === 'count' ? v.repeatCount : null,
      autoPay: base ? base.autoPay : v.autoPay,
      notes: v.notes,
    };
  }

  function categoryNameOf(v: Values) {
    return (
      parent?.children.find((c) => c.id === v.subcategoryId)?.name ??
      catalog?.tree.find((c) => c.id === v.categoryId)?.name
    );
  }

  function save(v: Values, scope: 'only' | 'following') {
    // Nova recorrência
    if (!editingId && v.kind !== 'transfer' && v.repeat !== 'none') {
      const recId = createRecurrence(db, ruleFrom(v));
      const first = occurrenceId(recId, v.occurredOn);
      if (
        v.source === 'account' &&
        v.paid &&
        v.occurredOn <= todayISO() &&
        getTransaction(db, first)?.status === 'pending'
      ) {
        markBillPaid(db, first, {
          paidOn: v.occurredOn,
          amountCents: v.amountCents,
          accountId: v.accountId,
        });
      }
      if (v.source === 'account') setLastAccountId(v.accountId);
      done('Recorrência criada');
      return;
    }
    // Esta e as próximas
    if (editingId && scope === 'following' && initial.recurrenceId && v.kind !== 'transfer') {
      const base = getRecurrence(db, initial.recurrenceId);
      if (base) {
        updateRecurrenceFrom(db, base.id, ruleFrom(v, base), { anchorTxId: editingId });
        if (v.source === 'account') {
          const now = getTransaction(db, editingId);
          if (v.paid && now?.status === 'pending')
            markBillPaid(db, editingId, {
              paidOn: todayISO() < v.occurredOn ? v.occurredOn : todayISO(),
              amountCents: v.amountCents,
              accountId: v.accountId,
            });
          if (!v.paid && now?.status === 'paid') markBillUnpaid(db, editingId);
        }
        done('Alterações salvas');
        return;
      }
    }
    const categoryName = categoryNameOf(v);

    // Compra ou estorno no cartão
    if (v.kind !== 'transfer' && v.source === 'card') {
      const purchase = {
        cardId: v.cardId,
        kind: v.kind,
        totalCents: v.amountCents,
        installments: v.kind === 'expense' ? v.installments : 1,
        description:
          v.description.trim() || categoryName || (v.kind === 'income' ? 'Estorno' : 'Compra'),
        categoryId: v.subcategoryId || v.categoryId,
        purchasedOn: v.occurredOn,
        notes: v.notes,
      };
      // Era um lançamento de conta e virou compra no cartão: troca um pelo outro.
      if (editingId && !editingCardPurchase) deleteTransaction(db, editingId);
      saveCardPurchase(db, purchase, editingId && editingCardPurchase ? editingId : undefined);
      done(
        v.kind === 'income'
          ? 'Estorno registrado'
          : v.installments > 1
            ? `Compra em ${v.installments}x registrada`
            : 'Compra registrada',
      );
      return;
    }
    // Era compra no cartão e virou lançamento de conta.
    if (editingId && editingCardPurchase) deleteCardPurchase(db, editingId);
    const updateId = editingId && !editingCardPurchase ? editingId : undefined;

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
      const name = categoryName;
      input = {
        kind: v.kind,
        amountCents: v.amountCents,
        // Sem descrição? Usa o nome da categoria, como os apps de banco fazem.
        description: v.description.trim() || name || (v.kind === 'income' ? 'Receita' : 'Despesa'),
        categoryId: finalCategory,
        accountId: v.accountId,
        occurredOn: v.occurredOn,
        notes: v.notes,
        status: v.paid ? 'paid' : 'pending',
        // Conta paga continua lembrando quando venceu.
        dueOn: v.paid ? (initial.dueOn ?? null) : v.occurredOn,
      };
    }
    if (updateId) updateTransaction(db, updateId, input);
    else createTransaction(db, input);
    setLastAccountId(v.accountId);
    done(NOUN[v.kind].saved);
  }

  function done(message: string) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast({ message: editingId ? 'Alterações salvas' : message });
    router.back();
  }

  const deleteFollowing = () => {
    if (!editingId || !initial.recurrenceId) return;
    setScopeFor(null);
    endRecurrenceFrom(db, initial.recurrenceId, initial.dueOn ?? initial.occurredOn ?? todayISO());
    toast({ message: 'Esta e as próximas foram excluídas' });
    router.back();
  };

  const onDelete = () => {
    if (!editingId) return;
    setConfirmDelete(false);
    setScopeFor(null);
    if (editingCardPurchase) {
      // Compra parcelada: exclui todas as parcelas juntas.
      const ids = deleteCardPurchase(db, editingId);
      toast({
        message: ids.length > 1 ? `Compra excluída (${ids.length} parcelas)` : 'Compra excluída',
        actionLabel: 'Desfazer',
        onAction: () => restoreRows(db, ids),
        duration: 6000,
      });
    } else {
      deleteTransaction(db, editingId);
      toast({
        message: 'Transação excluída',
        actionLabel: 'Desfazer',
        onAction: () => restoreTransaction(db, editingId),
        duration: 6000,
      });
    }
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

          <Field
            label={
              showStatus && (!paid || repeat !== 'none')
                ? 'Vencimento'
                : repeat !== 'none'
                  ? 'Primeira data'
                  : 'Data'
            }
          >
            <View style={styles.row}>
              <Chip label="Hoje" selected={occurredOn === today} onPress={() => setDate(today)} />
              <Chip
                label="Ontem"
                selected={occurredOn === yesterday}
                onPress={() => setDate(yesterday)}
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

          {!isTransfer && (
            <Field
              label={kind === 'expense' ? 'Pagar com' : 'Recebido em'}
              error={errors.accountId?.message ?? errors.cardId?.message}
            >
              <View style={styles.row} accessibilityRole="radiogroup">
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    icon={ACCOUNT_TYPE_META[a.type].icon}
                    label={a.name}
                    selected={source === 'account' && accountId === a.id}
                    onPress={() => {
                      setValue('source', 'account');
                      setValue('accountId', a.id);
                      setValue('installments', 1);
                    }}
                  />
                ))}
                {cards.map((c) => (
                  <Chip
                    key={c.id}
                    icon="card-outline"
                    label={kind === 'income' ? `Estorno no ${c.name}` : c.name}
                    selected={source === 'card' && cardId === c.id}
                    onPress={() => {
                      setValue('source', 'card');
                      setValue('cardId', c.id);
                    }}
                  />
                ))}
              </View>
            </Field>
          )}

          {usesCard && card && kind === 'expense' && (
            <Field label="Parcelas" error={errors.installments?.message}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
              >
                {INSTALLMENT_OPTIONS.map((n) => (
                  <Chip
                    key={n}
                    label={n === 1 ? 'À vista' : `${n}x`}
                    selected={installments === n}
                    onPress={() => setValue('installments', n, { shouldValidate: true })}
                  />
                ))}
              </ScrollView>
            </Field>
          )}

          {usesCard && card && (
            <InvoicePreview
              closingDay={card.closingDay}
              dueDay={card.dueDay}
              date={occurredOn}
              installments={kind === 'expense' ? installments : 1}
              amountCents={amountCents}
              refund={kind === 'income'}
            />
          )}

          {showStatus && (
            <Segmented
              accessibilityLabel="Situação"
              value={paid ? 'paid' : 'pending'}
              onChange={(v) => {
                paidTouched.current = true;
                setValue('paid', v === 'paid');
              }}
              options={
                kind === 'income'
                  ? [
                      { value: 'paid', label: 'Recebido' },
                      { value: 'pending', label: 'A receber', activeColor: colors.accent },
                    ]
                  : [
                      { value: 'paid', label: 'Pago' },
                      { value: 'pending', label: 'A pagar', activeColor: colors.accent },
                    ]
              }
            />
          )}

          {editingOccurrence && rule && (
            <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="repeat" size={18} color={colors.textMuted} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption">
                  Faz parte da recorrência “{rule.description}”:{' '}
                  {describeSchedule(scheduleOf(rule)).toLowerCase()}.
                </Text>
                <Pressable
                  onPress={() => router.push(`/recorrencia/${rule.id}`)}
                  accessibilityRole="link"
                  hitSlop={8}
                >
                  <Text variant="caption" tone="brand" style={{ fontWeight: '700' }}>
                    Editar frequência ou término
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {canRepeat && (
            <Field label="Repetir" error={errors.repeatUntil?.message}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm }}
              >
                {REPEAT_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    icon={o.key === 'none' ? undefined : 'repeat'}
                    selected={repeat === o.key}
                    onPress={() => setValue('repeat', o.key)}
                  />
                ))}
              </ScrollView>
              {repeat !== 'none' && (
                <View style={{ gap: space.md, marginTop: space.xs }}>
                  <Text variant="caption" tone="muted">
                    Termina
                  </Text>
                  <View style={styles.row}>
                    <Chip
                      label="Nunca"
                      selected={repeatEnd === 'never'}
                      onPress={() => setValue('repeatEnd', 'never')}
                    />
                    <Chip
                      label={
                        repeatEnd === 'count'
                          ? `Depois de ${repeatCount} vezes`
                          : 'Depois de N vezes'
                      }
                      selected={repeatEnd === 'count'}
                      onPress={() => setValue('repeatEnd', 'count')}
                    />
                    <Chip
                      icon="calendar-outline"
                      label={
                        repeatEnd === 'date' && repeatUntil
                          ? `Em ${formatDateField(repeatUntil)}`
                          : 'Em uma data'
                      }
                      selected={repeatEnd === 'date'}
                      onPress={() => {
                        setValue('repeatEnd', 'date');
                        setUntilOpen(true);
                      }}
                    />
                  </View>
                  {repeatEnd === 'count' && (
                    <View style={styles.stepper}>
                      <IconButton
                        icon="remove"
                        label="Menos uma vez"
                        background={colors.surfaceMuted}
                        disabled={repeatCount <= 2}
                        onPress={() => setValue('repeatCount', Math.max(2, repeatCount - 1))}
                      />
                      <Text
                        variant="heading"
                        tabular
                        style={{ minWidth: 90, textAlign: 'center' }}
                        accessibilityLiveRegion="polite"
                      >
                        {repeatCount} vezes
                      </Text>
                      <IconButton
                        icon="add"
                        label="Mais uma vez"
                        background={colors.surfaceMuted}
                        onPress={() => setValue('repeatCount', Math.min(360, repeatCount + 1))}
                      />
                    </View>
                  )}
                  <SwitchRow
                    title="Valor muda a cada vez"
                    subtitle="Para contas como luz e água: na hora de pagar, o app pede o valor certo."
                    value={variableAmount}
                    onChange={(b) => setValue('variableAmount', b)}
                  />
                  {source === 'account' && (
                    <SwitchRow
                      title={kind === 'income' ? 'Cai automaticamente' : 'Débito automático'}
                      subtitle={
                        kind === 'income'
                          ? 'Marca como recebido sozinho no dia.'
                          : 'Marca como pago sozinho no dia do vencimento.'
                      }
                      value={autoPay}
                      onChange={(b) => setValue('autoPay', b)}
                    />
                  )}
                  {usesCard && (
                    <Text variant="caption" tone="subtle">
                      Assinatura no cartão: o app lança a cobrança no dia, na fatura certa.
                    </Text>
                  )}
                </View>
              )}
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
          onPress={() =>
            editingOccurrence ? setScopeFor({ action: 'delete' }) : setConfirmDelete(true)
          }
        />
      )}

      <DatePickerSheet
        visible={untilOpen}
        value={repeatUntil || occurredOn}
        onSelect={(d) => setValue('repeatUntil', d, { shouldValidate: true })}
        onClose={() => setUntilOpen(false)}
      />
      <DatePickerSheet
        visible={dateOpen}
        value={occurredOn}
        onSelect={setDate}
        onClose={() => setDateOpen(false)}
      />
      <ChoiceDialog
        visible={scopeFor?.action === 'save'}
        title="Salvar alterações"
        message="Este lançamento faz parte de uma recorrência."
        choices={[
          { value: 'only', label: 'Só nesta' },
          { value: 'following', label: 'Nesta e nas próximas', primary: true },
        ]}
        onChoose={(scope) => {
          const values = scopeFor?.action === 'save' ? scopeFor.values : null;
          setScopeFor(null);
          if (values) save(values, scope);
        }}
        onCancel={() => setScopeFor(null)}
      />
      <ChoiceDialog
        visible={scopeFor?.action === 'delete'}
        title="Excluir"
        message="Este lançamento faz parte de uma recorrência. As ocorrências já pagas continuam no histórico."
        choices={[
          { value: 'only', label: 'Só esta', destructive: true },
          { value: 'following', label: 'Esta e as próximas', destructive: true, primary: true },
        ]}
        onChoose={(scope) => (scope === 'only' ? onDelete() : deleteFollowing())}
        onCancel={() => setScopeFor(null)}
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
    <View style={styles.switchRow}>
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

/** Mostra em qual fatura a compra cai (e até quando vão as parcelas). */
function InvoicePreview({
  closingDay,
  dueDay,
  date,
  installments,
  amountCents,
  refund,
}: {
  closingDay: number;
  dueDay: number;
  date: string;
  installments: number;
  amountCents: number;
  refund: boolean;
}) {
  const { colors } = useTheme();
  const cycle = { closingDay, dueDay };
  const first = invoiceMonthFor(date, cycle);
  const due = invoiceDates(first, cycle).dueDate;
  const lastMonth = shiftMonth(first, installments - 1);
  const per =
    installments > 1 && amountCents >= installments ? Math.floor(amountCents / installments) : null;
  return (
    <View
      style={[styles.preview, { backgroundColor: colors.brandSoft }]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="calendar-outline" size={18} color={colors.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption">
          {refund
            ? 'Abate a fatura de '
            : installments > 1
              ? '1ª parcela na fatura de '
              : 'Entra na fatura de '}
          <Text variant="caption" style={{ fontWeight: '700' }}>
            {formatMonthLong(first).toLowerCase()}
          </Text>
          , que vence em {formatDateShort(due)}.
        </Text>
        {installments > 1 && (
          <Text variant="caption" tone="muted">
            {per !== null ? `${installments}x de cerca de ${formatBRL(per)}. ` : ''}Última parcela
            na fatura de {formatMonthLong(lastMonth).toLowerCase()}.
          </Text>
        )}
      </View>
    </View>
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  preview: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
});
