import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Divider, MoneyInput, Screen, SectionHeader, Surface, Text } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { useRates, type Rate } from '@/features/rates/useRates';
import { totalBalance, TX_TABLES } from '@/features/transactions/repository';
import { formatBRL } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const SYMBOL: Record<Rate['code'], string> = { USD: 'US$', EUR: '€', GBP: '£', BTC: '₿' };

function formatForeign(value: number, code: Rate['code']) {
  const digits = code === 'BTC' ? 6 : 2;
  return `${SYMBOL[code]} ${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function Cambio() {
  const { colors } = useTheme();
  const rates = useRates();
  const { data: balance } = useDbQuery((db) => totalBalance(db), TX_TABLES);
  const [amount, setAmount] = useState<number | null>(null);
  const reais = (amount ?? Math.max(0, balance ?? 0)) / 100;

  return (
    <Screen
      title="Câmbio"
      refreshing={rates.status === 'loading' && !!rates.rates}
      onRefresh={rates.reload}
    >
      <Surface style={{ padding: space.lg, gap: space.xs }}>
        <Text variant="caption" tone="muted" align="center">
          Converter de reais
        </Text>
        <MoneyInput value={amount ?? Math.max(0, balance ?? 0)} onChange={setAmount} />
        <Text variant="caption" tone="subtle" align="center">
          {amount === null
            ? 'Começa com o seu saldo. Digite outro valor se quiser.'
            : 'Valor digitado por você.'}
        </Text>
      </Surface>

      <SectionHeader
        title="Cotações"
        action={
          rates.updatedAt ? (
            <Text variant="caption" tone="subtle">
              Atualizado às {format(rates.updatedAt, 'HH:mm')}
            </Text>
          ) : undefined
        }
      />

      {rates.status === 'error' && (
        <View style={[styles.error, { backgroundColor: colors.expenseSoft }]}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.expense} />
          <Text variant="caption" style={{ flex: 1 }}>
            {rates.message}
          </Text>
          <Button label="Tentar de novo" variant="ghost" onPress={rates.reload} />
        </View>
      )}

      {rates.rates ? (
        <Surface>
          {rates.rates.map((r, i) => (
            <View key={r.code}>
              {i > 0 && <Divider inset={space.lg} />}
              <View style={styles.rateRow}>
                <View style={[styles.code, { backgroundColor: colors.brandSoft }]}>
                  <Text variant="micro" tone="brand">
                    {r.code}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{r.name}</Text>
                  <Text variant="caption" tone="muted" tabular>
                    1 {r.code} = {formatBRL(Math.round(r.bid * 100))}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="bodyStrong" tabular>
                    {formatForeign(reais / r.bid, r.code)}
                  </Text>
                  <Text variant="caption" tabular tone={r.pctChange >= 0 ? 'income' : 'expense'}>
                    {r.pctChange >= 0 ? '▲' : '▼'}{' '}
                    {Math.abs(r.pctChange).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                    hoje
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Surface>
      ) : rates.status === 'loading' ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
      ) : null}

      <Text variant="caption" tone="subtle">
        Cotações de compra da AwesomeAPI, atualizadas em intervalos de alguns minutos. Use como
        referência.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  code: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    paddingLeft: space.lg,
    paddingVertical: space.xs,
  },
});
