import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  ColorPicker,
  ConfirmDialog,
  DayPicker,
  Field,
  FormLayout,
  MoneyInput,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import type { CardBrand, CreditCard } from '@/db/schema';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { listActiveAccounts } from '@/features/accounts/repository';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { CardVisual } from './CardVisual';
import { BRAND_LABEL, BRAND_ORDER, CARD_COLORS } from './meta';
import { archiveCard, createCard, deleteCard, unarchiveCard, updateCard } from './repository';

type Props = { editing?: { card: CreditCard; transactionCount: number } };

export function CardForm({ editing }: Props) {
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const c = editing?.card;
  const { data: accounts } = useDbQuery((d) => listActiveAccounts(d), ['accounts']);

  const [name, setName] = useState(c?.name ?? '');
  const [brand, setBrand] = useState<CardBrand>(c?.brand ?? 'mastercard');
  const [lastDigits, setLastDigits] = useState(c?.lastDigits ?? '');
  const [color, setColor] = useState(c?.color ?? CARD_COLORS[0]!);
  const [limitCents, setLimitCents] = useState(c?.limitCents ?? 0);
  const [closingDay, setClosingDay] = useState(c?.closingDay ?? 3);
  const [dueDay, setDueDay] = useState(c?.dueDay ?? 10);
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(
    c?.paymentAccountId ?? null,
  );
  const [picker, setPicker] = useState<'closing' | 'due' | null>(null);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const digitsError =
    lastDigits && !/^\d{4}$/.test(lastDigits) ? 'Digite os 4 últimos números.' : undefined;
  const payAccount = paymentAccountId ?? accounts?.[0]?.id ?? null;

  const save = () => {
    try {
      const input = {
        name,
        brand,
        lastDigits,
        color,
        limitCents,
        closingDay,
        dueDay,
        paymentAccountId: payAccount,
      };
      if (editing) updateCard(db, editing.card.id, input);
      else createCard(db, input);
      toast({ message: editing ? 'Cartão atualizado' : 'Cartão criado' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = (action: 'archive' | 'unarchive' | 'delete') => {
    if (!editing) return;
    try {
      if (action === 'archive') archiveCard(db, editing.card.id);
      if (action === 'unarchive') unarchiveCard(db, editing.card.id);
      if (action === 'delete') deleteCard(db, editing.card.id);
      setConfirm(null);
      toast({
        message:
          action === 'archive'
            ? 'Cartão arquivado'
            : action === 'unarchive'
              ? 'Cartão reativado'
              : 'Cartão excluído',
      });
      if (action === 'delete') router.dismissAll();
      else router.back();
    } catch (e) {
      setConfirm(null);
      setError((e as Error).message);
    }
  };

  const sameMonth = dueDay > closingDay;

  return (
    <FormLayout
      title={editing ? 'Editar cartão' : 'Novo cartão'}
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
            label={editing ? 'Salvar alterações' : 'Criar cartão'}
            disabled={!name.trim() || !!digitsError}
            onPress={save}
          />
        </>
      }
    >
      <CardVisual
        name={name || 'Meu cartão'}
        brand={brand}
        lastDigits={/^\d{4}$/.test(lastDigits) ? lastDigits : null}
        color={color}
      />

      <TextField
        label="Nome"
        placeholder="Ex.: Nubank, Itaú Platinum"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        maxLength={30}
      />

      <Field label="Bandeira">
        <View style={styles.row}>
          {BRAND_ORDER.map((b) => (
            <Chip
              key={b}
              label={BRAND_LABEL[b]}
              selected={brand === b}
              onPress={() => setBrand(b)}
            />
          ))}
        </View>
      </Field>

      <TextField
        label="Últimos 4 dígitos"
        placeholder="Opcional, só para identificar"
        hint="Por segurança, o app guarda só estes 4 números. Nunca o número completo nem o código de segurança."
        value={lastDigits}
        onChangeText={(t) => setLastDigits(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={4}
        error={digitsError}
      />

      <Field label="Cor">
        <ColorPicker colors={CARD_COLORS} value={color} onChange={setColor} />
      </Field>

      <Field label="Limite total">
        <MoneyInput value={limitCents} onChange={setLimitCents} accessibilityLabel="Limite" />
      </Field>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <DayField label="Fecha no dia" day={closingDay} onPress={() => setPicker('closing')} />
        <DayField label="Vence no dia" day={dueDay} onPress={() => setPicker('due')} />
      </View>
      <View style={[styles.note, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name="bulb-outline" size={18} color={colors.brand} />
        <Text variant="caption" style={{ flex: 1 }}>
          Melhor dia de compra: dia {closingDay}. Compras a partir desse dia entram na fatura
          seguinte, que vence dia {dueDay}
          {sameMonth ? ' do mesmo mês do fechamento' : ' do mês seguinte ao fechamento'}.
        </Text>
      </View>

      {(accounts?.length ?? 0) > 0 && (
        <Field
          label="Pagar a fatura com"
          hint="Sugestão na hora de pagar. Dá para trocar a cada pagamento."
        >
          <View style={styles.row}>
            {accounts!.map((a) => (
              <Chip
                key={a.id}
                icon={ACCOUNT_TYPE_META[a.type].icon}
                label={a.name}
                selected={payAccount === a.id}
                onPress={() => setPaymentAccountId(a.id)}
              />
            ))}
          </View>
        </Field>
      )}

      {editing && (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="subtle" align="center">
            Mudar fechamento ou vencimento vale para as próximas compras. As já lançadas continuam
            nas faturas em que caíram.
          </Text>
          {editing.card.archivedAt ? (
            <Button
              label="Reativar cartão"
              variant="secondary"
              icon="refresh"
              onPress={() => run('unarchive')}
            />
          ) : (
            <Button
              label="Arquivar cartão"
              variant="secondary"
              icon="archive-outline"
              onPress={() => setConfirm('archive')}
            />
          )}
          {editing.transactionCount === 0 && (
            <Button
              label="Excluir cartão"
              variant="danger"
              icon="trash-outline"
              onPress={() => setConfirm('delete')}
            />
          )}
        </View>
      )}

      <DayPicker
        visible={picker === 'closing'}
        title="Dia do fechamento"
        value={closingDay}
        onSelect={setClosingDay}
        onClose={() => setPicker(null)}
        hint="Está no app do banco, normalmente como “fechamento” ou “melhor dia de compra”."
      />
      <DayPicker
        visible={picker === 'due'}
        title="Dia do vencimento"
        value={dueDay}
        onSelect={setDueDay}
        onClose={() => setPicker(null)}
      />
      <ConfirmDialog
        visible={confirm === 'archive'}
        title="Arquivar este cartão?"
        message="Ele sai das listas e da escolha na hora de lançar. Faturas e compras continuam no histórico."
        confirmLabel="Arquivar"
        onConfirm={() => run('archive')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        title="Excluir este cartão?"
        message="Ele não tem lançamentos e será removido."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => run('delete')}
        onCancel={() => setConfirm(null)}
      />
    </FormLayout>
  );
}

function DayField({ label, day, onPress }: { label: string; day: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${day}`}
      style={({ pressed }) => [
        styles.dayField,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="title" tabular>
        {day}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  dayField: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 2,
  },
});
