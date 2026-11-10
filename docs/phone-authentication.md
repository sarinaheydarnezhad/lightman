# Lerona authentication

Lerona supports SMS OTP exclusively for both registration and login. The Persian
RTL screen uses existing Screen, ScreenHeader, Input, Button and FeedbackModal
components. It contains a mobile input, send-code button, six-digit OTP input,
verify-and-continue button and resend countdown. There are no password, email,
Google, registration-mode or existing-account activation controls.

The form accepts Iranian local/international numbers and Persian/Arabic digits.
The client normalizes digits; the backend performs authoritative normalization
and validation. It sends `purpose=authenticate` to `/api/v1/auth/phone/otp/request`
and verifies through `/api/v1/auth/phone/otp/verify`. No tokens are stored on send.
Successful verification signs into the original verified-phone account or creates
a new account where the legacy inventory permits it. No extra registration step
exists. A replacement request preserves the previous challenge until success;
editing the phone clears the challenge and code. Duplicate taps and countdowns
are guarded; loading, expiry, throttling, provider and recovery errors are localized.

The server returns `account_recovery_required` for unresolved legacy ownership.
The app shows a support recovery message and does not try Google, passwords or
duplicate registration. The backend also blocks fresh signup while unresolved
active legacy accounts exist. See the [migration procedure](../../Backend/docs/KAVENEGAR_OTP_SETUP.md).

Existing isolated account storage, SecureStore, account binding, refresh rotation,
guest-data handling, logout and navigation remain in place. Credentials are saved
only after `/me/` confirms the user and local account binding succeeds. Failed
binding revokes the new session where possible. OTPs remain in transient state.
Legacy authentication adapters throw `410 sms_otp_only` locally without sending
passwords or Google tokens. The Google SDK bridge, dependency and build plugin
have been removed. Backend routes independently reject direct legacy requests.

Configure only the public HTTPS origin `EXPO_PUBLIC_API_URL` for native builds;
Kavenegar credentials and templates stay in `Backend/.env`. Authentication retains
the existing native-only availability policy. Release builds embed public settings
at build time and need a fresh JS bundle when the API origin changes. Updating the
APK should preserve existing local data. No native production build or deployment
has been performed in this change.
