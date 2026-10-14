import { normalizePhoneNumber, validateTokens } from './phone-auth';

test.each(['+989121234567', '+۹۸۹۱۲۱۲۳۴۵۶۷', '+٩٨٩١٢١٢٣٤٥٦٧', ' +989121234567 '])(
  'phone normalization supports international and localized digits: %s',
  (phone) => {
    expect(normalizePhoneNumber(phone)).toBe('+989121234567');
  },
);

test.each(['09121234567', '+000000000', '+98abc1234567', '', '+1234567890123456'])(
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
