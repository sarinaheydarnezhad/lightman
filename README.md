# Lightman

Offline flashcard mobile foundation. Business data uses domain repository interfaces; development adapters reset on restart. Zustand holds only transient UI state.

## Start and verify

Install Node.js 22.13+ and pnpm 10.15.1 (for example, using Corepack), then run `pnpm install --frozen-lockfile`, `pnpm start`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, `pnpm expo:check`, and `pnpm config:check`. Run `pnpm android` for a local Android build, or `pnpm exec expo prebuild --platform android --no-install` to inspect generated native configuration. Android native builds require the Android SDK. iOS prebuild requires macOS or Linux, and local iOS native builds require macOS/Xcode.

## Architecture

`src/app` contains only Expo Router routes and composition. `features/*/presentation` renders screens; `domain` owns entities, validation, and repository contracts; `data` supplies replaceable adapters. `core` holds shared contracts and composition, `shared` holds UI primitives and theme, and `store` holds small session UI state. Presentation never imports data adapters. Domain never imports React Native, Expo, Zustand, or SQL. The composition root binds temporary adapters; eventual OP-SQLite adapters can replace them without changing presentation or domain.

## Performance rules

- Keep production deck/card/review collections behind repositories, never in Zustand. The small Task 3 UI samples are isolated in `src/shared/demo`.
- Pass identifiers or narrow selectors instead of large objects down component trees.
- Memoize when profiling or a clear render boundary justifies it.
- Avoid expensive render work, gesture callbacks, and animation worklets.
- Virtualize lists when collection screens arrive.
- Keep domain logic independent of UI rendering.

Store identifiers in `app.json` are provisional and must be owned by the publisher before release. EAS credentials and project linkage are configured when builds begin.

SDK 57's `expo-build-properties` plugin enables iOS scene support for builds made with Xcode 27. Regenerate native projects after changing app config. Store artwork, signing credentials, and on-device QA are release work outside this foundation.

## Design system

`src/shared/theme/values.json` is the single source of visual values. `tokens.ts` exposes typed colors, typography, spacing, radii, heights, and elevation. The NativeWind configuration reads the same values: semantic colors map to CSS variables that `ThemeProvider` sets on its root view for light, dark, or OLED. Use semantic utilities such as `bg-surface`, `text-primaryText`, `p-xl`, `rounded-md`, and `text-headingLarge`; avoid one-off values. Native properties that need color props (Lucide icons, indicators, text selection, navigation) read `useThemeColors()`. Cards use the shared shadow tokens via native style for iOS shadow and Android elevation.

The appearance preference lives only in `useUiStore` for this session. `system` resolves system light to light and system dark to dark; OLED is explicit and uses `#000000` as its base. Storage can be added at the store boundary later. Settings exposes all four preferences. In development, Settings links to `/design-system`, which previews every primitive and appearance; the route is intentionally available by direct URL for internal inspection.

Core primitives live in `src/shared/ui`: `Screen`, `Text`, `Button`, `IconButton`, `Card`, `Input`, `Divider`, `Badge`, `Chip`, `Tab`, `EmptyState`, and `LoadingState`. `Screen` uses safe area insets on all edges and a fluid centered content limit for phones and tablets. `Text` and `Input` support alignment, including RTL-aware start/end text alignment in `Text`; flex row components preserve native RTL mirroring. The UI uses font scaling, roles and state for actions/tabs, labels for icon controls, and readable theme-specific semantic contrast. Full localization, persisted preference, and full accessibility/device audits remain future work.

## Application shell

`src/app/_layout.tsx` keeps the existing provider order: gesture root, safe area, theme, bootstrap gate, then the native stack. `src/core/bootstrap/initialize-application.ts` is the one asynchronous startup entry point; it currently completes immediately. The gate tracks boot, initializing, ready and error states, provides loading and retry screens, and never runs setup in render. Feature screens stay in their `features/*/presentation` folders; route files only compose screens and read typed route parameters. The existing five tabs use JavaScript tabs with native safe-area handling and the root stack presents secondary screens. The tab navigator owns the bottom inset; stack headers own the top inset. `src/shared/navigation/safe-area.ts` supplies the corresponding `Screen` edges so they are not counted twice.

Secondary routes are `/decks/create`, `/decks/[deckId]`, `/decks/[deckId]/edit`, `/decks/[deckId]/cards/create`, `/decks/[deckId]/cards/[cardId]`, `/decks/[deckId]/cards/[cardId]/edit`, `/study/[sessionId]`, `/vocabulary/helper`, and `/settings/appearance`. Expo Router's existing typed-routes setting generates navigation types when the dev server starts; links use route literals or pathname/params objects, and dynamic screens type `useLocalSearchParams` by pathname. `src/shared/demo/decks.ts` and each feature's `use*ViewModel` module isolate temporary, in-memory display values. They have no persistence or live service connections. Analytics and study show placeholders until their future data sources exist; Settings only wires its existing session-only appearance preference.
