import { useLocalSearchParams } from 'expo-router';
import { TransactionForm, type Kind } from '@/features/transactions/TransactionForm';

const KINDS: Kind[] = ['expense', 'income', 'transfer'];

/**
 * Parâmetros opcionais: tipo (expense | income | transfer), conta (id da conta de origem)
 * e cartao (id do cartão, para já abrir como compra no cartão).
 */
export default function NovaTransacao() {
  const { tipo, conta, cartao } = useLocalSearchParams<{
    tipo?: string;
    conta?: string;
    cartao?: string;
  }>();
  const kind = KINDS.find((k) => k === tipo) ?? 'expense';
  return (
    <TransactionForm
      initial={{ kind, accountId: conta || undefined, cardId: cartao || undefined }}
    />
  );
}
