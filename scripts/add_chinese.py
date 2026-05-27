#!/usr/bin/env python3
"""
add_chinese.py — Add verified Chinese vocabulary using CC-CEDICT.

First-time setup: downloads CC-CEDICT if not present.

Usage:
    python scripts/add_chinese.py --words "苹果,猫,家" --topic basics
    python scripts/add_chinese.py --words "苹果,猫" --topic food
    python scripts/add_chinese.py --pinyin "ping guo,mao" --topic basics  # search by pinyin
    python scripts/add_chinese.py --download  # just download/update the dictionary
"""

import argparse
import gzip
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
CHINESE_VOCAB_DIR = REPO_ROOT / "chinese" / "vocabulary" / "topics"
CEDICT_CACHE = Path(__file__).parent / ".cedict_cache.txt"
CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"

ARTICLE_RE = re.compile(r"^(le |la |les |l'|l\u2019|un |une |des )", re.IGNORECASE)


def normalize_key(word: str) -> str:
    w = word.lower().strip()
    w = ARTICLE_RE.sub("", w)
    return w.strip()


def load_index() -> dict:
    path = REPO_ROOT / "chinese" / "words_index.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def update_index(index: dict, word: str, topic: str, word_id: str):
    key = normalize_key(word)
    if key:
        index[key] = f"{topic}:{word_id}"
    path = REPO_ROOT / "chinese" / "words_index.json"
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def download_cedict():
    """Download and cache CC-CEDICT dictionary."""
    print("📥 Downloading CC-CEDICT (this happens once)...")
    try:
        with urllib.request.urlopen(CEDICT_URL, timeout=60) as response:
            compressed = response.read()
        text = gzip.decompress(compressed).decode("utf-8")
        CEDICT_CACHE.write_text(text, encoding="utf-8")
        print(f"✅ CC-CEDICT saved to {CEDICT_CACHE}")
        return text
    except Exception as e:
        print(f"❌ Failed to download CC-CEDICT: {e}", file=sys.stderr)
        print("   Try manually: wget https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz", file=sys.stderr)
        sys.exit(1)


def load_cedict() -> dict:
    """Load CC-CEDICT into a dict keyed by simplified characters."""
    if not CEDICT_CACHE.exists():
        text = download_cedict()
    else:
        text = CEDICT_CACHE.read_text(encoding="utf-8")

    cedict = {}
    # Format: Traditional Simplified [pin1 yin1] /def1/def2/
    pattern = re.compile(r"^(\S+) (\S+) \[([^\]]+)\] /(.+)/$", re.MULTILINE)

    for match in pattern.finditer(text):
        traditional, simplified, pinyin_raw, defs_str = match.groups()
        defs = defs_str.split("/")

        # Convert pinyin numbers to tone marks
        pinyin = convert_pinyin(pinyin_raw)

        entry = {
            "simplified": simplified,
            "traditional": traditional,
            "pinyin": pinyin,
            "definitions": defs,
        }

        if simplified not in cedict:
            cedict[simplified] = []
        cedict[simplified].append(entry)

    return cedict


def convert_pinyin(pinyin_numbered: str) -> str:
    """Convert CC-CEDICT numbered pinyin (pin1) to tone-marked pinyin (pīn)."""
    tone_map = {
        "a": ["ā", "á", "ǎ", "à", "a"],
        "e": ["ē", "é", "ě", "è", "e"],
        "i": ["ī", "í", "ǐ", "ì", "i"],
        "o": ["ō", "ó", "ǒ", "ò", "o"],
        "u": ["ū", "ú", "ǔ", "ù", "u"],
        "ü": ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
    }
    vowel_order = ["a", "e", "ou", "o", "i", "u", "ü"]

    def add_tone(syllable: str, tone: int) -> str:
        # Find the vowel to mark (priority: a > e > o > i/u last one if both)
        for priority in ["a", "e", "o"]:
            if priority in syllable:
                return syllable.replace(priority, tone_map[priority][tone - 1], 1)
        # Handle iu and ui — mark the last vowel
        if "ou" in syllable:
            return syllable.replace("ou", f"o{tone_map['u'][tone-1]}", 1)
        if "iu" in syllable:
            return syllable.replace("iu", f"i{tone_map['u'][tone-1]}", 1)
        if "ui" in syllable:
            return syllable.replace("ui", f"u{tone_map['i'][tone-1]}", 1)
        # Single vowel
        for v in ["i", "u", "ü"]:
            if v in syllable:
                return syllable.replace(v, tone_map[v][tone - 1], 1)
        return syllable

    result_parts = []
    for syllable in pinyin_numbered.lower().split():
        syllable = syllable.replace("u:", "ü").replace("v", "ü")
        tone_match = re.search(r"[1-5]$", syllable)
        if tone_match:
            tone = int(tone_match.group())
            syllable_base = syllable[:-1]
            if tone in (1, 2, 3, 4):
                result_parts.append(add_tone(syllable_base, tone))
            else:
                result_parts.append(syllable_base)  # neutral tone
        else:
            result_parts.append(syllable)

    return " ".join(result_parts)


