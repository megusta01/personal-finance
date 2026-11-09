import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import {
  Chip,
  ConfirmDialog,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { useDb, useDbQuery } from '@/db/client';
import {
  backupFileName,
  createBackup,
  describeBackup,
  parseBackup,
  restoreBackup,
  type Backup,
  type BackupInfo,
} from '@/features/backup/backup';
import { csvFileName, exportCsv } from '@/features/backup/csv';
import { pickTextFile, saveAndShare } from '@/features/backup/files';
import { generateAll } from '@/features/recurrences/repository';
import { authenticate, lockAvailability, lockSupported } from '@/features/security/auth';
import { getMeta } from '@/features/catalog/meta';
import { countTransactions } from '@/features/transactions/repository';
import { formatDateShort } from '@/lib/dates';
import { requestPermission, remindersSupported } from '@/features/reminders/notifications';
import {
  setHideValues,
  setLockEnabled,
  setReminderPrefs,
  setThemePref,
  usePrefs,
  type ThemePref,
} from '@/lib/prefs';
import { syncConfigured } from '@/features/sync/client';
import { useSyncStatus } from '@/features/sync/service';
import { useSession } from '@/features/sync/session';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Mais() {
  const { session } = useSession();
  const syncStatus = useSyncStatus();
  const syncIcon: keyof typeof Ionicons.glyphMap = !session
    ? 'cloud-outline'
    : syncStatus.error
      ? 'cloud-offline-outline'
      : 'cloud-done-outline';
  const syncSubtitle = !syncConfigured
    ? 'Não configurada. Toque para ver como ligar.'
    : !session
      ? 'Entre com sua conta para usar em mais de um aparelho'
      : syncStatus.running
        ? `${session.user.email} · sincronizando…`
        : syncStatus.error
          ? `${session.user.email} · ${syncStatus.error.kind === 'offline' ? 'sem conexão' : syncStatus.error.kind === 'unavailable' ? 'nuvem indisponível, tentando de novo' : 'precisa de atenção'}`
          : `${session.user.email} · em dia`;

  const { colors } = useTheme();
  const prefs = usePrefs();
  const db = useDb();
  const toast = useToast();
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockLabel, setLockLabel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    lockAvailability().then((a) => alive && setLockLabel(a.ok ? a.label : null));
    return () => {
      alive = false;
    };
  }, []);

  /** Ligar ou desligar exige se autenticar (evita que outra pessoa desligue). */
  const toggleLock = async (on: boolean) => {
    setLockError(null);
    if (on) {
      const a = await lockAvailability();
      if (!a.ok) return setLockError(a.reason);
    }
    if (
      await authenticate(
        on ? 'Confirme para ligar o bloqueio' : 'Confirme para desligar o bloqueio',
      )
    )
      setLockEnabled(on);
  };

  const [pending, setPending] = useState<{ backup: Backup; info: BackupInfo } | null>(null);

  const run = async (what: 'csv' | 'backup') => {
    try {
      if (what === 'csv') {
        await saveAndShare(csvFileName(), exportCsv(db), 'text/csv', 'Exportar planilha');
      } else {
        await saveAndShare(
          backupFileName(),
          JSON.stringify(createBackup(db, Constants.expoConfig?.version)),
          'application/json',
          'Salvar backup',
        );
      }
    } catch (e) {
      toast({ message: (e as Error).message || 'Não foi possível gerar o arquivo.' });
    }
  };

  const pickBackup = async () => {
    try {
      const text = await pickTextFile();
      if (!text) return;
      const backup = parseBackup(text);
      setPending({ backup, info: describeBackup(backup) });
    } catch (e) {
      toast({ message: (e as Error).message, duration: 6000 });
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    try {
      restoreBackup(db, pending.backup);
      generateAll(db);
      toast({ message: 'Backup restaurado' });
    } catch (e) {
      toast({ message: (e as Error).message, duration: 6000 });
    } finally {
      setPending(null);
    }
  };
  const [permissionDenied, setPermissionDenied] = useState(false);

  const toggleReminders = async (on: boolean) => {
    if (!on) {
      setReminderPrefs({ remindersEnabled: false });
      return;
    }
    const granted = await requestPermission();
    setPermissionDenied(!granted);
    setReminderPrefs({ remindersEnabled: granted });
  };
  const { data } = useDbQuery(
    (db) => ({
      count: countTransactions(db),
      legacyCount: Number(getMeta(db, 'legacy_imported_count') ?? 0),
      legacyAt: getMeta(db, 'legacy_imported_at'),
    }),
    ['transactions'],
  );

  return (
    <Screen title="Mais">
      <SectionHeader title="Organizar" />
      <Surface>
        <ListRow
          title="Categorias"
          subtitle="Criar, editar e arquivar categorias e subcategorias"
          left={<Ionicons name="pricetags-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/categorias')}
        />
        <Divider inset={56} />
        <ListRow
          title="Contas e cartões"
          subtitle="Saldos, transferências, faturas e limites"
          left={<Ionicons name="wallet-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/contas')}
        />
        <Divider inset={56} />
        <ListRow
          title="Câmbio"
          subtitle="Cotações e conversor de moedas"
          left={<Ionicons name="globe-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/cambio')}
        />
      </Surface>

      <SectionHeader title="Planejar" />
      <Surface>
        <ListRow
          title="Relatórios"
          subtitle="Gastos por categoria, ritmo do mês e 12 meses"
          left={<Ionicons name="pie-chart-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/relatorios')}
        />
        <Divider inset={56} />
        <ListRow
          title="Orçamentos"
          subtitle="Limite de gasto por categoria"
          left={<Ionicons name="speedometer-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/orcamentos')}
        />
        <Divider inset={56} />
        <ListRow
          title="Metas"
          subtitle="Juntar dinheiro para um objetivo"
          left={<Ionicons name="flag-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/metas')}
        />
      </Surface>

      <SectionHeader title="Contas do mês" />
      <Surface>
        <ListRow
          title="A pagar e a receber"
          subtitle="Vencimentos, contas atrasadas e o que falta receber"
          left={<Ionicons name="calendar-outline" size={22} color={colors.brand} />}
          onPress={() => router.push('/pagamentos')}
        />
        <Divider inset={56} />
        <ListRow
          title="Recorrências"
          subtitle="Aluguel, luz, assinaturas, salário…"
          left={<Ionicons name="repeat" size={22} color={colors.brand} />}
          onPress={() => router.push('/recorrencias')}
        />
      </Surface>

      <SectionHeader title="Lembretes" />
      <Surface style={{ padding: space.lg, gap: space.lg }}>
        {remindersSupported ? (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Avisar vencimentos</Text>
                <Text variant="caption" tone="muted">
                  Notificação no celular para contas a pagar, recebimentos e faturas de cartão.
                </Text>
              </View>
              <Switch
                value={prefs.remindersEnabled}
                onValueChange={toggleReminders}
                accessibilityLabel="Avisar vencimentos"
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            {permissionDenied && (
              <Text variant="caption" tone="danger">
                As notificações estão bloqueadas para o app. Libere nas configurações do celular e
                ligue de novo.
              </Text>
            )}
            {prefs.remindersEnabled && (
              <>
                <Divider />
                <View style={{ gap: space.sm }}>
                  <Text variant="caption" tone="muted">
                    Horário do aviso
                  </Text>
                  <View style={styles.chips}>
                    {[7, 9, 12, 18, 20].map((h) => (
                      <Chip
                        key={h}
                        label={`${h}h`}
                        selected={prefs.reminderHour === h}
                        onPress={() => setReminderPrefs({ reminderHour: h })}
                      />
                    ))}
                  </View>
                </View>
                <View style={{ gap: space.sm }}>
                  <Text variant="caption" tone="muted">
                    Avisar também antes
                  </Text>
                  <View style={styles.chips}>
                    {[0, 1, 2, 3, 5, 7].map((d) => (
                      <Chip
                        key={d}
                        label={d === 0 ? 'Só no dia' : d === 1 ? '1 dia antes' : `${d} dias antes`}
                        selected={prefs.reminderDaysBefore === d}
                        onPress={() => setReminderPrefs({ reminderDaysBefore: d })}
                      />
                    ))}
                  </View>
                </View>
                <Text variant="caption" tone="subtle">
                  Com “Ocultar valores” ligado, os avisos não mostram valores na tela bloqueada.
                </Text>
              </>
            )}
          </>
        ) : (
          <Text variant="caption" tone="muted">
            Lembretes funcionam no app de celular (Android e iPhone).
          </Text>
        )}
      </Surface>

      {lockSupported && (
        <>
          <SectionHeader title="Segurança" />
          <Surface style={{ padding: space.lg, gap: space.sm }}>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Bloquear o app</Text>
                <Text variant="caption" tone="muted">
                  Pede {lockLabel ?? 'biometria'} ao abrir e ao voltar depois de 1 minuto. Esconde
                  os valores na lista de apps abertos.
                </Text>
              </View>
              <Switch
                value={prefs.lockEnabled}
                onValueChange={toggleLock}
                accessibilityLabel="Bloquear o app"
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            {lockError && (
              <Text variant="caption" tone="danger">
                {lockError}
              </Text>
            )}
          </Surface>
        </>
      )}

      <SectionHeader title="Aparência" />
      <Surface style={{ padding: space.lg, gap: space.lg }}>
        <Segmented<ThemePref>
          accessibilityLabel="Tema"
          value={prefs.theme}
          onChange={setThemePref}
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
          ]}
        />
        <Divider />
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Ocultar valores</Text>
            <Text variant="caption" tone="muted">
              Esconde saldos e valores na tela. Útil em lugares públicos.
            </Text>
          </View>
          <Switch
            value={prefs.hideValues}
            onValueChange={setHideValues}
            accessibilityLabel="Ocultar valores"
            trackColor={{ true: colors.brand, false: colors.border }}
            thumbColor={colors.surface}
          />
        </View>
      </Surface>

      <SectionHeader title="Seus dados" />
      <Surface>
        <InfoRow
          icon="phone-portrait-outline"
          title="Guardados neste aparelho"
          detail={`${data?.count ?? 0} transações. Funciona sem internet.`}
        />
        {!!data?.legacyCount && (
          <>
            <Divider inset={56} />
            <InfoRow
              icon="archive-outline"
              title="Importados da versão anterior"
              detail={`${data.legacyCount} transações${data.legacyAt ? ` em ${formatDateShort(data.legacyAt.slice(0, 10))}` : ''}. A tabela antiga foi mantida como cópia de segurança.`}
            />
          </>
        )}
        <Divider inset={56} />
        <ListRow
          title="Exportar planilha"
          subtitle="Todos os lançamentos em CSV, abre no Excel e no Google Planilhas"
          left={<Ionicons name="document-text-outline" size={22} color={colors.brand} />}
          onPress={() => run('csv')}
          chevron={false}
        />
        <Divider inset={56} />
        <ListRow
          title="Fazer backup"
          subtitle="Arquivo com todos os seus dados. Guarde no Drive, e-mail ou computador."
          left={<Ionicons name="cloud-download-outline" size={22} color={colors.brand} />}
          onPress={() => run('backup')}
          chevron={false}
        />
        <Divider inset={56} />
        <ListRow
          title="Restaurar backup"
          subtitle="Substitui os dados deste aparelho pelos de um arquivo de backup"
          left={<Ionicons name="cloud-upload-outline" size={22} color={colors.brand} />}
          onPress={pickBackup}
          chevron={false}
        />
        <Divider inset={56} />
        <ListRow
          title="Sincronização na nuvem"
          subtitle={syncSubtitle}
          left={<Ionicons name={syncIcon} size={22} color={colors.brand} />}
          onPress={() => router.push('/nuvem')}
        />
      </Surface>
      <ConfirmDialog
        visible={!!pending}
        title="Restaurar este backup?"
        message={
          pending
            ? `Backup de ${formatDateShort(pending.info.createdAt.slice(0, 10))}, com ${pending.info.transactions} lançamentos. Todos os dados atuais deste aparelho serão substituídos${session ? ' (e na sua conta na nuvem também, inclusive nos outros aparelhos)' : ''}. Se quiser, faça um backup antes.`
            : undefined
        }
        confirmLabel="Restaurar"
        destructive
        onConfirm={confirmRestore}
        onCancel={() => setPending(null)}
      />

      <Text variant="caption" tone="subtle" align="center" style={{ marginTop: space.lg }}>
        Finanças, versão {Constants.expoConfig?.version ?? '2.0.0'}
      </Text>
    </Screen>
  );
}

function InfoRow({
  icon,
  title,
  detail,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { padding: space.lg, alignItems: 'flex-start' }]}>
      <Ionicons
        name={icon}
        size={22}
        color={muted ? colors.textSubtle : colors.brand}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={muted ? 'muted' : 'default'}>
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
