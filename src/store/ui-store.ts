import { create } from 'zustand';
interface UiState {
  selectedDeckId: string | null;
  selectDeck: (id: string | null) => void;
}

/** Session-only UI choices; business collections belong in repositories. */
export const useUiStore = create<UiState>((set) => ({
  selectedDeckId: null,
  selectDeck: (selectedDeckId) => set({ selectedDeckId }),
}));
