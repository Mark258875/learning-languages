#!/usr/bin/env python3
"""
export_anki.py — Export vocabulary cards to Anki-compatible format.

Outputs a tab-separated .txt file importable into Anki (Basic note type).
Front: word + pronunciation | Back: translation + example sentence

Usage:
    python scripts/export_anki.py --lang french --output exports/french_anki.txt
    python scripts/export_anki.py --lang russian --topic basics --output exports/ru_basics.txt
    python scripts/export_anki.py --lang chinese --output exports/chinese_anki.txt
"""

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

LANG_DIRS = {
    "french": REPO_ROOT / "french" / "vocabulary" / "topics",
    "russian": REPO_ROOT / "russian" / "vocabulary" / "topics",
    "chinese": REPO_ROOT / "chinese" / "vocabulary" / "topics",
}


def format_french_card(card: dict) -> tuple[str, str]:
    front = card["word"]
    if card.get("pronunciation"):
        front += f"<br><small>{card['pronunciation']}</small>"
    if card.get("gender"):
        front += f"<br><i>({card['gender']})</i>"

    back = f"<b>{card['translation']}</b>"
    if card.get("example"):
        back += f"<br><br><i>{card['example']}</i>"
        if card.get("example_translation"):
            back += f"<br>{card['example_translation']}"
    return front, back


def format_russian_card(card: dict) -> tuple[str, str]:
    front = card["word"]
    if card.get("transliteration"):
        front += f"<br><small>({card['transliteration']})</small>"
    if card.get("pronunciation"):
        front += f"<br><small>{card['pronunciation']}</small>"

    back = f"<b>{card['translation']}</b>"
    if card.get("gender"):
        back += f"<br><i>({card['gender']})</i>"
    if card.get("example"):
        back += f"<br><br><i>{card['example']}</i>"
        if card.get("example_translation"):
            back += f"<br>{card['example_translation']}"
    return front, back


def format_chinese_card(card: dict) -> tuple[str, str]:
    front = f"{card['simplified']}"
    if card["simplified"] != card["traditional"]:
        front += f" / {card['traditional']}"
    front += f"<br><b>{card['pinyin']}</b>"

    back = f"<b>{card['translation']}</b>"
    if card.get("example"):
        back += f"<br><br><i>{card['example']}</i>"
        if card.get("example_pinyin"):
            back += f"<br>{card['example_pinyin']}"
        if card.get("example_translation"):
            back += f"<br>{card['example_translation']}"
    return front, back


FORMATTERS = {
    "french": format_french_card,
    "russian": format_russian_card,
    "chinese": format_chinese_card,
}


def main():
    parser = argparse.ArgumentParser(description="Export vocabulary to Anki-importable format")
    parser.add_argument("--lang", required=True, choices=list(LANG_DIRS.keys()))
    parser.add_argument("--topic", help="Specific topic to export (default: all topics)")
    parser.add_argument("--output", required=True, help="Output .txt file path")
    args = parser.parse_args()

    vocab_dir = LANG_DIRS[args.lang]
    formatter = FORMATTERS[args.lang]

    if args.topic:
        topic_files = [vocab_dir / f"{args.topic}.json"]
    else:
        topic_files = list(vocab_dir.glob("*.json"))

    if not topic_files:
        print(f"No vocabulary files found in {vocab_dir}")
        return

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    with open(output_path, "w", encoding="utf-8") as out:
        # Anki import header
        out.write("#separator:tab\n")
        out.write("#html:true\n")
        out.write("#notetype:Basic\n")
        out.write("#deck:" + args.lang.capitalize() + "\n")
        out.write("#columns:Front\tBack\n\n")

        for topic_file in sorted(topic_files):
            if not topic_file.exists():
                print(f"  ⚠️  {topic_file} not found, skipping")
                continue

            with open(topic_file, encoding="utf-8") as f:
                cards = json.load(f)

            for card in cards:
                front, back = formatter(card)
                # Escape tabs and newlines in content
                front = front.replace("\t", " ").replace("\n", " ")
                back = back.replace("\t", " ").replace("\n", " ")
                out.write(f"{front}\t{back}\n")
                total += 1

    print(f"✅ Exported {total} cards to {output_path}")
    print(f"\nTo import into Anki:")
    print(f"  1. Open Anki → File → Import")
    print(f"  2. Select {output_path}")
    print(f"  3. Verify settings and click Import")


if __name__ == "__main__":
    main()
