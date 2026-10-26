import { useLayoutEffect, type ReactNode } from 'react';
import { Stack, useNavigation } from 'expo-router';
import { HeaderBackButton } from 'expo-router/react-navigation';
import { Platform } from 'react-native';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { icons } from '@/shared/theme/tokens';

export function CardEditorHeader({ saveAction }: { saveAction: ReactNode }) {
  const navigation = useNavigation();
  const { t } = useLocalization();
  const BackIcon = Platform.OS === 'ios' ? ChevronLeft : ArrowLeft;

  useLayoutEffect(
    () => () => {
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: undefined,
        headerBackVisible: undefined,
        headerBackButtonDisplayMode: undefined,
        headerTitleAlign: undefined,
      });
    },
    [navigation],
  );

  return (
    <Stack.Screen
      options={{
        headerTitleAlign: 'center',
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: false,
        headerLeft: ({ canGoBack, tintColor }) =>
          canGoBack ? (
            <HeaderBackButton
              displayMode="minimal"
              style={{ marginRight: 'auto' }}
              accessibilityLabel={t('common.cancel')}
              tintColor={tintColor}
              backImage={({ tintColor: color }) => <BackIcon color={color} size={icons.medium} />}
              onPress={() => navigation.goBack()}
            />
          ) : null,
        headerRight: () => saveAction,
      }}
    />
  );
}
