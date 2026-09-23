import { Link } from 'expo-router';

import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export default function NotFound() {
  return (
    <Screen>
      <Text className="mb-3 text-3xl font-bold">Page not found</Text>
      <Text tone="secondary" className="mb-6">
        The page you requested isn’t here.
      </Text>
      <Link href="/" className="font-semibold text-accent">
        Return home
      </Link>
    </Screen>
  );
}
