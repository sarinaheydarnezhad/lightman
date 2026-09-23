export interface StudySettings {
  readonly dailyGoal: number;
}

export interface SettingsRepository {
  get(): Promise<StudySettings | null>;
  save(settings: StudySettings): Promise<void>;
}
