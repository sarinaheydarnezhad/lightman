import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import { speech } from '@/core/composition/speech';
import { languageTag } from '@/core/domain/values';
import type { AvailableSpeechVoice } from '@/core/ports/speech';
import type { UserSettings } from '@/features/settings/domain/user-settings';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

const languages = [
  { label: 'English', tag: 'en' },
  { label: 'Persian', tag: 'fa' },
  { label: 'Arabic', tag: 'ar' },
] as const;

const accents = [
  { label: 'Device default', value: null },
  { label: 'US English', value: 'us' },
  { label: 'UK English', value: 'uk' },
] as const;

export function SpeechSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [voices, setVoices] = useState<readonly AvailableSpeechVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void application.getSettings().then(
      (value) => {
        if (active) {
          setSettings(value);
          if (!value) setError('Speech settings are unavailable. Try reopening this screen.');
        }
      },
      () => {
        if (active) setError('Unable to load speech settings.');
      },
    );
    // The voice list is local to this screen and fetched only when it opens.
    void speech.getAvailableVoices().then((value) => {
      if (active) setVoices(value);
    });
    return () => {
      active = false;
    };
  }, []);

  async function save(changes: Partial<UserSettings>) {
    if (!settings || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await application.updateSettings(changes);
      setSettings(updated);
      setError(null);
      void haptics.selection();
    } catch {
      setError('Unable to save speech preference. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const language = settings?.preferredSpeechLanguage
    .toLowerCase()
    .replaceAll('_', '-')
    .split('-')[0];
  const available = voices.filter(
    (voice) => voice.language.toLowerCase().replaceAll('_', '-').split('-')[0] === language,
  );

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader
          title="Pronunciation"
          description="Choose your fallback voice language. Each deck's language takes priority."
        />
        {!settings && !error ? <LoadingState label="Loading speech settings" /> : null}
        {settings ? (
          <>
            <View className="gap-sm">
              <Text variant="headingSmall" accessibilityRole="header">
                Speech language
              </Text>
              {languages.map(({ tag, label }) => (
                <Button
                  key={tag}
                  label={label}
                  variant={language === tag ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: language === tag }}
                  disabled={saving}
                  onPress={() => {
                    if (language !== tag) void save({ preferredSpeechLanguage: languageTag(tag) });
                  }}
                />
              ))}
              <Text variant="bodySmall" tone="secondary">
                Device voices for this language: {available.length}. Voice availability varies by
                device.
              </Text>
            </View>
            {language === 'en' ? (
              <View className="gap-sm">
                <Text variant="headingSmall" accessibilityRole="header">
                  English accent
                </Text>
                {accents.map(({ label, value }) => (
                  <Button
                    key={label}
                    label={label}
                    variant={settings.preferredSpeechAccent === value ? 'primary' : 'secondary'}
                    accessibilityState={{ selected: settings.preferredSpeechAccent === value }}
                    disabled={saving}
                    onPress={() => {
                      if (settings.preferredSpeechAccent !== value)
                        void save({ preferredSpeechAccent: value });
                    }}
                  />
                ))}
                <Text variant="bodySmall" tone="secondary">
                  The device may use another English accent if your preference is unavailable.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
