/** Voice identifiers and native lifecycle objects stay inside the adapter. */
export type SpeechStatus = 'idle' | 'speaking' | 'stopping' | 'unavailable';
export type EnglishAccent = 'us' | 'uk';

export interface SpeechRequest {
  readonly language?: string;
  readonly preferredLanguage?: string;
  readonly accent?: EnglishAccent | null;
  readonly rate?: number;
  readonly pitch?: number;
  readonly volume?: number;
}

export interface AvailableSpeechVoice {
  readonly name: string;
  readonly language: string;
  readonly quality: 'enhanced' | 'default';
}

export interface SpeechService {
  /** True means native playback was requested, not that sound was audible. */
  speak(text: string, options?: SpeechRequest): Promise<boolean>;
  stop(): Promise<void>;
  isSpeaking(): boolean;
  getStatus(): SpeechStatus;
  subscribe(listener: () => void): () => void;
  getAvailableVoices(): Promise<readonly AvailableSpeechVoice[]>;
}
