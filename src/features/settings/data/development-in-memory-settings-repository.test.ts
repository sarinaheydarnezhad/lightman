import { makeSettings } from '@/../test/fixtures';
import { InMemorySettingsRepository } from './development-in-memory-settings-repository';

test('settings repository validates updates and isolates callers', async () => {
  const settings = new InMemorySettingsRepository();
  expect(await settings.get()).toBeNull();
  await settings.update(makeSettings());
  const original = await settings.get();
  await settings.update(makeSettings({ theme: 'oled' }));
  expect(original?.theme).toBe('system');
  expect((await settings.get())?.theme).toBe('oled');
  await expect(
    settings.update(makeSettings({ dailyReminderTime: '99:99' as never })),
  ).rejects.toMatchObject({ code: 'validation' });
  expect((await settings.get())?.theme).toBe('oled');
});
