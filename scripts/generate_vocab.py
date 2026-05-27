#!/usr/bin/env python3
"""
generate_vocab.py — Generate vocabulary using GitHub Models (gpt-4o-mini, free tier).

Reads meta.json for learner context and words_index.json for deduplication,
calls the GitHub Models API, validates the JSON output, then saves deduplicated
results to the appropriate topic file.

Requirements:
    pip install requests

Setup:
    export GITHUB_TOKEN=$(gh auth token)

Usage:
    python scripts/generate_vocab.py --lang french --topic travel --count 20
    python scripts/generate_vocab.py --lang russian --topic greetings --count 15
    python scripts/generate_vocab.py --lang chinese --topic food --count 10
    python scripts/generate_vocab.py --lang french --topic emotions --count 20 --model gpt-4o
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


def load_index(lang: str) -> dict:
    path = REPO_ROOT / lang / "words_index.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_index(lang: str, index: dict):
    path = REPO_ROOT / lang / "words_index.json"
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def load_meta(lang: str) -> dict:
    path = REPO_ROOT / lang / "meta.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"cefr_level": "A1", "topics_covered": [], "total_words": 0, "learner_notes": ""}


def save_meta(lang: str, meta: dict):
    path = REPO_ROOT / lang / "meta.json"
    meta["last_updated"] = str(date.today())
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Prompts & Schemas
# ---------------------------------------------------------------------------

SYSTEM_PROMPTS = {
    "french": (
        "You are a French language teacher creating vocabulary flashcards for a Slovak native speaker "
        "who studied French for 6 years but has had a 2-year gap. They are targeting B1 level. "
        "Generate vocabulary in JSON format ONLY — no prose, no markdown fences, no explanation."
    ),
    "russian": (
        "You are a Russian language teacher creating vocabulary flashcards for a Slovak native speaker "
        "who is a beginner in Russian (A1). They know the Cyrillic alphabet. "
        "Slovak-Russian cognates are helpful — highlight them in learner_note where relevant. "
        "Generate vocabulary in JSON format ONLY — no prose, no markdown fences, no explanation."
    ),
    "chinese": (
        "You are a Mandarin Chinese language teacher creating vocabulary flashcards for a Slovak native "
        "speaker who is a complete beginner in Chinese (A1). "
        "Include memory tips or mnemonics in learner_note where helpful. "
        "Generate vocabulary in JSON format ONLY — no prose, no markdown fences, no explanation."
    ),
}

SCHEMAS = {
    "french": """\
[
  {
    "id": "fr_TOPIC_NNN",
    "word": "<French word — include article for nouns, e.g. 'la maison'>",
    "translation": "<English translation>",
    "pronunciation": "<IPA, e.g. /mɛ.zɔ̃/>",
    "example": "<short example sentence in French>",
    "example_translation": "<English translation of example>",
    "tags": ["TOPIC", "<noun|verb|adjective|adverb|phrase>"],
    "gender": "<masculine|feminine|null>",
    "learner_note": "<optional: cognate hint, usage note, or null>",
    "source": "github_models",
    "verified": true
  }
]""",
    "russian": """\
[
  {
    "id": "ru_TOPIC_NNN",
    "word": "<Russian word in Cyrillic>",
    "translation": "<English translation>",
    "pronunciation": "<romanized transliteration>",
    "example": "<short example sentence in Cyrillic>",
    "example_translation": "<English translation of example>",
    "tags": ["TOPIC", "<noun|verb|adjective|adverb|phrase>"],
    "learner_note": "<optional: Slovak cognate, false friend, or null>",
    "source": "github_models",
    "verified": true
  }
]""",
    "chinese": """\
