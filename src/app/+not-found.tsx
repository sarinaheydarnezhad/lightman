import { Link } from 'expo-router';

import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export default function NotFound() {
  return (
    <Screen>
      <Text variant="headingLarge" className="mb-md">Page not found</Text>
      <Text tone="secondary" className="mb-xl">
        The page you requested isn’t here.
      </Text>
      <Link href="/" className="text-labelLarge text-primary">
        Return home
      </Link>
    </Screen>
  );
}
