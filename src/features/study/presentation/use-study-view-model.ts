export type StudyShellPhase = 'empty' | 'ready' | 'complete';

export const DEMO_STUDY_PHASE: StudyShellPhase = 'ready';

const presentations = {
  empty: {
    title: 'All caught up',
    description: 'No cards are due right now. You can explore your decks in the meantime.',
    action: 'Browse decks',
  },
  ready: {
    title: 'Ready when you are',
    description: 'Your next study session will appear here when study data is available.',
    action: 'Preview session',
  },
  complete: {
    title: 'Session complete',
    description: 'Your session summary will appear here after you finish studying.',
    action: 'Browse decks',
  },
} satisfies Record<StudyShellPhase, { title: string; description: string; action: string }>;

export function useStudyViewModel(phase: StudyShellPhase = DEMO_STUDY_PHASE) {
  return { phase, ...presentations[phase] };
}
