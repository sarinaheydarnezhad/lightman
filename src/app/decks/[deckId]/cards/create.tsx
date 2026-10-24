import { useLayoutEffect, type ReactNode } from 'react';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { HeaderBackButton } from 'expo-router/react-navigation';
import { Platform } from 'react-native';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { CardEditorScreen } from '@/features/decks/presentation/card-editor-screen';
import { useLocalization } from '@/shared/localization/localization-provider';
import { routeParam } from '@/shared/navigation/route-params';
import { icons } from '@/shared/theme/tokens';

function CreateCardHeader({ saveAction }: { saveAction: ReactNode }) {
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
              backImage={({ tintColor: color }) => (
                <BackIcon color={color} size={icons.medium} />
              )}
              onPress={() => navigation.goBack()}
            />
          ) : null,
        headerRight: () => saveAction,
      }}
    />
  );
}

export default function CreateCardRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/cards/create'>();
  return (
    <CardEditorScreen
      deckId={routeParam(deckId)}
      renderSaveAction={(saveAction) => <CreateCardHeader saveAction={saveAction} />}
    />
  );
}
