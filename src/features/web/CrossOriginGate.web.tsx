import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * O banco no navegador precisa de SharedArrayBuffer, que só existe com a página "isolada"
 * (cabeçalhos COOP/COEP). Se o servidor não mandou os cabeçalhos, instala o
 * public/coi-serviceworker.js, que passa a mandá-los, e recarrega a página uma vez.
 */
const SW_URL = '/coi-serviceworker.js';
const RELOAD_FLAG = 'coi.reloaded';

type State = 'ok' | 'preparing' | 'insecure' | 'failed';

function detect(): State {
  if (typeof window === 'undefined') return 'preparing'; // renderização estática
  if (window.crossOriginIsolated) {
    sessionStorage.removeItem(RELOAD_FLAG);
    return 'ok';
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return 'insecure';
  if (sessionStorage.getItem(RELOAD_FLAG)) return 'failed';
  return 'preparing';
}

async function installAndReload() {
  await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
}

export function CrossOriginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(detect);

  useEffect(() => {
    if (state !== 'preparing') return;
    installAndReload().catch((e) => {
      console.warn('[web] service worker', e);
      setState('failed');
    });
  }, [state]);

  if (state === 'ok') return <>{children}</>;

  if (state === 'preparing')
    return (
      <Box>
        <ActivityIndicator color="#0F4C5C" />
        <Text style={styles.text}>Preparando o app no navegador…</Text>
      </Box>
    );

  const insecure = state === 'insecure';
  return (
    <Box>
      <Text style={styles.title}>Não foi possível abrir o app neste endereço</Text>
      <Text style={styles.text}>
        {insecure
          ? `O navegador só libera o banco de dados do app em endereços seguros: https:// ou http://localhost. Você abriu ${window.location.origin}. No computador onde o Expo está rodando, use http://localhost:8081.`
          : 'O navegador não ativou o modo de que o banco de dados do app precisa. Isso acontece, por exemplo, depois de recarregar forçado (Ctrl+Shift+R) ou em janelas anônimas de alguns navegadores. Toque em "Tentar de novo".'}
      </Text>
      {!insecure && (
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            sessionStorage.removeItem(RELOAD_FLAG);
            window.location.reload();
          }}
        >
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
      )}
    </Box>
  );
}

function Box({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
        backgroundColor: '#F4F6F5',
      }}
    >
      <View style={{ maxWidth: 420, gap: 16, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

const styles = {
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#10201F',
    textAlign: 'center' as const,
  },
  text: { fontSize: 15, lineHeight: 22, color: '#4A5C5E', textAlign: 'center' as const },
  button: {
    backgroundColor: '#0F4C5C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
};
