# Google authentication

The **Continue with Google** button signs in an existing Google user or creates an account on first use. Phone/password login, verified phone registration, and legacy email/password login remain available. Google registration needs no phone number, SMS OTP, or app password.

## Configuration

Use the same Google Cloud project for all OAuth clients. Configure the OAuth consent screen and add test users while the app is in testing mode.

1. Create a **Web application** OAuth client. Set its public client ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the app build environment and `Google__WebClientId` on the backend. These values must match. No Google client secret is needed or shipped in the app.
2. For Android, create an **Android** OAuth client for `com.example.lerona` and register the SHA-1 certificate fingerprints for each signing key used: debug, local release, EAS, and Play App Signing as applicable. Do not pass the Android client ID as the web client ID.
3. For iOS, create an **iOS** OAuth client for `com.example.lerona`. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` for the app build. `app.config.js` derives the reversed client URL scheme and adds the native Google config plugin. Without an iOS client ID, Google sign-in fails with a configuration message on iOS while other login methods remain usable.
4. Deploy the backend with the `20261022100000_AddGoogleAuthentication` migration applied. It adds a nullable, unique `Users.GoogleSubject` column without changing existing accounts.
5. Install dependencies with `pnpm install`, regenerate native projects with `pnpm exec expo prebuild`, and rebuild/install the app. Existing APKs and Expo Go do not contain the new native Google module. For Android release builds, use the release bundle rebuild instructions in [phone authentication](phone-authentication.md) after changing public environment variables.

Do not store Google secrets in Expo public variables. Client IDs are public configuration, not secrets. Missing backend configuration disables only Google authentication with HTTP 503. Backend access to Google's HTTPS OpenID discovery and signing-key endpoints is required. On Android the native SDK also requires Google Play services. Web authentication remains unavailable, consistent with the existing native-only secure credential store.

## Session and account safety

The native SDK obtains a Google ID token with basic email/profile permissions. It does not request offline access or access to Gmail messages. Each interactive attempt clears the SDK's previous selection before opening Google sign-in, so app account switching does not rely on silent Google login. Cancellation leaves the app signed out and makes no backend request.

The SDK is loaded only when Google sign-in is invoked, after platform/client configuration checks. This keeps the auth screen usable when running a web build or an older native binary without the Google module; the adapter reports a failure instead of crashing during screen import.

`POST /api/v1/auth/google` accepts only `{ idToken }` and returns the existing application access/refresh token object. The backend validates the Google signature against cached, rotating Google public keys, restricts algorithms to RS256, validates both supported Google issuers, requires the configured audience, checks expiration, and requires a verified email and subject. Unknown signing keys trigger a metadata refresh; retry sign-in after the refresh. Authentication uses the existing per-IP auth rate limit, and responses are marked `no-store`.

Accounts are identified by the verified Google `sub`, never a client-supplied email or user ID. Repeated sign-in uses the same account even if Google's profile email changes; it does not silently overwrite the stored account profile. Archived accounts cannot sign in or be recreated. Concurrent first sign-ins are protected by unique subject/email indexes. A new Google account receives the existing sync head and normal application session, with no password hash or OTP challenge.

**Existing accounts are not linked automatically by email.** A collision returns `409 google_account_conflict` and asks the user to sign in with their original method. This avoids taking over or merging an existing account based only on a matching email. Explicit authenticated account linking is not implemented.

The app exchanges the transient Google ID token through the existing cloud client and sync engine, confirms `/me/`, activates isolated account storage before saving app credentials in SecureStore, and offers the existing guest-data preview. Google ID tokens are not persisted by the app or placed in route parameters. App refresh rotation, logout, revocation, and late-response protection are unchanged. Logging out of Lerona revokes its session; it does not revoke the user's Google account or sign them out of other Google apps.

## Verification

Automated tests cover the chooser adapter, success/cancellation/errors, duplicate submissions, unmount during the chooser, token exchange and account binding, Google JWT signature/issuer/audience/expiration validation, verified-email enforcement, repeated login, existing-email conflicts, archived users, metadata failure, auth rate limiting, refresh/logout, and SQL Server migration/model consistency.

Executed on October 22, 2026:

- Focused mobile auth/config tests: 6 suites, 91 tests passed.
- Backend Google/legacy/phone auth and persistence tests: 49 passed.
- TypeScript typecheck, ESLint on changed auth/config files, Prettier on changed mobile files, and Expo prebuild configuration evaluation passed.
- Full mobile suite: 975 passed, 10 failed across study-card alignment, navigation/reminders, and settings-language tests. All 10 failures also reproduce against the untouched mobile Git HEAD using the same installed dependencies.
- Full backend suite: 146 passed, one failure in `SyncTests.Guest_copy_retries_preserve_distinct_cards_and_historical_progress_with_owner_only_reads`, on the foreign-owner cards read. The same failure also reproduces against the untouched backend Git HEAD.
- Existing dependency audit warnings remain; unrelated test failures and dependency upgrades are not changed in this task.

Live Google consent, signing certificate registration, device login, iOS callback handling, production backend deployment, and applying the migration to SQL Server still require configured credentials and device/deployment verification. Mocked chooser tests and locally signed test tokens are not a live Google sign-in test.
