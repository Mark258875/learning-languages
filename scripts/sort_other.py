#!/usr/bin/env python3
"""
sort_other.py — Automatically categorise words from the "other" inbox topic.

Reads {lang}/vocabulary/topics/other.json, asks GitHub Models (gpt-4o-mini) to
assign each word to an appropriate topic, then moves words to the correct topic
files.  After sorting, other.json is cleared to [].

New topic files are created automatically if the LLM proposes a topic that does
not yet exist.

Requirements:
    pip install requests

Setup:
    export GITHUB_TOKEN=$(gh auth token)

Usage:
    python scripts/sort_other.py --lang french
    python scripts/sort_other.py --lang russian
    python scripts/sort_other.py --lang chinese
"""

import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).parent.parent
GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
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


def load_json(path: Path) -> list | dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return []


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_index(lang: str) -> dict:
    return load_json(REPO_ROOT / lang / "words_index.json") or {}


def save_index(lang: str, index: dict):
    save_json(REPO_ROOT / lang / "words_index.json", index)


def load_meta(lang: str) -> dict:
    path = REPO_ROOT / lang / "meta.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"cefr_level": "A1", "topics_covered": [], "total_words": 0, "learner_notes": ""}


def save_meta(lang: str, meta: dict):
    path = REPO_ROOT / lang / "meta.json"
    meta["last_updated"] = str(date.today())
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def get_existing_topics(lang: str) -> list[str]:
    topics_dir = REPO_ROOT / lang / "vocabulary" / "topics"
    if not topics_dir.exists():
        return []
    return [
        p.stem
        for p in topics_dir.glob("*.json")
        if p.stem != "other"
    ]


def find_next_id_num(entries: list, lang: str, topic: str) -> int:
    prefix = PREFIXES[lang]
    max_num = 0
    for e in entries:
        m = re.search(rf"{prefix}_{re.escape(topic)}_(\d+)$", e.get("id", ""))
        if m:
            max_num = max(max_num, int(m.group(1)))
    return max_num + 1


def call_github_models(token: str, system_prompt: str, user_prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 2000,
        "temperature": 0.2,
    }
    try:
        resp = requests.post(GITHUB_MODELS_URL, headers=headers, json=payload, timeout=90)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"❌ API call failed: {e}", file=sys.stderr)
        sys.exit(1)
    return resp.json()["choices"][0]["message"]["content"]


def build_categorisation_prompt(lang: str, words: list, existing_topics: list[str]) -> tuple[str, str]:
    system = (
        f"You are a vocabulary organiser for a {lang} language learning repository. "
        "Your job is to assign each word to the most fitting topic category. "
        "You may propose a new topic name if no existing topic fits — use lowercase snake_case. "
        "Return ONLY a JSON object mapping each word's id to a topic name. No prose, no markdown fences."
    )

    topics_list = ", ".join(existing_topics) if existing_topics else "none yet"

    word_lines = []
    for w in words:
        surface = w.get("word") or w.get("simplified") or w.get("pinyin", "?")
        translation = w.get("translation", "")
        tags = ", ".join(w.get("tags", []))
        word_lines.append(f'  "{w["id"]}": "{surface}" ({translation}) [tags: {tags}]')
    words_block = "\n".join(word_lines)

    user = (
        f"Existing topics: {topics_list}\n\n"
        f"Words to categorise:\n{words_block}\n\n"
        "Return a JSON object like:\n"
        '{"fr_other_001": "food", "fr_other_002": "travel", ...}\n\n'
        "Use one of the existing topics if it fits, otherwise propose a new lowercase snake_case name."
    )
    return system, user


def reassign_entry(entry: dict, lang: str, topic: str, new_num: int) -> dict:
    """Return a copy of the entry with its id updated to reflect the new topic."""
    new_entry = dict(entry)
    prefix = PREFIXES[lang]
    new_entry["id"] = f"{prefix}_{topic}_{new_num:03d}"
    # Refresh tags to include the new topic
    tags: list = list(new_entry.get("tags", []))
    if "other" in tags:
        tags.remove("other")
    if topic not in tags:
        tags.insert(0, topic)
    new_entry["tags"] = tags
    return new_entry