[
  {
    "id": "zh_TOPIC_NNN",
    "simplified": "<Simplified Chinese characters>",
    "traditional": "<Traditional Chinese characters>",
    "pinyin": "<pinyin with tone marks, e.g. 'nǐ hǎo'>",
    "translation": "<English translation>",
    "example": "<short example sentence in Simplified Chinese>",
    "example_pinyin": "<pinyin of example>",
    "example_translation": "<English translation of example>",
    "tags": ["TOPIC"],
    "learner_note": "<optional: mnemonic, visual tip, or null>",
    "source": "github_models",
    "verified": true
  }
]""",
}


def call_github_models(token: str, system_prompt: str, user_prompt: str, model: str) -> str:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 3500,
        "temperature": 0.4,
    }
    try:
        resp = requests.post(GITHUB_MODELS_URL, headers=headers, json=payload, timeout=90)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"❌ API call failed: {e}", file=sys.stderr)
        sys.exit(1)
    return resp.json()["choices"][0]["message"]["content"]


def find_next_id_num(existing: list, lang: str, topic: str) -> int:
    prefix = PREFIXES[lang]
    max_num = 0
    for e in existing:
        m = re.search(rf"{prefix}_{re.escape(topic)}_(\d+)$", e.get("id", ""))
        if m:
            max_num = max(max_num, int(m.group(1)))
    return max_num + 1


def main():
    parser = argparse.ArgumentParser(description="Generate vocabulary using GitHub Models")
    parser.add_argument("--lang", choices=LANGUAGES, required=True)
    parser.add_argument("--topic", required=True, help="Topic name, e.g. travel, food, emotions")
    parser.add_argument("--count", type=int, default=20, help="Number of words to generate")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="GitHub Models model ID")
    args = parser.parse_args()

    lang, topic, count = args.lang, args.topic, args.count

    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        print("❌ GITHUB_TOKEN not set. Run:", file=sys.stderr)
        print("   export GITHUB_TOKEN=$(gh auth token)", file=sys.stderr)
        sys.exit(1)

    index = load_index(lang)
    meta = load_meta(lang)

    topics_dir = REPO_ROOT / lang / "vocabulary" / "topics"
    topics_dir.mkdir(parents=True, exist_ok=True)
    topic_file = topics_dir / f"{topic}.json"

    existing_entries: list = []
    if topic_file.exists():
        try:
            existing_entries = json.loads(topic_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing_entries = []

    # Build exclusion list (cap at 300 words to keep prompt size sane)
    exclusions = list(index.keys())[:300]
    excl_str = ", ".join(exclusions) if exclusions else "none yet"

    cefr = meta.get("cefr_level", "A1")
    notes = meta.get("learner_notes", "")
    start_id = find_next_id_num(existing_entries, lang, topic)
    schema = SCHEMAS[lang].replace("TOPIC", topic).replace("NNN", f"{start_id:03d}")

    user_prompt = (
        f"Generate exactly {count} {lang} vocabulary words for the topic '{topic}' "
        f"at CEFR level {cefr}.\n"
        f"Learner profile: {notes}\n"
        f"IMPORTANT — do NOT include any of these already-known words: {excl_str}\n\n"
        f"Return a JSON array ONLY (no markdown fences, no explanation) using this schema:\n"
        f"{schema}\n\n"
        f"Use sequential IDs starting at {PREFIXES[lang]}_{topic}_{start_id:03d}."
    )

    print(f"🤖 Generating {count} '{topic}' words for {lang} via {args.model}...")
    raw = call_github_models(token, SYSTEM_PROMPTS[lang], user_prompt, args.model)

    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
    raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        new_entries = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"❌ LLM returned invalid JSON: {e}", file=sys.stderr)
        print(f"   Raw output (first 600 chars): {raw[:600]}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(new_entries, list):
        print("❌ Expected a JSON array from LLM", file=sys.stderr)
        sys.exit(1)

    # Dedup
    added = []
    skipped = 0
    for entry in new_entries:
        word = entry.get("word") or entry.get("simplified") or ""
        key = normalize(word)
        if not key:
            continue
        if key in index:
            skipped += 1
            continue
        added.append(entry)
        index[key] = f"{topic}:{entry.get('id', '')}"

    if not added:
        print(f"⚠️  All {len(new_entries)} generated words already exist in the index. Nothing added.")
        return

    # Save topic file
    combined = existing_entries + added
    topic_file.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")

    # Update index and meta
    save_index(lang, index)
    covered = meta.setdefault("topics_covered", [])
    if topic not in covered:
        covered.append(topic)
    meta["total_words"] = meta.get("total_words", 0) + len(added)
    save_meta(lang, meta)

    print(f"✅ Added {len(added)} words → {topic_file.relative_to(REPO_ROOT)}")
    if skipped:
        print(f"   ℹ️  Skipped {skipped} duplicates")
    print(f"   📊 Total {lang} words: {meta['total_words']}")


if __name__ == "__main__":
    main()
