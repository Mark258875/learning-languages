#!/usr/bin/env python3
"""
generate_examples.py — Generate example sentences for vocabulary entries that lack them.

Scans all vocabulary JSON files for a language and finds entries missing the
"example" field, then uses GitHub Models (gpt-4o-mini) to generate contextual
example sentences with translations.

Requirements:
    pip install requests

Setup:
    export GITHUB_TOKEN=$(gh auth token)

Usage:
    python scripts/generate_examples.py                  # all languages
    python scripts/generate_examples.py --lang french    # one language
    python scripts/generate_examples.py --batch 20       # limit per language
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).parent.parent
GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
LANGUAGES = ["french", "russian", "chinese"]
DEFAULT_BATCH_SIZE = 20


def load_json(path: Path) -> list | dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return []


def save_json(path: Path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def call_github_models(token: str, system_prompt: str, user_prompt: str) -> str:
    headers = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 4000,
        "temperature": 0.7,
    }
    try:
        resp = requests.post(
            GITHUB_MODELS_URL, headers=headers, json=payload, timeout=120
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"❌ API call failed: {e}", file=sys.stderr)
        sys.exit(1)
    return resp.json()["choices"][0]["message"]["content"]


def find_entries_without_examples(lang: str) -> list[tuple[Path, int, dict]]:
    """Return list of (file_path, index_in_file, entry) for entries missing examples."""
    topics_dir = REPO_ROOT / lang / "vocabulary" / "topics"
    results = []
    if not topics_dir.exists():
        return results

    for json_file in sorted(topics_dir.glob("*.json")):
        try:
            entries = json.loads(json_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(entries, list):
            continue
        for idx, entry in enumerate(entries):
            if not entry.get("example"):
                results.append((json_file, idx, entry))

    return results


def build_example_prompt(lang: str, entries: list[dict]) -> tuple[str, str]:
    """Build a prompt to generate example sentences for a batch of words."""
    lang_name = lang.capitalize()

    system = (
        f"You are a {lang_name} language tutor creating example sentences for vocabulary flashcards. "
        f"Generate natural, useful example sentences in {lang_name} at an A2-B1 level. "
        "Each sentence should demonstrate the word's meaning in context. "
        "Also provide an English translation of each sentence. "
        "Return ONLY a JSON array where each element has: "
        '"id" (the word\'s id), "example" (sentence in target language), '
        '"example_translation" (English translation of the sentence).'
    )

    if lang == "chinese":
        system += (
            ' For Chinese, also include "example_pinyin" (pinyin of the example sentence).'
        )

    word_lines = []
    for entry in entries:
        word = entry.get("word") or entry.get("simplified") or "?"
        translation = entry.get("translation", "")
        pinyin = entry.get("pinyin", "")
        word_id = entry.get("id", "")
        extra = f" [{pinyin}]" if pinyin else ""
        word_lines.append(f'  - id: "{word_id}", word: "{word}"{extra}, meaning: "{translation}"')

    user = (
        f"Generate one example sentence for each of these {lang_name} words:\n\n"
        + "\n".join(word_lines)
        + "\n\nReturn a JSON array. No markdown fences, no extra text."
    )
    return system, user


def main():
    parser = argparse.ArgumentParser(
        description="Generate example sentences for words missing them"
    )
    parser.add_argument(
        "--lang",
        choices=LANGUAGES,
        help="Only process this language (default: all)",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Max words to process per language (default: {DEFAULT_BATCH_SIZE})",
    )
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        print("❌ GITHUB_TOKEN not set. Run:", file=sys.stderr)
        print("   export GITHUB_TOKEN=$(gh auth token)", file=sys.stderr)
        sys.exit(1)

    langs = [args.lang] if args.lang else LANGUAGES
    total_generated = 0

    for lang in langs:
        print(f"\n🔍 Scanning {lang} for entries without examples...")
        missing = find_entries_without_examples(lang)

        if not missing:
            print(f"  ✅ All entries in {lang} already have examples!")
            continue

        print(f"  📝 Found {len(missing)} entries without examples")

        # Batch the entries
        batch = missing[: args.batch]
        entries_to_process = [entry for _, _, entry in batch]

        print(f"  🤖 Generating examples for {len(batch)} words...")
        system, user = build_example_prompt(lang, entries_to_process)
        raw = call_github_models(token, system, user)

        # Strip accidental markdown fences
        raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
        raw = re.sub(r"\n?```$", "", raw.strip())

        try:
            generated: list = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"  ❌ LLM returned invalid JSON: {e}", file=sys.stderr)
            print(f"     Raw output: {raw[:600]}", file=sys.stderr)
            continue

        if not isinstance(generated, list):
            print("  ❌ Expected a JSON array from LLM", file=sys.stderr)
            continue

        # Build a map from id → generated example
        examples_by_id = {}
        for item in generated:
            if isinstance(item, dict) and "id" in item and "example" in item:
                examples_by_id[item["id"]] = item

        # Apply generated examples back to the files
        files_modified = set()
        count = 0
        for file_path, idx, entry in batch:
            word_id = entry.get("id", "")
            if word_id not in examples_by_id:
                continue

            gen = examples_by_id[word_id]

            # Load the file, find the entry by ID (not index — file may have changed)
            all_entries = load_json(file_path)
            target_idx = None
            for i, e in enumerate(all_entries):
                if e.get("id") == word_id:
                    target_idx = i
                    break

            if target_idx is not None:
                all_entries[target_idx]["example"] = gen["example"]
                all_entries[target_idx]["example_translation"] = gen.get(
                    "example_translation", ""
                )
                if lang == "chinese" and gen.get("example_pinyin"):
                    all_entries[target_idx]["example_pinyin"] = gen["example_pinyin"]
                save_json(file_path, all_entries)
                files_modified.add(file_path)
                count += 1

        total_generated += count
        print(f"  ✅ Added examples to {count} entries across {len(files_modified)} file(s)")

    if total_generated > 0:
        print(f"\n🎉 Done — generated {total_generated} example sentence(s) total")
    else:
        print("\n✅ Nothing to do — all entries already have examples.")

    return total_generated


if __name__ == "__main__":
    total = main()
    # Exit with code 0 regardless — callers check output or git status
