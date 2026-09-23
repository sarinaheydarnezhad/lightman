import { type PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { layout } from '@/shared/theme/tokens';

type ScreenProps = PropsWithChildren<{ scroll?: boolean; testID?: string; edges?: Edge[] }>;

const defaultEdges: Edge[] = ['top', 'bottom', 'left', 'right'];
const contentStyle = {
  maxWidth: layout.contentMaxWidth,
  width: '100%' as const,
  alignSelf: 'center' as const,
};

export function Screen({ children, scroll = false, testID, edges = defaultEdges }: ScreenProps) {
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={edges}
      testID={testID}
    >
      {scroll ? (
        <ScrollView contentContainerClassName="flex-grow items-center" keyboardShouldPersistTaps="handled">
          <View className="w-full flex-1 px-xl py-xl" style={contentStyle}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 px-xl py-xl" style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
}
