import { type PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{ scroll?: boolean; testID?: string }>;

export function Screen({ children, scroll = false, testID }: ScreenProps) {
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={['top', 'bottom', 'left', 'right']}
      testID={testID}
    >
      {scroll ? (
        <ScrollView contentContainerClassName="flex-grow px-6 py-8">{children}</ScrollView>
      ) : (
        <View className="flex-1 px-6 py-8">{children}</View>
      )}
    </SafeAreaView>
  );
}
