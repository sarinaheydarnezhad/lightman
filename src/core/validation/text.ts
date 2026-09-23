import { AppError } from '@/core/errors/app-error';

export function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new AppError('validation', `${field} must contain 1–${maxLength} characters.`);
  }
  return normalized;
}
