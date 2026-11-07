import { useLocalSearchParams } from 'expo-router';
import { TransactionForm, type Kind } from '@/features/transactions/TransactionForm';

const KINDS: Kind[] = ['expense', 'income', 'transfer'];

/** Parâmetros opcionais: tipo (expense | income | transfer) e conta (id da conta de origem). */
export default function NovaTransacao() {
  const { tipo, conta } = useLocalSearchParams<{ tipo?: string; conta?: string }>();
  const kind = KINDS.find((k) => k === tipo) ?? 'expense';
  return <TransactionForm initial={{ kind, accountId: conta || undefined }} />;
}
