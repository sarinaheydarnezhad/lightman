import pathlib
import sys
import tempfile

from anki.collection import (
    Collection,
    ExportAnkiPackageOptions,
    ImportAnkiPackageOptions,
    ImportAnkiPackageRequest,
)


def verify(package_path: str, fixture_directory: str) -> None:
    with tempfile.TemporaryDirectory() as directory:
        collection = Collection(str(pathlib.Path(directory) / "test.anki2"))
        try:
            result = collection.import_anki_package(
                ImportAnkiPackageRequest(
                    package_path=package_path,
                    options=ImportAnkiPackageOptions(with_scheduling=False),
                )
            )
            assert result.log.new, result
            note = collection.get_note(collection.db.scalar("select id from notes limit 1"))
            assert note.fields[0].startswith("سلام"), note.fields
            assert note.fields[1].startswith("معنی"), note.fields
            assert len(note.fields) == 5, note.fields
            assert collection.card_count() == 1
            assert collection.db.scalar("select count(*) from revlog") == 0
            print("Anki successfully imported the generated APKG.")
            for legacy in (True, False):
                destination = pathlib.Path(fixture_directory) / (
                    "anki-legacy.apkg" if legacy else "anki-modern.apkg"
                )
                collection.export_anki_package(
                    out_path=str(destination),
                    options=ExportAnkiPackageOptions(
                        with_scheduling=False, with_media=False, legacy=legacy
                    ),
                    limit=None,
                )
                print(f"Created real Anki fixture: {destination}")
        finally:
            collection.close()


if __name__ == "__main__":
    verify(sys.argv[1], sys.argv[2])
