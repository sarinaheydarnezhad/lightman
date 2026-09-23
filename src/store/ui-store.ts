import { create } from 'zustand';
import type { ThemePreference } from '@/shared/theme/tokens';

export type { ThemePreference } from '@/shared/theme/tokens';

interface UiState {
  themePreference: ThemePreference;
  selectedDeckId: string | null;
  setThemePreference: (preference: ThemePreference) => void;
  selectDeck: (id: string | null) => void;
}

/** Session-only UI choices; business collections belong in repositories. */
export const useUiStore = create<UiState>((set) => ({
  themePreference: 'system',
  selectedDeckId: null,
  setThemePreference: (themePreference) => set({ themePreference }),
  selectDeck: (selectedDeckId) => set({ selectedDeckId }),
}));
