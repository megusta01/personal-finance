import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { EmptyState, Money, ScreenHeader, Text } from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import { ACCOUNT_TABLES, countActiveAccounts, getAccount } from '@/features/accounts/repository';
import { TransactionFeed } from '@/features/transactions/TransactionFeed';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function ContaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data } = useDbQuery(
    (db) => ({ account: getAccount(db, id), activeCount: countActiveAccounts(db) }),
    ACCOUNT_TABLES,
    [id],
  );
  const account = data?.account;

  if (!account) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Conta não encontrada"
          message="Ela pode ter sido excluída."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const meta = ACCOUNT_TYPE_META[account.type];
  const canTransfer = !account.archivedAt && (data?.activeCount ?? 0) > 1;

  const header = (
    <>
      <ScreenHeader back title={account.name} />
      <View style={[styles.hero, { backgroundColor: account.color }]}>
        <View style={styles.heroTop}>
          <Ionicons name={meta.icon} size={18} color="#F6F1E6" />
          <Text variant="caption" style={styles.heroMuted}>
            {[meta.label, account.institution].filter(Boolean).join(', ')}
          </Text>
        </View>
        <Text variant="caption" style={[styles.heroMuted, { marginTop: space.md }]}>
          Saldo atual
        </Text>
        <Money
          cents={account.balanceCents}
          variant="display"
          style={{ color: '#F6F1E6' }}
          adjustsFontSizeToFit
          numberOfLines={1}
        />
        {(!account.includeInTotal || account.archivedAt) && (
          <Text variant="caption" style={[styles.heroMuted, { marginTop: space.xs }]}>
            {account.archivedAt
              ? 'Conta arquivada. Não entra no saldo total.'
              : 'Esta conta não entra no saldo total.'}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <Action
          icon="add"
          label="Lançar"
          disabled={!!account.archivedAt}
          onPress={() =>
            router.push({ pathname: '/transacao/nova', params: { conta: account.id } })
          }
        />
        <Action
          icon="swap-horizontal"
          label="Transferir"
          disabled={!canTransfer}
          onPress={() =>
            router.push({
              pathname: '/transacao/nova',
              params: { tipo: 'transfer', conta: account.id },
            })
          }
        />
        <Action
          icon="options-outline"
          label="Ajustar saldo"
          disabled={!!account.archivedAt}
          onPress={() => router.push(`/conta/ajustar/${account.id}`)}
        />
        <Action
          icon="create-outline"
          label="Editar"
          onPress={() => router.push(`/conta/editar/${account.id}`)}
        />
      </View>
    </>
  );

  return <TransactionFeed header={header} fixedAccountId={account.id} />;
}

function Action({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <View
        style={[styles.actionIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Ionicons name={icon} size={21} color={colors.brand} />
      </View>
      <Text variant="caption" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroMuted: { color: '#F6F1E6', opacity: 0.8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: space.sm, width: 78 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
