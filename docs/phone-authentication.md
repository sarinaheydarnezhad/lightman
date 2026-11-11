# Lerona phone authentication

Returning users sign in with **mobile number and password**. Google belongs to Cent;
Lerona has no Google/email or passwordless OTP login.

New-account steps are **phone → SMS code → password and confirmation → name**.
OTP verification returns a short-lived, phone-bound signup proof, never a session.
Only final submission of that proof, a valid password and a name creates the account.

Forgot password uses **phone → recovery SMS code → new password and confirmation**.
The reset proof is separate from a signup proof and bound to the existing account.
A successful reset preserves the user ID, name, purchases and learning data, revokes
all old sessions, then signs in with the new password.

## API contract

- `POST /api/v1/auth/phone/login`: phoneNumber, password → tokens.
- `POST /api/v1/auth/phone/otp/request`: phoneNumber, purpose (`register` or `reset`).
- `POST /api/v1/auth/phone/otp/verify`: challengeId, code → registrationToken or
  resetPasswordToken, expiry; tokens are always null.
- `POST /api/v1/auth/phone/register`: phoneNumber, registrationToken, password,
  confirmPassword, username (the profile name) → tokens.
- `POST /api/v1/auth/phone/password/reset`: phoneNumber, resetToken, password,
  confirmPassword → tokens for the same account.
- Unverified `/phone/register-password` is rejected; Google/email/activation
  adapters and OTP-only login are disabled.

The existing password rules remain 8–128 characters, letters and numbers, with
common passwords rejected. Iranian local/international numbers and Persian/Arabic
digits normalize on both client and server. Changing the phone invalidates the
client challenge/proof. Send/verify requests and OTP verification never save tokens.
Passwords, OTPs and proofs stay in transient form state and are not stored.

SecureStore credentials are saved only after the existing owner lookup and local
account-binding checks. Failed binding revokes the new session where possible.
Refresh rotation, absolute session expiry, replay detection, account-scoped local
storage and logout remain in place. Cached legacy password credentials are not
discarded merely because they lack the newer phoneVerified metadata.

Server settings belong in the host environment. The native app receives only
`EXPO_PUBLIC_API_URL`; never include an SMS provider key in an Expo public variable.
A native development build can use exact `http://127.0.0.1:<port>` over USB for an
isolated local API. Release builds continue to require HTTPS.

These changes are prepared locally for the next coordinated app/backend rollout.
No backend/database deployment or real SMS delivery has been performed.
