import Fuse from 'fuse.js'

/**
 * Build a Fuse.js instance for fuzzy-searching a language's vocab cards.
 *
 * Keys searched:
 *   - French/Russian: word, translation
 *   - Chinese:        simplified, traditional, pinyin, translation
 *
 * threshold 0.35 → tolerates ~1-2 character edits (typos, transpositions).
 * ignoreLocation → match anywhere in the string, not just at the start.
 */
export function buildFuse(cards, lang) {
  const keys =
    lang === 'chinese'
      ? [
          { name: 'simplified', weight: 2 },
          { name: 'traditional', weight: 2 },
          { name: 'pinyin', weight: 1.5 },
          { name: 'translation', weight: 1 },
        ]
      : [
          { name: 'word', weight: 2 },
          { name: 'translation', weight: 1 },
        ]

  return new Fuse(cards, {
    keys,
    threshold: 0.35,
    distance: 200,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
}

/**
 * Detect whether a user query is in the target language or English.
 *
 * Returns 'target' when the query contains characters that belong to the
 * target language's script; otherwise returns 'english'.
 *
 * @param {string} query
 * @param {'french'|'russian'|'chinese'} targetLang
 * @returns {'target'|'english'}
 */
export function detectDirection(query, targetLang) {
  if (!query) return 'english'
  if (targetLang === 'russian' && /[а-яёА-ЯЁ]/.test(query)) return 'target'
  if (targetLang === 'chinese' && /[\u4e00-\u9fff\u3100-\u312f]/.test(query)) return 'target'
  // French: accented characters that are not common in English
  if (targetLang === 'french' && /[àâäéèêëîïôùûüçœæ]/i.test(query)) return 'target'
  return 'english'
}

/**
 * Score label for display — tells the user how confident the match is.
 * Fuse score: 0 = perfect match, 1 = no match.
 */
export function matchLabel(score) {
  if (score === undefined || score < 0.01) return null  // exact
  if (score < 0.2) return 'close match'
  return 'fuzzy match'
}
