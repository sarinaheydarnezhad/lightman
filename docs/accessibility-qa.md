# Accessibility device checklist

Run this checklist on a small phone and a larger phone or tablet in light, dark, and OLED themes. Use a real device: automated tests cannot confirm operating-system focus, speech output, or text layout at the largest display settings.

## iOS — VoiceOver

- Turn on VoiceOver in Accessibility settings. Visit Home, Decks, a deck and card, Card form, Study, Analytics, and Settings. Swipe through the screen in reading order; confirm headings, tab names and selected state, button actions, loading/empty/error text, and search fields are spoken.
- In Study, start an all-deck session. Read the term, phonetic and category; reveal, read Meaning and Examples, answer with the **Failure** and **Success** buttons, then follow the next card, retry, and completion. Check that the unrevealed answer is not exposed. Repeat with VoiceOver without swiping the card.
- Open archive and exit confirmations. Focus should enter at the question; underlying controls should be skipped. Cancel and confirm each flow. Check that an error is read if a save fails.
- Set Larger Text to a high accessibility size. Repeat the Card form, long card content, study answer buttons, analytics tabs, and Settings rows. Scroll to reach every control; no label should be cut off.
- Turn on Reduce Motion. Reveal and answer again; the card changes faces without rotating and answer submission still works.

## Android — TalkBack

- Turn on TalkBack. Repeat the same screen and study path, using TalkBack's next/previous navigation and double tap. Check the selected tab, setting switches, disabled controls, and the category/meaning/example labels.
- Open a confirmation and press Android Back. It should dismiss the question unless a confirmation is in progress. Return to the trigger and check it remains available.
- Increase system font and display size. Repeat the study controls and forms on a narrow device; verify vertical scrolling reaches the answer buttons and every error.
- Turn on Remove animations or reduced motion in system Accessibility settings. Repeat reveal, swipe, and button answers; visual motion may change, but all actions remain available.

## Both platforms

- Verify a reminder permission denial and a dictionary failure are readable, with clear next actions. Confirm search-empty and no-cards-due states are spoken.
- Check long English and Persian/Arabic text and a deck with RTL alignment. Labels and confirmation actions should follow logical reading order; the physical swipe direction still uses its existing meaning.
- Verify focus and contrast in all themes on physical screens. Token calculations against the surface give a minimum ratio of 5.9:1 for primary/secondary/tertiary and semantic status text in light, dark, and OLED; native disabled opacity and translucent overlays need visual inspection.
