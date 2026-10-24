export type OtpPurpose = 'register' | 'login';

export interface OtpChallenge {
  readonly challengeId: string;
  readonly expiresAtUtc: string;
  readonly resendAtUtc: string;
}

export interface AuthTokens {
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

const commonPasswords = new Set([
  'password1',
  'password12',
  'password123',
  'password1234',
  'password12345',
  'password123456',
  'qwerty123',
  'qwerty12345',
  'qwerty123456',
  'abc12345',
  'abcd1234',
  '1234abcd',
  'letmein123',
  'welcome1',
  'welcome123',
  'admin123',
  'admin1234',
  'iloveyou1',
  'passw0rd',
]);

export function isValidRegistrationPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /\p{L}/u.test(password) &&
    /\p{Nd}/u.test(password) &&
    !commonPasswords.has(password.replace(/[^\p{L}\p{Nd}]/gu, '').toLowerCase())
  );
}

function normalizePhoneDigits(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
    );
}

export function normalizeLocalPhoneNumber(value: string): string {
  const normalized = normalizePhoneDigits(value);
  if (!/^0[0-9]{10}$/.test(normalized)) throw new Error('invalid_phone');
  return normalized;
}

export function normalizePhoneNumber(value: string): string {
  const normalized = normalizePhoneDigits(value);
  if (/^0[0-9]{10}$/.test(normalized)) return `+98${normalized.slice(1)}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) throw new Error('invalid_phone');
  return normalized;
}

export function validateTokens(value: unknown): AuthTokens {
  const tokens = value as Partial<AuthTokens> | null;
  if (
    !tokens ||
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
