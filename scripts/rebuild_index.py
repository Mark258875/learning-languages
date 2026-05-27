#!/usr/bin/env python3
"""
rebuild_index.py — Build/rebuild the words_index.json deduplication index.

Scans all vocabulary JSON files for a language and produces a normalized
word → "topic:id" lookup map used for deduplication.

Normalization:
  - Lowercase
  - Strip leading articles: le / la / les / l' / un / une / des

Usage:
    python scripts/rebuild_index.py              # all languages
    python scripts/rebuild_index.py --lang fr    # one language
"""

import argparse
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
LANGUAGES = ["french", "russian", "chinese"]

ARTICLE_RE = re.compile(
    r"^(le |la |les |l'|l\u2019|un |une |des )",
    re.IGNORECASE,
)


def normalize(word: str) -> str:
    """Lowercase + strip leading articles for dedup key."""
    w = word.lower().strip()
    w = ARTICLE_RE.sub("", w)
    return w.strip()


def build_index(lang: str) -> dict:
    topics_dir = REPO_ROOT / lang / "vocabulary" / "topics"
    index = {}
    if not topics_dir.exists():
        print(f"  ⚠️  No topics directory for {lang}")
        return index

    for json_file in sorted(topics_dir.glob("*.json")):
        topic = json_file.stem
        try:
            entries = json.loads(json_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ⚠️  Failed to parse {json_file.name}: {e}")
            continue

        for entry in entries:
            word = entry.get("word") or entry.get("simplified") or ""
            word_id = entry.get("id", "")
            if word:
                key = normalize(word)
                if key and key not in index:
                    index[key] = f"{topic}:{word_id}"

    return index


def main():
    parser = argparse.ArgumentParser(
        description="Rebuild words_index.json for language(s)"
    )
    parser.add_argument(
        "--lang",
        choices=LANGUAGES,
        help="Only rebuild for this language (default: all)",
    )
    args = parser.parse_args()

    langs = [args.lang] if args.lang else LANGUAGES
    for lang in langs:
        print(f"\n🔍 Building index for {lang}...")
        index = build_index(lang)
        out_path = REPO_ROOT / lang / "words_index.json"
        out_path.write_text(
            json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  ✅ {len(index)} entries → {out_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
