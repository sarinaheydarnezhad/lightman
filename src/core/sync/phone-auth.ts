export type OtpPurpose = 'authenticate';

export interface OtpChallenge {
  readonly challengeId: string;
  readonly expiresAtUtc: string;
  readonly resendAtUtc: string;
  readonly codeLength?: number;
}

export interface AuthTokens {
  readonly phoneVerified: true;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAtUtc: string;
  readonly sessionId?: string;
  readonly sessionExpiresAtUtc?: string;
}

export interface OtpVerification {
  readonly registrationToken: string | null;
  readonly expiresAtUtc: string | null;
  readonly tokens: AuthTokens | null;
}

export interface PhoneRegistration {
  readonly phoneNumber: string;
  readonly registrationToken: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly username: string;
}

export interface PhonePasswordRegistration {
  readonly phoneNumber: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface PhoneActivation {
  readonly phoneNumber: string;
  readonly password?: string;
  readonly email?: string;
  readonly idToken?: string;
}

function normalizePhoneDigits(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
    );
}

export function normalizeLocalPhoneNumber(value: string): string {
  let normalized = normalizePhoneDigits(value);
  if (/^\+989[0-9]{9}$/.test(normalized)) normalized = `0${normalized.slice(3)}`;
  if (!/^09[0-9]{9}$/.test(normalized)) throw new Error('invalid_phone');
  return normalized;
}

export function normalizePhoneNumber(value: string): string {
  const normalized = normalizePhoneDigits(value);
  if (/^09[0-9]{9}$/.test(normalized)) return `+98${normalized.slice(1)}`;
  if (!/^\+989[0-9]{9}$/.test(normalized)) throw new Error('invalid_phone');
  return normalized;
}

export function validateTokens(value: unknown): AuthTokens {
  const tokens = value as Partial<AuthTokens> | null;
  if (
    !tokens ||
    tokens.phoneVerified !== true ||
    typeof tokens.accessToken !== 'string' ||
    !tokens.accessToken ||
    typeof tokens.refreshToken !== 'string' ||
    !tokens.refreshToken ||
    typeof tokens.accessExpiresAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(tokens.accessExpiresAtUtc)) ||
    (tokens.sessionExpiresAtUtc !== undefined &&
      (typeof tokens.sessionExpiresAtUtc !== 'string' ||
        !Number.isFinite(Date.parse(tokens.sessionExpiresAtUtc)))) ||
    (tokens.sessionId !== undefined &&
      (typeof tokens.sessionId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokens.sessionId)))
  )
    throw new Error('Invalid authentication response.');
  return tokens as AuthTokens;
}
