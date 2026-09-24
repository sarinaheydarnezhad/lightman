import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { View } from 'react-native';
import type { ReactNode } from 'react';

import { useUiStore } from '@/store/ui-store';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { appearanceChoices } from './appearance-options';

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress?: () => void;
}) {
  return (
    <Card
      variant={onPress ? 'interactive' : 'default'}
      accessibilityLabel={onPress ? `${label}, ${detail}` : undefined}
      onPress={onPress}
      className="gap-xs"
    >
      <Text variant="labelLarge">{label}</Text>
      <Text variant="bodySmall" tone="secondary">
        {detail}
      </Text>
    </Card>
  );
}

export function SettingsScreen() {
  const preference = useUiStore((state) => state.themePreference);
  const appearanceLabel = appearanceChoices.find((choice) => choice.value === preference)?.label;

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader
          title="Settings"
          description="Make the app comfortable for your study routine."
        />

        <SettingsSection title="Appearance">
          <SettingsRow
            label="Theme"
            detail={`Current: ${appearanceLabel ?? 'Follow system'}`}
            onPress={() => router.push('/settings/appearance')}
          />
        </SettingsSection>

        <SettingsSection title="Study">
          <SettingsRow label="Daily reminder" detail="Available in a future update" />
          <SettingsRow label="Study preferences" detail="Available in a future update" />
        </SettingsSection>

        <SettingsSection title="Audio">
          <SettingsRow label="Pronunciation" detail="Available in a future update" />
          <SettingsRow label="Voice and accent" detail="Available in a future update" />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow label="Version" detail={Constants.expoConfig?.version ?? 'Unknown'} />
          <SettingsRow label="Privacy" detail="Information available in a future update" />
          <SettingsRow label="Terms" detail="Information available in a future update" />
        </SettingsSection>

        {__DEV__ ? (
          <Link
            href="/design-system"
            className="text-labelLarge text-primary"
            accessibilityRole="link"
          >
            View design system
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}
