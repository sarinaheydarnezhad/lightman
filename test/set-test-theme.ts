import { repositories } from '@/core/composition/repositories';
import { defaultSettings } from '@/core/composition/default-settings';
import type { ThemeMode } from '@/features/settings/domain/user-settings';

export async function setTestTheme(theme: ThemeMode) {
  await repositories.settings.update({
    ...((await repositories.settings.get()) ?? defaultSettings()),
    theme,
  });
}
