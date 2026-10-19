import { normalizeLocalPhoneNumber, normalizePhoneNumber, validateTokens } from './phone-auth';

test.each(['09121234567', '۰۹۱۲۱۲۳۴۵۶۷', '٠٩١٢١٢٣٤٥٦٧', ' 09121234567 '])(
  'local phone entry accepts exactly 11 digits starting with zero: %s',
  (phone) => {
    expect(normalizeLocalPhoneNumber(phone)).toBe('09121234567');
    expect(normalizePhoneNumber(phone)).toBe('+989121234567');
  },
);

test.each([
  '',
  '0912123456',
  '091212345678',
  '19121234567',
  '+989121234567',
  '0912abc4567',
  '0912 1234567',
  '0912-1234567',
])('invalid local phone entry %s is rejected', (phone) => {
  expect(() => normalizeLocalPhoneNumber(phone)).toThrow('invalid_phone');
});

test.each(['+989121234567', '+۹۸۹۱۲۱۲۳۴۵۶۷', '+٩٨٩١٢١٢٣٤٥٦٧', ' +989121234567 '])(
  'phone normalization supports international and localized digits: %s',
  (phone) => {
    expect(normalizePhoneNumber(phone)).toBe('+989121234567');
  },
);

test.each(['0912123456', '091212345678', '+000000000', '+98abc1234567', '', '+1234567890123456'])(
  'invalid phone %s is rejected',
  (phone) => {
    expect(() => normalizePhoneNumber(phone)).toThrow('invalid_phone');
  },
);

test.each([null, {}, { accessToken: 'a', refreshToken: 'b', accessExpiresAtUtc: 'invalid' }])(
  'malformed authentication responses cannot become credentials',
  (value) => {
    expect(() => validateTokens(value)).toThrow('Invalid authentication response');
  },
);
