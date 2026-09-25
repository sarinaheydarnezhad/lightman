import type { HapticEvent, HapticFeedbackService } from '@/core/ports/haptic-feedback';

/** All events check the repository preference here, not in individual components. */
export function createHapticFeedbackService(
  isEnabled: () => Promise<boolean>,
  perform: (event: HapticEvent) => Promise<void>,
  reportUnavailable: () => void = () => {},
): HapticFeedbackService {
  let reported = false;
  async function emit(event: HapticEvent): Promise<void> {
    try {
      if (await isEnabled()) await perform(event);
    } catch {
      // Haptics are optional; warn at most once per service lifetime.
      if (!reported) {
        reported = true;
        try {
          reportUnavailable();
        } catch {
          // Even diagnostics must not turn optional feedback into an app error.
        }
      }
    }
  }
  return {
    selection: () => emit('selection'),
    cardReveal: () => emit('cardReveal'),
    answerSuccess: () => emit('answerSuccess'),
    answerFailure: () => emit('answerFailure'),
    swipeCommit: () => emit('swipeCommit'),
    actionConfirmed: () => emit('actionConfirmed'),
    actionRejected: () => emit('actionRejected'),
  };
}
