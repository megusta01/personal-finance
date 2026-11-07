import type Ionicons from '@expo/vector-icons/Ionicons';
import type { AccountType } from '@/db/schema';

type IconName = keyof typeof Ionicons.glyphMap;

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; icon: IconName; hint: string }
> = {
  checking: {
    label: 'Conta corrente',
    icon: 'business-outline',
    hint: 'Conta do banco para o dia a dia',
  },
  savings: {
    label: 'Poupança',
    icon: 'shield-checkmark-outline',
    hint: 'Dinheiro guardado com rendimento',
  },
  wallet: { label: 'Carteira', icon: 'wallet-outline', hint: 'Dinheiro em espécie' },
  investment: {
    label: 'Investimentos',
    icon: 'trending-up-outline',
    hint: 'Corretora, CDB, Tesouro…',
  },
  other: { label: 'Outra', icon: 'ellipse-outline', hint: 'Vale-refeição, conta digital, etc.' },
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'checking',
  'savings',
  'wallet',
  'investment',
  'other',
];

/** Cores para identificar contas. Escolhidas para ter contraste com texto claro. */
export const ACCOUNT_COLORS = [
  '#0F4C5C',
  '#1F6F8B',
  '#3D5A99',
  '#6A4C93',
  '#8E3B6E',
  '#A63D40',
  '#B5651D',
  '#8A7A1E',
  '#3E7C3E',
  '#2E7D6B',
  '#4A5560',
  '#1E2A30',
];

/** Sugestões para o campo "Banco ou instituição" (pode digitar qualquer outro). */
export const INSTITUTIONS = [
  'Nubank',
  'Itaú',
  'Bradesco',
  'Banco do Brasil',
  'Caixa',
  'Santander',
  'Inter',
  'C6 Bank',
  'BTG Pactual',
  'XP',
  'Mercado Pago',
  'PicPay',
  'Sicoob',
  'Sicredi',
];
