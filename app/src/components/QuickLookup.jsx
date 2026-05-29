import { useState, useEffect, useCallback, useRef } from 'react'
import {
  WIKT_LANG,
  wiktionaryLookup,
  buildEntry,
  fetchSuggestions,
} from '../utils/wiktionary.js'
import { externalLinks } from '../utils/lingea.js'

/**
 * QuickLookup — a compact modal dialog accessible from any page.
 *
 * Open with: the 🔍 button in the top nav, or press `/` / `Ctrl+K`.
 * Close with: Escape, backdrop click, or the × button.
 *
 * Features: Wiktionary lookup, autocomplete dropdown, auto-correct,
 * "Save to pending" button with confirmation.
 */
export default function QuickLookup({ lang, langMeta, onClose }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [correctedWord, setCorrectedWord] = useState(null)
  const [saved, setSaved] = useState(false)
  const [direction, setDirection] = useState('target')

  // Autocomplete
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)

  const inputRef = useRef(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape key closes the modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Pending count hint
  const storageKey = `ll_pending_${lang}`
  const pendingCount = (() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw).length : 0
    } catch {
      return 0
    }
  })()

  // ---- Autocomplete --------------------------------------------------------

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setSaved(false)
    if (val.length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await fetchSuggestions(val, 5)
          setSuggestions(results.filter((s) => s.toLowerCase() !== val.toLowerCase()))
          setShowDropdown(true)
        } catch {
          setSuggestions([])
        }
      }, 300)
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  const selectSuggestion = (s) => {
    setQuery(s)
    setSuggestions([])
    setShowDropdown(false)
    doSearch(s)
  }

  // ---- Search --------------------------------------------------------------

  const doSearch = useCallback(async (wordOverride, dir) => {
    const word = (wordOverride ?? query).trim()
    if (!word) return
    const searchDir = dir ?? direction

    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)
    setCorrectedWord(null)
    setSuggestions([])
    setShowDropdown(false)
    setDirection(searchDir)

    try {
      const parsed = await wiktionaryLookup(word, lang)
      if (!parsed || !parsed.definition) {
        // Try auto-correct via opensearch (multiple candidates)
        const topSuggestions = await fetchSuggestions(word, 5)
        let corrected = null
        for (const candidate of topSuggestions) {
          if (candidate.toLowerCase() === word.toLowerCase()) continue
          try {
            const parsed2 = await wiktionaryLookup(candidate, lang)
            if (parsed2?.definition) {
              corrected = { word: candidate, parsed: parsed2 }
              break
            }
          } catch {
            // ignore failed candidate and keep trying
          }
        }
        if (corrected) {
          setCorrectedWord(corrected.word)
          setResult(corrected)
        } else {
          setError(`No ${WIKT_LANG[lang]} entry found for "${word}".`)
        }
      } else {
        setResult({ word, parsed })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [query, lang, direction])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') doSearch()
    if (e.key === 'Escape') onClose()
  }

  // ---- Save to pending -----------------------------------------------------

  const saveToPending = () => {
    if (!result || saved) return
    const entry = buildEntry(result.word, result.parsed, lang)
    const storageKey = `ll_pending_${lang}`
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') }
      catch { return [] }
    })()
    localStorage.setItem(storageKey, JSON.stringify([...existing, entry]))
    setSaved(true)
  }

  // ---- Render --------------------------------------------------------------

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog */}
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className={`${langMeta.lightBgClass} dark:bg-gray-700 px-5 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-600 shrink-0`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{langMeta.flag}</span>
            <span className={`font-semibold text-sm ${langMeta.accentClass}`}>Quick Lookup</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">· {langMeta.label}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none transition-colors p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search row */}
        <div className="px-4 pt-3 pb-2 shrink-0 relative">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder={
                lang === 'chinese' ? 'Characters or English…'
                : lang === 'russian' ? 'Cyrillic word or English…'
                : 'French word or English…'
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 text-sm"
            />
            {/* Autocomplete dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Direction buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => doSearch(undefined, 'target')}
              disabled={loading || !query.trim()}
              className={`flex-1 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-all ${langMeta.bgClass} disabled:opacity-40`}
            >
              {loading && direction === 'target' ? '…' : `${langMeta.flag} Find from ${langMeta.label}`}
            </button>
            <button
              onClick={() => doSearch(undefined, 'english')}
              disabled={loading || !query.trim()}
              className="flex-1 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-all bg-blue-600 disabled:opacity-40 hover:bg-blue-700"
            >
              {loading && direction === 'english' ? '…' : '🇬🇧 Find from EN'}
            </button>
          </div>
          {correctedWord && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Showing results for <strong>{correctedWord}</strong> (auto-corrected)
            </p>
          )}
        </div>

        {/* Scrollable results area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm mb-3">
              {error}
            </div>
          )}

          {/* External links — shown when error or result exists */}
          {query.trim() && (error || result) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {externalLinks(query.trim(), lang, direction).map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {result && (
            <div className={`rounded-xl border-2 ${langMeta.borderClass} bg-white dark:bg-gray-750 dark:bg-gray-900/40 p-4`}>
              {/* Word + meta */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className={`text-xl font-bold ${langMeta.accentClass}`}>{result.word}</p>
                  {result.parsed.ipa && (
                    <p className="text-gray-400 dark:text-gray-500 font-mono text-xs mt-0.5">{result.parsed.ipa}</p>
                  )}
                  {result.parsed.pinyin && !result.parsed.ipa && (
                    <p className={`text-xs mt-0.5 ${langMeta.accentClass}`}>{result.parsed.pinyin}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 dark:text-gray-500 space-y-0.5 shrink-0">
                  {result.parsed.pos && <span className="block uppercase tracking-wide">{result.parsed.pos}</span>}
                  {result.parsed.gender && (
                    <span className="block">{result.parsed.gender === 'masculine' ? '♂ masc.' : '♀ fem.'}</span>
                  )}
                </div>
              </div>

              {/* Definitions */}
              {result.parsed.definitions.length > 0 && (
                <ol className="space-y-1 mb-2">
                  {result.parsed.definitions.map((def, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-200 text-sm">
                      <span className="text-gray-400 dark:text-gray-500 mr-1">{i + 1}.</span>{def}
                    </li>
                  ))}
                </ol>
              )}

              {/* Example */}
              {result.parsed.example && (
                <p className="text-xs italic text-gray-500 dark:text-gray-400 border-l-2 border-gray-200 dark:border-gray-600 pl-2 mb-3">
                  "{result.parsed.example}"
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={saveToPending}
                  disabled={saved}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    saved
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                      : `${langMeta.bgClass} text-white hover:opacity-90`
                  }`}
                >
                  {saved ? '✓ Saved to pending' : '+ Save to pending'}
                </button>
                {externalLinks(result.word, lang, direction).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} word${pendingCount > 1 ? 's' : ''} in pending queue`
              : 'No pending words'}
          </span>
          <span className="text-xs text-gray-300 dark:text-gray-600">Esc to close</span>
        </div>
      </div>
    </div>
  )
}
