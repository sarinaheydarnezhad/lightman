# Myket payments

## Implemented flow

Android Plus checkout now uses the installed `iab-myket-reactnative` 2.2.0 native promise bridge. Web, iOS, Expo Go and builds without the module cannot buy. Guests must sign in. The backend catalog controls whether buying is available; absent or invalid server configuration keeps all purchases disabled. Premium/Full is never purchasable.

These are **consumable, one-time products granting fixed periods**, not Myket auto-renewing subscriptions. Configure three distinct products for 1, 6 and 12 months. Their Myket console prices must match the server catalog: 70,000, 294,000 and 420,000 **toman** respectively. Confirm the console currency before entering prices; do not confuse toman and rial. The Myket checkout dialog is the final payment confirmation.

1. The signed-in app retrieves the server's public billing configuration and checks the installed application ID.
2. It connects to Myket and queries unfinished purchases before opening any new checkout.
3. The server checks active/scheduled subscriptions and creates an owner-bound checkout with a random developer payload, server SKU and duration. Pending checkout retries reuse the same order. Changing duration is blocked until cancellation or the one-hour reservation expires.
4. Myket displays its real payment UI. No local success simulation grants access.
5. The backend calls Myket's server-to-server verification API. It validates provider purchase/consumption states, server-issued payload, SKU, owner and purchase time. No client price, duration, user ID or paid flag controls activation.
6. An owner-serialized SQL transaction retires an expired Active row, inserts Plus and saves a unique token hash atomically. Replaying the same receipt cannot extend access or create another subscription. Periods start at the original verified purchase time, including late recovery.
7. Only after successful server verification/commit does the app consume the purchase. Verification, network or consumption failures leave the purchase recoverable. **Recover purchases** retries fulfillment without opening a new payment. Access is refreshed from the server, never toggled locally.

Cancellation is handled only for explicit Myket cancellation codes. Unknown failures are not treated as cancellations or proof of payment. Account/scope changes block late verification/consumption and UI updates. Purchase calls are serialized and repeated taps are blocked.

## Server setup required

Configure these values privately in backend deployment environment settings:

```text
Payments__Myket__Enabled=true
Payments__Myket__PackageName=com.lerona.app
Payments__Myket__PublicKey=<base64 RSA public key from Myket>
Payments__Myket__AccessToken=<Myket server verification API access token>
Payments__Myket__Products__1=<one-month SKU>
Payments__Myket__Products__6=<six-month SKU>
Payments__Myket__Products__12=<twelve-month SKU>
```

`AccessToken` is a secret: never put it in `EXPO_PUBLIC_*`, mobile code, source control or chat. Only the public key, package and SKU list are returned to authenticated clients. Verification uses POST to `https://developer.myket.ir/api/partners/applications/{package}/purchases/products/{sku}/verify`, header `X-Access-Token`, and JSON `{ "tokenId": "..." }`. Header logging is redacted and purchase tokens are not stored in plaintext.

Official contract checked on October 26, 2026: `https://myket.ir/kb/pages/server-to-server-payment-validation-api/`. React Native instructions: `https://myket.ir/kb/pages/adding-inapp-purchase-in-react-native/`.

Apply backend migration `20261026120851_AddMyketOrders` and deploy the updated API before enabling payments. The migration is additive and has not been applied to a live database. Existing deployments that only contain the old read-only subscription API cannot process these purchases. Rebuild/publish the backend rather than uploading an old `backend/publish` folder.

Authenticated, no-store routes:

- GET `/api/v1/payments/myket/`: public-key configuration, never the access token.
- POST `/api/v1/payments/myket/orders`: `{ durationMonths }`.
- POST `/api/v1/payments/myket/verify`: `{ sku, token }`.
- POST `/api/v1/payments/myket/orders/{id}/cancel`: cancels only the owner's unfinished intent; it is not a refund API.

## Android setup

The Android package in `app.json` is `com.lerona.app`. Reserve this package in Myket and configure its products, public key and server verification access token. The backend package must match the installed application ID. Configure your real production signing credentials; this change does not create signing keys. Existing installations of `com.example.lerona` have a separate app identity and purchase history; see [Android package migration](android-package-migration.md) before switching a live backend.

`app.config.js` now registers the plugin as a proper plugin/options tuple regardless of Google iOS configuration. The plugin preserves other plugins, manifest placeholders and Android queries, and adds the Myket billing permission/package visibility. It registers the official Myket Maven repository for every Android project, restricted to the `ir.myket` group; declaring it only in the SDK module does not resolve the application's transitive billing dependency.

SDK 2.2.0's published Android build script expects its own root version catalog and plugin versions. The version-guarded prebuild shim `plugins/myket-build.gradle` instead uses the host Expo Android/Kotlin plugins and React Native version. The plugin also exports only the SDK's promise module: its unused callback module exposes a custom native argument unsupported by React Native interop. Review these compatibility adjustments before upgrading the pinned SDK. iOS autolinking is explicitly disabled for this Android-only package.

After dependency installation, run `npx expo prebuild --platform android --no-install`, then rebuild the native app. Do not use `--clean` unless you intend to regenerate native files and have preserved custom native changes. An existing installation or Expo Go cannot gain native billing through a JavaScript-only update.

## Release acceptance and limitations

No live charge, console product creation, API credential provisioning, production migration, deployment or refund has been performed. Before enabling production payments, test on a Myket-equipped device using the reserved, correctly signed app: all three periods, cancellation, missing Myket, interrupted checkout, offline verification, interrupted consumption, process death/restart, original-account recovery, account switching, repeated taps and concurrent devices. Check the actual store prices/currency and exactly-once activation in SQL Server.

Keep unfinished purchases unconsumed when verification fails. A purchase belonging to a different Lerona account must be recovered in its original account. Myket inventory cannot restore a purchase already consumed by an older/foreign implementation without a corresponding server ledger entry. If concurrent external purchases overlap an active plan, the second receipt is not consumed or silently granted; support must reconcile/refund it in Myket. Automatic refund/revocation polling, store webhooks, account transfer and financial administration are not implemented. Define operational reconciliation/refund procedures before public release.

The backend currently reports existing NuGet security warnings for `System.Security.Cryptography.Pkcs` 9.0.11. Address that dependency advisory separately before production deployment; payment work does not suppress it.

## Validation record — October 26, 2026

- Frontend: 150 tests passed across eight focused configuration, subscription, cloud-client, sync-engine, checkout/recovery and paywall suites. TypeScript and targeted ESLint passed; formatting was checked with normalized Windows line endings.
- Backend: solution build and all 60 focused Myket, verifier, subscription and persistence tests passed. The broader suite reported 198 passing and one failing existing sync/card-read test: SQLite cannot order its `DateTimeOffset` column. That separate query/test-provider issue is not changed here.
- Android: `:iab-myket-reactnative:compileReleaseKotlin` and `:app:processReleaseMainManifest` passed, including the release JavaScript/Hermes bundle task. Initial repository resolution failures were fixed by adding the official repository at project scope. A full APK assembly, device installation and real Myket checkout were not performed.
- The additive migration was generated and checked, not applied to production. Payment credentials and console products still require operator setup; purchases remain disabled by default.
