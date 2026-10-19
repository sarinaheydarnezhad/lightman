import { type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { layout } from '@/shared/theme/tokens';
import { ScreenBackdrop } from '@/shared/theme/screen-backdrop';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  keyboardAware?: boolean;
  testID?: string;
  edges?: Edge[];
  header?: ReactNode;
}>;

const defaultEdges: Edge[] = ['top', 'bottom', 'left', 'right'];
const contentStyle = {
  maxWidth: layout.contentMaxWidth,
  width: '100%' as const,
  alignSelf: 'center' as const,
};

export function Screen({
  children,
  scroll = false,
  keyboardAware = false,
  testID,
  edges = defaultEdges,
  header,
}: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges} testID={testID}>
      <ScreenBackdrop />
      {header ? (
        <View className="w-full px-xl pt-xl" style={contentStyle}>
          {header}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerClassName="flex-grow items-center"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={keyboardAware}
        >
          <View className="w-full flex-1 px-xl py-xl" style={contentStyle}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 px-xl py-xl" style={contentStyle}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
