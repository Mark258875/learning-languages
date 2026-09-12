/**
 * Customizable Flashcard keyboard shortcuts — persisted like progress.js:
 * localStorage first, then synced to settings/keybindings.json on GitHub via
 * the same PAT (Lookup → GitHub token) so a remap follows you across devices.
 */

import { getRepoFile, putRepoFile } from './github.js'

const STORAGE_KEY = 'll_keybindings'
const SETTINGS_PATH = 'settings/keybindings.json'
const PUSH_DEBOUNCE_MS = 3000

/** Actions a key can be bound to, in the order they're shown in Settings. */
export const ACTIONS = [
  { id: 'flip', label: 'Flip card' },
  { id: 'again', label: 'Rate: Again' },
  { id: 'hard', label: 'Rate: Hard' },
  { id: 'good', label: 'Rate: Good' },
  { id: 'easy', label: 'Rate: Easy' },
]

export const DEFAULT_KEYS = { flip: 'f', again: '1', hard: '2', good: '3', easy: '4' }

// ponytail: one flat settings object, not per-language — "last write wins" by
// updatedAt is enough; no need for progress.js's per-card merge logic here.
let pushTimer = null
let remoteSha = null

function githubToken() {
  try { return localStorage.getItem('ll_github_token')?.trim() || '' } catch { return '' }
}

/** Human-readable form of a stored key, e.g. ' ' -> 'Space'. */
export function displayKey(key) {
  if (key === ' ') return 'Space'
  if (!key) return '—'
  return key.length === 1 ? key.toUpperCase() : key
}

/** Load the current keybindings from localStorage (defaults if never set). */
export function loadKeybindings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return { updatedAt: data.updatedAt ?? null, keys: { ...DEFAULT_KEYS, ...(data.keys || {}) } }
    }
  } catch { /* fall through to defaults */ }
  return { updatedAt: null, keys: DEFAULT_KEYS }
}

/** Save a new set of keybindings locally and schedule a GitHub sync. */
export function saveKeybindings(keys) {
  const data = { updatedAt: new Date().toISOString(), keys }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* ignore quota errors */ }
  schedulePush()
  return data
}

/**
 * Pull settings/keybindings.json from GitHub (if a token is set) and, if it's
 * newer than the local copy, adopt it. Safe with no token — no-op. Call once
 * on app load.
 */
export async function pullKeybindings() {
  const local = loadKeybindings()
  const token = githubToken()
  if (!token) return local
  try {
    const { content, sha } = await getRepoFile(token, SETTINGS_PATH)
    if (sha) remoteSha = sha
    if (!content) return local
    if ((content.updatedAt || '') > (local.updatedAt || '')) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content))
      return { updatedAt: content.updatedAt, keys: { ...DEFAULT_KEYS, ...content.keys } }
    }
    return local
  } catch {
    return local // offline / no repo access yet — keep local, retry next call
  }
}

function schedulePush() {
  const token = githubToken()
  if (!token) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => pushNow(token), PUSH_DEBOUNCE_MS)
}

async function pushNow(token) {
  const data = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })()
  if (!data) return
  try {
    const result = await putRepoFile(token, SETTINGS_PATH, data, remoteSha, 'Sync keybindings')
    remoteSha = result.content?.sha ?? remoteSha
  } catch {
    // Stale/missing sha — re-fetch, keep whichever write is newer, retry once.
    try {
      const fresh = await getRepoFile(token, SETTINGS_PATH)
      const winner = (fresh.content?.updatedAt || '') > (data.updatedAt || '') ? fresh.content : data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(winner))
      const result = await putRepoFile(token, SETTINGS_PATH, winner, fresh.sha, 'Sync keybindings')
      remoteSha = result.content?.sha ?? fresh.sha
    } catch { /* give up silently; the next remap reschedules a push */ }
  }
}
