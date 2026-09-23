# Lightman

Offline flashcard mobile foundation. Business data uses domain repository interfaces; development adapters reset on restart. Zustand holds only transient UI state.

## Start and verify

Install Node.js 22.13+ and pnpm 10.15.1 (for example, using Corepack), then run `pnpm install --frozen-lockfile`, `pnpm start`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm expo:check`, and `pnpm config:check`. Run `pnpm android` for a local Android build, or `pnpm exec expo prebuild --platform android --no-install` to inspect generated native configuration. Android native builds require the Android SDK. iOS prebuild requires macOS or Linux, and local iOS native builds require macOS/Xcode.

## Architecture

`src/app` contains only Expo Router routes and composition. `features/*/presentation` renders screens; `domain` owns entities, validation, and repository contracts; `data` supplies replaceable adapters. `core` holds shared contracts and composition, `shared` holds UI primitives and theme, and `store` holds small session UI state. Presentation never imports data adapters. Domain never imports React Native, Expo, Zustand, or SQL. The composition root binds temporary adapters; eventual OP-SQLite adapters can replace them without changing presentation or domain.

## Performance rules

- Keep deck/card/review collections behind repositories, never in Zustand.
- Pass identifiers or narrow selectors instead of large objects down component trees.
- Memoize when profiling or a clear render boundary justifies it.
- Avoid expensive render work, gesture callbacks, and animation worklets.
- Virtualize lists when collection screens arrive.
- Keep domain logic independent of UI rendering.

Store identifiers in `app.json` are provisional and must be owned by the publisher before release. EAS credentials and project linkage are configured when builds begin.

SDK 57's `expo-build-properties` plugin enables iOS scene support for builds made with Xcode 27. Regenerate native projects after changing app config. Store artwork, signing credentials, and on-device QA are release work outside this foundation.
