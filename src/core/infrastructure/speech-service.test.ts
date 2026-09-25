import type { SpeechAdapter } from './expo-speech-adapter';
import { createSpeechService } from './speech-service';
import type { DeviceVoice } from './voice-selection';

const voices: DeviceVoice[] = [
  { id: 'us', name: 'US', language: 'en-US', quality: 'default', isDefault: true },
  { id: 'uk', name: 'UK', language: 'en-GB', quality: 'enhanced', isDefault: false },
  { id: 'fa', name: 'Persian', language: 'fa-IR', quality: 'default', isDefault: false },
];

function fakeAdapter(available: DeviceVoice[] = voices) {
  const adapter: SpeechAdapter = {
    maxInputLength: 3000,
    getVoices: jest.fn(async () => available),
    speak: jest.fn(),
    stop: jest.fn(async () => {}),
  };
  return adapter;
}

test('uses exact front text, deck language, accent, and caches normalized voices lazily', async () => {
  const adapter = fakeAdapter();
  const speech = createSpeechService(adapter);
  expect(adapter.getVoices).not.toHaveBeenCalled();
  expect(await speech.speak(' ubiquitous ', { language: 'en', accent: 'uk' })).toBe(true);
  expect(adapter.speak).toHaveBeenCalledWith(
    'ubiquitous',
    expect.objectContaining({ language: 'en-GB', voiceId: 'uk', rate: 0.95 }),
  );
  expect(speech.getStatus()).toBe('speaking');
  expect(await speech.getAvailableVoices()).toEqual([
    { name: 'US', language: 'en-US', quality: 'default' },
    { name: 'UK', language: 'en-GB', quality: 'enhanced' },
    { name: 'Persian', language: 'fa-IR', quality: 'default' },
  ]);
  expect(adapter.getVoices).toHaveBeenCalledTimes(1);
});

test('repeating speak stops the old utterance before starting the new one; stale callbacks are ignored', async () => {
  const adapter = fakeAdapter();
  const speech = createSpeechService(adapter);
  await speech.speak('first', { language: 'en' });
  const oldCallbacks = jest.mocked(adapter.speak).mock.calls[0]![1];
  await speech.speak('second', { language: 'fa' });
  expect(adapter.stop).toHaveBeenCalledTimes(1);
  expect(jest.mocked(adapter.speak).mock.calls[1]![1]).toEqual(
    expect.objectContaining({ language: 'fa-IR', voiceId: 'fa' }),
  );
  oldCallbacks.onDone();
  expect(speech.isSpeaking()).toBe(true);
  jest.mocked(adapter.speak).mock.calls[1]![1].onDone();
  expect(speech.getStatus()).toBe('idle');
  await speech.stop();
  expect(adapter.stop).toHaveBeenCalledTimes(1);
});

test('only the latest rapid request speaks after pending voice discovery', async () => {
  let deliver: (voices: readonly DeviceVoice[]) => void = () => {};
  const adapter = fakeAdapter();
  jest.mocked(adapter.getVoices).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  );
  const speech = createSpeechService(adapter);
  const first = speech.speak('one', { language: 'en' });
  for (
    let attempt = 0;
    attempt < 5 && !jest.mocked(adapter.getVoices).mock.calls.length;
    attempt++
  ) {
    await Promise.resolve();
  }
  expect(adapter.getVoices).toHaveBeenCalledTimes(1);
  const second = speech.speak('two', { language: 'en' });
  deliver(voices);
  expect(await first).toBe(false);
  expect(await second).toBe(true);
  expect(adapter.speak).toHaveBeenCalledTimes(1);
  expect(adapter.speak).toHaveBeenCalledWith('two', expect.any(Object));
  await speech.stop();
  expect(speech.isSpeaking()).toBe(false);
});

test('stop cancels a request while voice discovery is pending', async () => {
  let deliver: (voices: readonly DeviceVoice[]) => void = () => {};
  const adapter = fakeAdapter();
  jest.mocked(adapter.getVoices).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  );
  const speech = createSpeechService(adapter);
  const request = speech.speak('one', { language: 'en' });
  for (
    let attempt = 0;
    attempt < 5 && !jest.mocked(adapter.getVoices).mock.calls.length;
    attempt++
  ) {
    await Promise.resolve();
  }
  expect(adapter.getVoices).toHaveBeenCalledTimes(1);
  const stopping = speech.stop();
  deliver(voices);
  expect(await request).toBe(false);
  await stopping;
  expect(adapter.speak).not.toHaveBeenCalled();
});

test('missing voices and oversized text report unavailable without native playback', async () => {
  const adapter = fakeAdapter([]);
  const speech = createSpeechService(adapter);
  expect(await speech.speak('hello', { language: 'en' })).toBe(false);
  expect(speech.getStatus()).toBe('unavailable');
  expect(await speech.speak('x'.repeat(3001), { language: 'en' })).toBe(false);
  expect(adapter.speak).not.toHaveBeenCalled();
  expect(adapter.getVoices).toHaveBeenCalledTimes(1);
  await speech.stop();
  expect(adapter.stop).not.toHaveBeenCalled();
});

test('discovery failures are nonfatal and can be retried without an audio cache', async () => {
  const adapter = fakeAdapter();
  jest.mocked(adapter.getVoices).mockRejectedValueOnce(new Error('engine unavailable'));
  const report = jest.fn();
  const speech = createSpeechService(adapter, report);
  expect(await speech.speak('term', { language: 'en' })).toBe(false);
  expect(report).toHaveBeenCalledTimes(1);
  expect(await speech.speak('term', { language: 'en', rate: 4, pitch: -1, volume: 2 })).toBe(true);
  expect(adapter.speak).toHaveBeenCalledWith(
    'term',
    expect.objectContaining({ rate: 2, pitch: 0.5, volume: 1 }),
  );
  expect(adapter.getVoices).toHaveBeenCalledTimes(2);
});

test('native speak and stop failures are contained, and a failed stop never permits overlap', async () => {
  const adapter = fakeAdapter();
  const report = jest.fn();
  const speech = createSpeechService(adapter, report);
  jest.mocked(adapter.speak).mockImplementationOnce(() => {
    throw new Error('native failure');
  });
  expect(await speech.speak('one', { language: 'en' })).toBe(false);
  expect(report).toHaveBeenCalledTimes(1);
  expect(await speech.speak('two', { language: 'en' })).toBe(true);
  jest.mocked(adapter.stop).mockRejectedValueOnce(new Error('stop failed'));
  expect(await speech.speak('three', { language: 'en' })).toBe(false);
  expect(adapter.speak).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledTimes(1);
  expect(await speech.speak('four', { language: 'en' })).toBe(true);
});
