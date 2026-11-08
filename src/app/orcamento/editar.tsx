import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  CategoryIcon,
  Chip,
  ConfirmDialog,
  Field,
  FormLayout,
  MoneyInput,
  OptionSheet,
  Text,
  useToast,
  type SheetOption,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import { deleteBudget, listBudgets, setBudget } from '@/features/budgets/repository';
import { listCategoryTree } from '@/features/categories/repository';
import { totalsByCategory } from '@/features/reports/repository';
import { monthKey, shiftMonth } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Criar ou editar o orçamento mensal de uma categoria. Parâmetro opcional: categoria. */
export default function EditarOrcamento() {
  const { categoria } = useLocalSearchParams<{ categoria?: string }>();
  const db = useDb();
  const toast = useToast();
  const { colors } = useTheme();
  const [existing] = useState(() => listBudgets(db).find((b) => b.categoryId === categoria));
  const [categoryId, setCategoryId] = useState(categoria ?? '');
  const [amount, setAmount] = useState(existing?.amountCents ?? 0);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useDbQuery(
    (d) => {
      const tree = listCategoryTree(d, 'expense');
      // Média dos 3 meses anteriores, para sugerir um valor realista.
      const cur = monthKey(new Date());
      const months = [1, 2, 3].map((i) => shiftMonth(cur, -i));
      const avg = categoryId
        ? Math.round(
            months.reduce(
              (s, m) =>
                s +
                (totalsByCategory(d, 'expense', m).find((t) => t.categoryId === categoryId)
                  ?.cents ?? 0),
              0,
            ) / 3,
          )
        : 0;
      return { tree, avg, budgeted: new Set(listBudgets(d).map((b) => b.categoryId)) };
    },
    ['categories', 'budgets', 'transactions'],
    [categoryId],
  );
  const category = data?.tree.find((c) => c.id === categoryId);
  const options: SheetOption<string>[] = (data?.tree ?? [])
    .filter((c) => c.id === categoryId || !data?.budgeted.has(c.id))
    .map((c) => ({
      value: c.id,
      label: c.name,
      icon: <CategoryIcon icon={c.icon} color={c.color} size={32} />,
    }));

  const save = () => {
    try {
      setBudget(db, categoryId, amount);
      toast({ message: existing ? 'Orçamento atualizado' : 'Orçamento criado' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormLayout
      title={existing ? 'Editar orçamento' : 'Novo orçamento'}
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
            label={existing ? 'Salvar alterações' : 'Criar orçamento'}
            disabled={!categoryId || amount <= 0}
            onPress={save}
          />
        </>
      }
    >
      <Field label="Categoria" hint="Vale para a categoria inteira, somando as subcategorias.">
        <Pressable
          disabled={!!existing}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          style={[styles.select, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <CategoryIcon icon={category?.icon} color={category?.color} size={32} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {category?.name ?? 'Escolher categoria'}
          </Text>
          {!existing && (
            <Text variant="caption" tone="brand">
              {category ? 'Trocar' : 'Escolher'}
            </Text>
          )}
        </Pressable>
      </Field>

      <Field label="Limite por mês">
        <MoneyInput value={amount} onChange={setAmount} accessibilityLabel="Limite por mês" />
        {(data?.avg ?? 0) > 0 && (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Text variant="caption" tone="muted">
              Você gastou em média {formatBRL(data!.avg)} por mês nos últimos 3 meses.
            </Text>
            <Chip label={`Usar ${formatBRL(data!.avg)}`} onPress={() => setAmount(data!.avg)} />
          </View>
        )}
      </Field>

      <View style={[styles.note, { backgroundColor: colors.brandSoft }]}>
        <Text variant="caption">
          Até 80% do limite a barra fica normal; de 80% a 100% aparece “Atenção”; acima disso,
          “Estourou”. No mês atual, o app também avisa se o ritmo de gasto vai passar do limite.
        </Text>
      </View>

      {existing && (
        <Button
          label="Remover orçamento"
          variant="danger"
          icon="trash-outline"
          onPress={() => setConfirm(true)}
        />
      )}

      <OptionSheet
        visible={picking}
        title="Categoria"
        options={options}
        value={categoryId}
        onSelect={setCategoryId}
        onClose={() => setPicking(false)}
      />
      <ConfirmDialog
        visible={confirm}
        title="Remover este orçamento?"
        message="Os gastos continuam no histórico; só o limite deixa de existir."
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (existing) deleteBudget(db, existing.id);
          setConfirm(false);
          toast({ message: 'Orçamento removido' });
          router.back();
        }}
        onCancel={() => setConfirm(false)}
      />
    </FormLayout>
  );
}

const styles = StyleSheet.create({
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  note: { padding: space.md, borderRadius: radius.md },
});
