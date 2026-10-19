# Phone authentication

See [the verification record](auth-verification.md) for executed commands, actual results and deployment checks that remain unverified.

Phone authentication extends the existing cloud client and sync engine; there is no second token store or authentication provider. Configure `EXPO_PUBLIC_API_URL` to the backend HTTPS origin (without `/api/v1`) in your native build. Expo SecureStore is already installed/configured. Authentication intentionally remains unavailable on web rather than storing credentials in localStorage. Do not put signing keys or SMS provider secrets in Expo public environment variables.

The backend needs its .NET 10 runtime/SDK, SQL Server connection, stable `Auth__SigningKey`, and the `AddPhoneAuthentication` migration. Its default SMS provider is SMS.ir: configure backend-only `Sms__ApiKey` and `Sms__TemplateId` for an approved verification template with a `Code` parameter. The existing six-digit OTP is preserved. The SMS.ir adapter requires Iranian `+989...` mobile numbers and converts them to the provider's ten-digit mobile field; the mobile/backend authentication contract remains international format. The original bearer-authenticated gateway remains available with `Sms__Provider=Webhook`, `Sms__Endpoint`, and `Sms__ApiKey`. Missing provider configuration returns 503; no fake success, fixed OTP, or code is echoed to mobile. Provider acceptance does not prove delivery, and real delivery has not been verified. Rotate any API key shared in chat and keep it out of Expo/public configuration.

## Contracts

### API address changes in installed Android release builds

`EXPO_PUBLIC_API_URL` is embedded in the JavaScript bundle at build time; an installed release APK does not reread the project's `.env`. Restarting Metro or reopening the installed app cannot update that address. An incremental native build can reuse an older JavaScript bundle after only `.env` changes.

After changing the backend origin, regenerate the release bundle and assemble a new APK. From `android/` on Windows:

```powershell
.\gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks --no-build-cache
.\gradlew.bat :app:assembleRelease --no-build-cache
```

Install the updated APK using `adb install -r android/app/build/outputs/apk/release/app-release.apk` from the project root. This updates the existing app without uninstalling it or clearing its local data. For development builds served by Metro, restart with `pnpm start --dev-client --clear` and reload the app instead. Use the backend HTTPS origin without an `/api/v1` suffix.

All paths include `/api/v1`. The app accepts exactly 11 digits starting with `0`, for example `09121234567`, including Persian and Arabic digits. The entered number remains in local format throughout OTP, resend and registration screens. The cloud client converts the leading `0` to `+98` before password login, OTP requests and registration, preserving the backend's international-format contract (`+989121234567`) without a backend change. Existing international-format cloud-client callers remain supported; the phone-entry form requires local format. Usernames need not be unique. The backend stores the username in its existing `DisplayName` field.

- `POST /auth/phone/otp/request`: `{ phoneNumber, purpose: "register" | "login" }` → `{ challengeId, expiresAtUtc, resendAtUtc }`.
- `POST /auth/phone/otp/verify`: `{ challengeId, code }` → registration `{ registrationToken, expiresAtUtc, tokens: null }`, or login `{ registrationToken: null, expiresAtUtc: null, tokens: { accessToken, refreshToken, accessExpiresAtUtc } }`.
- `POST /auth/phone/register`: `{ phoneNumber, registrationToken, password, confirmPassword, username }` → `{ accessToken, refreshToken, accessExpiresAtUtc }`.
- `POST /auth/phone/login`: `{ phoneNumber, password }` → the same token object.
- Existing `GET /me/`, `POST /auth/refresh` and authenticated `POST /auth/logout` remain in use. Legacy email APIs remain available for existing clients/accounts.

The "Existing email account" login option preserves access for users whose legacy accounts have no phone number. It calls the original email login through the same cloud client, sessions and token store; it does not migrate or duplicate accounts. New registration follows the phone-verification flow.

Code/proof expiration and attempts are enforced on the server: codes last five minutes, have five attempts, and may be requested once per 60 seconds and five times per hour per phone. Registration proofs last ten minutes and are bound to the verified phone and single-use. Resending invalidates prior verification. The existing per-IP authentication limit also applies. Clear validation, authentication, provider, rate-limit and network errors appear in English/Persian. The UI disables submissions while pending and displays resend/expiration states.

## Session and interruption behavior

Access/refresh tokens and the verified account UUID use the existing SecureStore key; passwords, OTPs and registration proofs are transient component state, never route parameters or persistent storage. Canceling/reopening a flow requires fresh verification. Successful authentication confirms `/me/` and selects the account's isolated local storage before storing credentials, then opens the [guest-data preview](guest-data-migration.md). A binding/storage failure attempts to revoke the newly issued server session. Guest storage is never bound to an account or automatically uploaded. Switching accounts selects separate databases instead of changing ownership. An explicitly confirmed copy uses new identities and the existing account sync queue, keeping guest originals intact. See [guest mode](guest-mode.md) for storage and offline-session restoration rules.

Expired access tokens use the existing single-flight refresh rotation. Rejected sessions clear credentials. If a refresh response is lost, uncertain credentials are cleared rather than automatically replaying a possibly consumed refresh token. Sign in again. [Secure logout](secure-logout.md) offers verified sync or explicit logout without backup, immediately isolates account state, clears credentials and preserves only non-secret references for later owner-authenticated revocation. Known absolute session expiry blocks offline restoration; legacy sessions with expired access require online refresh before restoration. Offline logout is never described as confirmed remote revocation. Late pre-logout responses cannot restore credentials.

An interrupted OTP verification or registration may already have succeeded on the server. Do not assume retry idempotency: request a new code for verification, or use password/OTP login if the account was created. The mobile client does not automatically replay registration/OTP POST requests. Native device UI behavior, SMS delivery, live backend integration and SQL Server migration application require deployment/device testing; a JavaScript bundle export is not an APK/device test.
