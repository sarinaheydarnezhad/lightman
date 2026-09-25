import type { HapticEvent, HapticFeedbackService } from '@/core/ports/haptic-feedback';

/** A semantic, platform-free test double for presentation interactions. */
export function createFakeHaptics(): {
  service: HapticFeedbackService;
  events: HapticEvent[];
} {
  const events: HapticEvent[] = [];
  const record = (event: HapticEvent) =>
    jest.fn(async () => {
      events.push(event);
    });
  return {
    events,
    service: {
      selection: record('selection'),
      cardReveal: record('cardReveal'),
      answerSuccess: record('answerSuccess'),
      answerFailure: record('answerFailure'),
      swipeCommit: record('swipeCommit'),
      actionConfirmed: record('actionConfirmed'),
      actionRejected: record('actionRejected'),
    },
  };
}
