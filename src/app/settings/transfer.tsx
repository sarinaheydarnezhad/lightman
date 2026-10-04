import { useLocalSearchParams } from 'expo-router';
import { TransferScreen } from '@/features/transfer/presentation/transfer-screen';

export default function TransferRoute() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  return <TransferScreen initialDeckId={typeof deckId === 'string' ? deckId : undefined} />;
}
