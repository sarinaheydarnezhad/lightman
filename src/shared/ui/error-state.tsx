import { FeedbackNotice } from './feedback-notice';

/** Retryable resource errors share the same message hierarchy and action. */
export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return <FeedbackNotice title={title} message={description} onRetry={onRetry} />;
}
