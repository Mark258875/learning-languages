# 🌍 Learning Languages

A personal language learning repository combining structured content with an interactive UI.

**Languages:** 🇫🇷 French · 🇷🇺 Russian · 🇨🇳 Chinese (Mandarin)

---

## 🗂️ Repository Structure

```
/
├── french/          # French — grammar, vocab, phrases
├── russian/         # Russian — Azbuka, grammar, vocab, phrases
├── chinese/         # Chinese — Pinyin, tones, radicals, vocab, phrases
├── progress/        # SRS progress JSON files (synced via git)
├── scripts/         # Python tools to fetch verified vocabulary from APIs
└── app/             # React + Vite learning UI
```

---

## 🚀 Running the App

```bash
cd app
npm install
npm run dev
# Open http://localhost:5173
```

### Deploy to GitHub Pages
```bash
cd app
npm run build
npm run deploy
```

---

## 📚 Adding Vocabulary

Use the Python scripts to fetch verified words from free dictionary APIs:

```bash
# French or Russian (Wiktionary API)
python scripts/add_vocab.py --lang french --words "pomme,chat,maison,bonjour" --topic food

# Russian
python scripts/add_vocab.py --lang russian --words "яблоко,дом,кошка" --topic basics

# Chinese (uses local CC-CEDICT dataset)
python scripts/add_chinese.py --words "苹果,猫,家" --topic basics

# Export all cards to an Anki deck (.apkg)
python scripts/export_anki.py --lang french --output exports/french.apkg
```

---

## 🧠 Learning Methods

| Method | How it works |
|--------|-------------|
| **Spaced Repetition (SM-2)** | Cards are scheduled at increasing intervals (1→3→7→14→30 days) |
| **Active Recall** | See the word, recall meaning before flipping |
| **Context Sentences** | Every card includes an example sentence |
| **Alphabet Modules** | Russian Azbuka and Chinese Pinyin with mnemonics |
| **Quiz Modes** | Multiple choice, fill-in-the-blank, typing practice |

---

## 🗃️ Content Structure

### Vocabulary Card Format (French/Russian)
```json
{
  "id": "fr_food_001",
  "word": "pomme",
  "translation": "apple",
  "pronunciation": "/pɔm/",
  "example": "Je mange une pomme.",
  "example_translation": "I am eating an apple.",
  "tags": ["food", "noun"],
  "gender": "feminine",
  "source": "wiktionary",
  "verified": true
}
```

### Vocabulary Card Format (Chinese)
```json
{
  "id": "zh_food_001",
  "simplified": "苹果",
  "traditional": "蘋果",
  "pinyin": "píngguǒ",
  "translation": "apple",
  "example": "我吃苹果。",
  "example_pinyin": "Wǒ chī píngguǒ.",
  "example_translation": "I eat an apple.",
  "radical": "艹",
  "tags": ["food", "noun"],
  "source": "cc-cedict",
  "verified": true
}
```

---

## 📈 Progress Tracking

Progress is stored in `progress/<lang>.json` and committed to git so it syncs across devices. Each vocabulary card tracks:
- **Ease factor** — how easy the card is for you
- **Interval** — days until next review
- **Due date** — when to review next
- **Streak** — consecutive days studied

---

## 📖 Theory Files

Each language has theory documentation in Markdown:

| File | Content |
|------|---------|
| `*/theory/grammar.md` | Core grammar rules |
| `*/theory/pronunciation.md` | Sound system, tricky sounds |
| `*/theory/verbs.md` | Verb forms and conjugation tables |
| `russian/theory/azbuka.md` | Cyrillic alphabet guide |
| `russian/theory/cases.md` | The 6 Russian cases |
| `chinese/theory/pinyin.md` | Complete Pinyin system |
| `chinese/theory/tones.md` | The 4 tones + neutral tone |
| `chinese/theory/radicals.md` | Common character radicals |

---

## 🔗 Dictionary APIs Used

- **Wiktionary API** — `https://en.wiktionary.org/w/api.php` (French, Russian — free, no key)
- **CC-CEDICT** — Free Chinese-English dictionary dataset (offline)

---

## 📓 Journal

See `journal.md` for personal learning notes, reflections, and progress tracking.
