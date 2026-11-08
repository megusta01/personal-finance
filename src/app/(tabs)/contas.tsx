import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  Money,
  Screen,
  SectionHeader,
  Surface,
  Text,
} from '@/components/ui';
import { useDbQuery } from '@/db/client';
import { AccountIcon } from '@/features/accounts/AccountIcon';
import { ACCOUNT_TYPE_META } from '@/features/accounts/meta';
import {
  ACCOUNT_TABLES,
  listAccountsWithBalance,
  type AccountWithBalance,
} from '@/features/accounts/repository';
import { CardVisual } from '@/features/cards/CardVisual';
import { STATUS_META } from '@/features/cards/meta';
import { listCards, listCardsOverview, type CardOverview } from '@/features/cards/repository';
import { formatDateShort, formatMonthShort } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Contas() {
  const { colors } = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useDbQuery(
    (db) => ({
      active: listAccountsWithBalance(db),
      archived: listAccountsWithBalance(db, { archived: true }),
      cards: listCardsOverview(db),
      archivedCards: listCards(db, { archived: true }),
    }),
    [...ACCOUNT_TABLES, 'credit_cards'],
  );
  const cards = data?.cards ?? [];
  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const total = active.filter((a) => a.includeInTotal).reduce((s, a) => s + a.balanceCents, 0);
  const outside = active.filter((a) => !a.includeInTotal).length;

  return (
    <Screen
      title="Contas e cartões"
      right={
        <IconButton
          icon="add"
          label="Nova conta"
          background={colors.brandSoft}
          color={colors.brand}
          onPress={() => router.push('/conta/nova')}
        />
      }
    >
      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted">
          Saldo total
        </Text>
        <Money cents={total} variant="display" tone={total < 0 ? 'expense' : 'default'} />
        {outside > 0 && (
          <Text variant="caption" tone="subtle">
            {outside === 1 ? '1 conta não entra no total' : `${outside} contas não entram no total`}
          </Text>
        )}
      </View>

      <Surface>
        {active.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Divider inset={68} />}
            <AccountRow account={a} />
          </View>
        ))}
      </Surface>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button
          label="Transferir"
          icon="swap-horizontal"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={active.length < 2}
          onPress={() => router.push({ pathname: '/transacao/nova', params: { tipo: 'transfer' } })}
        />
        <Button
          label="Nova conta"
          icon="add"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push('/conta/nova')}
        />
      </View>
      {active.length < 2 && (
        <Text variant="caption" tone="subtle" style={{ marginTop: -space.sm }}>
          Cadastre uma segunda conta para fazer transferências entre elas.
        </Text>
      )}

      <SectionHeader
        title="Cartões de crédito"
        action={
          <IconButton
            icon="add"
            label="Novo cartão"
            size={20}
            color={colors.brand}
            onPress={() => router.push('/cartao/novo')}
          />
        }
      />
      {cards.length > 0 ? (
        <Surface>
          {cards.map((c, i) => (
            <View key={c.id}>
              {i > 0 && <Divider inset={68} />}
              <CardRow card={c} />
            </View>
          ))}
        </Surface>
      ) : (
        <Surface>
          <EmptyState
            icon="card-outline"
            title="Nenhum cartão ainda"
            message="Cadastre seus cartões para acompanhar faturas, limite e compras parceladas."
            actionLabel="Cadastrar cartão"
            onAction={() => router.push('/cartao/novo')}
          />
        </Surface>
      )}
      {(data?.archivedCards.length ?? 0) > 0 && (
        <Surface>
          {data!.archivedCards.map((c, i) => (
            <View key={c.id}>
              {i > 0 && <Divider inset={68} />}
              <ListRow
                title={c.name}
                subtitle="Cartão arquivado"
                tone="muted"
                left={<CardVisual compact name={c.name} brand={c.brand} color={c.color} />}
                onPress={() => router.push(`/cartao/${c.id}`)}
              />
            </View>
          ))}
        </Surface>
      )}

      {archived.length > 0 && (
        <>
          <SectionHeader title="Contas arquivadas" />
          <Surface>
            <ListRow
              title={
                showArchived
                  ? 'Esconder contas arquivadas'
                  : `Mostrar ${archived.length === 1 ? '1 conta arquivada' : `${archived.length} contas arquivadas`}`
              }
              tone="muted"
              chevron={false}
              onPress={() => setShowArchived((v) => !v)}
            />
            {showArchived &&
              archived.map((a) => (
                <View key={a.id}>
                  <Divider inset={68} />
                  <AccountRow account={a} />
                </View>
              ))}
          </Surface>
        </>
      )}
    </Screen>
  );
}

function AccountRow({ account: a }: { account: AccountWithBalance }) {
  const subtitle = [
    ACCOUNT_TYPE_META[a.type].label,
    a.institution,
    a.includeInTotal ? null : 'fora do total',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <ListRow
      title={a.name}
      subtitle={subtitle}
      left={<AccountIcon icon={a.icon} color={a.color} />}
      right={
        <Money
          cents={a.balanceCents}
          variant="bodyStrong"
          tone={a.balanceCents < 0 ? 'expense' : a.archivedAt ? 'muted' : 'default'}
        />
      }
      onPress={() => router.push(`/conta/${a.id}`)}
      chevron={false}
    />
  );
}

function CardRow({ card: c }: { card: CardOverview }) {
  const inv = c.current;
  const status = STATUS_META[inv.status];
  const amount = inv.paidCents > 0 && inv.status !== 'paid' ? inv.remainingCents : inv.totalCents;
  const subtitle =
    inv.status === 'empty'
      ? `Fatura de ${formatMonthShort(inv.month)} sem lançamentos`
      : `Fatura de ${formatMonthShort(inv.month)}: ${status.label.toLowerCase()}, vence ${formatDateShort(inv.dates.dueDate).slice(0, 5)}`;
  return (
    <ListRow
      title={c.name}
      subtitle={subtitle}
      left={<CardVisual compact name={c.name} brand={c.brand} color={c.color} />}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Money
            cents={amount}
            variant="bodyStrong"
            tone={inv.status === 'overdue' ? 'expense' : 'default'}
          />
          <Text variant="micro" tone="subtle">
            disp. <Money cents={c.availableCents} variant="micro" tone="subtle" />
          </Text>
        </View>
      }
      onPress={() => router.push(`/cartao/${c.id}`)}
      chevron={false}
    />
  );
}
