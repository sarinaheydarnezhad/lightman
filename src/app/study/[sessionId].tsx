import { useLocalSearchParams } from 'expo-router';
import { StudySessionScreen } from '@/features/study/presentation/study-session-screen';

export default function StudySessionRoute() {
  const { sessionId } = useLocalSearchParams<'/study/[sessionId]'>();

  return <StudySessionScreen sessionId={typeof sessionId === 'string' ? sessionId : ''} />;
}
