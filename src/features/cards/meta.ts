import type { CardBrand } from '@/db/schema';
import type { InvoiceStatus } from './cycle';

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  other: 'Outra',
};

export const BRAND_ORDER: CardBrand[] = ['mastercard', 'visa', 'elo', 'amex', 'hipercard', 'other'];

export const CARD_COLORS = [
  '#6A4C93',
  '#1E2A30',
  '#0F4C5C',
  '#3D5A99',
  '#A63D40',
  '#B5651D',
  '#2E7D6B',
  '#8E3B6E',
  '#4A5560',
  '#8A7A1E',
];

export const STATUS_META: Record<
  InvoiceStatus,
  { label: string; tone: 'brand' | 'income' | 'expense' | 'muted' | 'accent' }
> = {
  future: { label: 'Futura', tone: 'muted' },
  open: { label: 'Aberta', tone: 'brand' },
  closed: { label: 'Fechada', tone: 'accent' },
  paid: { label: 'Paga', tone: 'income' },
  overdue: { label: 'Vencida', tone: 'expense' },
  empty: { label: 'Sem lançamentos', tone: 'muted' },
};
