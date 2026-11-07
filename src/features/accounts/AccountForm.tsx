import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';
import {
  Button,
  Chip,
  ColorPicker,
  ConfirmDialog,
  Field,
  FormLayout,
  MoneyInput,
  Segmented,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb } from '@/db/client';
import { ACCOUNT_TYPES, type AccountType } from '@/db/schema';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AccountIcon } from './AccountIcon';
import { ACCOUNT_COLORS, ACCOUNT_TYPE_META, ACCOUNT_TYPE_ORDER, INSTITUTIONS } from './meta';
import {
  archiveAccount,
  createAccount,
  deleteAccount,
  unarchiveAccount,
  updateAccount,
} from './repository';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dê um nome para a conta.')
    .max(40, 'Use no máximo 40 caracteres.'),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(40, 'Use no máximo 40 caracteres.'),
  color: z.string(),
  initialAbsCents: z.number().int().min(0).max(99_999_999_999, 'Valor alto demais.'),
  negative: z.boolean(),
  includeInTotal: z.boolean(),
});
type Values = z.infer<typeof schema>;

type Props = {
  editing?: {
    id: string;
    archived: boolean;
    transactionCount: number;
    values: {
      name: string;
      type: AccountType;
      institution: string | null;
      color: string;
      initialBalanceCents: number;
      includeInTotal: boolean;
    };
  };
};

