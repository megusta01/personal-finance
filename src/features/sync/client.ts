import './polyfills';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { authStorage } from './authStorage';

/**
 * Cliente do Supabase. Só existe se o .env tiver a URL e a chave do projeto
 * (veja "Sincronização com o Supabase" no README). Sem isso, o app funciona normalmente
 * só no aparelho e a tela de sincronização explica como configurar.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Aceita os nomes que o painel do Supabase sugere (eles mudaram com o tempo).
// O Expo só lê variáveis escritas por extenso assim, uma por uma.
const key =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          ...(authStorage ? { storage: authStorage } : {}),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const syncConfigured = !!supabase;

// No celular, o token só se renova com o app aberto (recomendação do Supabase).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
