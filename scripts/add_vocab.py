#!/usr/bin/env python3
"""
add_vocab.py — Fetch and add verified vocabulary from Wiktionary API.

Usage:
    python scripts/add_vocab.py --lang french --words "pomme,chat,maison" --topic food
    python scripts/add_vocab.py --lang russian --words "яблоко,дом,кошка" --topic basics
    python scripts/add_vocab.py --lang french --file wordlist.txt --topic travel
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).parent.parent

ARTICLE_RE = re.compile(
    r"^(le |la |les |l'|l\u2019|un |une |des )",
    re.IGNORECASE,
)


def normalize_key(word: str) -> str:
    """Lowercase + strip articles for dedup index key."""
    w = word.lower().strip()
    w = ARTICLE_RE.sub("", w)
    return w.strip()


def load_index(lang: str) -> dict:
    path = REPO_ROOT / lang / "words_index.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def update_index(lang: str, index: dict, word: str, topic: str, word_id: str):
    key = normalize_key(word)
    if key:
        index[key] = f"{topic}:{word_id}"
    path = REPO_ROOT / lang / "words_index.json"
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

LANG_CONFIG = {
    "french": {
        "wiktionary_section": "French",
        "prefix": "fr",
        "dir": REPO_ROOT / "french" / "vocabulary" / "topics",
    },
    "russian": {
        "wiktionary_section": "Russian",
        "prefix": "ru",
        "dir": REPO_ROOT / "russian" / "vocabulary" / "topics",
    },
}

WIKTIONARY_API = "https://en.wiktionary.org/w/api.php"


def fetch_wiktionary(word: str, lang_section: str) -> dict | None:
    """Fetch word data from the English Wiktionary API."""
    params = {
        "action": "query",
        "titles": word,
        "prop": "revisions",
        "rvprop": "content",
        "format": "json",
        "rvslots": "main",
    }
    try:
        resp = requests.get(WIKTIONARY_API, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"  ⚠️  Network error for '{word}': {e}", file=sys.stderr)
        return None

    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()))
    if "missing" in page:
        print(f"  ⚠️  '{word}' not found on Wiktionary", file=sys.stderr)
        return None

    revisions = page.get("revisions", [])
    if not revisions:
        return None

    slots = revisions[0].get("slots", {})
    wikitext = slots.get("main", {}).get("*", "") or revisions[0].get("*", "")

    return parse_wiktionary_section(word, wikitext, lang_section)


def parse_wiktionary_section(word: str, wikitext: str, lang_section: str) -> dict | None:
    """Extract definition, IPA, and example from a language section of wikitext."""
    # Find the language section
    pattern = rf"=={lang_section}==(.+?)(?:==\w|$)"
    match = re.search(pattern, wikitext, re.DOTALL)
    if not match:
        print(f"  ⚠️  No {lang_section} section found for '{word}'", file=sys.stderr)
        return None

    section = match.group(1)

    # Extract IPA
    ipa_match = re.search(r"\{\{IPA\|[^|]*\|(/[^/]+/)", section)
    ipa = ipa_match.group(1) if ipa_match else ""

    # Extract definitions (lines starting with #, not #: or ##)
    definitions = re.findall(r"^# ([^#:\n][^\n]*)", section, re.MULTILINE)
    # Clean wiki markup
    definitions = [re.sub(r"\{\{[^}]+\}\}", "", d).strip() for d in definitions]
    definitions = [re.sub(r"\[\[(?:[^|\]]+\|)?([^\]]+)\]\]", r"\1", d) for d in definitions]
    definitions = [re.sub(r"'''?([^']+)'''?", r"\1", d).strip() for d in definitions]
    definitions = [d for d in definitions if d]

    # Extract example sentences
    examples = re.findall(r"^#: ?\{\{[^}]*ux\|[^|]*\|([^|]+)", section, re.MULTILINE)
    if not examples:
        examples = re.findall(r"^#: ''([^']+)''", section, re.MULTILINE)

    # Determine gender from section
    gender = ""
    if "{{fr-noun|m" in section or "{{head|fr|noun|g=m" in section:
        gender = "masculine"
    elif "{{fr-noun|f" in section or "{{head|fr|noun|g=f" in section:
        gender = "feminine"

    return {
        "word": word,
        "translation": definitions[0] if definitions else "",
        "pronunciation": ipa,
        "example": examples[0] if examples else "",
        "example_translation": "",
        "gender": gender,
        "all_definitions": definitions[:3],
        "source": "wiktionary",
        "verified": True,
    }


def load_topic_file(filepath: Path) -> list:
    if filepath.exists():
        with open(filepath, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_topic_file(filepath: Path, cards: list) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)


def generate_id(prefix: str, topic: str, index: int) -> str:
    return f"{prefix}_{topic}_{index:03d}"


def main():
    parser = argparse.ArgumentParser(description="Add verified vocabulary from Wiktionary")
    parser.add_argument("--lang", required=True, choices=list(LANG_CONFIG.keys()), help="Target language")
    parser.add_argument("--words", help="Comma-separated list of words to look up")
    parser.add_argument("--file", help="Text file with one word per line")
    parser.add_argument("--topic", required=True, help="Topic/category name (e.g. food, travel)")
    args = parser.parse_args()

    config = LANG_CONFIG[args.lang]
    lang_section = config["wiktionary_section"]
    prefix = config["prefix"]
    topic_dir = config["dir"]
    topic_file = topic_dir / f"{args.topic}.json"

    # Gather words
    words = []
    if args.words:
        words = [w.strip() for w in args.words.split(",") if w.strip()]
    elif args.file:
        with open(args.file, encoding="utf-8") as f:
            words = [line.strip() for line in f if line.strip()]
    else:
        print("Error: provide --words or --file", file=sys.stderr)
        sys.exit(1)

    # Load existing cards + dedup index
    existing_cards = load_topic_file(topic_file)
    existing_words = {card["word"] for card in existing_cards}
    index = load_index(args.lang)
    start_index = len(existing_cards) + 1

    print(f"\n🔍 Looking up {len(words)} word(s) in {lang_section} (Wiktionary)...\n")

    new_cards = []
    for i, word in enumerate(words):
        if word in existing_words:
            print(f"  ⏭️  '{word}' already exists, skipping")
            continue

        norm = normalize_key(word)
        if norm in index:
            print(f"  ⏭️  '{word}' already in index (as '{norm}'), skipping")
            continue

        print(f"  📖 Fetching '{word}'...")
        data = fetch_wiktionary(word, lang_section)

        if data:
            card_id = generate_id(prefix, args.topic, start_index + i)
            card = {
                "id": card_id,
                "word": data["word"],
                "translation": data["translation"],
                "pronunciation": data["pronunciation"],
                "example": data["example"],
                "example_translation": data["example_translation"],
                "tags": [args.topic],
                "source": "wiktionary",
                "verified": True,
            }
            if data.get("gender"):
                card["gender"] = data["gender"]

            new_cards.append(card)
            update_index(args.lang, index, data["word"], args.topic, card_id)
            print(f"  ✅ '{word}' → '{data['translation']}' ({data['pronunciation']})")
        else:
            print(f"  ❌ Could not fetch '{word}' — add manually")

        time.sleep(0.5)  # Be polite to Wiktionary

    if new_cards:
        all_cards = existing_cards + new_cards
        save_topic_file(topic_file, all_cards)
        print(f"\n✨ Added {len(new_cards)} card(s) to {topic_file}")
        print(f"   Total cards in {args.topic}: {len(all_cards)}")
    else:
        print("\n   No new cards added.")


if __name__ == "__main__":
    main()
