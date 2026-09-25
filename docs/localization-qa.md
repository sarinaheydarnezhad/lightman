# Localization and RTL QA

App language is a `UserSettings.language` preference (`en`, `fa`, `ar`). English is the default, and unknown or untranslated UI strings use English. Changing language updates the current UI without changing `Deck.language`, `Deck.textAlignment`, speech preferences, or physical study swipe meanings (left = failure; right = success). Settings and reminders remain session local while the in-memory repository is in use. An enabled reminder is replaced with translated text when app language changes.

## Device checks to perform

- **iOS VoiceOver and Android TalkBack:** Change app language in Settings and revisit Home, Decks, card form/details, Study, Analytics, and Settings. Verify selected language, tab/back navigation, confirmation dialogs, error announcements, and the gesture-free Reveal/Success/Failure path. Test reduced motion and large system text in both RTL languages.
- **Reading order:** Verify RTL navigation/back affordances and logical start/end alignment. Switch between an RTL app with an English LTR deck and an English app with an RTL deck. Card contents and form inputs must follow the deck setting; application labels must follow the app setting. Center alignment must remain centered.
- **Mixed text:** Try `English کتاب`, `کتاب English`, `Arabic كتاب`, `كتاب Arabic`, an RTL sentence with `19:00` and punctuation, and long meanings/examples. Verify text is unchanged after saving and that search finds Persian, Arabic, and mixed Latin terms.
- **Analytics:** Dates must read oldest to newest left to right on the chart, including in RTL. Verify streaks, percentages, and box counts retain numeric meaning in both screen readers. ISO chart dates remain Gregorian and in chronological order.
- **Notifications and speech:** Enable a reminder, change language, verify one scheduled reminder at the same local `HH:mm` with updated title/body, and reopen Settings. Verify pronunciation still follows deck language and speech accent preference rather than menu language. Voice availability depends on the device.

Automated tests verify translations, fallback, language switching, script-aware search, reminder localization, and native reminder replacement. Native VoiceOver/TalkBack, font rendering, DST, and device-level notification delivery still require physical device checks.
