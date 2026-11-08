import { useLocalSearchParams } from 'expo-router';
import { TransactionForm, type Kind } from '@/features/transactions/TransactionForm';

const KINDS: Kind[] = ['expense', 'income', 'transfer'];

/**
 * Parâmetros opcionais: tipo (expense | income | transfer), conta (id da conta de origem),
 * cartao (id do cartão, para já abrir como compra no cartão) e pendente=1 (já abre como "a pagar").
 */
export default function NovaTransacao() {
  const { tipo, conta, cartao, pendente } = useLocalSearchParams<{
    tipo?: string;
    conta?: string;
    cartao?: string;
    pendente?: string;
  }>();
  const kind = KINDS.find((k) => k === tipo) ?? 'expense';
  return (
    <TransactionForm
      initial={{
        kind,
        accountId: conta || undefined,
        cardId: cartao || undefined,
        status: pendente === '1' ? 'pending' : undefined,
      }}
    />
  );
}
