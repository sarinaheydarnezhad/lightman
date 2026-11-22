import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { DEFAULT_UI_LANGUAGE } from '@/core/composition/default-settings';
import {
  formatNumber,
  resolveDirection,
  resolveUiLanguage,
  translate,
  type UiDirection,
  type UiLanguage,
} from './localization';
import type { MessageKey } from './messages';

type Localization = {
  language: UiLanguage;
  direction: UiDirection;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  number: (value: number) => string;
};

const defaultLocalization: Localization = {
  language: DEFAULT_UI_LANGUAGE,
  direction: resolveDirection(DEFAULT_UI_LANGUAGE),
  t: (key, values) => translate(DEFAULT_UI_LANGUAGE, key, values),
  number: (value) => formatNumber(value, DEFAULT_UI_LANGUAGE),
};
const LocalizationContext = createContext(defaultLocalization);

export function LocalizationProvider({
  children,
  language: languageOverride,
}: PropsWithChildren<{ language?: UiLanguage }>) {
  const tag = useSyncExternalStore(
    application.settings.subscribe,
    application.settings.snapshot,
  )?.language;
  const [savedLanguage, setSavedLanguage] = useState(() =>
    resolveUiLanguage(tag ?? DEFAULT_UI_LANGUAGE),
  );
  const currentLanguage = tag ? resolveUiLanguage(tag) : savedLanguage;
  if (currentLanguage !== savedLanguage) setSavedLanguage(currentLanguage);
  const language = languageOverride ?? currentLanguage;
  const direction = resolveDirection(language);
  const value = useMemo<Localization>(
    () => ({
      language,
      direction,
      t: (key, values) => translate(language, key, values),
      number: (value) => formatNumber(value, language),
    }),
    [language, direction],
  );
  return (
    <LocalizationContext.Provider value={value}>
      <View className="flex-1" style={{ direction: 'ltr' }}>
        {children}
      </View>
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): Localization {
  return useContext(LocalizationContext);
}
