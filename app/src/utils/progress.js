/**
 * Progress persistence — read/write SRS progress JSON files.
 *
 * In the browser we use localStorage as a proxy, and provide
 * import/export helpers for syncing with the repo JSON files.
 */

const STORAGE_KEY = (lang) => `ll_progress_${lang}`

const DEFAULT_PROGRESS = (lang) => ({
  version: 1,
  language: lang,
  stats: { streak: 0, lastStudied: null, totalReviewed: 0, weeklyGoal: 50 },
  cards: {},
})

/** Load progress for a language from localStorage */
export function loadProgress(lang) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(lang))
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return DEFAULT_PROGRESS(lang)
}

/** Save progress for a language to localStorage */
export function saveProgress(lang, progress) {
  try {
    localStorage.setItem(STORAGE_KEY(lang), JSON.stringify(progress))
  } catch (_) {}
}

/** Update a single card's SRS state and persist */
export function updateCardProgress(lang, cardId, newState) {
  const progress = loadProgress(lang)
  progress.cards[cardId] = newState

  // Update stats
  const today = new Date().toISOString().split('T')[0]
  progress.stats.totalReviewed = (progress.stats.totalReviewed || 0) + 1
  if (progress.stats.lastStudied !== today) {
    const yesterday = (() => {
      const d = new Date(); d.setDate(d.getDate() - 1)
      return d.toISOString().split('T')[0]
    })()
    progress.stats.streak =
      progress.stats.lastStudied === yesterday
        ? (progress.stats.streak || 0) + 1
        : 1
    progress.stats.lastStudied = today
  }

  saveProgress(lang, progress)
  return progress
}

/** Export progress as a JSON string (for saving to progress/*.json) */
export function exportProgress(lang) {
  return JSON.stringify(loadProgress(lang), null, 2)
}

/**
 * Import progress from a JSON string (paste content of progress/*.json).
 * Returns true on success.
 */
export function importProgress(lang, jsonStr) {
  try {
    const data = JSON.parse(jsonStr)
    if (data.language !== lang) return false
    saveProgress(lang, data)
    return true
  } catch (_) {
    return false
  }
}

/** Get percent of cards reviewed at least once */
export function getCompletionPercent(progress, totalCards) {
  if (!totalCards) return 0
  const reviewed = Object.keys(progress?.cards ?? {}).length
  return Math.round((reviewed / totalCards) * 100)
}
