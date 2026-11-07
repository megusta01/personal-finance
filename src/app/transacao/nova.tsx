import { useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '@/features/transactions/TransactionForm';

export default function NovaTransacao() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  return <TransactionForm initial={{ kind: tipo === 'income' ? 'income' : 'expense' }} />;
}
