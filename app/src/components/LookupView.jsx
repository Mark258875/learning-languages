import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { commitPendingWords } from '../utils/github.js'
import { VOCAB } from '../data/loader.js'
import { buildFuse, detectDirection } from '../utils/search.js'
import {
  WIKT_API,
  WIKT_LANG,
  parseWikitext,
  buildEntry,
  wiktionaryLookup as wiktLookup,
  fetchSuggestions as wiktSuggestions,
} from '../utils/wiktionary.js'

const OPENSEARCH_LIMIT = 5

// ---------------------------------------------------------------------------
// Result card — shows parsed Wiktionary data
// ---------------------------------------------------------------------------
function ResultCard({ word, parsed, lang, langMeta, onSave, alreadySaved }) {
  return (
    <div className={`rounded-xl border-2 ${langMeta.borderClass} bg-white dark:bg-gray-800 p-5 shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-2xl font-bold ${langMeta.accentClass}`}>{word}</p>
          {parsed.ipa && (
            <p className="text-gray-400 dark:text-gray-500 font-mono text-sm mt-0.5">{parsed.ipa}</p>
          )}
          {parsed.pinyin && !parsed.ipa && (
            <p className={`text-sm mt-0.5 ${langMeta.accentClass}`}>{parsed.pinyin}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-400 dark:text-gray-500 space-y-1">
          {parsed.pos && <span className="block uppercase tracking-wide">{parsed.pos}</span>}
          {parsed.gender && (
            <span className="block">{parsed.gender === 'masculine' ? '♂ masc.' : '♀ fem.'}</span>
          )}
        </div>
      </div>

      {parsed.definitions.length > 0 && (
        <ol className="mt-3 space-y-1">
          {parsed.definitions.map((def, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-200 text-sm">
              <span className="text-gray-400 dark:text-gray-500 mr-1">{i + 1}.</span> {def}
            </li>
          ))}
        </ol>
      )}

      {parsed.example && (
        <p className="mt-3 text-sm italic text-gray-500 dark:text-gray-400 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
          "{parsed.example}"
        </p>
      )}

      <div className="mt-4 flex gap-2 items-center">
        <button
          onClick={onSave}
          disabled={alreadySaved}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            alreadySaved
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
              : `${langMeta.bgClass} text-white hover:opacity-90`
          }`}
        >
          {alreadySaved ? '✓ Saved to pending' : '+ Save to pending'}
        </button>
        <a
          href={`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
        >
          Open in Wiktionary ↗
        </a>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending queue panel — with GitHub commit or JSON export
// ---------------------------------------------------------------------------
function PendingPanel({
  pending,
  lang,
  langMeta,
  onRemove,
  onExport,
  onClear,
  onCommit,
  onCommitToInbox,
  commitState,   // 'idle' | 'selectTopic' | 'committing' | 'success' | 'error'
  commitTopic,
  onTopicChange,
  onCommitConfirm,
  onCommitCancel,
  commitResult,
  commitError,
  hasToken,
  onSetupToken,
}) {
  if (pending.length === 0 && commitState !== 'success') return null

  const existingTopics = Object.keys(VOCAB[lang]?.topics ?? {})

  return (
    <div className="mt-6">
      {/* Success banner */}
      {commitState === 'success' && commitResult && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          <p className="font-semibold">✅ Committed {commitResult.added} word(s) to GitHub!</p>
          {commitResult.skipped > 0 && (
            <p className="text-xs mt-0.5">{commitResult.skipped} duplicate(s) skipped.</p>
          )}
          {commitResult.commitUrl && (
            <a
              href={commitResult.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline mt-1 block"
            >
              View commit ↗
            </a>
          )}
          <p className="text-xs mt-1 opacity-75">
            GitHub Pages will redeploy in ~1 min. Pending queue cleared.
          </p>
        </div>
      )}

      {pending.length === 0 ? null : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Pending words ({pending.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={onExport}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                ↓ Export JSON
              </button>
              <button
                onClick={onClear}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Word list */}
          <div className="space-y-2 mb-4">
            {pending.map((entry, i) => {
              const word = entry.word || entry.simplified || '?'
              return (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className={`font-medium ${langMeta.accentClass}`}>{word}</span>
                    {entry.translation && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">— {entry.translation}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 text-lg leading-none ml-2"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          {/* Commit to GitHub section */}
          {commitState === 'selectTopic' ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                Save {pending.length} word(s) to which topic?
              </p>
              <input
                type="text"
                value={commitTopic}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="e.g. travel, food, home…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && commitTopic.trim() && onCommitConfirm()}
              />
              <div className="flex flex-wrap gap-1 mb-3">
                {/* Pinned inbox topic — always shown first */}
                <button
                  key="other"
                  onClick={() => onTopicChange('other')}
                  title="Dump here for auto-sorting later"
                  className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                    commitTopic === 'other'
                      ? `${langMeta.bgClass} text-white border-transparent`
                      : 'border-dashed border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  📥 other
                </button>
                {existingTopics.filter((t) => t !== 'other').map((t) => (
                  <button
                    key={t}
                    onClick={() => onTopicChange(t)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                      commitTopic === t
                        ? `${langMeta.bgClass} text-white border-transparent`
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onCommitConfirm}
                  disabled={!commitTopic.trim()}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all ${langMeta.bgClass} disabled:opacity-40`}
                >
                  Commit to GitHub
                </button>
                <button
                  onClick={onCommitCancel}
                  className="px-4 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : commitState === 'committing' ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400 text-center animate-pulse">
              ⏳ Committing to GitHub…
            </div>
          ) : (
            <div className="space-y-2">
              {commitState === 'error' && commitError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                  ❌ {commitError}
                </div>
              )}
              {hasToken ? (
                <div className="flex gap-2">
                  <button
                    onClick={onCommit}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium text-white ${langMeta.bgClass} hover:opacity-90 transition-all`}
                  >
                    💾 Commit to GitHub
                  </button>
                  <button
                    onClick={onCommitToInbox}
                    title="Commit directly to 'other' inbox — auto-sorted by GitHub Actions"
                    className="px-3 py-2 rounded-xl text-sm border border-dashed border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                  >
                    📥
                  </button>
                </div>
              ) : (
                <button
                  onClick={onSetupToken}
                  className="w-full py-2 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-all"
                >
                  🔑 Set up GitHub token to commit directly
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Token settings panel
// ---------------------------------------------------------------------------
function TokenSettings({ token, onSave, onClose }) {
  const [value, setValue] = useState(token || '')
  return (
    <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">🔑 GitHub Token Setup</p>
        {token && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">×</button>
        )}
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
        Create a{' '}
        <a
          href="https://github.com/settings/tokens/new?scopes=repo&description=Learning+Languages+App"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Personal Access Token (classic) ↗
        </a>{' '}
        with <strong>repo</strong> scope. Stored only in your browser's localStorage.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ghp_…"
          className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none"
          autoFocus
        />
        <button
          onClick={() => onSave(value.trim())}
          disabled={!value.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LocalMatchCard — shows a single locally-stored vocab card matched by an
// English reverse lookup, with a button to look it up on Wiktionary.
// ---------------------------------------------------------------------------
function LocalMatchCard({ card, lang, langMeta, onLookup }) {
  const isChinese = lang === 'chinese'
  const primary = isChinese
    ? `${card.simplified}${card.traditional && card.traditional !== card.simplified ? ` (${card.traditional})` : ''}`
    : card.word
  const secondary = isChinese ? card.pinyin : card.pronunciation

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{primary}</p>
        {secondary && (
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{secondary}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.translation}</p>
      </div>
      <button
        onClick={onLookup}
        className={`shrink-0 text-xs px-2.5 py-1.5 rounded-md font-medium text-white ${langMeta.bgClass} hover:opacity-90 transition-opacity`}
      >
        🔍 Look up
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main LookupView component
// ---------------------------------------------------------------------------
export default function LookupView({ lang, langMeta }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [savedWord, setSavedWord] = useState(null)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)

  // Bidirectional state
  const [correctedWord, setCorrectedWord] = useState(null)
  const [localMatches, setLocalMatches] = useState(null)

  // GitHub token
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('ll_github_token') || '')
  const [showTokenSetup, setShowTokenSetup] = useState(false)

  // Commit flow state
  const [commitState, setCommitState] = useState('idle') // idle | selectTopic | committing | success | error
  const [commitTopic, setCommitTopic] = useState('')
  const [commitResult, setCommitResult] = useState(null)
  const [commitError, setCommitError] = useState(null)

  const storageKey = `ll_pending_${lang}`

  // Fuse.js index over all local vocab for bidirectional (English→target) search
  const localFuse = useMemo(() => buildFuse(VOCAB[lang]?.all ?? [], lang), [lang])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      setPending(stored ? JSON.parse(stored) : [])
    } catch {
      setPending([])
    }
    setResult(null)
    setError(null)
    setQuery('')
    setSavedWord(null)
    setCommitState('idle')
    setCommitResult(null)
    setSuggestions([])
    setShowDropdown(false)
    setCorrectedWord(null)
    setLocalMatches(null)
  }, [lang, storageKey])

  // Fetch Wiktionary opensearch suggestions (debounced, target-lang only)
  const fetchSuggestions = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q || q.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await wiktSuggestions(q, OPENSEARCH_LIMIT)
        setSuggestions(results.filter((s) => s.toLowerCase() !== q.toLowerCase()))
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [])

  // Wiktionary full-article lookup (wrapper around util for auto-correct retry)
  const wiktionaryLookup = useCallback(async (word) => {
    return wiktLookup(word, lang)
  }, [lang])

  const search = useCallback(async (wordOverride) => {
    const word = (wordOverride ?? query).trim()
    if (!word) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSavedWord(null)
    setCorrectedWord(null)
    setLocalMatches(null)
    setSuggestions([])
    setShowDropdown(false)

    // Bidirectional: English query → search local vocab translations
    const dir = detectDirection(word, lang)
    if (dir === 'english') {
      const matches = localFuse.search(word, { limit: 6 })
      setLocalMatches(matches.map((m) => m.item))
      setLoading(false)
      return
    }

    // Target-lang query → Wiktionary article lookup
    try {
      const parsed = await wiktionaryLookup(word)
      if (!parsed || !parsed.definition) {
        // Fallback: try top opensearch suggestion
        const osUrl = `${WIKT_API}?action=opensearch&search=${encodeURIComponent(word)}&limit=3&format=json&origin=*`
        const osr = await fetch(osUrl)
        const osd = await osr.json()
        const topSuggestion = (osd[1] ?? [])[0]
        if (topSuggestion && topSuggestion.toLowerCase() !== word.toLowerCase()) {
          try {
            const parsed2 = await wiktionaryLookup(topSuggestion)
            if (parsed2?.definition) {
              setCorrectedWord(topSuggestion)
              setResult({ word: topSuggestion, parsed: parsed2 })
            } else {
              setError(
                `No ${WIKT_LANG[lang]} entry found for "${word}". ` +
                  `Try the exact form (e.g. "maison", not "maisons").`
              )
            }
          } catch {
            setError(
              `No ${WIKT_LANG[lang]} entry found for "${word}". ` +
                `Try the exact form (e.g. "maison", not "maisons").`
            )
          }
        } else {
          setError(
            `No ${WIKT_LANG[lang]} entry found on Wiktionary for "${word}". ` +
              `Try the exact form (e.g. "maison", not "maisons").`
          )
        }
      } else {
        setResult({ word, parsed })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [query, lang, localFuse, wiktionaryLookup])

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    const dir = detectDirection(val, lang)
    if (dir === 'target') {
      fetchSuggestions(val)
      setShowDropdown(true)
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search()
    if (e.key === 'Escape') { setSuggestions([]); setShowDropdown(false) }
  }

  const selectSuggestion = (s) => {
    setQuery(s)
    setSuggestions([])
    setShowDropdown(false)
    search(s)
  }

  const savePending = useCallback(() => {
    if (!result) return
    const entry = buildEntry(result.word, result.parsed, lang)
    const updated = [...pending, entry]
    setPending(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setSavedWord(result.word)
  }, [result, pending, lang, storageKey])

  const removePending = (idx) => {
    const updated = pending.filter((_, i) => i !== idx)
    setPending(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const clearPending = () => {
    setPending([])
    localStorage.removeItem(storageKey)
    setCommitState('idle')
  }

  const exportPending = () => {
    const blob = new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pending_${lang}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveToken = (token) => {
    setGithubToken(token)
    localStorage.setItem('ll_github_token', token)
    setShowTokenSetup(false)
  }

  const handleCommitClick = () => {
    // Pre-fill topic from existing topics if only one exists
    const topics = Object.keys(VOCAB[lang]?.topics ?? {})
    setCommitTopic(topics.length === 1 ? topics[0] : '')
    setCommitState('selectTopic')
    setCommitError(null)
  }

  const handleCommitConfirm = async () => {
    const topic = commitTopic.trim()
    if (!topic) return
    setCommitState('committing')
    try {
      const res = await commitPendingWords(githubToken, lang, topic, pending)
      setCommitResult(res)
      setCommitState('success')
      setPending([])
      localStorage.removeItem(storageKey)
    } catch (e) {
      setCommitError(e.message)
      setCommitState('error')
    }
  }

  // Skip topic selector — commit directly to the "other" inbox for auto-sorting
  const handleCommitToInbox = async () => {
    setCommitTopic('other')
    setCommitState('committing')
    setCommitError(null)
    try {
      const res = await commitPendingWords(githubToken, lang, 'other', pending)
      setCommitResult(res)
      setCommitState('success')
      setPending([])
      localStorage.removeItem(storageKey)
    } catch (e) {
      setCommitError(e.message)
      setCommitState('error')
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h2 className={`text-xl font-bold ${langMeta.accentClass} mb-1`}>
        🔍 Word Lookup
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Look up a word via Wiktionary, save it to the pending queue, then commit to the repo.
      </p>

      {/* Token setup */}
      {showTokenSetup && (
        <TokenSettings
          token={githubToken}
          onSave={saveToken}
          onClose={() => setShowTokenSetup(false)}
        />
      )}

      {/* Search bar */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder={
              lang === 'chinese'
                ? 'Target characters (e.g. 苹果) or English translation'
                : lang === 'russian'
                ? 'Cyrillic word (e.g. дом) or English translation'
                : 'French word (e.g. maison) or English translation'
            }
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-1"
            autoFocus
          />
          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => search()}
          disabled={loading || !query.trim()}
          className={`px-5 py-2 rounded-lg font-medium text-white transition-all ${langMeta.bgClass} disabled:opacity-40`}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {/* Auto-correction notice */}
      {correctedWord && (
        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Showing results for <strong>{correctedWord}</strong> (auto-corrected)
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-5">
          <ResultCard
            word={result.word}
            parsed={result.parsed}
            lang={lang}
            langMeta={langMeta}
            onSave={savePending}
            alreadySaved={savedWord === result.word}
          />
        </div>
      )}

      {/* English → local vocab results (bidirectional) */}
      {localMatches !== null && (
        <div className="mt-5 space-y-3">
          {localMatches.length === 0 ? (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-sm text-gray-500 dark:text-gray-400">
              No saved words match <em>"{query}"</em>. Try typing the {WIKT_LANG[lang]} word directly.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">
                Matching saved words
              </p>
              {localMatches.map((card) => (
                <LocalMatchCard
                  key={card.id}
                  card={card}
                  lang={lang}
                  langMeta={langMeta}
                  onLookup={() => {
                    const w = card.word || card.simplified || ''
                    setQuery(w)
                    search(w)
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Pending queue */}
      <PendingPanel
        pending={pending}
        lang={lang}
        langMeta={langMeta}
        onRemove={removePending}
        onExport={exportPending}
        onClear={clearPending}
        onCommit={handleCommitClick}
        onCommitToInbox={handleCommitToInbox}
        commitState={commitState}
        commitTopic={commitTopic}
        onTopicChange={setCommitTopic}
        onCommitConfirm={handleCommitConfirm}
        onCommitCancel={() => setCommitState('idle')}
        commitResult={commitResult}
        commitError={commitError}
        hasToken={!!githubToken}
        onSetupToken={() => setShowTokenSetup(true)}
      />

      {/* Token management footer */}
      {!showTokenSetup && (
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setShowTokenSetup(true)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {githubToken ? '🔑 Change GitHub token' : '🔑 Set up GitHub token'}
          </button>
        </div>
      )}
    </div>
  )
}
