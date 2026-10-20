# Visual theme

Light mode follows `New.png`: a soft lavender canvas, subtle waves, rounded white surfaces, purple primary actions, quiet shadows, illustrated study artwork, and deck monograms. The home screen keeps live due counts, review totals, streaks, and existing navigation; the decorative flame ring does not claim to measure study progress.

Shared colors and dimensions live in `src/shared/theme/values.json`. Screens, cards, buttons, inputs, lists, charts, tab navigation, and stack headers use the active semantic palette. The book-and-plant artwork and flame are scalable React Native SVG components, not screenshots containing baked-in interface text. The layout adapts to English/Persian and hides decorative header artwork at narrow widths or larger font scales to leave room for content.

## Dark palette

Dark mode uses a neutral charcoal canvas (`#141414`), cards (`#202020`), and elevated or nested surfaces (`#2B2B2B`). Primary text is `#F5F5F5`; supporting text and decorative icons use `#A1A1AA`. Borders and shadows are neutral rather than purple, and the screen backdrop starts with the background color instead of an accent wash. Light mode keeps its original colors, gradient backdrop, and shadows.

Purple is reserved for primary actions, active navigation, links, selection, and the brand illustration: `primary` is `#A78BFA`, and `secondaryAccent` is `#C4B5FD` for progress and activity indicators. Primary buttons remain solid, with charcoal foregrounds for contrast. `primarySoft` maps to the neutral elevated surface in dark mode, so icon containers and selection backgrounds do not add a purple cast. Selected elements retain purple foregrounds or borders.

The `achievement` token is `#F59E0B` in dark mode for the streak icon and flame emblem; it is separate from warning colors. `decorativeIcon` keeps non-interactive icons and deck monograms neutral. These three role-specific tokens map to the existing primary color in light mode, preserving its appearance. Error, success, warning, and info palettes are unchanged; disabled controls retain neutral text on elevated surfaces and their existing disabled behavior.

## Appearance preferences

Settings → Appearance offers only **Light** and **Dark**, with previews. Selection goes through the existing settings use case and repository and updates the whole app immediately. Native settings remain in the active scope's SQLite database across restarts. Old saved `system` values load as Light; old `oled` values load as Dark. The historical database schema still accepts these legacy values so existing databases and incoming sync settings remain readable. No study data or existing account data is deleted to change appearance.

The reference's fake phone frame, status bar, and bottom gesture handle are not drawn inside the app; these belong to the operating system. Actual typography and available space can vary with the device, font scaling, and safe-area insets.

## Verification

- 25 focused tests pass for exact palette values, unchanged light/status colors, semantic contrast, runtime theme switching, neutral backdrop/shadow colors on web/iOS/Android, Home in English/Persian, activity indicators, and shared controls. Tested foreground/background pairs meet a minimum contrast ratio of 4.5:1.
- Four selected navigation tests pass for the root/tab layout, both analytics themes, and saving the Appearance preference.
- A read-only comparison with Git confirms all original light colors, non-color tokens, and error/success/warning/info colors remain unchanged. Tailwind compilation, formatting checks for changed files, and `git diff --check` pass.
- Full-suite verification remains incomplete after unrelated navigation failures involving language/RTL, deck-form expectations, reminders, and a study-flow timeout. Repository checks also expose seven TypeScript errors from missing routes in generated Expo route types, an existing `react/no-children-prop` lint error, and an unused-import warning. These behaviors were not changed for this color refinement.
- Physical Android/iOS rendering, browser visual inspection of the updated palette, and maximum accessibility text sizes still need manual QA.
