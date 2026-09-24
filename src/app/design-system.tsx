import { useState } from 'react';
import { View } from 'react-native';
import { Settings2 } from 'lucide-react-native';

import { useUiStore } from '@/store/ui-store';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';
import {
  palette,
  type SemanticColor,
  type ThemePreference,
  type TypographyVariant,
} from '@/shared/theme/tokens';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Chip } from '@/shared/ui/chip';
import { Divider } from '@/shared/ui/divider';
import { EmptyState } from '@/shared/ui/empty-state';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { Tab } from '@/shared/ui/tab';
import { Text } from '@/shared/ui/text';

const preferences: ThemePreference[] = ['system', 'light', 'dark', 'oled'];
const variants: TypographyVariant[] = [
  'display',
  'headingLarge',
  'headingMedium',
  'headingSmall',
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'labelLarge',
  'labelMedium',
  'caption',
];
const colorNames = Object.keys(palette.light) as SemanticColor[];

export default function DesignSystemDemo() {
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);
  const mode = useThemeMode();
  const colors = useThemeColors();
  const [selectedTab, setSelectedTab] = useState<'meaning' | 'examples'>('meaning');
  const [selectedChip, setSelectedChip] = useState(false);
  const [pressedCard, setPressedCard] = useState(false);
  const [sample, setSample] = useState('');

  return (
    <Screen scroll edges={stackScreenEdges} testID="design-system-demo">
      <View className="gap-2xl">
        <View className="gap-sm">
          <Text variant="headingLarge">Design system</Text>
          <Text tone="secondary">Explore the foundation in {mode} appearance.</Text>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Appearance</Text>
          <View className="flex-row flex-wrap gap-sm">
            {preferences.map((option) => (
              <Chip
                key={option}
                label={option === 'oled' ? 'OLED' : option}
                selected={preference === option}
                onPress={() => setPreference(option)}
              />
            ))}
          </View>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Typography</Text>
          {variants.map((variant) => (
            <Text key={variant} variant={variant}>
              {variant}
            </Text>
          ))}
          <Text tone="secondary">Secondary text stays quiet and readable.</Text>
          <Text tone="tertiary" variant="caption">
            Tertiary caption for supporting details.
          </Text>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Semantic colors</Text>
          <View className="flex-row flex-wrap gap-sm">
            {colorNames.map((name) => (
              <View key={name} className="w-listItem items-center gap-xs">
                <View
                  className="h-iconButton w-iconButton rounded-sm border border-border"
                  style={{ backgroundColor: colors[name] }}
                />
                <Text variant="caption" align="center">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Actions</Text>
          <Button label="Primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Tertiary" variant="tertiary" />
          <Button label="Destructive" variant="destructive" />
          <Button label="Loading" loading />
          <Button label="Disabled" disabled />
          <IconButton icon={Settings2} label="Open settings example" />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Inputs</Text>
          <Input
            label="Example"
            placeholder="Enter text"
            helperText="Helpful supporting text"
            value={sample}
            onChangeText={setSample}
          />
          <Input label="With error" error="Please check this entry" />
          <Input label="Disabled field" disabled placeholder="Unavailable" />
          <Input label="Notes" multiline placeholder="Write a few lines" />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Surfaces</Text>
          <Card>
            <Text>Default surface</Text>
          </Card>
          <Card variant="elevated">
            <Text>Elevated surface</Text>
          </Card>
          <Card variant="outlined">
            <Text>Outlined surface</Text>
          </Card>
          <Card
            variant="interactive"
            accessibilityLabel="Interactive surface example"
            onPress={() => setPressedCard(!pressedCard)}
          >
            <Text>{pressedCard ? 'Pressed surface' : 'Interactive surface'}</Text>
          </Card>
          <Divider />
          <View className="flex-row flex-wrap gap-sm">
            <Badge label="Neutral" />
            <Badge label="Primary" variant="primary" />
            <Badge label="Success" variant="success" />
            <Badge label="Error" variant="error" />
            <Badge label="Warning" variant="warning" />
          </View>
          <Chip
            label="Select example"
            selected={selectedChip}
            onPress={() => setSelectedChip(!selectedChip)}
          />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">Tabs and states</Text>
          <View className="flex-row" accessibilityRole="tablist">
            <Tab
              label="Meaning"
              active={selectedTab === 'meaning'}
              onPress={() => setSelectedTab('meaning')}
            />
            <Tab
              label="Examples"
              active={selectedTab === 'examples'}
              onPress={() => setSelectedTab('examples')}
            />
            <Tab label="Disabled" disabled />
          </View>
          <LoadingState label="Loading preview" />
          <EmptyState title="Nothing here yet" description="A quiet place for future content." />
        </View>
      </View>
    </Screen>
  );
}
