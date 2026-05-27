#!/usr/bin/env python3
"""
import_pending.py — Import pending words exported from the app into the vocab repo.

After looking up words in the app's Lookup panel and saving them to the pending
queue, use the "Export pending" button to download pending_{lang}.json, then run
this script to deduplicate and commit them to the correct topic file.

Usage:
    python scripts/import_pending.py --file pending_french.json --lang french --topic travel
    python scripts/import_pending.py --file pending_russian.json --lang russian --topic basics
    python scripts/import_pending.py --file pending_chinese.json --lang chinese --topic food
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
LANGUAGES = ["french", "russian", "chinese"]
PREFIXES = {"french": "fr", "russian": "ru", "chinese": "zh"}

ARTICLE_RE = re.compile(
    r"^(le |la |les |l'|l\u2019|un |une |des )",
    re.IGNORECASE,
)


def normalize(word: str) -> str:
    w = word.lower().strip()
    w = ARTICLE_RE.sub("", w)
    return w.strip()


def load_index(lang: str) -> dict:
    path = REPO_ROOT / lang / "words_index.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_index(lang: str, index: dict):
    path = REPO_ROOT / lang / "words_index.json"
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def find_next_num(existing: list, lang: str, topic: str) -> int:
    prefix = PREFIXES[lang]
    max_num = 0
    for e in existing:
        m = re.search(rf"{prefix}_{re.escape(topic)}_(\d+)$", e.get("id", ""))
        if m:
            max_num = max(max_num, int(m.group(1)))
    return max(max_num + 1, len(existing) + 1)


def main():
    parser = argparse.ArgumentParser(description="Import pending words from app export")
    parser.add_argument("--file", required=True, help="Path to pending_*.json exported from the app")
    parser.add_argument("--lang", choices=LANGUAGES, required=True)
    parser.add_argument("--topic", required=True, help="Topic to assign these words to")
    args = parser.parse_args()

    pending_path = Path(args.file)
    if not pending_path.exists():
        print(f"❌ File not found: {pending_path}", file=sys.stderr)
        sys.exit(1)

    try:
        entries = json.loads(pending_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {pending_path}: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(entries, list):
        print("❌ Expected a JSON array in the file", file=sys.stderr)
        sys.exit(1)

    index = load_index(args.lang)
    topics_dir = REPO_ROOT / args.lang / "vocabulary" / "topics"
    topics_dir.mkdir(parents=True, exist_ok=True)
    topic_file = topics_dir / f"{args.topic}.json"

    existing: list = []
    if topic_file.exists():
        try:
            existing = json.loads(topic_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []

    prefix = PREFIXES[args.lang]
    start = find_next_num(existing, args.lang, args.topic)
    added, skipped = [], 0

    for i, entry in enumerate(entries):
        word = entry.get("word") or entry.get("simplified") or ""
        key = normalize(word)
        if not key:
            continue
        if key in index:
            skipped += 1
            print(f"  ⚠️  Skip (duplicate): {word}")
            continue

        # Assign ID if missing
        if not entry.get("id"):
            entry["id"] = f"{prefix}_{args.topic}_{(start + i):03d}"
        entry.setdefault("source", "manual")
        entry.setdefault("verified", False)
        entry.setdefault("tags", [args.topic])

        added.append(entry)
        index[key] = f"{args.topic}:{entry['id']}"

    if added:
        combined = existing + added
        topic_file.write_text(
            json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        save_index(args.lang, index)
        print(f"✅ Added {len(added)} words → {topic_file.relative_to(REPO_ROOT)}")
    else:
        print("⚠️  Nothing new to add (all duplicates).")

    if skipped:
        print(f"   ℹ️  Skipped {skipped} duplicate(s)")


if __name__ == "__main__":
    main()
