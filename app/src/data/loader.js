/**
 * Static data loader — imports all vocabulary JSON files and theory markdown.
 *
 * Vite's import.meta.glob eagerly imports all matching JSON files at build time.
 * Each entry becomes: { id, word/simplified, translation, ... }
 */

// --- Vocabulary ---

const frenchFiles = import.meta.glob(
  '../../french/vocabulary/topics/*.json', { eager: true }
)
const russianFiles = import.meta.glob(
  '../../russian/vocabulary/topics/*.json', { eager: true }
)
const chineseFiles = import.meta.glob(
  '../../chinese/vocabulary/topics/*.json', { eager: true }
)

const frenchPhrases = import.meta.glob(
  '../../french/phrases/*.json', { eager: true }
)
const russianPhrases = import.meta.glob(
  '../../russian/phrases/*.json', { eager: true }
)
const chinesePhrases = import.meta.glob(
  '../../chinese/phrases/*.json', { eager: true }
)

// Alphabet data
const azbukaData = import.meta.glob(
  '../../russian/theory/azbuka.json', { eager: true }
)
const pinyinTheory = import.meta.glob(
  '../../chinese/theory/pinyin.json', { eager: true }
)

function flattenGlob(globResult) {
  return Object.values(globResult).flatMap((mod) =>
    Array.isArray(mod.default) ? mod.default : []
  )
}

function topicsFromGlob(globResult) {
  // Returns { topicName: [...cards] }
  const result = {}
  for (const [path, mod] of Object.entries(globResult)) {
    const name = path.split('/').pop().replace('.json', '')
    result[name] = Array.isArray(mod.default) ? mod.default : []
  }
  return result
}

export const VOCAB = {
  french: {
    topics: topicsFromGlob(frenchFiles),
    all: flattenGlob(frenchFiles),
    phrases: flattenGlob(frenchPhrases),
  },
  russian: {
    topics: topicsFromGlob(russianFiles),
    all: flattenGlob(russianFiles),
    phrases: flattenGlob(russianPhrases),
  },
  chinese: {
    topics: topicsFromGlob(chineseFiles),
    all: flattenGlob(chineseFiles),
    phrases: flattenGlob(chinesePhrases),
  },
}

export const AZBUKA = flattenGlob(azbukaData)

// --- Theory markdown (raw strings) ---

const frenchTheory = import.meta.glob(
  '../../french/theory/*.md', { eager: true, query: '?raw', import: 'default' }
)
const russianTheory = import.meta.glob(
  '../../russian/theory/*.md', { eager: true, query: '?raw', import: 'default' }
)
const chineseTheory = import.meta.glob(
  '../../chinese/theory/*.md', { eager: true, query: '?raw', import: 'default' }
)

function theoryFromGlob(globResult) {
  const result = {}
  for (const [path, content] of Object.entries(globResult)) {
    const name = path.split('/').pop().replace('.md', '')
    result[name] = content
  }
  return result
}

export const THEORY = {
  french: theoryFromGlob(frenchTheory),
  russian: theoryFromGlob(russianTheory),
  chinese: theoryFromGlob(chineseTheory),
}

// --- Language metadata ---
export const LANGUAGES = [
  {
    id: 'french',
    label: 'French',
    flag: '🇫🇷',
    color: 'blue',
    accentClass: 'text-blue-600',
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-600',
    lightBgClass: 'bg-blue-50',
  },
  {
    id: 'russian',
    label: 'Russian',
    flag: '🇷🇺',
    color: 'red',
    accentClass: 'text-red-600',
    bgClass: 'bg-red-600',
    borderClass: 'border-red-600',
    lightBgClass: 'bg-red-50',
  },
  {
    id: 'chinese',
    label: 'Chinese',
    flag: '🇨🇳',
    color: 'amber',
    accentClass: 'text-amber-600',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-500',
    lightBgClass: 'bg-amber-50',
  },
]

export function getLang(id) {
  return LANGUAGES.find((l) => l.id === id)
}
