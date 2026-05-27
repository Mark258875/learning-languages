/**
 * GitHub Contents API helpers for committing vocab files directly from the browser.
 *
 * Uses the authenticated PUT /repos/{owner}/{repo}/contents/{path} endpoint.
 * A GitHub Personal Access Token (PAT) with repo scope is required.
 * Store the token in localStorage under 'll_github_token'.
 */

const REPO_OWNER = 'Mark258875'
const REPO_NAME = 'learning-languages'
const BRANCH = 'main'
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`

/**
 * Encode a string (including Unicode/UTF-8) to base64 for the GitHub API.
 */
function encodeContent(str) {
  const bytes = new TextEncoder().encode(str)
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary)
}

/**
 * Decode base64 content from the GitHub API (handles UTF-8).
 */
function decodeContent(b64) {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Fetch a file from the repo. Returns { exists, content (parsed JSON), sha }.
 * content is null if file doesn't exist.
 */
export async function getRepoFile(token, path) {
  const res = await fetch(`${API_BASE}/contents/${path}?ref=${BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (res.status === 404) return { exists: false, content: null, sha: null }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${res.status}`)
  }
  const data = await res.json()
  const raw = decodeContent(data.content)
  return { exists: true, content: JSON.parse(raw), sha: data.sha }
}

/**
 * Create or update a file in the repo.
 * Pass sha=null to create a new file; pass the file's sha to update.
 */
export async function putRepoFile(token, path, jsonContent, sha, commitMessage) {
  const encoded = encodeContent(JSON.stringify(jsonContent, null, 2) + '\n')
  const body = { message: commitMessage, content: encoded, branch: BRANCH }
  if (sha) body.sha = sha

  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${res.status}`)
  }
  return await res.json()
}

/** Normalize word for dedup (mirrors Python normalize() in rebuild_index.py) */
export function normalizeWord(word) {
  return word
    .toLowerCase()
    .trim()
    .replace(/^(le |la |les |l'|l\u2019|un |une |des )/i, '')
    .trim()
}

/**
 * Commit pending words to the repo.
 *
 * @param {string} token  - GitHub PAT
 * @param {string} lang   - 'french' | 'russian' | 'chinese'
 * @param {string} topic  - topic slug, e.g. 'travel'
 * @param {Array}  words  - pending word objects to save
 * @returns {{ added: number, skipped: number, commitUrl: string }}
 */
export async function commitPendingWords(token, lang, topic, words) {
  const PREFIXES = { french: 'fr', russian: 'ru', chinese: 'zh' }
  const prefix = PREFIXES[lang]
  const topicPath = `${lang}/vocabulary/topics/${topic}.json`
  const indexPath = `${lang}/words_index.json`

  // Fetch both files in parallel
  const [topicFile, indexFile] = await Promise.all([
    getRepoFile(token, topicPath),
    getRepoFile(token, indexPath),
  ])

  const existing = topicFile.content ?? []
  const index = indexFile.content ?? {}

  // Find next ID number
  let maxNum = existing.length
  existing.forEach((e) => {
    const m = e.id?.match(/_(\d+)$/)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
  })
  let nextNum = maxNum + 1

  // Dedup + merge
  const added = []
  let skipped = 0
  for (const entry of words) {
    const word = entry.word || entry.simplified || ''
    const key = normalizeWord(word)
    if (!key || key in index) {
      skipped++
      continue
    }
    const id = `${prefix}_${topic}_${String(nextNum).padStart(3, '0')}`
    nextNum++
    const finalEntry = { ...entry, id, tags: entry.tags?.length ? entry.tags : [topic] }
    added.push(finalEntry)
    index[key] = `${topic}:${id}`
  }

  if (added.length === 0) {
    return { added: 0, skipped, commitUrl: null }
  }

  const updatedTopic = [...existing, ...added]
  const msg =
    `Add ${added.length} word(s) to ${lang}/${topic} via Lookup panel\n\n` +
    added.map((e) => `- ${e.word || e.simplified}`).join('\n') +
    '\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

  // Commit topic file first, then index
  const topicResult = await putRepoFile(token, topicPath, updatedTopic, topicFile.sha, msg)
  await putRepoFile(
    token,
    indexPath,
    index,
    indexFile.sha,
    `Update ${lang}/words_index.json after adding ${added.length} word(s) to ${topic}`
  )

  return {
    added: added.length,
    skipped,
    commitUrl: topicResult.commit?.html_url ?? null,
  }
}
