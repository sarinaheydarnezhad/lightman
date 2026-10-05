# Local import and export

Open **Settings → Import / Export**, or **Export cards** on a deck. Choose a CSV,
XLSX, or Anki APKG file for import. Parsing, validation, and duplicate checks are
read-only. Review the format, decks, total/new/duplicate/invalid counts and row
errors, then explicitly confirm. Cancelling never changes repositories.

Export either the selected active deck or all active decks, select a format, then
share/save. Native platforms use Expo's share sheet; web downloads the file.
Exported native files remain in the OS-managed cache so receiving applications
can read them after the share sheet closes. Newly installed native modules require
a new development/release build, rather than only refreshing JavaScript.

## Content and mapping

- CSV is UTF-8 with a BOM, RFC-style quoting, and headers. XLSX contains a `Cards`
  worksheet with string cells, not formulas. Both preserve Unicode and multiline text;
  XLSX import follows Excel's CRLF-to-LF line-ending normalization.
- Headers are `Deck`, `Front`, `Back`, `Phonetic`, `Category`, `Examples`.
  Case, spaces, underscores, and hyphens in recognized headers are ignored.
  Aliases include `Deck Name`, `Front Text`, `Question`, `Meaning`, `Answer`, and
  `Pronunciation`. Required headers are Front/Back or their aliases.
- Examples use an array encoded in a single cell, with `sentence` and optional
  `translation`/`notes`. This preserves the existing Card model without adding a
  separate JSON file format. Invalid examples or required fields are reported.
  Large XLSX example arrays span `Examples 2`, `Examples 3`, etc. continuation
  columns on the same row, avoiding Excel's cell-text length limit.
- A missing/empty Deck cell uses the source filename without its extension.
  XLSX scans all worksheets for a recognized header row, ignoring unrelated sheets.
- APKG export writes a real ZIP archive containing a schema-11 SQLite
  `collection.anki2`, an empty `media` map, deck metadata, a five-field Lerona
  note type, and new Anki cards. Mobile uses the existing native SQLite engine on
  temporary cache files, opened read-only during import and deleted after use.
  Web uses sql.js's self-contained asm.js build. There is no extra application
  database, backend, or package-codec WASM download.
- APKG import supports legacy `collection.anki2`/`collection.anki21` and modern
  Zstandard-compressed `collection.anki21b` with separate deck/field tables.
  A note's first field becomes Front, its second Back, and later fields map only
  to matching Phonetic, Category, or Examples fields. HTML becomes plain text.
  Multiple templates for the same note/deck become one application card.
  Filtered cards use their original deck. Tags are extracted by the adapter, but
  are not saved: the current Card model has no tags field. Media is not extracted.

## Identity and review state

Deck matching and duplicate keys use Unicode NFKC, lowercasing, trimming, and
collapsed whitespace. The key is deck name + front + back. Existing and in-file
duplicates are skipped, never overwritten. Archived cards also count as
duplicates; an archived matching deck must be restored before adding new cards.
Confirmation rechecks against current repository contents and prevents concurrent
imports. Individual persistence failures appear as skipped rows in the summary.

Cards are saved through the existing application use cases and receive normal
initial Leitner review state. No Anki scheduling or fake ReviewEvents are imported.
Imports are limited to 50 MB; extracted Anki collections to 100 MB.

## Verification

Run `npm test -- src/features/transfer` for format round trips, real SQLite package
integrity, Unicode/multiline content, matching, validation, duplicates, initial
review state, and confirmation/cancellation UI coverage.

The optional official-Anki smoke check additionally imports the generated package
using Anki's backend. Install `anki==26.9.3` in a separate Python environment, set
`ANKI_TEST_PACKAGE` to an absolute output path, and run the adapter tests. Then run:

```text
python scripts/verify-anki-package.py <generated.apkg> <fixture-directory>
```

The script verifies note fields, card count, and absence of review history, then
exports legacy and modern APKG fixtures using Anki itself.
