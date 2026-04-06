#!/usr/bin/env python3
"""
filter_names.py — Remove proper names from word-list.txt

Uses NLTK's names corpus (male.txt + female.txt) to identify and remove
names from the word list. Words that are also common English words are
kept via an exceptions list.

Usage:
    python filter_names.py             # dry run (preview only)
    python filter_names.py --apply     # actually modify files

Requirements:
    pip install nltk
    python -c "import nltk; nltk.download('names')"
"""

import argparse
import shutil
import sys
from pathlib import Path

# ── Exceptions: words that appear in NLTK names corpus but are also
#    common English words we want to keep in the word list.
EXCEPTIONS = {
    # Months / calendar / days
    "may", "june", "april", "august", "tuesday",
    # Common verbs
    "will", "don", "can", "mark", "frank", "dean", "sue",
    "deny", "carry", "foster", "lay", "say", "saw", "wait",
    "wake", "wash", "wade", "win", "trace", "tuck", "tab",
    # Nouns — body / people / roles
    "bride", "butler", "buddy", "butler", "buster", "rabbi",
    "shepherd", "tailor", "tanner", "mason", "porter", "cooper",
    "knight", "prince", "baron", "earl", "major", "marshal",
    "kaiser", "nanny", "nan", "ward",
    # Nouns — animals
    "bear", "bee", "bird", "bunny", "camel", "cat", "dove",
    "doe", "drake", "fox", "goose", "hart", "lamb", "lion",
    "raven", "robin", "rod", "salmon", "wolf",
    # Nouns — plants / nature
    "ash", "bard", "barn", "beck", "berry", "brook",
    "cinnamon", "coral", "daisy", "dale", "dew", "ebony",
    "fern", "flower", "garland", "garnet", "ginger", "grove",
    "hazel", "heath", "holly", "iris", "ivy", "laurel", "lea",
    "moss", "nova", "opal", "pearl", "poppy", "reed",
    "rosemary", "rose",
    # Nouns — objects / materials
    "bell", "chip", "clay", "cole", "crystal", "diamond",
    "doll", "ivory", "jade", "jean", "jewel", "kit", "kitty",
    "mead", "pen", "penny", "piper", "puff", "scarlet",
    "shell", "star", "tab", "tray", "velvet", "viola", "van",
    # Nouns — places / directions
    "bay", "dale", "glen", "grove", "lane", "marsh", "vale",
    "west", "lea", "pier",
    # Nouns — abstract / other
    "ace", "ally", "angel", "art", "aura", "ave",
    "bliss", "bonnie", "buck", "bud", "case",
    "charity", "cherry", "con", "cookie", "dawn",
    "duke", "else", "faith", "fan", "fancy",
    "fidelity", "fortune", "gay", "glad", "glory",
    "grace", "guy", "gypsy", "hall", "ham", "happy",
    "harmony", "honor", "honey", "hope", "hale",
    "jack", "jay", "jewel", "job", "joy", "joy",
    "kin", "king", "lust", "love", "meta", "mic",
    "mercy", "merry", "melody", "miles", "min",
    "noble", "norm", "oral", "pace", "page",
    "park", "patience", "prince", "rad", "ram",
    "red", "rich", "roman", "row", "royal",
    "shadow", "skip", "slim", "sol", "son",
    "spike", "sterling", "stern", "sting",
    "storm", "stew", "sunny", "sunshine",
    "tan", "temp", "terra", "trip",
    "wade", "ware", "way", "wit", "witty",
    "wood", "worth", "worthy", "wright",
    "yankee", "yard",
    # Colors
    "amber", "ebony", "gray", "scarlet",
    # Short words / abbreviations likely to be false positives
    "ann", "lee", "pat", "ray", "gene", "rob", "ron", "rex",
    "al", "ed", "jo", "di", "web",
    # Other common words
    "crystal", "jasmine", "lily", "violet",
    "sandy", "misty", "stormy", "rocky", "rusty",
    "chance", "haven", "lance", "pierce",
    "cliff", "ford",
}


def load_nltk_names() -> set[str]:
    try:
        from nltk.corpus import names as nltk_names
    except ImportError:
        print("ERROR: nltk not installed. Run:  pip install nltk")
        sys.exit(1)

    try:
        male = set(w.lower() for w in nltk_names.words("male.txt"))
        female = set(w.lower() for w in nltk_names.words("female.txt"))
    except LookupError:
        print("ERROR: NLTK names corpus not downloaded. Run:")
        print("  python -c \"import nltk; nltk.download('names')\"")
        sys.exit(1)

    return male | female


def filter_file(path: Path, names: set[str], dry_run: bool) -> list[str]:
    """Return the list of words removed from path."""
    if not path.exists():
        print(f"  SKIP (not found): {path}")
        return []

    words = path.read_text(encoding="utf-8").splitlines()
    removed = []
    kept = []

    for word in words:
        w = word.strip()
        if not w:
            kept.append(word)
            continue
        wl = w.lower()
        if wl in names and wl not in EXCEPTIONS:
            removed.append(w)
        else:
            kept.append(word)

    if removed:
        print(f"\n  {path}  —  removing {len(removed)} name(s):")
        for name in sorted(removed, key=str.lower):
            print(f"    - {name}")
    else:
        print(f"\n  {path}  —  no names found")

    if not dry_run and removed:
        backup = path.with_suffix(path.suffix + ".bak")
        shutil.copy2(path, backup)
        print(f"  Backed up to: {backup}")
        path.write_text("\n".join(kept), encoding="utf-8")
        print(f"  Wrote {len(kept)} words (removed {len(removed)})")

    return removed


def main():
    parser = argparse.ArgumentParser(description="Remove names from word-list.txt")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually modify files (default is dry-run / preview)",
    )
    args = parser.parse_args()
    dry_run = not args.apply

    if dry_run:
        print("DRY RUN — no files will be modified (pass --apply to commit changes)\n")
    else:
        print("APPLYING changes to files...\n")

    print("Loading NLTK names corpus...")
    names = load_nltk_names()
    print(f"  {len(names)} names loaded")

    root = Path(__file__).parent
    targets = [
        root / "word-list.txt",
        root / "public" / "word-list.txt",
    ]

    all_removed: set[str] = set()
    for path in targets:
        removed = filter_file(path, names, dry_run)
        all_removed.update(w.lower() for w in removed)

    print(f"\n{'-' * 50}")
    print(f"Total unique names flagged: {len(all_removed)}")

    if dry_run and all_removed:
        print("\nRun with --apply to remove them.")
    elif not dry_run and all_removed:
        print("\nDone. Review .bak files if you need to undo.")


if __name__ == "__main__":
    main()
