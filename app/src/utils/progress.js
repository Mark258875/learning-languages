/**
 * Progress persistence — read/write SRS progress JSON files.
 *
 * In the browser we use localStorage as a proxy, and sync it with
 * progress/<lang>.json in the repo via the GitHub Contents API (same PAT
 * the Lookup panel uses) so progress carries across devices.
 */

import { getRepoFile, putRepoFile } from './github.js'

const STORAGE_KEY = (lang) => `ll_progress_${lang}`
const PROGRESS_PATH = (lang) => `progress/${lang}.json`
const PUSH_DEBOUNCE_MS = 8000

// ponytail: module-level, in-memory only — one browser tab per session in
// practice, so no need to persist these across reloads.
const pushTimers = {}
const remoteSha = {}

function githubToken() {
  try { return localStorage.getItem('ll_github_token')?.trim() || '' } catch { return '' }
}

/** Merge two progress objects: per-card by lastReview (newest wins), stats from whichever is more recently studied. */
export function mergeProgress(a, b) {
  if (!a) return b
  if (!b) return a
  const cards = { ...a.cards, ...b.cards }
  for (const id of Object.keys(b.cards || {})) {
    const ca = a.cards?.[id]
    const cb = b.cards[id]
    if (ca && cb) cards[id] = (ca.lastReview || '') >= (cb.lastReview || '') ? ca : cb
  }
  const fresher = (a.stats?.lastStudied || '') >= (b.stats?.lastStudied || '') ? a : b
  return { ...fresher, cards }
}

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
  schedulePush(lang)
  return progress
}

/**
 * Pull progress/<lang>.json from GitHub (if a token is set) and merge it into
 * the local copy. Safe to call with no token configured — returns local
 * progress unchanged. Call when a language becomes active / on app load.
 */
export async function pullProgress(lang) {
  const local = loadProgress(lang)
  const token = githubToken()
  if (!token) return local
  try {
    const { content, sha } = await getRepoFile(token, PROGRESS_PATH(lang))
    if (sha) remoteSha[lang] = sha
    if (!content) return local
    const merged = mergeProgress(local, content)
    saveProgress(lang, merged)
    return merged
  } catch {
    return local // offline / no repo access yet — keep local, retry next call
  }
}

// ponytail: debounced per-change push (not a request queue) — a very fast
// reviewer produces a handful of commits per session, not one per card.
function schedulePush(lang) {
  const token = githubToken()
  if (!token) return
  clearTimeout(pushTimers[lang])
  pushTimers[lang] = setTimeout(() => pushNow(lang, token), PUSH_DEBOUNCE_MS)
}

async function pushNow(lang, token) {
  const progress = loadProgress(lang)
  const msg = `Sync ${lang} progress`
  try {
    const result = await putRepoFile(token, PROGRESS_PATH(lang), progress, remoteSha[lang] ?? null, msg)
    remoteSha[lang] = result.content?.sha ?? remoteSha[lang]
  } catch {
    // Sha missing/stale (no prior pull this session, or another device pushed
    // first) — re-fetch the current file, merge, and retry once. Refetching
    // is always a safe recovery step regardless of why the first PUT failed.
    try {
      const fresh = await getRepoFile(token, PROGRESS_PATH(lang))
      const merged = mergeProgress(progress, fresh.content)
      saveProgress(lang, merged)
      const result = await putRepoFile(token, PROGRESS_PATH(lang), merged, fresh.sha, msg)
      remoteSha[lang] = result.content?.sha ?? fresh.sha
    } catch { /* give up silently (e.g. bad token); the next change reschedules a push */ }
  }
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
