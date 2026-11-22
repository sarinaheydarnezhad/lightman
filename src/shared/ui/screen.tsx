import { type PropsWithChildren, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { layout } from '@/shared/theme/tokens';
import { ScreenBackdrop } from '@/shared/theme/screen-backdrop';
import { useThemeVariables } from '@/shared/theme/theme-provider';

type ScreenProps = PropsWithChildren<{
  /** Set false when the screen has its own scrolling container, such as a FlatList. */
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
  scroll = true,
  keyboardAware = true,
  testID,
  edges = defaultEdges,
  header,
}: ScreenProps) {
  const themeVariables = useThemeVariables();
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={themeVariables}
      edges={edges}
      testID={testID}
    >
      <ScreenBackdrop />
      {header ? (
        <View className="w-full px-lg pt-xl sm:px-xl" style={contentStyle}>
          {header}
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={keyboardAware && (Platform.OS === 'android' || (Platform.OS === 'ios' && !scroll))}
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      >
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerClassName="flex-grow items-center"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === 'ios'}
          >
            <View className="w-full flex-grow px-lg py-xl sm:px-xl" style={contentStyle}>
              {children}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 px-lg py-xl sm:px-xl" style={contentStyle}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
