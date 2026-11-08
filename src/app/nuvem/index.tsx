import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  Button,
  ConfirmDialog,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import type { MigrationDb } from '@/db/migrations';
import { signOutAndWipe, wipeForCurrentAccount } from '@/features/sync/account';
import { syncConfigured } from '@/features/sync/client';
import { lastSyncAt, pendingCount } from '@/features/sync/engine';
import { requestSync, useSyncStatus } from '@/features/sync/service';
import { useSession } from '@/features/sync/session';
import { formatSince } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

export default function Nuvem() {
  const { session, loading } = useSession();
  return (
    <Screen title="Sincronização" back>
      {!syncConfigured ? (
        <NotConfigured />
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: space.xl }} />
      ) : session ? (
        <SignedIn email={session.user.email ?? 'sua conta'} />
      ) : (
        <SignedOut />
      )}
    </Screen>
  );
}

function Benefit({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.benefit}>
      <View style={[styles.benefitIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

function SignedOut() {
  return (
    <View style={{ gap: space.lg }}>
      <Surface style={{ padding: space.xl, gap: space.lg }}>
        <Text variant="heading">Seus dados em todos os aparelhos</Text>
        <Benefit
          icon="cloud-done-outline"
          title="Cópia automática na nuvem"
          detail="Perdeu ou trocou de celular? É só entrar na conta e tudo volta."
        />
        <Benefit
          icon="phone-portrait-outline"
          title="Celular, tablet e navegador"
          detail="Lance no celular e confira no computador, sempre em dia."
        />
        <Benefit
          icon="airplane-outline"
          title="Continua funcionando sem internet"
          detail="Os dados ficam no aparelho e sobem quando a conexão voltar."
        />
        <Benefit
          icon="lock-closed-outline"
          title="Só você vê seus dados"
          detail="Cada conta só acessa os próprios registros, protegidos por senha."
        />
      </Surface>
      <Button
        size="lg"
        label="Criar conta"
        onPress={() => router.push('/nuvem/entrar?modo=criar')}
      />
      <Button
        size="lg"
        variant="secondary"
        label="Já tenho conta"
        onPress={() => router.push('/nuvem/entrar')}
      />
      <Text variant="caption" tone="subtle" align="center">
        O que você já registrou neste aparelho vai junto para a conta.
      </Text>
    </View>
  );
}

function StatusLine() {
  const { colors } = useTheme();
  const status = useSyncStatus();
  const { data } = useDbQuery(
    (d) => ({ pending: pendingCount(d), last: lastSyncAt(d) }),
    ['sync_outbox', 'app_meta'],
  );
  const pending = data?.pending ?? 0;

  let icon: IconName = 'checkmark-circle';
  let color = colors.income;
  let title = 'Tudo sincronizado';
  let detail = data?.last ? `Última vez ${formatSince(data.last)}.` : 'Ainda não sincronizou.';
  if (status.running) {
    title = 'Sincronizando…';
    detail = pending ? `${pending} alterações para enviar.` : 'Conferindo novidades na nuvem.';
  } else if (status.error) {
    icon = status.error.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle';
    color = status.error.kind === 'offline' ? colors.textMuted : colors.danger;
    title = status.error.kind === 'offline' ? 'Sem conexão' : 'Não foi possível sincronizar';
    detail = status.error.message;
  } else if (pending) {
    icon = 'time-outline';
    color = colors.accent;
    title = `${pending} ${pending === 1 ? 'alteração aguardando' : 'alterações aguardando'} envio`;
  }

  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {status.running ? (
        <ActivityIndicator color={colors.brand} style={{ width: 24 }} />
      ) : (
        <Ionicons name={icon} size={24} color={color} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text
          variant="caption"
          tone={status.error?.kind === 'offline' ? 'muted' : status.error ? 'danger' : 'muted'}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}

function SignedIn({ email }: { email: string }) {
  const { colors } = useTheme();
  const db = useDb();
  const toast = useToast();
  const status = useSyncStatus();
  const [confirm, setConfirm] = useState<null | { pending: number }>(null);
  const [wipeOther, setWipeOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const mdb: MigrationDb = useSQLiteContext();

  const askSignOut = async () => {
    setBusy(true);
    await requestSync(db, 'manual');
    setBusy(false);
    setConfirm({ pending: pendingCount(db) });
  };

  const signOut = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await signOutAndWipe(mdb);
      toast({ message: 'Você saiu da conta' });
    } catch (e) {
      toast({ message: `Não foi possível sair: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const useThisAccount = async () => {
    setWipeOther(false);
    await wipeForCurrentAccount(mdb);
    await requestSync(db, 'manual');
    toast({ message: 'Pronto. Os dados desta conta estão sendo baixados.' });
  };

  return (
    <View style={{ gap: space.lg }}>
      <Surface>
        <ListRow
          title={email}
          subtitle="Conta conectada"
          left={<Ionicons name="person-circle-outline" size={28} color={colors.brand} />}
        />
        <Divider inset={space.lg} />
        <StatusLine />
        <View style={{ padding: space.lg, paddingTop: 0, gap: space.sm }}>
          {status.error?.kind === 'other-account' ? (
            <Button
              variant="danger"
              label="Apagar dados do aparelho e usar esta conta"
              onPress={() => setWipeOther(true)}
            />
          ) : status.error?.kind === 'auth' ? (
            <Button label="Entrar de novo" onPress={() => router.push('/nuvem/entrar')} />
          ) : (
            <Button
              variant="secondary"
              icon="sync-outline"
              label="Sincronizar agora"
              loading={status.running}
              onPress={() => void requestSync(db, 'manual')}
            />
          )}
        </View>
      </Surface>

      <SectionHeader title="Como funciona" />
      <Surface style={{ padding: space.lg, gap: space.md }}>
        <Text variant="caption" tone="muted">
          Contas, cartões, lançamentos, categorias, recorrências, orçamentos e metas vão para a
          nuvem sozinhos, alguns segundos depois de cada alteração, ao abrir o app e a cada 5
          minutos.
        </Text>
        <Text variant="caption" tone="muted">
          Se a mesma coisa for editada em dois aparelhos, fica a edição mais recente.
        </Text>
        <Text variant="caption" tone="muted">
          Tema, lembretes, bloqueio e “Ocultar valores” são de cada aparelho e não sincronizam.
        </Text>
      </Surface>

      <Surface>
        <ListRow
          title="Sair da conta"
          subtitle="Apaga os dados deste aparelho. Eles continuam na sua conta."
          tone="danger"
          left={<Ionicons name="log-out-outline" size={22} color={colors.danger} />}
          onPress={busy ? undefined : askSignOut}
          chevron={false}
        />
      </Surface>

      <ConfirmDialog
        visible={!!confirm}
        title="Sair da conta?"
        message={
          confirm?.pending
            ? `Atenção: ${confirm.pending} ${confirm.pending === 1 ? 'alteração ainda não foi' : 'alterações ainda não foram'} para a nuvem (sem conexão?) e ${confirm.pending === 1 ? 'será perdida' : 'serão perdidas'}. Se puder, conecte à internet e sincronize antes.`
            : 'Os dados saem deste aparelho, mas continuam na sua conta. Para vê-los de novo, é só entrar.'
        }
        confirmLabel={confirm?.pending ? 'Sair mesmo assim' : 'Sair'}
        destructive
        onConfirm={signOut}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={wipeOther}
        title="Usar esta conta neste aparelho?"
        message="Os dados que estão no aparelho são de outra conta e serão apagados daqui (continuam na outra conta, na nuvem). Depois, os dados desta conta são baixados."
        confirmLabel="Apagar e continuar"
        destructive
        onConfirm={useThisAccount}
        onCancel={() => setWipeOther(false)}
      />
    </View>
  );
}

function NotConfigured() {
  const { colors } = useTheme();
  return (
    <Surface style={{ padding: space.xl, gap: space.md }}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.textSubtle} />
      <Text variant="heading">Sincronização não configurada</Text>
      <Text tone="muted">
        Para usar a nuvem, este app precisa de um projeto no Supabase (o plano gratuito serve).
      </Text>
      <Text variant="caption" tone="muted">
        1. Crie o projeto em supabase.com.{'\n'}2. No SQL Editor, rode o arquivo
        supabase/schema.sql.{'\n'}3. Copie a URL e a chave publicável para o arquivo .env (modelo em
        .env.example).{'\n'}4. Reinicie com npx expo start --clear.
      </Text>
      <Text variant="caption" tone="subtle">
        O passo a passo completo está no README, em “Sincronização com o Supabase”.
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  benefit: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.lg },
});
