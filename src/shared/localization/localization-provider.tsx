import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
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
  language: 'en',
  direction: 'ltr',
  t: (key, values) => translate('en', key, values),
  number: (value) => formatNumber(value, 'en'),
};
const LocalizationContext = createContext(defaultLocalization);

export function LocalizationProvider({ children }: PropsWithChildren) {
  const tag = useSyncExternalStore(
    application.settings.subscribe,
    application.settings.snapshot,
  )?.language;
  const language = resolveUiLanguage(tag);
  const direction = resolveDirection(tag);
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
      <View className="flex-1" style={{ direction }}>
        {children}
      </View>
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): Localization {
  return useContext(LocalizationContext);
}
