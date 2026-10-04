# Anki package fixtures

`anki-legacy.apkg.base64` and `anki-modern.apkg.base64` contain collections exported
by the official Anki 26.9.3 backend after it successfully imported the application's
generated package. They contain one Unicode/multiline five-field note.

Only the actual collection, media map, and package metadata were retained, with
ZIP compression reapplied. Collection bytes were not modified. Base64 avoids
binary patch tooling and is decoded only by tests.

`scripts/verify-anki-package.py` documents the reproducible verification/export
procedure. Fixtures exercise both schema-11 legacy collections and real modern
Zstandard-compressed collections with separate deck/field tables.
