# Phone authentication

See [the verification record](auth-verification.md) for executed commands, actual results and deployment checks that remain unverified.

Phone authentication extends the existing cloud client and sync engine; there is no second token store or authentication provider. Configure `EXPO_PUBLIC_API_URL` to the backend HTTPS origin (without `/api/v1`) in your native build. Expo SecureStore is already installed/configured. Authentication intentionally remains unavailable on web rather than storing credentials in localStorage. Do not put signing keys or SMS provider secrets in Expo public environment variables.

The backend needs its .NET 10 runtime/SDK, SQL Server connection, stable `Auth__SigningKey`, and the existing `AddPhoneAuthentication` migration. Deploy the backend's new `/auth/phone/register-password` endpoint before rebuilding/installing the app. This change adds no database migration. Current phone/password registration and login do not require SMS configuration or contact an SMS provider.

The legacy OTP endpoints remain available for older clients. Their default SMS provider is SMS.ir; configure backend-only `Sms__ApiKey` and `Sms__TemplateId` for an approved template with a `Code` parameter. The original gateway remains available with `Sms__Provider=Webhook`, `Sms__Endpoint`, and `Sms__ApiKey`. Missing SMS configuration still returns 503 for OTP requests; no fake success or fixed OTP is introduced. Keep all provider secrets out of Expo/public configuration.

## Contracts

Google, email and OTP controls are temporarily hidden. Their existing client adapters and backend APIs remain available for compatibility and possible re-enablement; [Google configuration](google-authentication.md) is preserved.

Registration takes only a mobile number, password and matching confirmation. Both app and backend require 8–128 characters containing letters and numbers, and reject a small list of common passwords (ignoring case and punctuation). Persian letters/digits are supported. This is not a comprehensive breached-password check. Login takes the mobile number and one password; registration strength checks do not lock out existing accounts with older passwords. No username is required; new accounts default to the display name `Learner`.

**Phone ownership is not verified in this temporary flow.** Anyone can register an unused number they enter. Do not treat that number as proof of ownership or use it alone for account recovery or account linking. Duplicate numbers, including archived accounts, cannot be re-registered or have their passwords overwritten. Users with email-only or Google-only accounts cannot access those accounts through this temporary phone-only UI; no accounts are automatically merged or migrated.

### API address changes in installed Android release builds

`EXPO_PUBLIC_API_URL` is embedded in the JavaScript bundle at build time; an installed release APK does not reread the project's `.env`. Restarting Metro or reopening the installed app cannot update that address. An incremental native build can reuse an older JavaScript bundle after only `.env` changes.

After changing the backend origin, regenerate the release bundle and assemble a new APK. From `android/` on Windows:

```powershell
.\gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks --no-build-cache
.\gradlew.bat :app:assembleRelease --no-build-cache
```

Install the updated APK using `adb install -r android/app/build/outputs/apk/release/app-release.apk` from the project root. This updates the existing app without uninstalling it or clearing its local data. For development builds served by Metro, restart with `pnpm start --dev-client --clear` and reload the app instead. Use the backend HTTPS origin without an `/api/v1` suffix.

All paths include `/api/v1`. The app accepts exactly 11 digits starting with `0`, for example `09121234567`, including Persian and Arabic digits. The entered number remains in local format in the form. The cloud client converts the leading `0` to `+98` before requests, preserving the backend's international-format contract (`+989121234567`). Existing international-format cloud-client callers remain supported; the phone-entry form requires local format.

- `POST /auth/phone/register-password`: `{ phoneNumber, password, confirmPassword }` → `{ accessToken, refreshToken, accessExpiresAtUtc, sessionId, sessionExpiresAtUtc }`. No OTP/proof is required.
- Legacy `POST /auth/phone/otp/request`: `{ phoneNumber, purpose: "register" | "login" }` → `{ challengeId, expiresAtUtc, resendAtUtc }`.
- `POST /auth/phone/otp/verify`: `{ challengeId, code }` → registration `{ registrationToken, expiresAtUtc, tokens: null }`, or login `{ registrationToken: null, expiresAtUtc: null, tokens: { accessToken, refreshToken, accessExpiresAtUtc } }`.
- `POST /auth/phone/register`: `{ phoneNumber, registrationToken, password, confirmPassword, username }` → `{ accessToken, refreshToken, accessExpiresAtUtc }`.
- `POST /auth/phone/login`: `{ phoneNumber, password }` → the same token object.
- Existing `GET /me/`, `POST /auth/refresh` and authenticated `POST /auth/logout` remain in use. Legacy email APIs remain available for existing clients/accounts.

The legacy verified registration endpoint still requires a valid registration proof and its original 12–128-character password and username. Its OTP requirements are not weakened by the separate password-registration endpoint.

For legacy OTP endpoints, codes last five minutes, have five attempts, and may be requested once per 60 seconds and five times per hour per phone. Proofs last ten minutes, are phone-bound and single-use; resending invalidates prior verification. The existing per-IP authentication limit also applies to the new registration endpoint. Validation, authentication, rate-limit and network errors appear in English/Persian. The UI disables inputs and duplicate submissions while pending.

## Session and interruption behavior

After signing in, accounts without a saved name see a localized name prompt before guest-data review or account access. New phone/password accounts start with an empty name instead of the old "Learner" placeholder. Names are trimmed, must contain 1–120 characters and are saved with authenticated `PUT /api/v1/me/profile` (`{ displayName }`), using only the authenticated account identity. Failed loads/saves offer retry without advancing onboarding. A saved name is returned by `/me/`, so later sign-ins do not ask again. Accounts that already have a name retain it. Deploy the backend profile endpoint and registration change together with this app update; no database migration is required.

Signed-in users can also change their display name from **Settings → Edit name**. Saving uses the same authenticated `PUT /me/profile` endpoint and 1–120-character validation; cancelling discards the draft. Failed saves preserve the draft for retry, and account changes discard the previous account's editor. This does not change phone numbers, credentials, or subscription access. The Settings subscription button uses the theme's purple primary color only for server-confirmed active subscriptions; free and provisional states retain the neutral style.

Access/refresh tokens and the authenticated account UUID use the existing SecureStore key; passwords and confirmation are transient component state, never route parameters or persistent storage. Switching form modes clears both passwords. Successful authentication confirms `/me/` and selects isolated account storage before storing credentials. The [guest-data modal](guest-data-migration.md) immediately synchronizes account data and requires adding guest data or permanently discarding it with a second confirmation. Verified additive copies use new identities and the existing sync queue, then clear guest storage; failures preserve recoverable source data. With no guest learning data the account opens automatically. A binding/storage failure attempts to revoke the newly issued session and preserves guest data. Guest storage is never bound directly to an account. See [guest mode](guest-mode.md) for isolation and restoration rules.

Expired access tokens use the existing single-flight refresh rotation. Rejected sessions clear credentials. If a refresh response is lost, uncertain credentials are cleared rather than automatically replaying a possibly consumed refresh token. Sign in again. [Secure logout](secure-logout.md) offers verified sync or explicit logout without backup, immediately isolates account state, clears credentials and preserves only non-secret references for later owner-authenticated revocation. Known absolute session expiry blocks offline restoration; legacy sessions with expired access require online refresh before restoration. Offline logout is never described as confirmed remote revocation. Late pre-logout responses cannot restore credentials.

An interrupted registration may already have succeeded on the server. Try phone/password login if registration was interrupted or the number is reported as already registered. The mobile client does not automatically replay registration POST requests. Native device UI behavior and live backend integration require deployment/device testing; a JavaScript bundle export is not an APK/device test.
