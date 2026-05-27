import { useState, useEffect, useCallback } from 'react'

const WIKT_API = 'https://en.wiktionary.org/w/api.php'
const WIKT_LANG = { french: 'French', russian: 'Russian', chinese: 'Chinese' }

// ---------------------------------------------------------------------------
// Wikitext parser — extracts IPA, definition, example, POS from a language
// section of English Wiktionary wikitext.
// ---------------------------------------------------------------------------
function parseWikitext(wikitext, targetLang) {
  // Split into top-level ==Language== sections
  const parts = wikitext.split(/(?=\n==[^=][^=]*==\n)/)
  let langSection = null
  for (const part of parts) {
    const header = part.match(/^[\n]*==([^=]+)==\n/)
    if (header && header[1].trim().toLowerCase() === targetLang.toLowerCase()) {
      langSection = part
      break
    }
  }
  if (!langSection) return null

  // IPA — e.g. {{IPA|fr|/mɛ.zɔ̃/}}
  const ipaMatch = langSection.match(/\{\{IPA\|[^|]*\|([^|}]+)/)
  const ipa = ipaMatch ? ipaMatch[1].trim() : null

  // Part of speech — first ===Noun/Verb/Adjective/...=== heading
  const posMatch = langSection.match(
    /===\s*(Noun|Verb|Adjective|Adverb|Pronoun|Phrase|Interjection|Conjunction|Preposition|Particle)\s*===/
  )
  const pos = posMatch ? posMatch[1].toLowerCase() : null

  // Gender (French nouns)
  let gender = null
  if (/\{\{fr-noun\|m/.test(langSection) || /g=m/.test(langSection)) gender = 'masculine'
  else if (/\{\{fr-noun\|f/.test(langSection) || /g=f/.test(langSection)) gender = 'feminine'

  // Definitions — lines starting with exactly one # (not ## or #:)
  const rawDefs = [...langSection.matchAll(/^# ([^#:\n][^\n]*)/gm)]
    .map((m) =>
      m[1]
        .replace(/\{\{[^}]+\}\}/g, '')              // remove templates
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1') // [[link|text]] → text
        .replace(/'{2,3}/g, '')                     // remove bold/italic
        .replace(/^\s*[:;]\s*/, '')
        .trim()
    )
    .filter(Boolean)

  // Example — prefer {{ux|lang|text}} template, fall back to #: ''text''
  const uxMatch = langSection.match(/\{\{ux\|[^|]+\|([^|}\n]+)/)
  const italicMatch = langSection.match(/^#: ''([^']+)''/m)
  const example = uxMatch
    ? uxMatch[1].trim()
    : italicMatch
    ? italicMatch[1].trim()
    : null

  // Chinese: extract pinyin from {{zh-pron|m=...}} or {{zh-l|...}}
  let pinyin = null
  const pinyinMatch = langSection.match(/\|m=([a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+)/i)
  if (pinyinMatch) pinyin = pinyinMatch[1].trim().split('\n')[0].split('|')[0].trim()

  return {
    ipa,
    pos,
    gender,
    pinyin,
    definitions: rawDefs.slice(0, 3),
    definition: rawDefs[0] || null,
    example,
  }
}

// ---------------------------------------------------------------------------
// Build a pending entry in the repo vocab schema
// ---------------------------------------------------------------------------
function buildEntry(word, parsed, lang) {
  const base = {
    id: '',
    translation: parsed.definition || '',
    tags: ['lookup'],
    source: 'wiktionary',
    verified: false,
  }
  if (parsed.example) {
    base.example = parsed.example
    base.example_translation = ''
  }
  if (lang === 'chinese') {
    return {
      ...base,
      simplified: word,
      traditional: '',
      pinyin: parsed.pinyin || parsed.ipa || '',
    }
  }
  return {
    ...base,
    word,
    pronunciation: parsed.ipa || '',
    ...(lang === 'french' && parsed.gender ? { gender: parsed.gender } : {}),
  }
}

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
// Pending queue panel
// ---------------------------------------------------------------------------
function PendingPanel({ pending, onRemove, onExport, onClear, langMeta }) {
  if (pending.length === 0) return null
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Pending words ({pending.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className={`px-3 py-1 rounded-lg text-xs font-medium ${langMeta.bgClass} text-white hover:opacity-90`}
          >
            ↓ Export JSON
          </button>
          <button
            onClick={onClear}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-2">
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

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        After export, run:{' '}
        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded font-mono">
          python scripts/import_pending.py --file pending_*.json --lang LANG --topic TOPIC
        </code>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main LookupView component
// ---------------------------------------------------------------------------
export default function LookupView({ lang, langMeta }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null) // { word, parsed }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState([])
  const [savedWord, setSavedWord] = useState(null)

  const storageKey = `ll_pending_${lang}`

  // Load pending list from localStorage when language changes
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
  }, [lang, storageKey])

  const search = useCallback(async () => {
    const word = query.trim()
    if (!word) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSavedWord(null)
    try {
      const url =
        `${WIKT_API}?action=parse&page=${encodeURIComponent(word)}` +
        `&prop=wikitext&format=json&origin=*`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Network error: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error.info)
      const wikitext = data.parse?.wikitext?.['*'] || ''
      const parsed = parseWikitext(wikitext, WIKT_LANG[lang])
      if (!parsed || !parsed.definition) {
        setError(
          `No ${WIKT_LANG[lang]} entry found on Wiktionary for "${word}". ` +
            `Try the exact form (e.g. "maison", not "maisons").`
        )
      } else {
        setResult({ word, parsed })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [query, lang])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search()
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

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h2 className={`text-xl font-bold ${langMeta.accentClass} mb-1`}>
        🔍 Word Lookup
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Look up a word via Wiktionary and save it to your pending queue for import.
      </p>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            lang === 'chinese'
              ? 'Enter characters, e.g. 苹果'
              : lang === 'russian'
              ? 'Enter Cyrillic word, e.g. дом'
              : 'Enter word, e.g. maison'
          }
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-opacity-50"
          style={{ '--tw-ring-color': 'var(--accent)' }}
          autoFocus
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className={`px-5 py-2 rounded-lg font-medium text-white transition-all ${langMeta.bgClass} disabled:opacity-40`}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>

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

      {/* Pending queue */}
      <PendingPanel
        pending={pending}
        onRemove={removePending}
        onExport={exportPending}
        onClear={clearPending}
        langMeta={langMeta}
      />
    </div>
  )
}