export function AccountForm({ editing }: Props) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ev = editing?.values;
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ev?.name ?? '',
      type: ev?.type ?? 'checking',
      institution: ev?.institution ?? '',
      color: ev?.color ?? ACCOUNT_COLORS[1]!,
      initialAbsCents: Math.abs(ev?.initialBalanceCents ?? 0),
      negative: (ev?.initialBalanceCents ?? 0) < 0,
      includeInTotal: ev?.includeInTotal ?? true,
    },
  });
  const [type, color, institution, negative] = useWatch({
    control,
    name: ['type', 'color', 'institution', 'negative'],
  });

  const onSubmit = handleSubmit((v) => {
    const input = {
      name: v.name,
      type: v.type,
      institution: v.institution,
      color: v.color,
      icon: ACCOUNT_TYPE_META[v.type].icon,
      initialBalanceCents: v.negative ? -v.initialAbsCents : v.initialAbsCents,
      includeInTotal: v.includeInTotal,
    };
    try {
      if (editing) updateAccount(db, editing.id, input);
      else createAccount(db, input);
      toast({ message: editing ? 'Conta atualizada' : 'Conta criada' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const runDanger = (action: 'archive' | 'unarchive' | 'delete') => {
    if (!editing) return;
    try {
      if (action === 'archive') archiveAccount(db, editing.id);
      if (action === 'unarchive') unarchiveAccount(db, editing.id);
      if (action === 'delete') deleteAccount(db, editing.id);
      setConfirm(null);
      toast({
        message:
          action === 'archive'
            ? 'Conta arquivada'
            : action === 'unarchive'
              ? 'Conta reativada'
              : 'Conta excluída',
      });
      if (action === 'delete') router.dismissAll();
      else router.back();
    } catch (e) {
      setConfirm(null);
      setError((e as Error).message);
    }
  };

  const suggestions = INSTITUTIONS.filter(
    (i) => !institution || i.toLowerCase().includes(institution.toLowerCase()),
  ).slice(0, 8);

  return (
    <FormLayout
      title={editing ? 'Editar conta' : 'Nova conta'}
      onClose={() => router.back()}
      footer={
        <>
          {error && (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button
            size="lg"
            label={editing ? 'Salvar alterações' : 'Criar conta'}
            onPress={() => onSubmit()}
          />
        </>
      }
    >
      <View style={styles.preview}>
        <AccountIcon icon={ACCOUNT_TYPE_META[type].icon} color={color} size={56} />
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Nome"
            placeholder="Ex.: Nubank, Itaú salário, Dinheiro"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={40}
            error={errors.name?.message}
          />
        )}
      />

      <Field label="Tipo" hint={ACCOUNT_TYPE_META[type].hint}>
        <View style={styles.types} accessibilityRole="radiogroup">
          {ACCOUNT_TYPE_ORDER.map((t) => {
            const selected = t === type;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityLabel={ACCOUNT_TYPE_META[t].label}
                accessibilityState={{ selected }}
                onPress={() => setValue('type', t)}
                style={[
                  styles.type,
                  {
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                  },
                ]}
              >
                <Text variant="caption" tone={selected ? 'brand' : 'default'}>
                  {ACCOUNT_TYPE_META[t].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <View style={{ gap: space.sm }}>
        <Controller
          control={control}
          name="institution"
          render={({ field }) => (
            <TextField
              label="Banco ou instituição"
              placeholder="Opcional"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={40}
              error={errors.institution?.message}
            />
          )}
        />
        {suggestions.length > 0 && !INSTITUTIONS.includes(institution) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((s) => (
              <Chip key={s} label={s} onPress={() => setValue('institution', s)} />
            ))}
          </ScrollView>
        )}
      </View>

      <Field label="Cor">
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker colors={ACCOUNT_COLORS} value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      <Field
        label={editing ? 'Saldo inicial' : 'Saldo atual'}
        hint={
          editing && editing.transactionCount > 0
            ? 'Mudar o saldo inicial altera o saldo de todo o histórico. Para corrigir só o saldo de hoje, use "Ajustar saldo" na conta.'
            : 'Quanto tem nesta conta agora. Daqui pra frente o app soma e subtrai as movimentações.'
        }
      >
        <Controller
          control={control}
          name="initialAbsCents"
          render={({ field }) => (
            <MoneyInput
              value={field.value}
              onChange={field.onChange}
              color={negative ? colors.expense : undefined}
              prefix={negative ? '−R$' : 'R$'}
            />
          )}
        />
        <Controller
          control={control}
          name="negative"
          render={({ field }) => (
            <Segmented
              accessibilityLabel="Sinal do saldo"
              value={field.value ? 'neg' : 'pos'}
              onChange={(v) => field.onChange(v === 'neg')}
              options={[
                { value: 'pos', label: 'Positivo' },
                { value: 'neg', label: 'Negativo', activeColor: colors.expense },
              ]}
            />
          )}
        />
      </Field>

      <Controller
        control={control}
        name="includeInTotal"
        render={({ field }) => (
          <View
            style={[
              styles.switchRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">Somar no saldo total</Text>
              <Text variant="caption" tone="muted">
                Desligue para reservas ou investimentos que você não quer ver misturados ao dinheiro
                do dia a dia.
              </Text>
            </View>
            <Switch
              value={field.value}
              onValueChange={field.onChange}
              accessibilityLabel="Somar no saldo total"
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        )}
      />

      {editing && (
        <View style={{ gap: space.sm }}>
          {editing.archived ? (
            <Button
              label="Reativar conta"
              variant="secondary"
              icon="refresh"
              onPress={() => runDanger('unarchive')}
            />
          ) : (
            <Button
              label="Arquivar conta"
              variant="secondary"
              icon="archive-outline"
              onPress={() => setConfirm('archive')}
            />
          )}
          {editing.transactionCount === 0 && (
            <Button
              label="Excluir conta"
              variant="danger"
              icon="trash-outline"
              onPress={() => setConfirm('delete')}
            />
          )}
          {editing.transactionCount > 0 && (
            <Text variant="caption" tone="subtle" align="center">
              Contas com movimentações não podem ser excluídas, só arquivadas.
            </Text>
          )}
        </View>
      )}

      <ConfirmDialog
        visible={confirm === 'archive'}
        title="Arquivar esta conta?"
        message="Ela sai da lista e do saldo total, mas o histórico continua no extrato. Dá para reativar depois."
        confirmLabel="Arquivar"
        onConfirm={() => runDanger('archive')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        title="Excluir esta conta?"
        message="A conta não tem movimentações e será removida."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => runDanger('delete')}
        onCancel={() => setConfirm(null)}
      />
    </FormLayout>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  type: {
    paddingHorizontal: space.md + 2,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
