import { Pressable, type PressableProps } from 'react-native';
import { Text } from './text';
import { interaction } from '@/shared/theme/tokens';

type TabProps = Omit<PressableProps, 'children'> & { label: string; active?: boolean };

export function Tab({
  label,
  active = false,
  disabled,
  style,
  accessibilityState,
  ...props
}: TabProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, selected: active, disabled: !!disabled }}
      disabled={disabled}
      className={`min-h-tab min-w-0 flex-1 items-center justify-center border-b-2 px-md ${active ? 'border-primary' : 'border-transparent'}`}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        {
          opacity: disabled
            ? interaction.disabledOpacity
            : state.pressed
              ? interaction.pressedOpacity
              : 1,
        },
      ]}
    >
      <Text variant="labelLarge" tone={active ? 'accent' : 'secondary'} align="center">
        {label}
      </Text>
    </Pressable>
  );
}