def main():
    parser = argparse.ArgumentParser(description="Sort words from other.json into proper topics")
    parser.add_argument("--lang", choices=LANGUAGES, required=True, help="Language to sort")
    args = parser.parse_args()
    lang = args.lang

    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        print("❌ GITHUB_TOKEN not set. Run:", file=sys.stderr)
        print("   export GITHUB_TOKEN=$(gh auth token)", file=sys.stderr)
        sys.exit(1)

    topics_dir = REPO_ROOT / lang / "vocabulary" / "topics"
    other_file = topics_dir / "other.json"

    if not other_file.exists():
        print(f"ℹ️  {other_file.relative_to(REPO_ROOT)} does not exist — nothing to sort.")
        return

    other_words: list = load_json(other_file)
    if not isinstance(other_words, list):
        other_words = []

    if not other_words:
        print(f"ℹ️  {other_file.relative_to(REPO_ROOT)} is empty — nothing to sort.")
        return

    print(f"📂 Found {len(other_words)} word(s) in {lang}/vocabulary/topics/other.json")

    existing_topics = get_existing_topics(lang)
    print(f"📋 Existing topics: {existing_topics or ['(none)']}")

    index = load_index(lang)
    meta = load_meta(lang)

    # Ask LLM to categorise
    system, user = build_categorisation_prompt(lang, other_words, existing_topics)
    print(f"🤖 Asking {DEFAULT_MODEL} to categorise words...")
    raw = call_github_models(token, system, user)

    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        assignments: dict = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"❌ LLM returned invalid JSON: {e}", file=sys.stderr)
        print(f"   Raw output: {raw[:600]}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(assignments, dict):
        print("❌ Expected a JSON object {word_id: topic} from LLM", file=sys.stderr)
        sys.exit(1)

    # Build a map of id → entry for quick lookup
    id_to_entry = {w["id"]: w for w in other_words if "id" in w}

    # Group words by their assigned topic
    by_topic: dict[str, list] = {}
    unassigned = []
    for word_id, topic in assignments.items():
        if word_id not in id_to_entry:
            print(f"⚠️  LLM assigned unknown id '{word_id}' — skipping")
            continue
        # Sanitise topic name
        topic = re.sub(r"[^a-z0-9_]", "_", topic.lower().strip()).strip("_")
        if not topic:
            unassigned.append(id_to_entry[word_id])
            continue
        by_topic.setdefault(topic, []).append(id_to_entry[word_id])

    # Entries not assigned by LLM stay in other
    assigned_ids = set(assignments.keys())
    for w in other_words:
        if w.get("id") not in assigned_ids:
            unassigned.append(w)

    print(f"\n📊 Assignment summary:")
    for topic, words in sorted(by_topic.items()):
        status = "existing" if topic in existing_topics else "NEW"
        print(f"   {topic} ({status}): {len(words)} word(s)")
    if unassigned:
        print(f"   other (not assigned): {len(unassigned)} word(s)")

    # Move words to topic files
    total_moved = 0
    topics_created = []
    for topic, entries in by_topic.items():
        topic_file = topics_dir / f"{topic}.json"
        existing_entries: list = load_json(topic_file) if topic_file.exists() else []
        if not isinstance(existing_entries, list):
            existing_entries = []

        is_new = not topic_file.exists() or not existing_entries
        if is_new and topic not in existing_topics:
            topics_created.append(topic)

        next_num = find_next_id_num(existing_entries, lang, topic)
        added = []
        skipped = 0

        for entry in entries:
            word = entry.get("word") or entry.get("simplified") or ""
            key = normalize(word)
            if key and key in index and not index[key].startswith("other:"):
                # Already exists in a real topic — skip
                skipped += 1
                continue
            new_entry = reassign_entry(entry, lang, topic, next_num)
            next_num += 1
            added.append(new_entry)
            index[key] = f"{topic}:{new_entry['id']}"

        if added:
            combined = existing_entries + added
            topics_dir.mkdir(parents=True, exist_ok=True)
            save_json(topic_file, combined)
            total_moved += len(added)
            print(f"   ✅ {topic}.json ← {len(added)} word(s)" + (f" (skipped {skipped} dupes)" if skipped else ""))

    # Clean up "other" entries from index
    for w in other_words:
        word = w.get("word") or w.get("simplified") or ""
        key = normalize(word)
        if key and index.get(key, "").startswith("other:"):
            del index[key]

    # Write remaining (unassigned) words back to other.json
    if unassigned:
        save_json(other_file, unassigned)
        print(f"\n⚠️  {len(unassigned)} word(s) could not be categorised — left in other.json")
    else:
        save_json(other_file, [])
        print(f"\n🗑️  other.json cleared (all words moved)")

    # Update index and meta
    save_index(lang, index)
    covered: list = meta.setdefault("topics_covered", [])
    for topic in list(by_topic.keys()) + topics_created:
        if topic not in covered and topic != "other":
            covered.append(topic)
    meta["total_words"] = meta.get("total_words", 0) + total_moved
    save_meta(lang, meta)

    print(f"\n✅ Done — moved {total_moved} word(s) across {len(by_topic)} topic(s)")
    if topics_created:
        print(f"   🆕 New topics created: {', '.join(topics_created)}")


if __name__ == "__main__":
    main()
