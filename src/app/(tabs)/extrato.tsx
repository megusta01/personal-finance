import { Text } from '@/components/ui';
import { TransactionFeed } from '@/features/transactions/TransactionFeed';

export default function Extrato() {
  return (
    <TransactionFeed
      header={
        <Text variant="title" accessibilityRole="header">
          Extrato
        </Text>
      }
    />
  );
}