def lookup_word(cedict: dict, word: str) -> dict | None:
    """Look up a word in CC-CEDICT."""
    entries = cedict.get(word)
    if not entries:
        return None
    entry = entries[0]  # Take primary entry
    # Filter out entries that are just names or measurements
    defs = [d for d in entry["definitions"] if not d.startswith("surname")]
    if not defs:
        defs = entry["definitions"]
    return {**entry, "definitions": defs}


def load_topic_file(filepath: Path) -> list:
    if filepath.exists():
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_topic_file(filepath: Path, cards: list) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Add verified Chinese vocabulary from CC-CEDICT")
    parser.add_argument("--words", help="Comma-separated Chinese words (simplified)")
    parser.add_argument("--topic", help="Topic/category name")
    parser.add_argument("--download", action="store_true", help="Download/update CC-CEDICT and exit")
    args = parser.parse_args()

    if args.download:
        download_cedict()
        return

    if not args.words or not args.topic:
        print("Error: --words and --topic are required", file=sys.stderr)
        sys.exit(1)

    topic_file = CHINESE_VOCAB_DIR / f"{args.topic}.json"
    existing_cards = load_topic_file(topic_file)
    existing_words = {card["simplified"] for card in existing_cards}
    index = load_index()
    start_index = len(existing_cards) + 1

    print(f"\n📖 Loading CC-CEDICT...")
    cedict = load_cedict()
    print(f"   Loaded {len(cedict)} entries\n")

    words = [w.strip() for w in args.words.split(",") if w.strip()]
    print(f"🔍 Looking up {len(words)} word(s)...\n")

    new_cards = []
    for i, word in enumerate(words):
        if word in existing_words:
            print(f"  ⏭️  '{word}' already exists, skipping")
            continue

        if normalize_key(word) in index:
            print(f"  ⏭️  '{word}' already in index, skipping")
            continue

        entry = lookup_word(cedict, word)
        if entry:
            card_id = f"zh_{args.topic}_{start_index + i:03d}"
            card = {
                "id": card_id,
                "simplified": entry["simplified"],
                "traditional": entry["traditional"],
                "pinyin": entry["pinyin"],
                "translation": entry["definitions"][0],
                "example": "",
                "example_pinyin": "",
                "example_translation": "",
                "tags": [args.topic],
                "source": "cc-cedict",
                "verified": True,
            }
            if len(entry["definitions"]) > 1:
                card["alt_definitions"] = entry["definitions"][1:3]

            new_cards.append(card)
            update_index(index, entry["simplified"], args.topic, card_id)
            print(f"  ✅ {entry['simplified']} ({entry['traditional']}) [{entry['pinyin']}] → {entry['definitions'][0]}")
        else:
            print(f"  ❌ '{word}' not found in CC-CEDICT")

    if new_cards:
        all_cards = existing_cards + new_cards
        save_topic_file(topic_file, all_cards)
        print(f"\n✨ Added {len(new_cards)} card(s) to {topic_file}")
        print(f"   Total cards in {args.topic}: {len(all_cards)}")
    else:
        print("\n   No new cards added.")


if __name__ == "__main__":
    main()
