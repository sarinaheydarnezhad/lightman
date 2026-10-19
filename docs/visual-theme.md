# Lavender theme

The visual system follows `New.png`: a soft lavender canvas, subtle waves, rounded white surfaces, purple primary actions, quiet shadows, illustrated study artwork, and deck monograms. The home screen keeps live due counts, review totals, streaks, and existing navigation; the decorative flame ring does not claim to measure study progress.

Shared colors and dimensions live in `src/shared/theme/values.json`. Screens, cards, buttons, inputs, lists, charts, tab navigation, and stack headers use the active semantic palette. The book-and-plant artwork and flame are scalable React Native SVG components, not screenshots containing baked-in interface text. The layout adapts to English/Persian and hides decorative header artwork at narrow widths or larger font scales to leave room for content.

Settings → Appearance offers only **Light** and **Dark**, with previews. Selection goes through the existing settings use case and repository and updates the whole app immediately. Native settings remain in the active scope's SQLite database across restarts. Old saved `system` values load as Light; old `oled` values load as Dark. The historical database schema still accepts these legacy values so existing databases and incoming sync settings remain readable. No study data or existing account data is deleted to change appearance.

The reference's fake phone frame, status bar, and bottom gesture handle are not drawn inside the app; these belong to the operating system. Actual typography and available space can vary with the device, font scaling, and safe-area insets.

## Verification

- 41 focused tests pass for semantic contrast, theme switching, home actions in English/Persian, SQLite persistence and legacy settings, Settings, and shared UI controls.
- Eight selected navigation tests pass for the root/tab layout, deck routes, both analytics themes, Appearance selection, and starting study from Home. Two settings-use-case tests pass for defaults and theme changes.
- TypeScript, focused ESLint checks, and formatting checks pass. Light and dark appearances were also inspected in a 390 × 844 browser preview, including a saved dark preference after reload.
- Broader runs still expose existing expectations for Arabic UI support, forced RTL alignment of English study text, and reminder scheduling/permission mocks. These unrelated behaviors were not changed to make the theme checks pass. Physical Android/iOS rendering and maximum accessibility text sizes still need device QA.
