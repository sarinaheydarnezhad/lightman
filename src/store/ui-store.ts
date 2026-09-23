import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

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
