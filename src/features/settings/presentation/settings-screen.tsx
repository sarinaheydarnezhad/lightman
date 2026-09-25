import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import { useUiStore } from '@/store/ui-store';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
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
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean | null>(null);
  const [savingHaptics, setSavingHaptics] = useState(false);
  const savingHapticsRef = useRef(false);
  const [hapticsError, setHapticsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void application.getSettings().then(
      (settings) => {
        if (active) setHapticsEnabled(settings?.hapticsEnabled ?? true);
      },
      () => {
        if (active) setHapticsError('Unable to load haptics preference.');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const toggleHaptics = async () => {
    if (hapticsEnabled === null || savingHapticsRef.current) return;
    savingHapticsRef.current = true;
    setSavingHaptics(true);
    try {
      const settings = await application.updateSettings({ hapticsEnabled: !hapticsEnabled });
      setHapticsEnabled(settings.hapticsEnabled);
      setHapticsError(null);
      if (settings.hapticsEnabled) void haptics.selection();
    } catch {
      setHapticsError('Unable to save haptics preference. Please try again.');
    } finally {
      savingHapticsRef.current = false;
      setSavingHaptics(false);
    }
  };

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
          <Card className="gap-sm">
            <Text variant="labelLarge">Haptic feedback</Text>
            <Text variant="bodySmall" tone="secondary">
              {hapticsEnabled === null
                ? 'Loading preference…'
                : hapticsEnabled
                  ? 'On. Subtle feedback for study actions.'
                  : 'Off. Study actions still work as usual.'}
            </Text>
            <Button
              label={hapticsEnabled ? 'Turn haptics off' : 'Turn haptics on'}
              variant="secondary"
              disabled={hapticsEnabled === null}
              loading={savingHaptics}
              onPress={() => void toggleHaptics()}
            />
            {hapticsError ? (
              <Text tone="error" accessibilityLiveRegion="polite">
                {hapticsError}
              </Text>
            ) : null}
          </Card>
          <SettingsRow label="Daily reminder" detail="Available in a future update" />
          <SettingsRow label="Study preferences" detail="Available in a future update" />
        </SettingsSection>

        <SettingsSection title="Audio">
          <SettingsRow
            label="Pronunciation"
            detail="Speech language and English accent"
            onPress={() => router.push('/settings/speech')}
          />
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
