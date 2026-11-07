import type { AccountType, CategoryKind } from './schema';

/**
 * Dados iniciais com IDs fixos. Como o ID é o mesmo em todo aparelho,
 * quando o sync com o Supabase entrar, a "Carteira" e as categorias padrão
 * de dois celulares se juntam em vez de aparecer duplicadas.
 */

export const DEFAULT_ACCOUNT = {
  id: 'acc-default-wallet',
  name: 'Carteira',
  type: 'wallet' as AccountType,
  color: '#0F4C5C',
  icon: 'wallet-outline',
};

type SeedCategory = { id: string; name: string; kind: CategoryKind; icon: string; color: string };

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Despesas
  {
    id: 'cat-exp-food',
    name: 'Alimentação',
    kind: 'expense',
    icon: 'restaurant-outline',
    color: '#E07A3F',
  },
  {
    id: 'cat-exp-groceries',
    name: 'Mercado',
    kind: 'expense',
    icon: 'cart-outline',
    color: '#C9852B',
  },
  {
    id: 'cat-exp-transport',
    name: 'Transporte',
    kind: 'expense',
    icon: 'car-outline',
    color: '#3D7EA6',
  },
  { id: 'cat-exp-home', name: 'Moradia', kind: 'expense', icon: 'home-outline', color: '#7A5C99' },
  {
    id: 'cat-exp-utilities',
    name: 'Contas da casa',
    kind: 'expense',
    icon: 'flash-outline',
    color: '#B8962E',
  },
  {
    id: 'cat-exp-health',
    name: 'Saúde',
    kind: 'expense',
    icon: 'medkit-outline',
    color: '#C44B5E',
  },
  {
    id: 'cat-exp-education',
    name: 'Educação',
    kind: 'expense',
    icon: 'school-outline',
    color: '#4C6FBF',
  },
  {
    id: 'cat-exp-leisure',
    name: 'Lazer',
    kind: 'expense',
    icon: 'game-controller-outline',
    color: '#2E9C8F',
  },
  {
    id: 'cat-exp-shopping',
    name: 'Compras',
    kind: 'expense',
    icon: 'bag-handle-outline',
    color: '#B5578F',
  },
  {
    id: 'cat-exp-subscriptions',
    name: 'Assinaturas',
    kind: 'expense',
    icon: 'repeat-outline',
    color: '#5E6AD2',
  },
  {
    id: 'cat-exp-travel',
    name: 'Viagem',
    kind: 'expense',
    icon: 'airplane-outline',
    color: '#2F8FC4',
  },
  { id: 'cat-exp-pets', name: 'Pets', kind: 'expense', icon: 'paw-outline', color: '#9A6B3F' },
  {
    id: 'cat-exp-taxes',
    name: 'Impostos e taxas',
    kind: 'expense',
    icon: 'receipt-outline',
    color: '#6F7B80',
  },
  {
    id: 'cat-exp-other',
    name: 'Outros',
    kind: 'expense',
    icon: 'ellipsis-horizontal',
    color: '#7D8A8E',
  },
  // Receitas
  {
    id: 'cat-inc-salary',
    name: 'Salário',
    kind: 'income',
    icon: 'briefcase-outline',
    color: '#1F9D6B',
  },
  {
    id: 'cat-inc-freelance',
    name: 'Freelance',
    kind: 'income',
    icon: 'laptop-outline',
    color: '#2A8C9E',
  },
  {
    id: 'cat-inc-investments',
    name: 'Rendimentos',
    kind: 'income',
    icon: 'trending-up-outline',
    color: '#3E8E41',
  },
  {
    id: 'cat-inc-refund',
    name: 'Reembolso',
    kind: 'income',
    icon: 'return-down-back-outline',
    color: '#5B8C5A',
  },
  { id: 'cat-inc-gift', name: 'Presente', kind: 'income', icon: 'gift-outline', color: '#C2577A' },
  {
    id: 'cat-inc-other',
    name: 'Outros',
    kind: 'income',
    icon: 'ellipsis-horizontal',
    color: '#7D8A8E',
  },
];

export const FALLBACK_CATEGORY: Record<CategoryKind, string> = {
  expense: 'cat-exp-other',
  income: 'cat-inc-other',
};
