# Android package migration

Lerona's Android application ID changes from `com.example.lerona` to
`com.lerona.app`. `app.json` is the persistent Expo configuration, inherited by
`app.config.js`. The existing generated native project also uses the new Gradle
`applicationId`, namespace, and Kotlin package/source paths for `MainActivity` and
`MainApplication`. Native projects are ignored by Git; future Expo Prebuild runs
must use the updated `app.json`. No clean prebuild, device installation, uninstall,
application-data reset, database migration, or server deployment is part of this
change.

## Existing installations and data

Android treats the new ID as a separate application, rather than an update of an
installation of the old package. An existing Google Play listing cannot be updated
with a different application ID. See Android's [application ID documentation](https://developer.android.com/build/configure-app-module).

The old installation and its data remain intact. The new installation cannot read
the old package's private SQLite databases, SecureStore credentials, preferences,
pending sync queue, or scheduled reminders. Users must sign in again. Before
moving, verify account synchronization in the old app and confirm the same account's
data in the new app. Guest data and unsynchronized changes need special attention.
The existing Import / Export feature can transfer card content; it is not a full
backup of review history, sessions, credentials, or device preferences. Keep the old
installation until the required data is verified. No automatic transfer between
the two package sandboxes has been introduced.

## External configuration

- **Google sign-in:** Register an Android OAuth client for `com.lerona.app` in the
  existing Google Cloud project, with the SHA-1 fingerprint for every actual
  signing certificate used by debug, local release, EAS, and Play App Signing
  builds. Keep the old client while supporting the old package. The existing web
  client ID and backend audience do not change solely because of this rename.
  Google login code is retained even though its UI is currently hidden. See
  [Google's Android OAuth client setup](https://developers.google.com/workspace/guides/create-credentials#android)
  and [the app's setup guide](google-authentication.md).
- **Myket:** Reserve/register `com.lerona.app`, configure the matching products and
  credentials, and set backend `Payments__Myket__PackageName=com.lerona.app`.
  Ensure its public key, verification access token, and product IDs belong to this
  package. The client compares the installed application ID with the server's
  package; a mismatch disables checkout. The current backend supports one package
  configuration, so switching it also affects billing and unfinished purchase
  recovery for old installations. Do not assume old purchase tokens are valid for
  the new package. Reconcile unfinished purchases before rollout; existing
  account entitlements remain server records. See [Myket payment setup](myket-payments.md)
  and the [package-specific verification API](https://myket.ir/docs/technical/services/purchase-validation/).
- **Signing and distribution:** Configure EAS/store credentials and any CI or
  store package allowlists for the new ID. Existing local release Gradle settings
  use the debug keystore; this rename does not create a production signing key.
  Rebuild a native binary before distributing the new ID.
- **Firebase:** No Firebase integration, `google-services.json`, Google Services
  Gradle plugin, or FCM token registration is configured in this project. If an
  external Firebase app exists, register a new Android app for `com.lerona.app`
  and obtain its matching configuration; Firebase's registered package name
  cannot be edited. See [Firebase Android setup](https://firebase.google.com/docs/android/setup).

## Deep links and other native configuration

The manifest's relative `.MainActivity` and `.MainApplication` declarations resolve
against the new namespace. Main, debug, and debugOptimized manifests have no old
package literals requiring replacement. Existing `lerona://` and `exp+lerona://`
schemes are preserved. If both app IDs are installed, the same custom scheme can
match either app, so verify the receiving app during device testing. No HTTPS App
Links, `assetlinks.json`, custom hard-coded provider authorities, or package-based
OAuth redirect URI is configured here. Any externally hosted association files or
API-key restrictions must be checked separately if they exist.

Myket's own `ir.mservices.market` package and billing permission are unchanged.
The iOS bundle identifier remains `com.example.lerona`. Local reminders, database
names, storage keys, application versions, permissions, and authentication endpoints
are unchanged.
